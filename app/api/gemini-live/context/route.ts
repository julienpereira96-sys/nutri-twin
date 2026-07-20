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
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

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
  sexe: string | null;
  objective: string | null;
  objectif_clinique: string | null;
  defi: string | null;
  motivation: string | null;
  situation_vie: string | null;
  rythme_professionnel: string | null;
  pathologies: string | null;
  notes: string | null;
  practitioner_instruction: unknown;
  emotional_status: string | null;
};

type ConversationRow = {
  role: string;
  content: string;
  created_at: string;
};

type PractitionerProfile = {
  tone_of_voice?: string | null;
  tutoiement?: string | null;
  gestion_culpabilite?: string | null;
  vocabulaire_crise?: string | null;
  levier_motivation?: string | null;
  urgence_detresse?: string | null;
  ligne_rouge?: string | null;
  signature?: string | null;
};

function buildSystemPrompt(patient: PatientRow, recentConvs: ConversationRow[], practitioner?: PractitionerProfile | null): string {
  const name = patient.first_name ?? "le patient";

  // Label maps
  const levierLabels: Record<string, string> = {
    progres:    "Voir des progrès concrets",
    encourage:  "Se sentir encouragé(e)",
    comprendre: "Comprendre le fonctionnement",
    routine:    "Avoir une routine stricte",
    supervise:  "Savoir qu'il/elle est supervisé(e)",
    simplicite: "La simplicité des actions",
    autre:      "Autre",
  };
  const moodLabels: Record<string, string> = {
    abloc:     "Très motivé(e)",
    optimiste: "Optimiste",
    anxieux:   "Un peu anxieux(se)",
    sceptique: "Un peu sceptique",
    perdu:     "Complètement perdu(e)",
    fatigue:   "Volontaire mais fatigué(e)",
  };
  const defiLabels: Record<string, string> = {
    temps:      "Manque de temps",
    sucre:      "Pulsions sucrées",
    restaurant: "Repas au restaurant",
    motivation: "Manque de motivation",
    cuisine:    "Manque d'organisation en cuisine",
    stress:     "Manger sous le stress",
  };
  const situationVieLabels: Record<string, string> = {
    seul:    "Seul(e)",
    couple:  "En couple, sans enfants",
    famille: "En famille avec enfants",
    parents: "Chez ses parents",
  };
  const rythmeProfLabels: Record<string, string> = {
    bureau:     "Horaires bureau (9h-18h)",
    decale:     "Horaires décalés",
    teletravail:"Télétravail",
    etudiant:   "Étudiant(e)",
    sans_emploi:"Sans activité professionnelle",
  };

  // Extraire le sommeil du champ notes (pipe-separated)
  const sommeilNote = (() => {
    if (!patient.notes) return null;
    for (const seg of patient.notes.split(" | ")) {
      if (seg.startsWith("Sommeil:")) return seg.slice("Sommeil:".length).trim();
    }
    return null;
  })();

  // Parser practitioner_instruction (texte simple ou tableau JSON avec expiration)
  const murmureText = (() => {
    const instr = patient.practitioner_instruction;
    if (!instr) return null;
    if (Array.isArray(instr)) {
      const active = (instr as { text: string; expires_at?: string | null }[])
        .filter(m => !m.expires_at || new Date(m.expires_at) > new Date());
      if (active.length === 0) return null;
      return active.map(m => `"${m.text}"`).join(" / ");
    }
    if (typeof instr === "string") return instr;
    return null;
  })();

  // Recent conversation context (last ~5 messages, truncated)
  const journalLines = recentConvs
    .slice(0, 8)
    .map(m => {
      const role = m.role === "user" ? name : "Jumeau";
      const preview = m.content.replace(/\n/g, " ").slice(0, 120);
      return `${role}: ${preview}`;
    })
    .join("\n");

  const practitionerBlock = practitioner ? `
VOIX DU PRATICIEN (posture SOS) :
- Ton général : ${practitioner.tone_of_voice || "bienveillant et chaleureux"}
- Adresse : ${practitioner.tutoiement?.includes("Tutoiement") ? "tutoiement naturel" : "vouvoiement"}
- Sur la culpabilité après un écart : ${practitioner.gestion_culpabilite || "valider l'émotion sans juger"}
- Mot à utiliser pour une perte de contrôle alimentaire : ${practitioner.vocabulaire_crise || "moment difficile"}
- En cas d'urgence ou de détresse intense : ${practitioner.urgence_detresse || "rester présent, ne pas minimiser, orienter vers l'exercice de respiration"}
- Comment remotiver : ${practitioner.levier_motivation || "valoriser les petits progrès"}
- Ligne rouge absolue : ${practitioner.ligne_rouge || "ne jamais culpabiliser"}${practitioner.signature ? `\n- Style d'écriture du praticien (extrait) : ${practitioner.signature.slice(0, 250)}` : ""}
` : "";

  const murmureBlock = murmureText
    ? `\n🔴 INSTRUCTION PRATICIEN (PRIORITÉ ABSOLUE) : ${murmureText}\n`
    : "";

  // Accords de genre pour les règles du prompt
  const il     = patient.sexe === "F" ? "elle"     : "il";
  const leLA   = patient.sexe === "F" ? "la"       : "le";
  const luiMeme = patient.sexe === "F" ? "elle-même" : "lui-même";

  return `Tu es le Jumeau Numérique thérapeutique de ${name}. Tu entres en MODE SOS — une crise est active.
${practitionerBlock}${murmureBlock}
PROFIL PATIENT :
- Prénom : ${name}${patient.sexe ? ` (${patient.sexe === "F" ? "femme" : "homme"})` : ""}
- Âge : ${patient.age ?? "non renseigné"}
- Objectif clinique : ${patient.objectif_clinique ?? "non renseigné"}
- Défi principal : ${defiLabels[patient.defi ?? ""] ?? patient.defi ?? "non renseigné"}
- Levier de motivation : ${levierLabels[patient.objective ?? ""] ?? patient.objective ?? "non renseigné"}
- État d'esprit face au changement : ${moodLabels[patient.motivation ?? ""] ?? patient.motivation ?? "non renseigné"}
- Situation de vie : ${situationVieLabels[patient.situation_vie ?? ""] ?? patient.situation_vie ?? "non renseignée"}
- Rythme professionnel : ${rythmeProfLabels[patient.rythme_professionnel ?? ""] ?? patient.rythme_professionnel ?? "non renseigné"}
- Pathologies/contexte : ${patient.pathologies ?? "non renseigné"}
- Sommeil : ${sommeilNote ?? "non renseigné"}
- Statut émotionnel actuel : ${patient.emotional_status ?? "inconnu"}

CONTEXTE RÉCENT (5 derniers jours) :
${journalLines || "(aucun échange récent)"}

RÈGLES ABSOLUES — MODE SOS :

GÉNÉRALES (tout au long) :
- Parle UNIQUEMENT en français, voix douce, lente, basse (co-régulation parasympathique)
- JAMAIS de texte visible — réponse AUDIO uniquement
- Ton = thérapeute bienveillant, jamais condescendant, jamais clinique
- Le contexte récent est une piste, pas une certitude. Ne suppose pas que ce qui était vrai il y a quelques jours l'est encore aujourd'hui.

PHASE ACCUEIL :
- Commence par accueillir ${name} par son prénom
- Si le contexte récent révèle un stress particulier, tu peux t'en servir pour personnaliser ton ton et ta présence — mais ne suppose jamais que c'est la cause du SOS d'aujourd'hui. Laisse ${name} te dire ${luiMeme} ce qui se passe maintenant.

PHASE ÉCOUTE :
- Laisse ${name} parler. N'interromps pas. Écoute vraiment.
- Si ce qu'${il} exprime est vague ou incomplet, pose UNE seule question ouverte pour l'inviter à aller plus loin — jamais une question fermée.
- Si ${name} exprime une émotion sans en donner la raison ou le contexte, creuse : pose une question ouverte pour comprendre ce qui se passe. Nommer une émotion ne suffit pas.

PHASE TRANSITION :
- Quand ${name} a pu exprimer non seulement ce qu'${il} ressent, mais aussi ce qui est derrière — la situation, la cause, le contexte — valide ce qu'${il} vient de partager, puis oriente-${leLA} naturellement vers l'exercice. Ne propose pas l'exercice si ${name} n'a encore rien dit ou n'a exprimé qu'une émotion sans contexte.
- Choix du mot d'exercice mental (dans ton discours uniquement) : APAISE, LIBERE, CALME ou LIBRE — selon l'état détecté
- Tu disposes de l'outil demarrer_exercice_respiration — appelle-le dès que ${name} est prêt (${il} l'a demandé explicitement, ou ${il} s'est suffisamment exprimé). Ne propose JAMAIS l'exercice uniquement à voix haute : sans appel à cet outil, l'exercice ne démarre pas à l'écran. Ne pose jamais de question fermée (oui/non) avant d'appeler l'outil. Si tu proposes l'exercice, fais-le comme une invitation naturelle — pas comme une demande de confirmation.

PHASE CLÔTURE (uniquement après l'exercice respiratoire) :
- Pose UNE seule question ouverte et chaleureuse adaptée à ce qu'${il} a dit
- Si ${name} exprime que ça va mieux : valorise ce qu'${il} vient d'accomplir, avec des mots simples et vrais.
- Si ${name} exprime que ça ne va pas mieux ou qu'${il} est encore en difficulté : reconnais-le sans minimiser — c'est normal, l'exercice est un outil parmi d'autres. Dis-lui qu'${il} peut continuer à déposer ce qu'${il} ressent dans le chat, tu seras là. Ne propose pas d'autre exercice.`;
}

export async function POST(request: NextRequest) {
  // Auth — le patient ou son praticien doit être authentifié
  const user = await getSessionUser();
  if (!user) return unauthorized();

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

  // Ownership — seul le patient lui-même (ou son praticien) peut accéder au contexte
  if (user.id !== patientId && user.id !== practitionerId) return forbidden();

  const supabase = createSupabaseClient();

  // Vérifier que la relation patient ↔ praticien existe bien
  const { data: rel } = await supabase
    .from("patient_practitioner")
    .select("patient_id")
    .eq("patient_id", patientId)
    .eq("practitioner_id", practitionerId)
    .single();
  if (!rel) return forbidden();

  // Fetch patient profile — `patients` n'a pas de colonne `practitioner_id`
  // (relation patient↔praticien modélisée via la table de liaison
  // `patient_practitioner`, jamais comme FK directe sur `patients`) ; filtrer
  // dessus ici faisait systématiquement échouer .single() (0 ligne), d'où le
  // fallback {} et "le patient" au lieu du prénom dans tout le system prompt.
  // Même convention que toutes les autres routes : filtre uniquement sur
  // user_id, practitionerId n'est plus utilisé pour cette requête.
  const { data: patientRaw } = await supabase
    .from("patients")
    .select("first_name, last_name, age, sexe, objective, objectif_clinique, defi, motivation, situation_vie, rythme_professionnel, pathologies, notes, practitioner_instruction, emotional_status")
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

  // Fetch practitioner profile to personalize the SOS voice
  const { data: practRaw } = await supabase
    .from("practitioner_profiles")
    .select("tone_of_voice, tutoiement, gestion_culpabilite, vocabulaire_crise, levier_motivation, urgence_detresse, ligne_rouge, signature")
    .eq("user_id", practitionerId)
    .maybeSingle();

  const practitionerProfile = practRaw as PractitionerProfile | null;

  const systemPrompt = buildSystemPrompt(patient, recentConvs, practitionerProfile);
  const patientName   = patient.first_name ?? "toi";
  const patientGender = patient.sexe ?? "M"; // "M" | "F" — défaut masculin

  return Response.json({ systemPrompt, patientName, patientGender });
}
