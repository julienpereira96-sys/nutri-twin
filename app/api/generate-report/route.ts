import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { patientId, practitionerId, dateFrom, dateTo } = await request.json() as {
      patientId: string;
      practitionerId: string;
      dateFrom: string;
      dateTo: string;
    };

    if (!patientId || !practitionerId || !dateFrom || !dateTo) {
      return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
    }

    if (user.id !== practitionerId) return forbidden();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [{ data: journalEntries }, { data: chatMessages }, { data: patient }] = await Promise.all([
      supabase
        .from("journal_entries")
        .select("date, mood, food_rating, emotions, content")
        .eq("patient_id", patientId)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .order("date", { ascending: true }),
      supabase
        .from("conversations")
        .select("role, content, created_at")
        .eq("patient_id", patientId)
        .eq("practitioner_id", practitionerId)
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .order("created_at", { ascending: true }),
      supabase
        .from("patients")
        .select("first_name, last_name, age, pathologies, objective, objectif_clinique")
        .eq("user_id", patientId)
        .single(),
    ]);

    const firstName = (patient as { first_name?: string } | null)?.first_name ?? "le patient";
    const patientMessages = (chatMessages ?? []).filter(m => m.role === "user");
    const messageCount = patientMessages.length;

    // Moins de 5 messages → message honnête
    if (messageCount < 5 && (!journalEntries || journalEntries.length === 0)) {
      return NextResponse.json({
        lowData: true,
        message: `${firstName} n'a que peu d'activité sur cette période (${messageCount} message${messageCount > 1 ? "s" : ""} de chat, ${journalEntries?.length ?? 0} entrée${(journalEntries?.length ?? 0) > 1 ? "s" : ""} de journal). Il n'y a pas encore suffisamment de données pour générer un rapport pertinent. Essayez une période plus longue ou revenez après quelques échanges supplémentaires.`,
      });
    }

    // Construire les données de contexte
    let journalSection = "";
    if (journalEntries && journalEntries.length > 0) {
      const avgMood = (journalEntries.reduce((sum, e) => sum + (e.mood as number), 0) / journalEntries.length).toFixed(1);
      const avgFood = (journalEntries.reduce((sum, e) => sum + (e.food_rating as number), 0) / journalEntries.length).toFixed(1);
      const allEmotions = journalEntries.flatMap(e => (e.emotions as string[]) ?? []);
      const emotionCounts: Record<string, number> = {};
      allEmotions.forEach(em => { emotionCounts[em] = (emotionCounts[em] ?? 0) + 1; });
      const topEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([em, count]) => `${em} (${count}x)`).join(", ");
      const notes = journalEntries.filter(e => e.content).map(e => `${e.date}: "${(e.content as string).slice(0, 120)}"`).join(" | ");
      journalSection = `JOURNAL DE BORD (${journalEntries.length} entrées, du ${dateFrom} au ${dateTo}) :
- Humeur moyenne : ${avgMood}/10
- Alimentation moyenne : ${avgFood}/3
- Émotions dominantes : ${topEmotions || "non renseignées"}
${notes ? `- Notes : ${notes}` : ""}`;
    }

    const chatSection = messageCount > 0
      ? `CONVERSATIONS PATIENT (${messageCount} messages) :
${patientMessages.slice(-30).map(m => `- ${(m.content as string).slice(0, 200)}`).join("\n")}`
      : "";

    const patientProfile = [
      (patient as { age?: number } | null)?.age ? `Âge : ${(patient as { age?: number }).age} ans` : "",
      (patient as { pathologies?: string } | null)?.pathologies ? `Pathologies : ${(patient as { pathologies?: string }).pathologies}` : "",
      (patient as { objectif_clinique?: string } | null)?.objectif_clinique ? `Objectif clinique : ${(patient as { objectif_clinique?: string }).objectif_clinique}` : "",
      (patient as { objective?: string } | null)?.objective ? `Objectif personnel : ${(patient as { objective?: string }).objective}` : "",
    ].filter(Boolean).join(" | ");

    const prompt = `Tu es l'assistant d'un nutritionniste. Génère un compte rendu professionnel pour ${firstName} sur la période du ${dateFrom} au ${dateTo}.

${patientProfile ? `PROFIL : ${patientProfile}\n\n` : ""}${journalSection ? `${journalSection}\n\n` : ""}${chatSection ? `${chatSection}\n\n` : ""}Génère EXACTEMENT les 4 sections suivantes, basées UNIQUEMENT sur les données fournies. N'invente aucune information. Si une section n'a pas de données suffisantes, dis-le honnêtement en une phrase.

- synthese : Vue d'ensemble de la période (2-3 phrases). Ton clinique et factuel.
- patterns : Patterns comportementaux ou émotionnels observés dans les données (2-4 phrases). Ne cite que ce qui est documenté.
- victoires : Points positifs et progrès concrets constatés sur la période (1-3 phrases). Si aucun n'est visible dans les données, dis-le simplement.
- murmures_bilan : Points à approfondir lors de la prochaine consultation, basés sur les signaux observés (2-4 phrases).

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks :
{"synthese": "...", "patterns": "...", "victoires": "...", "murmures_bilan": "..."}`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { maxOutputTokens: 1000, temperature: 0.5 },
    });

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim().replace(/```json|```/g, "").trim();

    const report = JSON.parse(rawText) as { synthese: string; patterns: string; victoires: string; murmures_bilan: string };

    return NextResponse.json({ report });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("generate-report error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
