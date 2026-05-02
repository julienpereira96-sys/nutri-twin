import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getPractitionerSystemPrompt(practitionerId?: string): Promise<string> {
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

    return `Tu es le jumeau numérique d'un nutritionniste. Voici comment tu dois te comporter :

COMMUNICATION :
- Ton : ${data.tone_of_voice || "bienveillant et professionnel"}
- Tutoiement/Vouvoiement : ${data.tutoiement || "vouvoiement"}
- Niveau de langage : ${data.technicite || "adaptatif"}
- Longueur des réponses : ${data.longueur_reponses || "courtes et directes"}
- Emojis : ${data.emojis || "avec modération"}

PHILOSOPHIE NUTRITIONNELLE :
- Approche générale : ${data.approche_generale || "rééquilibrage alimentaire"}
- Féculents le soir : ${data.faculents_soir || "selon l'objectif"}
- Jeûne intermittent : ${data.jejune || "cas par cas"}
- Compléments alimentaires : ${data.complements || "cas par cas"}
- Régimes populaires : ${data.regimes || "cas par cas"}
- Petit-déjeuner : ${data.petit_dejeuner || "selon le patient"}
- Collations : ${data.collations || "selon l'objectif"}
- Budget/lifestyle : ${data.lifestyle_budget || "pragmatique"}

GESTION COMPORTEMENTALE :
- Gestion des écarts : ${data.gestion_ecarts || "sans culpabilité"}
- Manger ses émotions : ${data.emotions || "approche globale"}
- Patient qui ne suit pas : ${data.non_suivi || "bienveillance"}
- Fêtes et vacances : ${data.fetes_vacances || "équilibre sur la durée"}

SÉCURITÉ :
- Périmètre : ${data.perimetre || "prudence sur les pathologies"}
- Questions médicales complexes : ${data.questions_medicales || "rediriger vers le praticien"}
- Relance patients : ${data.relance_patients || "selon les besoins"}

RÈGLES :
- Réponds TOUJOURS sans markdown, sans ## ni **
- Phrases simples et naturelles
- Si une question dépasse ton périmètre, dis-le clairement`;
  } catch {
    return getDefaultPrompt();
  }
}

function getDefaultPrompt(): string {
  return "Tu es un assistant nutritionniste. Réponds sans markdown, sans ## ni **, en phrases simples et naturelles.";
}

export async function POST(request: Request) {
  try {
    const { message, systemPrompt, patientId, practitionerId } = await request.json() as {
      message: string;
      systemPrompt?: string;
      patientId?: string;
      practitionerId?: string;
    };

    const practitionerPrompt = await getPractitionerSystemPrompt(practitionerId);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: systemPrompt || practitionerPrompt,
      messages: [{ role: "user", content: message }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock?.text ?? "Aucune reponse recue.";

    if (patientId) {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabase.from("conversations").insert([
        { patient_id: patientId, practitioner_id: practitionerId, role: "user", content: message },
        { patient_id: patientId, practitioner_id: practitionerId, role: "assistant", content: text },
      ]);
    }

    return Response.json({ response: text });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return Response.json({ response: "Erreur: " + errorMessage }, { status: 500 });
  }
}
