import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

async function getRelevantDocuments(question: string, practitionerId: string): Promise<string> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const queryEmbedding = embeddingResponse.data[0]?.embedding;
    if (!queryEmbedding) return "";

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      practitioner_id: practitionerId,
      match_count: 5,
    });

    if (!data || data.length === 0) return "";

    const relevant = (data as { content: string; similarity: number }[])
      .filter((d) => d.similarity > 0.5)
      .map((d) => d.content)
      .join("\n\n");

    return relevant ? `\nDOCUMENTS DE RÉFÉRENCE DU PRATICIEN :\n${relevant}\n` : "";
  } catch {
    return "";
  }
}

async function getPatientProfile(patientId: string): Promise<string> {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data } = await supabase
      .from("patients")
      .select("first_name, last_name, age, objective, pathologies, allergies, notes")
      .eq("user_id", patientId)
      .single();

    if (!data) return "";

    const parts = [];
    if (data.first_name) parts.push(`Prénom : ${data.first_name}`);
    if (data.age) parts.push(`Âge : ${data.age} ans`);
    if (data.objective) parts.push(`Objectif : ${data.objective}`);
    if (data.pathologies) parts.push(`Pathologies : ${data.pathologies}`);
    if (data.allergies) parts.push(`Allergies : ${data.allergies}`);
    if (data.notes) parts.push(`Notes : ${data.notes}`);

    return parts.length > 0 ? `\nPROFIL DU PATIENT :\n${parts.join("\n")}\n` : "";
  } catch {
    return "";
  }
}

async function getConversationHistory(
  patientId: string,
  practitionerId: string,
  sessionId?: string
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from("conversations")
      .select("role, content")
      .eq("patient_id", patientId)
      .eq("practitioner_id", practitionerId)
      .order("created_at", { ascending: true })
      .limit(20);

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

    const { data } = await query;
    if (!data || data.length === 0) return [];

    return data as { role: "user" | "assistant"; content: string }[];
  } catch {
    return [];
  }
}

async function getPractitionerSystemPrompt(
  practitionerId?: string,
  question?: string,
  patientId?: string
): Promise<string> {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const query = supabase.from("practitioner_profiles").select("*").limit(1);
    if (practitionerId) {
      query.eq("user_id", practitionerId);
    }
    const { data } = await query.single();
    if (!data) return getDefaultPrompt();

    let documentsContext = "";
    if (practitionerId && question) {
      documentsContext = await getRelevantDocuments(question, practitionerId);
    }

    let patientContext = "";
    if (patientId) {
      patientContext = await getPatientProfile(patientId);
    }

    return `Tu es le jumeau numérique d'un nutritionniste. Voici comment tu dois te comporter :

COMMUNICATION :
- Ton : ${data.tone_of_voice || "bienveillant et professionnel"}
- Tutoiement/Vouvoiement : ${data.tutoiement || "vouvoiement"}
- Niveau de langage : ${data.technicite || "adaptatif"}
- Longueur des réponses : ${data.longueur_reponses || "courtes et directes"}
- Emojis : ${data.emojis || "avec modération"}

PHILOSOPHIE NUTRITIONNELLE :
- Approche générale : ${data.approche_generale || "rééquilibrage alimentaire"}
- Pathologies principales : ${data.pathologies || "généraliste"}
- Position sur les régimes : ${data.position_regimes || "cas par cas"}
- Position sur les glucides : ${data.position_glucides || "selon l'objectif"}
- Jeûne intermittent : ${data.jejune || "cas par cas"}
- Compléments alimentaires : ${data.complements || "cas par cas"}
- Petit-déjeuner : ${data.petit_dejeuner || "selon le patient"}
- Budget/lifestyle : ${data.lifestyle_budget || "pragmatique"}
- Ce que je ne prescris jamais : ${data.jamais_dire || "rien de spécifique"}
- Ma règle d'or : ${data.conviction || "non spécifiée"}

GESTION HUMAINE :
- Gestion des écarts : ${data.gestion_ecarts || "sans culpabilité"}
- Manger ses émotions : ${data.emotions || "approche globale"}
- Patient qui ne suit pas : ${data.non_suivi || "bienveillance"}
- Fêtes et vacances : ${data.fetes_vacances || "équilibre sur la durée"}
- Comment remotiver : ${data.motivation_berne || "valoriser les progrès"}
- Ma posture : ${data.posture || "bienveillant"}

SÉCURITÉ :
- Périmètre : ${data.perimetre || "prudence sur les pathologies"}
- Questions médicales complexes : ${data.questions_medicales || "rediriger vers le praticien"}
- Détresse psychologique : ${data.urgence_detresse || "exprimer de l'empathie et alerter"}
- Ligne rouge absolue : ${data.ligne_rouge || "ne jamais culpabiliser"}

MON APPROCHE EN MES MOTS :
${data.approche_libre || "Approche bienveillante et personnalisée."}

EXEMPLES DE MES RÉPONSES :
- Face à un craquage : "${data.situation1 || "Un écart, ça arrive. On repart ensemble."}"
- Face à un régime à la mode : "${data.situation2 || "Je préfère qu'on trouve ce qui vous convient vraiment."}"
- Face à un patient qui décroche : "${data.situation3 || "Je suis là quand vous êtes prêt(e)."}"
- Face à une question médicale : "${data.situation4 || "C'est une question importante, parlons-en avec votre médecin."}"
- Face à une victoire : "${data.situation5 || "C'est fantastique ! Je suis fier(e) de vous."}"
- Face à une détresse émotionnelle : "${data.situation6 || "Je vous entends. Vous n'êtes pas seul(e)."}"
${patientContext}${documentsContext}
RÈGLES ABSOLUES :
- Réponds TOUJOURS sans markdown, sans ## ni **
- Phrases simples et naturelles, bien aérées
- Saute des lignes entre les idées pour faciliter la lecture
- Tu ES ce praticien — pas un assistant générique
- Utilise le prénom du patient si tu le connais
- Si une question dépasse ton périmètre, dis-le clairement et oriente vers le praticien`;
  } catch {
    return getDefaultPrompt();
  }
}

function getDefaultPrompt(): string {
  return "Tu es un assistant nutritionniste. Réponds sans markdown, sans ## ni **, en phrases simples et naturelles bien aérées.";
}

export async function POST(request: Request) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { message, systemPrompt, patientId, practitionerId, sessionId } = await request.json() as {
      message: string;
      systemPrompt?: string;
      patientId?: string;
      practitionerId?: string;
      sessionId?: string;
    };

    const practitionerPrompt = await getPractitionerSystemPrompt(practitionerId, message, patientId);

    // Récupérer l'historique de conversation
    let conversationHistory: { role: "user" | "assistant"; content: string }[] = [];
    if (patientId && practitionerId) {
      conversationHistory = await getConversationHistory(patientId, practitionerId, sessionId);
    }

    // Construire les messages avec l'historique
    const messages: { role: "user" | "assistant"; content: string }[] = [
      ...conversationHistory,
      { role: "user", content: message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: systemPrompt || practitionerPrompt,
      messages,
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock?.text ?? "Aucune reponse recue.";

    if (patientId) {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      await supabase.from("conversations").insert([
        {
          patient_id: patientId,
          practitioner_id: practitionerId,
          role: "user",
          content: message,
          session_id: sessionId ?? null,
        },
        {
          patient_id: patientId,
          practitioner_id: practitionerId,
          role: "assistant",
          content: text,
          session_id: sessionId ?? null,
        },
      ]);

      if (sessionId) {
        await supabase
          .from("conversations_sessions")
          .update({
            last_message: text.slice(0, 100),
            last_message_at: new Date().toISOString(),
          })
          .eq("id", sessionId);
      }
    }

    return Response.json({ response: text });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return Response.json({ response: "Erreur: " + errorMessage }, { status: 500 });
  }
}
