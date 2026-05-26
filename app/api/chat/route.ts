import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const PLAN_CONFIG = {
  essentiel: {
    model: "gemini-3.1-flash-lite",
    maxOutputTokens: 250,
    historyLimit: 20,
    ragChunks: 5,
    dailyMessageLimit: 30,
    isFounder: false,
  },
  pro: {
    model: "gemini-3-flash",
    maxOutputTokens: 450,
    historyLimit: 100,
    ragChunks: 8,
    dailyMessageLimit: 100,
    isFounder: false,
  },
  cabinet: {
    model: "gemini-3-flash",
    maxOutputTokens: 450,
    historyLimit: 100,
    ragChunks: 8,
    dailyMessageLimit: 100,
    isFounder: false,
  },
  fondateur: {
    model: "gemini-3-flash",
    maxOutputTokens: 450,
    historyLimit: 100,
    ragChunks: 8,
    dailyMessageLimit: 100,
    isFounder: true,
  },
};

type PlanType = keyof typeof PLAN_CONFIG;

type ChatRequest = {
  message: string;
  systemPrompt?: string;
  patientId?: string;
  practitionerId?: string;
  sessionId?: string;
  imageBase64?: string;
  imageMimeType?: string;
  isSOS?: boolean;
};

const COMPLEX_KEYWORDS = [
  "faim", "manger", "repas", "aliment", "calorie", "régime", "poids",
  "maigrir", "grossir", "sport", "exercice", "santé", "maladie", "diabète",
  "cholestérol", "allergie", "intolérance", "fatigue", "stress", "anxieux",
  "triste", "déprime", "craquage", "écart", "motivation", "découragement",
  "résultat", "plateau", "ballonnement", "digestion", "sucre", "glucide",
  "protéine", "lipide", "vitamine", "complément", "jeûne", "détox",
  "j'ai mangé", "j'ai craqué", "je me sens", "j'ai mal", "pourquoi",
  "comment", "que faire", "conseil", "aide", "problème",
  "peur", "honte", "marre", "ras-le-bol", "abandon", "nul", "nulle",
  "échec", "culpabilité", "désespoir", "craquer", "pleurer",
];



// ═══ DÉTECTION DE CRISE ═══
const CRISIS_CRITICAL_KEYWORDS = [
  // Suicide
  "suicide", "suicider", "me suicider", "suicidaire", "veux mourir", "envie de mourir",
  "je veux mourir", "en finir", "plus envie de vivre", "disparaître", "disparaitre",
  "me tuer", "me faire du mal", "mettre fin à ma vie", "fin à ma vie",
  // Urgences vitales
  "gorge qui serre", "gorge enfle", "lèvres gonflent", "lèvres gonflées", "allergie grave",
  "anaphylaxie", "epipen", "je suffoque", "je peux plus respirer",
  "douleur poitrine", "douleur thoracique", "bras gauche engourdi", "bras qui engourdit",
  "je perds connaissance", "je vais perdre connaissance", "vision floue soudaine",
  "paralysie", "je parle plus", "bouche tordue",
  // Hypoglycémie sévère  
  "je tremble plus je peux", "sueurs froides et confus", "je comprends plus rien",
  // Menaces
  "je vais le tuer", "je vais la tuer", "je vais faire du mal", "envie de frapper",
];

const CRISIS_ALERT_KEYWORDS = [
  // TCA graves
  "je me suis fait vomir", "j'ai vomi exprès", "je prends des laxatifs", "laxatifs après manger",
  "je mange rien depuis", "j'ai rien mangé depuis", "moins de 500 calories", "moins de 600 calories",
  "j'ai tout mangé d'un coup", "j'ai tout englouti", "crise de boulimie", "hyperphagie",
  // Arrêt traitement
  "arrêter mon traitement", "arrêter mes médicaments", "stop mes cachets", "plus prendre mes médicaments",
  // Grossesse
  "je suis enceinte", "j'attends un bébé", "grossesse", "je suis tombée enceinte",
  // Interactions médicamenteuses
  "nouveau médicament", "on m'a prescrit", "ordonnance nouvelle",
  // Décompensation
  "on empoisonne", "ils me surveillent", "je suis suivie", "complot", "on veut me faire du mal",
];

function detectCrisisLevel(message: string): "critical" | "alert" | "none" {
  const lower = message.toLowerCase();
  if (CRISIS_CRITICAL_KEYWORDS.some(kw => lower.includes(kw))) return "critical";
  if (CRISIS_ALERT_KEYWORDS.some(kw => lower.includes(kw))) return "alert";
  return "none";
}

const CRISIS_CRITICAL_RESPONSES: Record<string, string> = {
  suicide: "Je t'entends, et ce que tu ressens est réel. Tu n'es pas seul(e). Appelle maintenant le 3114 — c'est le numéro national de prévention du suicide, disponible 24h/24, gratuit et confidentiel. Ton praticien sera également informé immédiatement. 🌿",
  medical: "Ce que tu décris nécessite une attention médicale immédiate. Appelle le 15 (SAMU) ou le 112 maintenant. Ne reste pas seul(e). Ton praticien sera informé.",
  threat: "Je prends note de ce que tu exprimes. Si tu te sens en danger ou si tu risques de faire du mal à quelqu'un, appelle le 17 (Police) ou le 112 immédiatement.",
};

function getCriticalResponseType(message: string): string {
  const lower = message.toLowerCase();
  if (["suicide", "mourir", "en finir", "tuer", "disparaître", "disparaitre"].some(kw => lower.includes(kw))) return "suicide";
  if (["gorge", "respire", "poitrine", "thoracique", "bras", "paralysie", "tremble", "sueurs froides"].some(kw => lower.includes(kw))) return "medical";
  if (["je vais le tuer", "je vais la tuer", "faire du mal", "frapper"].some(kw => lower.includes(kw))) return "threat";
  return "suicide";
}

function getTCAResponse(firstName: string): string {
  return `Je sens que c'est un moment très difficile pour toi, ${firstName}. On va mettre de côté les conseils alimentaires pour l'instant. Je vais en toucher deux mots à ton praticien pour qu'on puisse t'épauler au mieux. Respire, je suis là. 🌿`;
}

function getAlertMurmure(message: string): string {
  const lower = message.toLowerCase();
  if (["enceinte", "grossesse", "bébé"].some(kw => lower.includes(kw)))
    return "Le patient a confirmé une grossesse. Priorité à la nutrition prénatale et à l'équilibre micronutritionnel. Suspendre tout objectif de perte de poids ou de restriction.";
  if (["vomi", "laxatif", "boulimie", "hyperphagie"].some(kw => lower.includes(kw)))
    return "Comportement TCA détecté. Passer en mode soutien uniquement. Ne pas donner de conseils nutritionnels jusqu'à la prochaine consultation.";
  if (["arrêter mon traitement", "stop mes cachets", "plus prendre mes médicaments"].some(kw => lower.includes(kw)))
    return "Le patient envisage d'arrêter son traitement médical. Rediriger systématiquement vers le médecin traitant sur ce sujet.";
  if (["nouveau médicament", "on m'a prescrit", "ordonnance"].some(kw => lower.includes(kw)))
    return "Nouveau médicament signalé. Vérifier les interactions possibles avec le protocole nutritionnel en cours.";
  if (["complot", "empoisonne", "surveillent"].some(kw => lower.includes(kw)))
    return "Signes de décompensation psychologique détectés. Reprendre la main manuellement et contacter le patient directement.";
  return "Alerte comportementale détectée. Vérifier la conversation et contacter le patient si nécessaire.";
}


function isComplexMessage(message: string): boolean {
  const lower = message.toLowerCase();
  if (message.split(" ").length > 15) return true;
  return COMPLEX_KEYWORDS.some((kw) => lower.includes(kw));
}

function createSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getGeminiEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
  const result = await model.embedContent({
    content: { parts: [{ text }], role: "user" },
    taskType: "RETRIEVAL_DOCUMENT",
    outputDimensionality: 768,
  } as never);
  return result.embedding.values;
}

type CachedPractitioner = {
  plan: PlanType;
  profile: Record<string, string> | null;
};

async function getPractitionerFromCache(practitionerId: string): Promise<CachedPractitioner | null> {
  try {
    const cached = await redis.get<CachedPractitioner>(`practitioner:${practitionerId}`);
    return cached ?? null;
  } catch {
    return null;
  }
}

async function setPractitionerInCache(practitionerId: string, data: CachedPractitioner): Promise<void> {
  try {
    await redis.set(`practitioner:${practitionerId}`, data, { ex: 3600 });
  } catch {}
}

async function invalidatePractitionerCache(practitionerId: string): Promise<void> {
  try {
    await redis.del(`practitioner:${practitionerId}`);
  } catch {}
}

async function getPractitionerData(practitionerId: string): Promise<CachedPractitioner> {
  const cached = await getPractitionerFromCache(practitionerId);
  if (cached) return cached;

  const supabase = createSupabaseClient();
  const [practitionerResult, profileResult] = await Promise.all([
    supabase.from("practitioners").select("plan").eq("user_id", practitionerId).single(),
    supabase.from("practitioner_profiles").select("*").eq("user_id", practitionerId).single(),
  ]);

  const plan = (practitionerResult.data as { plan?: string } | null)?.plan;
  const validPlan: PlanType = plan && plan in PLAN_CONFIG ? plan as PlanType : "essentiel";
  const profile = profileResult.data as Record<string, string> | null;

  const data: CachedPractitioner = { plan: validPlan, profile };
  await setPractitionerInCache(practitionerId, data);
  return data;
}

async function hasDocuments(practitionerId: string): Promise<boolean> {
  try {
    const cacheKey = `has_docs:${practitionerId}`;
    const cached = await redis.get<boolean>(cacheKey);
    if (cached !== null) return cached;

    const supabase = createSupabaseClient();
    const { count } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("practitioner_id", practitionerId);

    const result = (count ?? 0) > 0;
    await redis.set(cacheKey, result, { ex: 3600 });
    return result;
  } catch {
    return false;
  }
}

async function getRelevantDocuments(question: string, practitionerId: string, ragChunks: number): Promise<string> {
  try {
    const hasDocs = await hasDocuments(practitionerId);
    if (!hasDocs) return "";

    // N'appelle l'embedding que si le message est suffisamment complexe
    if (question.split(" ").length < 4 && !isComplexMessage(question)) return "";

    const supabase = createSupabaseClient();
    const queryEmbedding = await getGeminiEmbedding(question);
    const { data } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      practitioner_id: practitionerId,
      match_count: ragChunks,
    });

    const results = data as { content: string; similarity: number }[] | null;
    if (!results || results.length === 0) return "";

    const relevant = results.filter((d) => d.similarity > 0.5).map((d) => d.content).join("\n\n");
    return relevant ? `\nDOCUMENTS DE RÉFÉRENCE DU PRATICIEN :\n${relevant}\n` : "";
  } catch {
    return "";
  }
}

async function getFreshJournal(patientId: string): Promise<string> {
  try {
    const supabase = createSupabaseClient();

    const { data: recentEntries } = await supabase
      .from("journal_entries")
      .select("date, mood, food_rating, emotions, content")
      .eq("patient_id", patientId)
      .order("date", { ascending: false })
      .limit(3);

    const { data: weekEntries } = await supabase
      .from("journal_entries")
      .select("mood, food_rating")
      .eq("patient_id", patientId)
      .order("date", { ascending: false })
      .limit(7);

    if (!recentEntries?.length) return "";

    let weekSummary = "";
    if (weekEntries && weekEntries.length >= 3) {
      const avgMood = (weekEntries.reduce((sum, e) => sum + e.mood, 0) / weekEntries.length).toFixed(1);
      const avgFood = (weekEntries.reduce((sum, e) => sum + e.food_rating, 0) / weekEntries.length).toFixed(1);
      const firstMood = weekEntries[weekEntries.length - 1].mood;
      const lastMood = weekEntries[0].mood;
      const trend = lastMood > firstMood ? "en hausse" : lastMood < firstMood ? "en baisse" : "stable";
      weekSummary = `Synthèse 7 jours : humeur moyenne ${avgMood}/10 (${trend}), alimentation moyenne ${avgFood}/3.`;
    }

    const detailedEntries = recentEntries.map((e) => {
      const moodLabel = e.mood <= 3 ? "difficile" : e.mood <= 6 ? "moyen" : e.mood <= 8 ? "bien" : "excellent";
      const foodLabel = e.food_rating === 1 ? "difficile" : e.food_rating === 2 ? "bien" : "excellent";
      const emotions = (e.emotions as string[])?.join(", ") || "non renseignées";
      const note = e.content ? ` — "${e.content}"` : "";
      return `  • ${e.date} : humeur ${moodLabel} (${e.mood}/10), alimentation ${foodLabel}, émotions : ${emotions}${note}`;
    }).join("\n");

    return `\nJOURNAL DU PATIENT :\n${weekSummary}\nDernières entrées :\n${detailedEntries}\nUtilise ces données subtilement pour adapter ton ton et tes conseils, sans jamais citer explicitement le journal.`;
  } catch {
    return "";
  }
}

async function getPatientProfile(patientId: string): Promise<string> {
  try {
    const cacheKey = `patient_profile:${patientId}`;
    const cached = await redis.get<string>(cacheKey);
    if (cached) {
      const journalContext = await getFreshJournal(patientId);
      return cached + journalContext;
    }

    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("patients")
      .select("first_name, last_name, age, sexe, taille, poids, objective, pathologies, allergies, traitements, objectif_clinique, practitioner_instruction, motivation, defi, aliments_aimes, aliments_detestes, niveau_activite, regime_specifique")
      .eq("user_id", patientId)
      .single();

    const patient = data as {
      first_name?: string; last_name?: string; age?: number; sexe?: string;
      taille?: number; poids?: number; objective?: string; pathologies?: string;
      allergies?: string; traitements?: string; objectif_clinique?: string;
      motivation?: string; defi?: string;
      aliments_aimes?: string; aliments_detestes?: string; niveau_activite?: string;
      regime_specifique?: string; practitioner_instruction?: string;
    } | null;

    if (!patient) return "";

    const parts = [];
    if (patient.first_name) parts.push(`Prénom : ${patient.first_name}`);
    if (patient.age) parts.push(`Âge : ${patient.age} ans`);
    if (patient.sexe) parts.push(`Sexe : ${patient.sexe}`);
    if (patient.taille) parts.push(`Taille : ${patient.taille} cm`);
    if (patient.poids) parts.push(`Poids : ${patient.poids} kg`);
    if (patient.pathologies) parts.push(`Pathologies : ${patient.pathologies}`);
    if (patient.allergies) parts.push(`Allergies : ${patient.allergies}`);
    if (patient.traitements) parts.push(`Traitements : ${patient.traitements}`);
    if (patient.objectif_clinique) parts.push(`Objectif clinique : ${patient.objectif_clinique}`);
    if (patient.objective) parts.push(`Objectif personnel : ${patient.objective}`);
    if (patient.niveau_activite) parts.push(`Niveau d'activité : ${patient.niveau_activite}`);
    if (patient.regime_specifique) parts.push(`Régime : ${patient.regime_specifique}`);
    if (patient.motivation) parts.push(`État d'esprit : ${patient.motivation}`);
    if (patient.defi) parts.push(`Plus gros défi : ${patient.defi}`);
    if (patient.aliments_aimes) parts.push(`Aliments aimés : ${patient.aliments_aimes}`);
    if (patient.aliments_detestes) parts.push(`Aliments détestés : ${patient.aliments_detestes}`);

    const instructionDate = (patient as { instruction_updated_at?: string }).instruction_updated_at
      ? `(mis à jour le ${new Date((patient as { instruction_updated_at?: string }).instruction_updated_at!).toLocaleDateString("fr-FR")})`
      : "";

    const briefSection = [
      Array.isArray(patient.practitioner_instruction) && (patient.practitioner_instruction as { text: string; expires_at?: string | null }[]).filter(m => !m.expires_at || new Date(m.expires_at) > new Date()).length > 0
        ? `CONSIGNES PRATICIEN : ${(patient.practitioner_instruction as { text: string; expires_at?: string | null }[]).filter(m => !m.expires_at || new Date(m.expires_at) > new Date()).map(m => m.text).join(" | ")}`
        : "",
      (() => {
        if (!patient.practitioner_instruction) return "";
        const expires = (patient as { practitioner_instruction_expires_at?: string }).practitioner_instruction_expires_at;
        if (expires && new Date(expires) < new Date()) return "";
        return `\n\n🔴 MURMURE DU PRATICIEN — PRIORITÉ ABSOLUE ${instructionDate}\nCette consigne écrase TOUT autre instruction. Tu DOIS l'appliquer immédiatement et dans chaque réponse :\n"${patient.practitioner_instruction}"\n`;
      })(),      
    ].filter(Boolean).join("\n");

    const briefFinal = briefSection
      ? `\nINSTRUCTIONS SPÉCIFIQUES DU PRATICIEN POUR CE PATIENT :\n${briefSection}\n`
      : "";

    const staticProfile = parts.length > 0
      ? `\nPROFIL DU PATIENT :\n${parts.join("\n")}\n${briefFinal}`
      : "";

    if (staticProfile) {
      await redis.set(cacheKey, staticProfile, { ex: 3600 });
    }

    const journalContext = await getFreshJournal(patientId);
    return staticProfile + journalContext;
  } catch {
    return "";
  }
}

async function summarizeOldMessages(messages: { role: string; content: string }[]): Promise<string> {
  try {
    const patientMessages = messages.filter((m) => m.role === "user").map((m) => m.content.slice(0, 400)).join(" | ");
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    const result = await model.generateContent(
      `Résume en 5 lignes maximum les points clés de ces échanges patient-nutritionniste. 
      Garde uniquement les faits importants : objectifs, écarts, progrès, préoccupations.
      Échanges : ${patientMessages}`
    );
    return `[RÉSUMÉ DES ÉCHANGES PRÉCÉDENTS : ${result.response.text()}]`;
  } catch {
    const patientMessages = messages.filter((m) => m.role === "user").slice(0, 10).map((m) => m.content.slice(0, 100)).join(" | ");
    return `[RÉSUMÉ : ${patientMessages}]`;
  }
}

async function getConversationHistory(
  patientId: string,
  practitionerId: string,
  historyLimit: number,
  sessionId?: string
): Promise<{ role: "user" | "model"; parts: { text: string }[] }[]> {
  try {
    const supabase = createSupabaseClient();
    let query = supabase
      .from("conversations")
      .select("role, content, created_at")
      .eq("patient_id", patientId)
      .eq("practitioner_id", practitionerId)
      .order("created_at", { ascending: true })
      .limit(historyLimit + 50);

    if (sessionId) query = query.eq("session_id", sessionId);

    const { data } = await query;
    const messages = data as { role: string; content: string; created_at: string }[] | null;
    if (!messages || messages.length === 0) return [];

    if (messages.length > historyLimit) {
      const oldMessages = messages.slice(0, messages.length - historyLimit);
      const recentMessages = messages.slice(messages.length - historyLimit);
      const summary = await summarizeOldMessages(oldMessages);
      return [
        { role: "user" as const, parts: [{ text: summary }] },
        ...recentMessages.map((m) => ({
          role: m.role === "assistant" ? "model" as const : "user" as const,
          parts: [{ text: m.content }],
        })),
      ];
    }

    return messages.map((m) => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    }));
  } catch {
    return [];
  }
}

function buildSystemPrompt(
  profile: Record<string, string> | null,
  patientContext: string,
  documentsContext: string
): string {
  if (!profile) return getDefaultPrompt();

  return `Tu ES le Jumeau Numérique de ce nutritionniste expert. Le patient ne doit jamais sentir qu'il parle à une machine, mais à une extension directe de l'esprit et de la méthode de son praticien.

IDENTITÉ & POSTURE :
- Ton de communication : ${profile.tone_of_voice || "bienveillant et professionnel"}
- Mode d'adresse : ${profile.tutoiement || "vouvoiement"}
- Niveau de langage : ${profile.technicite || "adapté au patient"}
- Longueur des réponses : ${profile.longueur_reponses || "courte et précise"}
- Émojis : ${profile.emojis || "avec modération"}
- Posture : ${profile.posture || "bienveillant"}

PHILOSOPHIE NUTRITIONNELLE :
- Approche : ${profile.approche_generale || "rééquilibrage progressif"}
- Spécialités : ${profile.pathologies || "généraliste"}
- Position régimes : ${profile.position_regimes || "cas par cas"}
- Glucides : ${profile.position_glucides || "selon objectif"}
- Jeûne : ${profile.jejune || "cas par cas"}
- Compléments : ${profile.complements || "cas par cas"}
- Petit-déjeuner : ${profile.petit_dejeuner || "optionnel"}
- Conviction fondamentale : ${profile.conviction || "non spécifiée"}
- Ne jamais recommander : ${profile.jamais_dire || "rien de spécifique"}

GESTION HUMAINE :
- Face à un écart : ${profile.gestion_ecarts || "sans culpabilité, on repart"}
- Face aux émotions : ${profile.emotions || "travail global"}
- Si non-suivi : ${profile.non_suivi || "bienveillance totale"}
- Fêtes et vacances : ${profile.fetes_vacances || "équilibre sur la durée"}
- Pour remotiver : ${profile.motivation_berne || "valoriser les petits progrès"}

SÉCURITÉ & LIMITES :
- Périmètre d'action : ${profile.perimetre || "prudence sur les pathologies"}
- Questions médicales : ${profile.questions_medicales || "rediriger vers le médecin"}
- Détresse psychologique : ${profile.urgence_detresse || "empathie et alerte praticien"}
- Ligne rouge absolue : ${profile.ligne_rouge || "ne jamais culpabiliser"}

MON APPROCHE EN MES MOTS :
${profile.approche_libre || "Bienveillant, personnalisé, centré sur le patient."}

EXEMPLES DE RÉPONSES ATTENDUES :
- Craquage : "${profile.situation1 || "Un écart ne définit pas votre parcours. On repart ensemble."}"
- Régime miracle : "${profile.situation2 || "Trouvons ce qui vous convient vraiment sur le long terme."}"
- Décrochage : "${profile.situation3 || "Je suis là, sans jugement. Qu'est-ce qui s'est passé ?"}"
- Question médicale : "${profile.situation4 || "C'est une excellente question pour votre médecin traitant."}"
- Victoire : "${profile.situation5 || "Bravo ! C'est une vraie victoire, savourez-la."}"
- Détresse : "${profile.situation6 || "Vous n'êtes pas seul(e). Votre praticien sera informé."}"

═══ HIÉRARCHIE ABSOLUE DES INSTRUCTIONS ═══
Tu dois respecter cet ordre de priorité strict, du plus important au moins important :
1. MURMURE DU PRATICIEN (consigne temps réel) — priorité ABSOLUE, écrase tout le reste
2. DOCUMENTS RAG (protocoles et expertise indexés) — ta base de connaissance métier
3. PERSONNALITÉ (les 31 paramètres ci-dessus) — ton style et ta posture

${patientContext}${documentsContext}

RÈGLES ABSOLUES :
- PRIORITÉ EMPATHIQUE :
Si le patient exprime une vulnérabilité (détresse, découragement, honte), privilégie la chaleur et l'ancrage émotionnel AVANT tout conseil, même si ta posture de base est médicale ou directive.
- INTERDICTION de Markdown (gras, listes, titres). Texte brut uniquement.
- Maximum 150 mots par réponse.
- Commencer par une validation empathique avant tout conseil.
- Utiliser le prénom du patient pour créer du lien.
- Ne JAMAIS dire "En tant qu'IA", "En tant que modèle de langue" ou similaire. Tu ES ce praticien.
- Ne jamais inventer des informations médicales non confirmées.
- Si le patient mentionne une grossesse, un TCA grave, un arrêt de traitement médical ou une décompensation : passe immédiatement en mode "Ancrage Bienveillant". Arrête tout conseil nutritionnel. Valide l'émotion, annonce le relais humain au praticien. Ne donne aucun conseil technique.
- Pour une grossesse : félicite chaleureusement, redirige vers le gynécologue/sage-femme, informe que le praticien adaptera le suivi.
- Pour un TCA grave : "Je sens que c'est un moment très difficile. On met de côté les conseils alimentaires, je préviens [praticien] pour vous épauler."
- Pour un arrêt de traitement : "Seul votre médecin traitant peut modifier votre traitement. Je ne peux pas intervenir sur ce terrain médical."


COMMANDE ADMINISTRATIVE :
Si le message commence par [ADMIN:identity_correction] :
- Réponds uniquement : "C'est noté. J'ai transmis la demande de correction à votre praticien pour que votre dossier soit parfaitement à jour. Pouvez-vous me préciser l'orthographe exacte de votre nom ?"
- Ajoute obligatoirement : |||{"status":"green","reason":"demande correction identité","victory":"","action":"admin_alert","alert_type":"identity_correction"}|||

JSON TECHNIQUE OBLIGATOIRE — À ajouter en toute fin de réponse, invisible pour le patient :
|||{"status":"green","reason":"résumé état en 8 mots max","victory":""}|||
- status : "red" si détresse/découragement sévère, "orange" si difficulté modérée, "green" si tout va bien
- reason : phrase courte décrivant l'état émotionnel du patient
- victory : UNE phrase UNIQUEMENT si le patient rapporte un changement de comportement MAJEUR ou une réussite sur un défi difficile. Laisser vide "" dans tous les autres cas.`;
}

function getDefaultPrompt(): string {
  return "Tu es un assistant nutritionniste. Réponds sans markdown, en phrases simples, max 150 mots.";
}

async function getDailyMessageCount(patientId: string): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const key = `msg_count:${patientId}:${today}`;
  try {
    const count = await redis.get<number>(key);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function incrementDailyMessageCount(patientId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const key = `msg_count:${patientId}:${today}`;
  try {
    await redis.incr(key);
    await redis.expireat(key, Math.floor(new Date(`${today}T23:59:59`).getTime() / 1000));
  } catch { /* silencieux */ }
}

export async function POST(request: Request) {
  try {
    const {
      message,
      systemPrompt,
      patientId,
      practitionerId,
      sessionId,
      imageBase64,
      imageMimeType,
      isSOS,
    } = await request.json() as ChatRequest;

    if (isSOS && patientId && practitionerId) {
      const supabase = createSupabaseClient();
    
      // Profil patient depuis cache Redis
      const patientContext = await getPatientProfile(patientId);
    
      // Données spécifiques pour la personnalisation miroir
      const { data: patientRaw } = await supabase
        .from("patients")
        .select("first_name, practitioner_instruction, notes, pathologies, defi, motivation")
        .eq("user_id", patientId)
        .single();
    
      const patient = patientRaw as {
        first_name?: string;
        practitioner_instruction?: string;
        notes?: string;
        pathologies?: string;
        defi?: string;
        motivation?: string;
      } | null;
    
      const mirrorContext = [
        patient?.practitioner_instruction ? `Consigne actuelle du praticien : "${patient.practitioner_instruction}"` : "",
        "",
        patient?.defi ? `Plus gros défi du patient : "${patient.defi}"` : "",
        patient?.motivation ? `État d'esprit actuel : "${patient.motivation}"` : "",
        patient?.pathologies ? `Pathologies : "${patient.pathologies}"` : "",
      ].filter(Boolean).join("\n");
    
      // 3 derniers messages
      const { data: recentMessages } = await supabase
        .from("conversations")
        .select("role, content")
        .eq("patient_id", patientId)
        .eq("practitioner_id", practitionerId)
        .order("created_at", { ascending: false })
        .limit(3);

        // Derniers outils SOS utilisés
        const { data: recentSOS } = await supabase
        .from("sos_events")
        .select("raw_response, triggered_at")
        .eq("patient_id", patientId)
        .order("triggered_at", { ascending: false })
        .limit(3);

        const recentTools = (recentSOS ?? [])
        .map(e => {
          try {
            const parsed = JSON.parse(e.raw_response as string) as { tool_id?: string };
            return parsed.tool_id ?? null;
          } catch { return null; }
        })
        .filter(Boolean)
        .join(", ");

    
      const context = (recentMessages ?? [])
        .reverse()
        .map((m: { role: string; content: string }) => `${m.role === "user" ? "Patient" : "Jumeau"}: ${m.content}`)
        .join("\n");
    
      const firstName = patient?.first_name ?? "le patient";
    
      const sosPrompt = `Tu es le Jumeau Numérique d'un nutritionniste expert. Tu dois choisir et personnaliser un outil de soutien émotionnel pour ${firstName}.
    
    CONTEXTE PATIENT :
    ${patientContext}
    
    PERSONNALISATION MIROIR (utilise ces éléments pour rendre le script de l'exercice unique et personnel) :
    ${mirrorContext || "Pas de données spécifiques."}
    
    DERNIERS ÉCHANGES :
    ${context || "Aucun échange récent."}
    
        RÈGLES :
        RÈGLES :
    - Choisis l'outil parmi :
      breathing (stress/anxiété/tension)
      ancrage (panique/dissociation/perte de repères)
      manger (impulsions alimentaires/TCA/envie de grignoter)
      marche (fatigue/rumination/besoin de mouvement)
      body_scan (confusion faim réelle vs émotionnelle, sensations corporelles)
      defusion (pensées automatiques négatives, culpabilité, "je suis nul")
      ecriture (ruminations nocturnes, trop-plein émotionnel, besoin de vider)
      adaptive_coaching (situation unique nécessitant un exercice sur mesure TCC)

    - Si tu choisis adaptive_coaching, génère toi-même les steps du tool_script en fonction du problème précis du patient. Les steps doivent suivre une approche TCC (Thérapies Cognitivo-Comportementales) : identifier la pensée automatique, la questionner, proposer une action concrète. Reste dans un cadre bienveillant et nutritionnel.
    
    - ANTI-REDONDANCE : Les outils récemment utilisés par ce patient sont : ${recentTools || "aucun"}. Évite de reproposer le même outil. Varie systématiquement.
    
    - PROPOSITION, PAS IMPOSITION : Amène toujours l'exercice comme une proposition douce, sauf si le patient a explicitement demandé de l'aide (bouton SOS pressé).
    
    - HUMOUR BIENVEILLANT : Si le patient exprime de la lassitude envers un exercice ("encore la respiration ?"), réponds avec autodérision et légèreté. Exemple : "Je sais, je suis monomaniaque du souffle — mais c'est le seul bouton Reset de ton système nerveux que je peux activer à distance ! 🌿"
    
    - Le twin_message doit suivre cette structure en moins de 30 mots :
      1. Valide l'émotion immédiate du dernier message du patient (écho émotionnel 70%)
      2. Lien subtil avec l'objectif de santé si pertinent (ADN praticien 30%, s'inspirer du Murmure ou du ton)
      3. Transition douce vers l'exercice
      Exemple : "Je sens que cet examen raté t'a épuisé, ${firstName}. Prenons 2 minutes pour retrouver ton calme avant d'y revenir."
      Maximum 30 mots. Jamais robotique, toujours humain.
    
    - Les steps du tool_script doivent être personnalisés et varier à chaque fois — jamais de texte générique ou identique à une session précédente.
    
    - Réponds UNIQUEMENT en JSON sans markdown ni backticks :
    {"tool_id":"breathing","twin_message":"Message personnalisé avec prénom max 30 mots","tool_script":{"step_1":"instruction personnalisée","step_2":"instruction personnalisée","step_3":"instruction personnalisée"}}`;

    
      const sosModel = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
      });
    
      const sosResult = await sosModel.generateContent(sosPrompt);
      const sosText = sosResult.response.text().trim().replace(/```json|```/g, "").trim();
    
      // Tracking en base
      try {
        await supabase.from("sos_events").insert({
          patient_id: patientId,
          practitioner_id: practitionerId,
          triggered_at: new Date().toISOString(),
          raw_response: sosText,
        });
      } catch { /* silencieux */ }
    
      try {
        const parsed = JSON.parse(sosText);
        return Response.json({ tool: parsed });
      } catch {
        return Response.json({
          tool: {
            tool_id: "breathing",
            twin_message: `${firstName}, prenons un moment pour souffler ensemble.`,
            tool_script: {},
          },
        });
      }
    }      

    // ═══ DÉTECTION CRISE ═══
const crisisLevel = detectCrisisLevel(message);

if (crisisLevel === "critical" && patientId && practitionerId) {
  const supabase = createSupabaseClient();
  const responseType = getCriticalResponseType(message);
  const criticalResponse = CRISIS_CRITICAL_RESPONSES[responseType];

  // Vérification Gemini avant d'envoyer l'alerte
  const verifyModel = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite", generationConfig: { maxOutputTokens: 10, temperature: 0 } });
  const verifyResult = await verifyModel.generateContent(`Ce message exprime-t-il un danger de mort immédiat pour le patient ou pour autrui ? Réponds uniquement par "oui" ou "non". Message : "${message}"`);
  const verifyText = verifyResult.response.text().trim().toLowerCase();

  if (verifyText.includes("oui")) {
    // Mettre à jour le statut patient
    await supabase.from("patients").update({
      emotional_status: "red_critical",
      emotional_insight: "Alerte critique détectée",
    }).eq("user_id", patientId);

    // Ajouter admin_alert
    const { data: current } = await supabase.from("patients").select("admin_alerts").eq("user_id", patientId).single();
    const alerts = (current as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
    await supabase.from("patients").update({
      admin_alerts: [...alerts, { type: "crisis", alert_type: responseType, date: new Date().toISOString(), seen: false, murmure: "" }]
    }).eq("user_id", patientId);

    // Sauvegarder la conversation
    await supabase.from("conversations").insert([
      { patient_id: patientId, practitioner_id: practitionerId, role: "user", content: message, session_id: sessionId ?? null },
      { patient_id: patientId, practitioner_id: practitionerId, role: "assistant", content: criticalResponse, session_id: sessionId ?? null },
    ]);

    // Envoyer email au praticien
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-crisis-alert`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-crisis-token": process.env.CRISIS_SECRET_TOKEN ?? "",
        },
        body: JSON.stringify({ patientId, practitionerId, alertType: responseType, message }),        
      });
    } catch { /* silencieux */ }

    return new Response(criticalResponse, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

if (crisisLevel === "alert" && patientId && practitionerId) {
  const supabase = createSupabaseClient();
  const murmure = getAlertMurmure(message);

  await supabase.from("patients").update({ emotional_status: "red" }).eq("user_id", patientId);
  
  const { data: current } = await supabase.from("patients").select("admin_alerts").eq("user_id", patientId).single();
  const alerts = (current as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
  
  await supabase.from("patients").update({
    admin_alerts: [...alerts, { 
      type: "alert", 
      alert_type: "behavioral", 
      date: new Date().toISOString(), 
      seen: false, 
      murmure 
    }]
  }).eq("user_id", patientId);

  // ON NE RETURN PAS — Gemini continue
}


    const practitionerData = practitionerId
      ? await getPractitionerData(practitionerId)
      : { plan: "essentiel" as PlanType, profile: null };

    const plan = practitionerData.plan;
    const config = PLAN_CONFIG[plan];

    let showWarning = false;
    if (patientId) {
      const dailyCount = await getDailyMessageCount(patientId);
      if (dailyCount >= config.dailyMessageLimit) {
        return Response.json({
          error: "rate_limit",
          remaining: 0,
          response: plan === "essentiel"
            ? "Vous avez atteint votre limite de messages pour aujourd'hui. Votre compagnon de suivi vous attend demain ! 🌿"
            : "Votre compagnon de suivi a besoin de faire le point sur nos échanges d'aujourd'hui pour préparer votre prochain bilan. On se retrouve demain pour continuer ? 🌿",
        }, { status: 429 });
      }
      
      // Avertissement à 90% de la limite
      const warningThreshold = Math.floor(config.dailyMessageLimit * 0.9);
      showWarning = dailyCount >= warningThreshold && dailyCount < config.dailyMessageLimit;
      }


    const [patientContext, documentsContext] = await Promise.all([
      patientId ? getPatientProfile(patientId) : Promise.resolve(""),
      practitionerId ? getRelevantDocuments(message, practitionerId, config.ragChunks) : Promise.resolve(""),
    ]);

    const practitionerPrompt = systemPrompt ||
      buildSystemPrompt(practitionerData.profile, patientContext, documentsContext);

    let conversationHistory: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    if (patientId && practitionerId) {
      conversationHistory = await getConversationHistory(patientId, practitionerId, config.historyLimit, sessionId);
    }

    const modelName = imageBase64
      ? "gemini-3-flash"
      : plan === "essentiel"
        ? config.model
        : isComplexMessage(message) ? "gemini-3-flash" : "gemini-3.1-flash-lite";

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: practitionerPrompt,
      generationConfig: {
        maxOutputTokens: config.maxOutputTokens,
        temperature: 0.78,
      },
    });

    const chat = model.startChat({ history: conversationHistory });

    let result;
    if (imageBase64 && imageMimeType) {
      const visionPrompt = `Tu reçois une photo de repas d'un patient en suivi nutritionnel.
${patientContext}${documentsContext}
Analyse :
1. Identifie les aliments visibles et les proportions approximatives
2. Croise avec le protocole du praticien et le profil patient
3. Signale tout écart (allergies, intolérances, consignes spécifiques)
4. Réponds en tant que jumeau numérique — ton bienveillant, jamais culpabilisant
${message ? `\nMessage du patient : "${message}"` : ""}
Max 150 mots. Sans markdown.`;

      result = await chat.sendMessageStream([
        { inlineData: { data: imageBase64, mimeType: imageMimeType as "image/jpeg" | "image/png" | "image/webp" } },
        { text: visionPrompt },
      ]);
    } else {
      result = await chat.sendMessageStream(message);
    }

    const encoder = new TextEncoder();
    const supabase = createSupabaseClient();

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = "";

        try {
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            fullText += chunkText;
            controller.enqueue(encoder.encode(chunkText));
            await new Promise(resolve => setTimeout(resolve, 5));
          }          
        } catch {
          controller.close();
          return;
        }

        let emotionalStatus = "green";
        let emotionalInsight = "";
        let victoryText = "";
        let adminAlert: { action?: string; alert_type?: string } = {};
        const statusMatch = fullText.match(/\|\|\|([\s\S]*?)\|\|\|/);
        if (statusMatch) {
          try {
            const parsed = JSON.parse(statusMatch[1]) as { status: string; reason: string; victory?: string; action?: string; alert_type?: string };
            emotionalStatus = parsed.status;
            emotionalInsight = parsed.reason;
            victoryText = parsed.victory ?? "";
            if (parsed.action) adminAlert = { action: parsed.action, alert_type: parsed.alert_type };
          } catch { /* silencieux */ }
          fullText = fullText.replace(/\|\|\|[\s\S]*?\|\|\|/, "").trim();
        }
        
        if (patientId) {
          await supabase.from("conversations").insert([
            {
              patient_id: patientId,
              practitioner_id: practitionerId,
              role: "user",
              content: imageBase64 ? `📷 ${message || "Photo de repas"}` : message,
              session_id: sessionId ?? null,
            },
            {
              patient_id: patientId,
              practitioner_id: practitionerId,
              role: "assistant",
              content: fullText,
              session_id: sessionId ?? null,
            },
          ]);

          if (patientId) void incrementDailyMessageCount(patientId);
          await supabase.from("patients").update({
            emotional_status: emotionalStatus,
            emotional_insight: emotionalInsight,
            ...(victoryText ? { latest_victory: victoryText, victory_detected_at: new Date().toISOString() } : {}),
          }).eq("user_id", patientId);
        
          if (adminAlert.action === "admin_alert") {
            const { data: current } = await supabase.from("patients").select("admin_alerts").eq("user_id", patientId).single();
            const alerts = (current as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
            await supabase.from("patients").update({
              admin_alerts: [...alerts, { type: adminAlert.alert_type, date: new Date().toISOString(), seen: false }]
            }).eq("user_id", patientId);
          }
        
          if (sessionId) {
            await supabase.from("conversations_sessions").update({
              last_message: fullText.slice(0, 100),
              last_message_at: new Date().toISOString(),
            }).eq("id", sessionId);
          }
        }
        
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
        "X-Accel-Buffering": "no",
        "Cache-Control": "no-cache, no-transform",
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return Response.json({ response: "Erreur: " + errorMessage }, { status: 500 });
  }
}

export { invalidatePractitionerCache };

