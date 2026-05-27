import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(request: Request) {
  try {
    const { patientId, practitionerId } = await request.json() as {
      patientId: string;
      practitionerId: string;
    };

    if (!patientId || !practitionerId) {
      return NextResponse.json({ error: "patientId et practitionerId requis." }, { status: 400 });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Récupérer les données du patient en parallèle
    const [{ data: chatMessages }, { data: journalEntries }, { data: patient }] = await Promise.all([
      supabase
        .from("conversations")
        .select("role, content, created_at")
        .eq("patient_id", patientId)
        .eq("practitioner_id", practitionerId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("journal_entries")
        .select("date, mood, food_rating, emotions, content")
        .eq("patient_id", patientId)
        .order("date", { ascending: false })
        .limit(14),
      supabase
        .from("patients")
        .select("first_name, last_name, age, pathologies, objective, objectif_clinique")
        .eq("user_id", patientId)
        .single(),
    ]);

    const firstName = (patient as { first_name?: string } | null)?.first_name ?? "le patient";

    const chatData = (chatMessages ?? [])
      .filter(m => m.role === "user")
      .slice(0, 20)
      .map(m => (m.content as string).slice(0, 200))
      .join(" | ") || "Pas de conversations récentes";

    const journalData = (journalEntries ?? [])
      .map(e => {
        const emotions = (e.emotions as string[])?.join(", ") || "non renseignées";
        const note = e.content ? ` — "${(e.content as string).slice(0, 100)}"` : "";
        return `${e.date}: humeur ${e.mood}/10, alimentation ${e.food_rating}/3, émotions: ${emotions}${note}`;
      })
      .join(" | ") || "Pas d'entrées journal";

    const patientProfile = [
      (patient as { age?: number } | null)?.age ? `Âge : ${(patient as { age?: number }).age} ans` : "",
      (patient as { pathologies?: string } | null)?.pathologies ? `Pathologies : ${(patient as { pathologies?: string }).pathologies}` : "",
      (patient as { objectif_clinique?: string } | null)?.objectif_clinique ? `Objectif clinique : ${(patient as { objectif_clinique?: string }).objectif_clinique}` : "",
      (patient as { objective?: string } | null)?.objective ? `Objectif personnel : ${(patient as { objective?: string }).objective}` : "",
    ].filter(Boolean).join(" | ") || "";

    const prompt = `Tu es l'assistant d'un nutritionniste qui prépare sa prochaine consultation avec ${firstName}.

${patientProfile ? `PROFIL PATIENT :\n${patientProfile}\n\n` : ""}DERNIERS ÉCHANGES CHAT (messages du patient) :
${chatData}

JOURNAL DES 14 DERNIERS JOURS :
${journalData}

Génère exactement 3 questions clés que le praticien devrait poser lors de la prochaine consultation. Les questions doivent être précises, personnalisées et montrer que le praticien a suivi de près l'évolution du patient. Chaque question doit avoir un contexte expliquant pourquoi elle est importante.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks :
[
  {"question": "...", "contexte": "..."},
  {"question": "...", "contexte": "..."},
  {"question": "...", "contexte": "..."}
]`;

    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash",
      generationConfig: { maxOutputTokens: 600, temperature: 0.6 },
    });

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim().replace(/```json|```/g, "").trim();

    // Valider que c'est bien du JSON
    const questions = JSON.parse(rawText) as { question: string; contexte: string }[];

    return NextResponse.json({ questions });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("generate-bilan error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
