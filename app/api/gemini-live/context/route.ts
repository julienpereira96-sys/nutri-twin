/**
 * /api/gemini-live/context
 *
 * Construit et retourne le system prompt condensé (<500 tokens) pour
 * la session Gemini Live SOS. Inclut le profil clinique du patient
 * et une fenêtre glissante des 5 derniers jours de conversations.
 *
 * POST { patientId, practitionerId }
 * → { systemPrompt: string, patientName: string }
 *
 * ⚠️  La clé API Gemini reste côté client (NEXT_PUBLIC) pour la phase
 *     de test. À remplacer par un relay WebSocket serveur en production.
 */

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type PatientRow = {
  first_name: string;
  last_name: string;
  age: number | null;
  defi: string | null;
  pathologies: string | null;
  motivation: string | null;
  practitioner_instruction: string | null;
  emotional_status: string | null;
};

type ConversationRow = {
  role: string;
  content: string;
  created_at: string;
};

function buildSystemPrompt(patient: PatientRow, recentConvs: ConversationRow[]): string {
  const name = patient.first_name ?? "le patient";

  // Recent conversation context (last ~5 messages, truncated)
  const journalLines = recentConvs
    .slice(0, 8)
    .map(m => {
      const role = m.role === "user" ? name : "Jumeau";
      const preview = m.content.replace(/\n/g, " ").slice(0, 120);
      return `${role}: ${preview}`;
    })
    .join("\n");

  return `Tu es le Jumeau Numérique thérapeutique de ${name}. Tu entres en MODE SOS — une crise est active.

PROFIL PATIENT :
- Prénom : ${name}
- Âge : ${patient.age ?? "non renseigné"}
- Défi principal : ${patient.defi ?? "gestion alimentaire émotionnelle"}
- Pathologies/contexte : ${patient.pathologies ?? "non renseigné"}
- Motivation profonde : ${patient.motivation ?? "non renseignée"}
- Instruction praticien : ${patient.practitioner_instruction ?? "aucune"}
- Statut émotionnel actuel : ${patient.emotional_status ?? "inconnu"}

CONTEXTE RÉCENT (5 derniers jours) :
${journalLines || "(aucun échange récent)"}

RÈGLES ABSOLUES — MODE SOS :

GÉNÉRALES (tout au long) :
- Parle UNIQUEMENT en français, voix douce, lente, basse (co-régulation parasympathique)
- JAMAIS de texte visible — réponse AUDIO uniquement
- Ton = thérapeute bienveillant, jamais condescendant, jamais clinique

PHASE ACCUEIL :
- Commence par accueillir ${name} par son prénom
- Si le contexte récent révèle un stress particulier, personnalise l'accueil naturellement (sans citer les logs)

PHASE ÉCOUTE :
- Laisse ${name} parler. N'interromps pas. Écoute vraiment.
- Si ce qu'il exprime est vague ou incomplet, pose UNE seule question ouverte pour l'inviter à aller plus loin — jamais une question fermée.

PHASE TRANSITION :
- Quand ${name} a pu exprimer ce qui ne va pas — même brièvement — valide ce qu'il vient de partager, puis oriente-le naturellement vers l'exercice. Ne propose pas l'exercice si ${name} n'a encore rien dit ou n'a exprimé qu'une idée très vague sans avoir pu développer.
- Choix du mot d'exercice mental (dans ton discours uniquement) : APAISE, LIBERE, CALME ou LIBRE — selon l'état détecté
- Tu disposes de l'outil demarrer_exercice_respiration — appelle-le dès que ${name} est prêt (il l'a demandé explicitement, ou il s'est suffisamment exprimé). Ne propose JAMAIS l'exercice uniquement à voix haute : sans appel à cet outil, l'exercice ne démarre pas à l'écran. Ne pose jamais de question fermée (oui/non) avant d'appeler l'outil. Si tu proposes l'exercice, fais-le comme une invitation naturelle — pas comme une demande de confirmation.

PHASE CLÔTURE (uniquement après l'exercice respiratoire) :
- Pose UNE seule question ouverte et chaleureuse adaptée à ce qu'il a dit
- Si ${name} exprime que l'exercice n'a pas suffi ou qu'il se sent encore en difficulté : conclus avec bienveillance et fais-lui comprendre que tu restes disponible dans le chat. Ne propose pas un autre exercice.`;
}

export async function POST(request: NextRequest) {
  let body: { patientId: string; practitionerId: string };
  try {
    body = await request.json() as { patientId: string; practitionerId: string };
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { patientId, practitionerId } = body;
  if (!patientId || !practitionerId) {
    return Response.json({ error: "missing_ids" }, { status: 400 });
  }

  const supabase = createSupabaseClient();

  // Fetch patient profile — `patients` n'a pas de colonne `practitioner_id`
  // (relation patient↔praticien modélisée via la table de liaison
  // `patient_practitioner`, jamais comme FK directe sur `patients`) ; filtrer
  // dessus ici faisait systématiquement échouer .single() (0 ligne), d'où le
  // fallback {} et "le patient" au lieu du prénom dans tout le system prompt.
  // Même convention que toutes les autres routes : filtre uniquement sur
  // user_id, practitionerId n'est plus utilisé pour cette requête.
  const { data: patientRaw } = await supabase
    .from("patients")
    .select("first_name, last_name, age, defi, pathologies, motivation, practitioner_instruction, emotional_status")
    .eq("user_id", patientId)
    .single();

  const patient = (patientRaw ?? {}) as PatientRow;

  // Fetch recent conversations (last 5 days)
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { data: convRaw } = await supabase
    .from("conversations")
    .select("role, content, created_at")
    .eq("patient_id", patientId)
    .gte("created_at", fiveDaysAgo)
    .order("created_at", { ascending: false })
    .limit(10);

  const recentConvs = (convRaw ?? []) as ConversationRow[];

  const systemPrompt = buildSystemPrompt(patient, recentConvs);
  const patientName = patient.first_name ?? "toi";

  return Response.json({ systemPrompt, patientName });
}
