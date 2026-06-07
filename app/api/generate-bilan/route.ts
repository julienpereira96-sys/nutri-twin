import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { patientId, practitionerId } = await request.json() as {
      patientId: string;
      practitionerId: string;
    };

    if (!patientId || !practitionerId) {
      return NextResponse.json({ error: "patientId et practitionerId requis." }, { status: 400 });
    }

    if (user.id !== practitionerId) return forbidden();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Lire le curseur actuel pour ce patient
    const { data: practitionerRow } = await supabase
      .from("practitioners")
      .select("bilan_cursors")
      .eq("user_id", practitionerId)
      .single();

    const cursors = (practitionerRow?.bilan_cursors as Record<string, string> | null) ?? {};
    const lastCursor = cursors[patientId] ?? null;

    // Récupérer les données du patient en parallèle
    let conversationsQuery = supabase
      .from("conversations")
      .select("role, content, created_at")
      .eq("patient_id", patientId)
      .eq("practitioner_id", practitionerId)
      .order("created_at", { ascending: false })
      .limit(100);

    // Filtrer après le curseur si présent
    if (lastCursor) {
      conversationsQuery = conversationsQuery.gt("created_at", lastCursor);
    }

    const [{ data: chatMessages }, { data: journalEntries }, { data: patient }, { data: sosEventsRaw }] = await Promise.all([
      conversationsQuery,
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
      // Épisodes Mon Soutien depuis le curseur (ou tout si pas de curseur)
      lastCursor
        ? supabase
            .from("sos_events")
            .select("triggered_at, sos_context, raw_response")
            .eq("patient_id", patientId)
            .gt("triggered_at", lastCursor)
            .order("triggered_at", { ascending: false })
            .limit(20)
        : supabase
            .from("sos_events")
            .select("triggered_at, sos_context, raw_response")
            .eq("patient_id", patientId)
            .order("triggered_at", { ascending: false })
            .limit(20),
    ]);

    const firstName = (patient as { first_name?: string } | null)?.first_name ?? "le patient";

    // Compter les messages patient depuis le curseur
    const patientMessages = (chatMessages ?? []).filter(m => m.role === "user");
    const messageCount = patientMessages.length;

    // Si moins de 5 messages depuis le dernier bilan, retourner un message honnête
    if (messageCount < 5) {
      const sinceText = lastCursor
        ? "depuis votre dernière préparation de séance"
        : "dans l'historique";
      return NextResponse.json({
        lowData: true,
        message: `${firstName} n'a envoyé que ${messageCount} message${messageCount > 1 ? "s" : ""} ${sinceText}. Il n'y a pas encore suffisamment d'échanges pour générer des questions pertinentes. Revenez après quelques nouvelles conversations.`,
      });
    }

    const chatData = patientMessages
      .slice(0, 20)
      .map(m => (m.content as string).slice(0, 200))
      .join(" | ");

    const journalData = (journalEntries ?? [])
      .map(e => {
        const emotions = (e.emotions as string[])?.join(", ") || "non renseignées";
        const note = e.content ? ` - "${(e.content as string).slice(0, 100)}"` : "";
        return `${e.date}: humeur ${e.mood}/10, alimentation ${e.food_rating}/3, émotions: ${emotions}${note}`;
      })
      .join(" | ") || "Pas d'entrées journal";

    const patientProfile = [
      (patient as { age?: number } | null)?.age ? `Âge : ${(patient as { age?: number }).age} ans` : "",
      (patient as { pathologies?: string } | null)?.pathologies ? `Pathologies : ${(patient as { pathologies?: string }).pathologies}` : "",
      (patient as { objectif_clinique?: string } | null)?.objectif_clinique ? `Objectif clinique : ${(patient as { objectif_clinique?: string }).objectif_clinique}` : "",
      (patient as { objective?: string } | null)?.objective ? `Objectif personnel : ${(patient as { objective?: string }).objective}` : "",
    ].filter(Boolean).join(" | ") || "";

    // Construire la section Mon Soutien
    const toolNames: Record<string, string> = {
      breathing: "Cohérence cardiaque", ancrage: "Ancrage sensoriel", marche: "Marche consciente",
      manger: "Pleine conscience alimentaire", body_scan: "Body scan", defusion: "Défusion cognitive",
      ecriture: "Écriture cathartique", adaptive_coaching: "Coaching personnalisé",
    };
    type SosEventRow = { triggered_at: string; sos_context: string; raw_response?: { tool_id?: string } | null };
    const sosEpisodes = (sosEventsRaw ?? []) as SosEventRow[];
    const sosSection = sosEpisodes.length > 0
      ? `ÉPISODES MON SOUTIEN DEPUIS LE DERNIER BILAN (${sosEpisodes.length} déclenchement${sosEpisodes.length > 1 ? "s" : ""}) :\n` +
        sosEpisodes.map(ev => {
          const date = new Date(ev.triggered_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
          const context = ev.sos_context?.split(" | ")[0] ?? "non précisé";
          const toolId = ev.raw_response?.tool_id;
          const exercise = toolId ? (toolNames[toolId] ?? toolId) : "exercice non précisé";
          return `  - ${date} : ${context} → ${exercise}`;
        }).join("\n")
      : "";

    const prompt = `Tu es l'assistant d'un nutritionniste qui prépare sa prochaine consultation avec ${firstName}.

${patientProfile ? `PROFIL PATIENT :\n${patientProfile}\n\n` : ""}MESSAGES DU PATIENT DEPUIS LE DERNIER BILAN (${messageCount} messages) :
${chatData}

JOURNAL DES 14 DERNIERS JOURS :
${journalData}
${sosSection ? `\n${sosSection}\n` : ""}
Génère exactement 3 questions clés que le praticien devrait poser lors de la prochaine consultation. Les questions doivent être précises, personnalisées et montrer que le praticien a suivi de près l'évolution du patient.${sosSection ? " Intègre les épisodes Mon Soutien si pertinents pour comprendre l'état émotionnel du patient." : ""}

Pour chaque question :
- "question" : la question à poser, formulée directement au patient
- "justification" : pourquoi cette question est importante, basée sur les données observées
- "objectif" : l'objectif clinique visé par cette question

N'invente aucune donnée non présente dans les échanges. Si un point n'est pas documenté, ne le mentionne pas.

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks :
[
  {"question": "...", "justification": "...", "objectif": "..."},
  {"question": "...", "justification": "...", "objectif": "..."},
  {"question": "...", "justification": "...", "objectif": "..."}
]`;

    let questions: { question: string; justification: string; objectif: string }[];
    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-3-flash-preview",
        generationConfig: { maxOutputTokens: 800, temperature: 0.6 },
      });
      const result = await model.generateContent(prompt);
      const rawText = result.response.text().trim().replace(/```json|```/g, "").trim();
      questions = JSON.parse(rawText) as typeof questions;
      if (!Array.isArray(questions) || questions.length === 0 || !questions[0].question) throw new Error("Structure JSON invalide");
    } catch {
      return NextResponse.json(
        { error: "Une erreur est survenue lors de la génération du bilan. Veuillez réessayer dans quelques instants." },
        { status: 502 }
      );
    }

    // Mettre à jour le curseur avec le timestamp du message le plus récent
    const newestMessage = (chatMessages ?? []).reduce((latest, msg) => {
      const t = new Date(msg.created_at as string).getTime();
      return t > latest ? t : latest;
    }, 0);

    if (newestMessage > 0) {
      const newCursors = { ...cursors, [patientId]: new Date(newestMessage).toISOString() };
      await supabase
        .from("practitioners")
        .update({ bilan_cursors: newCursors })
        .eq("user_id", practitionerId);
    }

    return NextResponse.json({ questions });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    console.error("generate-bilan error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
