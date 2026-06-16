import { GoogleAuth } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { getSessionUser } from "@/lib/api-auth";

// ─── Vertex AI ────────────────────────────────────────────────────────────────
const VERTEX_LOCATION = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
const VERTEX_PROJECT  = process.env.GOOGLE_CLOUD_PROJECT_ID!;

function vertexUrl(modelId: string, method: string): string {
  return `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${modelId}:${method}`;
}

// In-process token cache — reused on warm starts, regenerated on cold starts
let _cachedToken: { value: string; exp: number } | null = null;
async function getVertexToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.exp) return _cachedToken.value;
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!) as object;
  const auth = new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain Vertex AI access token");
  _cachedToken = { value: token, exp: Date.now() + 50 * 60 * 1000 };
  return token;
}

/** Non-streaming Vertex AI generateContent */
async function vertexGenerate(
  modelId: string,
  prompt: string,
  opts?: { maxOutputTokens?: number; temperature?: number }
): Promise<string> {
  const token = await getVertexToken();
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      ...(opts?.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
      ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
    },
  };
  const res = await fetch(vertexUrl(modelId, "generateContent"), {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Vertex AI ${res.status}: ${await res.text()}`);
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Streaming Vertex AI generateContent — yields text chunks via SSE */
async function* vertexStreamGenerate(
  modelId: string,
  contents: { role: string; parts: unknown[] }[],
  systemInstruction: string,
  generationConfig: { maxOutputTokens?: number; temperature?: number }
): AsyncGenerator<string> {
  const token = await getVertexToken();
  const body = {
    contents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig,
  };
  const res = await fetch(vertexUrl(modelId, "streamGenerateContent") + "?alt=sse", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Vertex AI stream ${res.status}: ${await res.text()}`);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (!json || json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch { /* ignore malformed SSE line */ }
    }
  }
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ═══ CONFIGURATION DES PLANS ═══
// Modèle chat : gemini-3.1-flash-lite pour tous les textes (tous plans confondus)
//               gemini-3-flash-preview uniquement si image Base64 détectée
// Mémoire    : Essentiel → 3 jours / 20 msg max, sans résumé
//              Pro+      → 7 jours / 40 msg max + résumé des messages plus anciens
const PLAN_CONFIG = {
  essentiel: {
    maxOutputTokens: 420,
    ragChunks: 5,
    dailyMessageLimit: 30,
    isFounder: false,
  },
  pro: {
    maxOutputTokens: 650,
    ragChunks: 8,
    dailyMessageLimit: 100,
    isFounder: false,
  },
  cabinet: {
    maxOutputTokens: 650,
    ragChunks: 8,
    dailyMessageLimit: 100,
    isFounder: false,
  },
  fondateur: {
    maxOutputTokens: 650,
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
  sosContext?: string; // contexte de triage SOS (fringale / stress / culpabilité / coup de mou)
  origin?: "crise" | "pratique"; // forcé par le client (ex: bibliothèque d'exercices → toujours "pratique")
  isPostExercise?: boolean; // follow-up chaud post-exercice — bypass total des effets de bord
  toolId?: string; // outil SOS utilisé (breathing, ancrage, etc.) — transmis avec isPostExercise
};

// ═══ GARDE-FOU BRUT — urgences vitales absolues uniquement ═══
// Ces mots-clés déclenchent un bypass immédiat AVANT tout appel LLM.
// Pour tout le reste (TCA, comportemental, implicite), c'est Gemini qui analyse.
const CRISIS_CRITICAL_KEYWORDS = [
  "suicide", "suicider", "me suicider", "suicidaire", "veux mourir", "envie de mourir",
  "je veux mourir", "en finir", "plus envie de vivre", "disparaître", "disparaitre",
  "me tuer", "me faire du mal", "mettre fin à ma vie", "fin à ma vie",
  "gorge qui serre", "gorge enfle", "lèvres gonflent", "lèvres gonflées", "allergie grave",
  "anaphylaxie", "epipen", "je suffoque", "je peux plus respirer",
  "douleur poitrine", "douleur thoracique", "bras gauche engourdi", "bras qui engourdit",
  "je perds connaissance", "je vais perdre connaissance", "vision floue soudaine",
  "paralysie", "je parle plus", "bouche tordue",
  "je tremble plus je peux", "sueurs froides et confus",
  "je vais le tuer", "je vais la tuer", "je vais faire du mal", "envie de frapper",
];

const CRISIS_CRITICAL_RESPONSES: Record<string, string> = {
  suicide: "Je t'entends, et ce que tu ressens est réel. Tu n'es pas seul(e). Appelle maintenant le 3114 - c'est le numéro national de prévention du suicide, disponible 24h/24, gratuit et confidentiel. Ton praticien sera également informé immédiatement. 🌿",
  medical: "Ce que tu décris nécessite une attention médicale immédiate. Appelle le 15 (SAMU) ou le 112 maintenant. Ne reste pas seul(e). Ton praticien sera informé.",
  threat: "Je prends note de ce que tu exprimes. Si tu te sens en danger ou si tu risques de faire du mal à quelqu'un, appelle le 17 (Police) ou le 112 immédiatement.",
};

function isCriticalKeyword(message: string): boolean {
  const lower = message.toLowerCase();
  return CRISIS_CRITICAL_KEYWORDS.some(kw => lower.includes(kw));
}

// ═══ PRE-FILTRE REGEX — signaux comportementaux / TCA ═══
// Première barrière locale (O(n) string scan) avant tout appel LLM.
// Si aucun signal détecté → bypass de analyzeCrisisWithLLM.
function hasBehavioralSignal(message: string): boolean {
  const lower = message.toLowerCase();
  return [
    // Détresse émotionnelle active
    "j'en peux plus", "je craque", "c'est trop dur", "à bout", "plus la force",
    "j'ai tout foiré", "j'ai échoué", "je me dégoûte", "honte de moi",
    "j'arrive plus", "je n'arrive plus", "déprimée", "déprimé",
    "je pleure", "je n'en peux plus", "c'est trop difficile",
    // TCA / perte de contrôle alimentaire
    "crise de boulimie", "binge", "hyperphagie", "j'ai tout mangé",
    "j'ai craqué", "je contrôle plus", "j'ai mangé en cachette",
    "pu m'arrêter", "plus m'arrêter", "j'ai vomi", "j'ai tout vomi",
    "laxatif", "je veux pas manger", "j'arrive pas à manger",
    "je mange plus", "je mange rien", "je mange pas",
    "je me purge",
    // Automutilation / comportemental
    "je me fais du mal", "me couper", "me blesser",
    // Désespoir / abandon
    "à quoi ça sert", "rien ne sert", "aucun espoir",
    "tout abandonner", "j'abandonne", "je renonce",
    "dégoût de moi", "je suis nulle", "je suis nul",
  ].some(kw => lower.includes(kw));
}

function getCriticalResponseType(message: string): string {
  const lower = message.toLowerCase();
  if (["suicide", "mourir", "en finir", "tuer", "disparaître", "disparaitre"].some(kw => lower.includes(kw))) return "suicide";
  if (["gorge", "respire", "poitrine", "thoracique", "bras", "paralysie", "tremble", "sueurs froides"].some(kw => lower.includes(kw))) return "medical";
  if (["je vais le tuer", "je vais la tuer", "faire du mal", "frapper"].some(kw => lower.includes(kw))) return "threat";
  return "suicide";
}

// ═══ ANALYSE CRISE LLM (garde-fou principal) ═══
// Appelé en parallèle du build de prompt principal pour chaque message non-vital.
type CrisisAnalysis = {
  level: "red_critical" | "red_behavioral" | "none";
  murmure: string;
};

async function analyzeCrisisWithLLM(message: string, patientContext: string): Promise<CrisisAnalysis> {
  try {
    const prompt = `Tu es un détecteur de crise pour un suivi nutritionnel. Analyse ce message d'un patient.

CONTEXTE PATIENT :
${patientContext.slice(0, 500)}

MESSAGE : "${message}"

Réponds UNIQUEMENT en JSON sans markdown :
- level :
  "red_critical" si intention suicidaire/urgence vitale explicite ou fortement implicite (mots-clés : en finir, me tuer, suicide).
  "red_behavioral" uniquement si le patient exprime une détresse émotionnelle active, une perte de contrôle alimentaire immédiate (crise d'hyperphagie, boulimie en cours/récente), ou un sentiment de dégoût profond de soi ("je me dégoûte", "j'ai tout foiré").
  ATTENTION : renvoie "none" si le message est une question théorique, informative, ou l'utilisation d'une question prédéfinie de l'interface (ex: "Comment résister à une fringale ?").
  "none" sinon.
- murmure : phrase courte (max 15 mots) pour le praticien si level != none, "" sinon.

{"level":"none","murmure":""}`;

    const raw = await vertexGenerate("gemini-3.1-flash-lite", prompt, { maxOutputTokens: 100, temperature: 0 });
    return JSON.parse(raw.replace(/```json|```/g, "").trim()) as CrisisAnalysis;
  } catch {
    return { level: "none", murmure: "" };
  }
}

function createSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getGeminiEmbedding(text: string): Promise<number[]> {
  const token = await getVertexToken();
  const res = await fetch(vertexUrl("gemini-embedding-2", "predict"), {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ content: text, task_type: "RETRIEVAL_DOCUMENT", output_dimensionality: 768 }],
    }),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${res.status}`);
  const data = await res.json() as { predictions?: { embeddings?: { values?: number[] } }[] };
  return data.predictions?.[0]?.embeddings?.values ?? [];
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

// ═══ RAG ÉTENDU ═══
// Tuyau systématique : consignes praticien injectées via getPatientProfile (déjà géré).
// Tuyau vectoriel : documents praticien + patient, filtre 4 mots désactivé si mot-clé médical.
async function hasDocuments(practitionerId: string, patientId?: string): Promise<boolean> {
  try {
    const cacheKey = `has_docs:${practitionerId}:${patientId ?? "global"}`;
    const cached = await redis.get<boolean>(cacheKey);
    if (cached !== null) return cached;

    const supabase = createSupabaseClient();
    let query = supabase.from("documents").select("*", { count: "exact", head: true }).eq("practitioner_id", practitionerId);
    if (patientId) query = query.or(`patient_id.eq.${patientId},patient_id.is.null`);
    const { count } = await query;

    const result = (count ?? 0) > 0;
    await redis.set(cacheKey, result, { ex: 3600 });
    return result;
  } catch {
    return false;
  }
}

function messageNeedsRAG(message: string, patientPathologies?: string): boolean {
  // Appelle le RAG pour tout message d'au moins 4 mots
  if (message.split(" ").length >= 4) return true;

  // Court mais contient un terme médical du dossier patient → RAG quand même
  if (patientPathologies) {
    const lower = message.toLowerCase();
    const pathoTerms = patientPathologies.toLowerCase().split(/[,;\s]+/).filter(t => t.length > 3);
    if (pathoTerms.some(term => lower.includes(term))) return true;
  }

  return false;
}

async function getRelevantDocuments(
  question: string,
  practitionerId: string,
  ragChunks: number,
  patientId?: string,
  patientPathologies?: string
): Promise<string> {
  try {
    const hasDocs = await hasDocuments(practitionerId, patientId);
    if (!hasDocs) return "";

    if (!messageNeedsRAG(question, patientPathologies)) return "";

    const supabase = createSupabaseClient();
    const queryEmbedding = await getGeminiEmbedding(question);

    // Recherche dans docs praticien + docs patient si patient_id existe
    const { data: globalDocs } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      practitioner_id: practitionerId,
      match_count: ragChunks,
    });

    let patientDocs: { content: string; similarity: number }[] = [];
    if (patientId) {
      try {
        const { data } = await supabase.rpc("match_patient_documents", {
          query_embedding: queryEmbedding,
          patient_id_param: patientId,
          match_count: Math.ceil(ragChunks / 2),
        });
        if (data) patientDocs = data as { content: string; similarity: number }[];
      } catch {
        // match_patient_documents n'existe peut-être pas encore — silencieux
      }
    }

    const allResults = [
      ...((globalDocs as { content: string; similarity: number }[] | null) ?? []),
      ...patientDocs,
    ];

    if (allResults.length === 0) return "";

    const relevant = allResults
      .filter(d => d.similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, ragChunks)
      .map(d => d.content)
      .join("\n\n");

    return relevant ? `\nDOCUMENTS DE RÉFÉRENCE :\n${relevant}\n` : "";
  } catch {
    return "";
  }
}

async function getPatientProfile(patientId: string): Promise<{ context: string; pathologies?: string }> {
  try {
    const cacheKey = `patient_profile_v2:${patientId}`;
    const cached = await redis.get<{ context: string; pathologies?: string }>(cacheKey);
    if (cached) return cached;

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
      regime_specifique?: string; practitioner_instruction?: unknown;
    } | null;

    if (!patient) return { context: "" };

    const levierLabels: Record<string, string> = {
      progres: "Voir des progrès concrets",
      encourage: "Se sentir encouragé(e)",
      comprendre: "Comprendre le fonctionnement",
      routine: "Avoir une routine stricte",
      supervise: "Savoir qu'il/elle est supervisé(e)",
      simplicite: "La simplicité des actions",
      autre: "Autre",
    };
    const moodLabels: Record<string, string> = {
      abloc: "Très motivé(e)",
      optimiste: "Optimiste",
      anxieux: "Un peu anxieux(se)",
      sceptique: "Un peu sceptique",
      perdu: "Complètement perdu(e)",
      fatigue: "Volontaire mais fatigué(e)",
    };

    const parts: string[] = [];
    if (patient.first_name) parts.push(`Prénom : ${patient.first_name}`);
    if (patient.age) parts.push(`Âge : ${patient.age} ans`);
    if (patient.sexe) parts.push(`Sexe : ${patient.sexe}`);
    if (patient.taille) parts.push(`Taille : ${patient.taille} cm`);
    if (patient.poids) parts.push(`Poids : ${patient.poids} kg`);
    if (patient.pathologies) parts.push(`Pathologies : ${patient.pathologies}`);
    if (patient.allergies) parts.push(`Allergies : ${patient.allergies}`);
    if (patient.traitements) parts.push(`Traitements : ${patient.traitements}`);
    if (patient.objectif_clinique) parts.push(`Objectif clinique : ${patient.objectif_clinique}`);
    if (patient.objective) parts.push(`Levier de motivation : ${levierLabels[patient.objective] ?? patient.objective}`);
    if (patient.niveau_activite) parts.push(`Niveau d'activité : ${patient.niveau_activite}`);
    if (patient.regime_specifique) parts.push(`Régime : ${patient.regime_specifique}`);
    if (patient.motivation) parts.push(`État d'esprit face au changement : ${moodLabels[patient.motivation] ?? patient.motivation}`);
    if (patient.defi) parts.push(`Plus gros défi déclaré : ${patient.defi}`);
    if (patient.aliments_aimes) parts.push(`Aliments aimés : ${patient.aliments_aimes}`);
    if (patient.aliments_detestes) parts.push(`Aliments détestés : ${patient.aliments_detestes}`);

    // Murmures / consignes praticien (tuyau systématique)
    const instructionDate = (patient as { instruction_updated_at?: string }).instruction_updated_at
      ? `(mis à jour le ${new Date((patient as { instruction_updated_at?: string }).instruction_updated_at!).toLocaleDateString("fr-FR")})`
      : "";

    const murmureSection = (() => {
      const instr = patient.practitioner_instruction;
      if (!instr) return "";
      // Format tableau de murmures
      if (Array.isArray(instr)) {
        const active = (instr as { text: string; expires_at?: string | null }[])
          .filter(m => !m.expires_at || new Date(m.expires_at) > new Date());
        if (active.length === 0) return "";
        return `\n🔴 MURMURES DU PRATICIEN - PRIORITÉ ABSOLUE ${instructionDate}\nCes consignes écrasent TOUT. Applique-les immédiatement et dans chaque réponse :\n${active.map(m => `• "${m.text}"`).join("\n")}\n`;
      }
      // Format texte simple
      const expires = (patient as { practitioner_instruction_expires_at?: string }).practitioner_instruction_expires_at;
      if (expires && new Date(expires) < new Date()) return "";
      return `\n🔴 MURMURE DU PRATICIEN - PRIORITÉ ABSOLUE ${instructionDate}\nCette consigne écrase TOUT autre instruction. Tu DOIS l'appliquer immédiatement et dans chaque réponse :\n"${instr as string}"\n`;
    })();

    const staticProfile = parts.length > 0
      ? `\nPROFIL DU PATIENT :\n${parts.join("\n")}\n${murmureSection ? `\nINSTRUCTIONS SPÉCIFIQUES DU PRATICIEN POUR CE PATIENT :${murmureSection}` : ""}`
      : "";

    const result = { context: staticProfile, pathologies: patient.pathologies };
    if (staticProfile) await redis.set(cacheKey, result, { ex: 3600 });
    return result;
  } catch {
    return { context: "" };
  }
}

async function summarizeOldMessages(messages: { role: string; content: string }[]): Promise<string> {
  try {
    const patientMessages = messages.filter((m) => m.role === "user").map((m) => m.content.slice(0, 400)).join(" | ");
    const text = await vertexGenerate(
      "gemini-3.1-flash-lite",
      `Résume en 5 lignes maximum les points clés de ces échanges patient-nutritionniste.
      Garde uniquement les faits importants : objectifs, écarts, progrès, préoccupations.
      Échanges : ${patientMessages}`
    );
    return `[RÉSUMÉ DES ÉCHANGES PRÉCÉDENTS : ${text}]`;
  } catch {
    const patientMessages = messages.filter((m) => m.role === "user").slice(0, 10).map((m) => m.content.slice(0, 100)).join(" | ");
    return `[RÉSUMÉ : ${patientMessages}]`;
  }
}

// ═══ MÉMOIRE HYBRIDE INDEXÉE SUR LE PLAN ═══
// Essentiel : fenêtre 3 jours / 20 messages max — mémoire immédiate uniquement, pas de résumé.
//             L'historique plus ancien est silencieusement coupé (levier d'upsell vers Pro).
// Pro+      : fenêtre 7 jours / 40 messages max — les messages hors fenêtre sont résumés
//             par summarizeOldMessages (gemini-3.1-flash-lite) et injectés en tête du contexte.
async function getConversationHistory(
  patientId: string,
  practitionerId: string,
  plan: PlanType,
  sessionId?: string
): Promise<{ role: "user" | "model"; parts: { text: string }[] }[]> {
  try {
    const supabase = createSupabaseClient();
    const isEssentiel = plan === "essentiel";
    const windowDays = isEssentiel ? 3 : 7;
    const hardCap = isEssentiel ? 20 : 40;
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    // Mémoire vive : messages dans la fenêtre temporelle du plan
    let recentQuery = supabase
      .from("conversations")
      .select("role, content, created_at")
      .eq("patient_id", patientId)
      .eq("practitioner_id", practitionerId)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: true })
      .limit(hardCap);

    if (sessionId) recentQuery = recentQuery.eq("session_id", sessionId);

    const { data: recentData } = await recentQuery;
    const recentMessages = (recentData as { role: string; content: string; created_at: string }[] | null) ?? [];

    const recentFormatted = recentMessages.map((m) => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    }));

    // Plan Essentiel : mémoire immédiate uniquement, on coupe sans résumé
    if (isEssentiel) return recentFormatted;

    // Plan Pro+ : mémoire long terme — résumer les messages hors fenêtre
    const { data: olderData } = await supabase
      .from("conversations")
      .select("role, content")
      .eq("patient_id", patientId)
      .eq("practitioner_id", practitionerId)
      .lt("created_at", windowStart)
      .order("created_at", { ascending: true })
      .limit(100);

    const olderMessages = (olderData as { role: string; content: string }[] | null) ?? [];
    if (olderMessages.length === 0) return recentFormatted;

    const summary = await summarizeOldMessages(olderMessages);
    return [
      { role: "user" as const, parts: [{ text: summary }] },
      ...recentFormatted,
    ];
  } catch {
    return [];
  }
}

function buildSystemPrompt(
  profile: Record<string, string> | null,
  patientContext: string,
  documentsContext: string,
  forceAncrage = false
): string {
  if (!profile) return getDefaultPrompt();

  const ancrageBlock = forceAncrage ? `
⚠️ MODE ANCRAGE BIENVEILLANT ACTIF ⚠️
Le patient traverse une période de vulnérabilité comportementale ou émotionnelle.
RÈGLES STRICTES pour ce mode :
- ZÉRO conseil nutritionnel, ZÉRO objectif, ZÉRO programme.
- 100% écoute active, validation émotionnelle, ancrage TCC.
- Si le patient demande un conseil alimentaire, dis doucement que vous y reviendrez quand il se sentira prêt.
- Ton praticien est informé et prendra le relais à la prochaine séance.
` : "";

  return `Tu ES le Jumeau Numérique de ce nutritionniste expert. Le patient ne doit jamais sentir qu'il parle à une machine, mais à une extension directe de l'esprit et de la méthode de son praticien.
${ancrageBlock}
IDENTITÉ & POSTURE :
- Ton de communication : ${profile.tone_of_voice || "bienveillant et professionnel"}
- Mode d'adresse : ${profile.tutoiement || "vouvoiement"}
- Niveau de langage : ${profile.technicite || "adapté au patient"}
- Longueur des réponses : ${profile.longueur_reponses || "courte et précise"}
- Émojis : ${profile.emojis || "avec modération"}

PHILOSOPHIE NUTRITIONNELLE :
- Approche principale : ${profile.approche_generale || "rééquilibrage progressif"}
- Spécialités : ${profile.pathologies || "généraliste"}
- Position régimes : ${profile.position_regimes || "cas par cas"}
- Glucides : ${profile.position_glucides || "selon objectif"}
- Jeûne intermittent : ${profile.position_jeune || "cas par cas selon le patient"}
- Compléments alimentaires : ${profile.position_complements || "selon les besoins identifiés"}
- Petit-déjeuner : ${profile.position_petit_dejeuner || "optionnel, adapté au patient"}
- Sensibilité budget : ${profile.sensibilite_budget || "adapté au budget du patient"}
- Orientation produits : ${profile.orientation_produits || "flexibilité selon le patient"}
- Conviction fondamentale : ${profile.conviction || "non spécifiée"}
- Ne jamais recommander : ${profile.jamais_dire || "rien de spécifique"}

GESTION HUMAINE :
- Alimentation émotionnelle : ${profile.alimentation_emotionnelle || "travail global"}
- Si non-suivi : ${profile.non_suivi || "bienveillance totale"}
- Fêtes et vacances : ${profile.fetes_vacances || "équilibre sur la durée"}
- Pour remotiver : ${profile.levier_motivation || "valoriser les petits progrès"}
- Face à un patient perfectionniste : ${profile.profil_perfectionniste || "valoriser la rigueur tout en aidant à accepter l'équilibre sur la durée"}
- Adaptation selon le profil patient : ${profile.adaptation_profil || "j'adapte le fond et la forme selon la personne"}

SÉCURITÉ & LIMITES :
- Périmètre d'action : ${profile.perimetre || "prudence sur les pathologies"}
- Questions médicales complexes : ${profile.questions_medicales || "rediriger vers le médecin"}
- Détresse psychologique : ${profile.urgence_detresse || "empathie et alerte praticien"}
- Ligne rouge absolue : ${profile.ligne_rouge || "ne jamais culpabiliser"}

MA VISION — PHILOSOPHIE FONDAMENTALE :
${profile.vision || "Bienveillant, personnalisé, centré sur le patient."}

MA SIGNATURE — VOIX, MÉTAPHORES ET MANTRAS :
${profile.signature ? profile.signature : "Utilise un ton authentique et humain, cohérent avec la posture définie ci-dessus."}

EXEMPLES DE RÉPONSES ATTENDUES :
- Craquage nocturne : "${profile.situation_craquage || "Un écart ne définit pas votre parcours. On repart ensemble."}"
- Stagnation de la balance : "${profile.situation_stagnation || "La stagnation est normale, explorons ce qui se passe ensemble."}"
- Patient disparu / honte de revenir : "${profile.situation_abandon || "Aucun jugement ici. L'important c'est que vous soyez là maintenant."}"
- Question prédiabète/féculents : "${profile.situation_prediabete || "C'est une excellente question pour votre médecin traitant."}"
- Question alcool week-end : "${profile.situation_alcool || "L'équilibre se construit sur la durée, pas sur une soirée."}"
- Complément ou tendance douteuse : "${profile.situation_marketing || "Restons sur des approches dont l'efficacité est prouvée."}"
- Objectif irréaliste : "${profile.situation_drastique || "Je comprends l'urgence. Voyons ce qui est raisonnablement atteignable."}"
- Flemme / pas le temps de cuisiner : "${profile.situation_flemme || "Pas de panique. Voici 2-3 options rapides qui respectent votre protocole."}"
- Coup dur / plus la force : "${profile.situation_coup_dur || "On met le programme entre parenthèses. Prenez soin de vous d'abord."}"

═══ HIÉRARCHIE ABSOLUE DES INSTRUCTIONS ═══
Tu dois respecter cet ordre de priorité strict, du plus important au moins important :
1. MURMURE DU PRATICIEN (consigne temps réel) - priorité ABSOLUE, écrase tout le reste
2. DOCUMENTS RAG (protocoles et expertise indexés) - ta base de connaissance métier
3. PERSONNALITÉ (les paramètres ci-dessus) - ton style et ta posture

${patientContext}${documentsContext}

RÈGLES ABSOLUES :
- PRIORITÉ EMPATHIQUE : Si le patient exprime une vulnérabilité, privilégie la chaleur AVANT tout conseil.
- INTERDICTION de Markdown (gras, listes, titres). Texte brut uniquement.
- Maximum 150 mots par réponse.
- Commencer par une validation empathique avant tout conseil.
- Utiliser le prénom du patient pour créer du lien.
- Ne JAMAIS dire "En tant qu'IA", "En tant que modèle de langue" ou similaire.
- Ne jamais inventer des informations médicales non confirmées.
- Grossesse : félicite, redirige vers gynécologue/sage-femme, praticien adaptera le suivi.
- TCA grave : stop conseils alimentaires, valide l'émotion, annonce relais praticien.
- Arrêt de traitement : "Seul votre médecin traitant peut modifier votre traitement."

COMMANDE ADMINISTRATIVE :
Si le message commence par [ADMIN:identity_correction] :
- Réponds uniquement : "C'est noté. J'ai transmis la demande de correction à votre praticien pour que votre dossier soit parfaitement à jour. Pouvez-vous me préciser l'orthographe exacte de votre nom ?"
- Ajoute obligatoirement : |||{"status":"green","reason":"demande correction identité","victory":"","action":"admin_alert","alert_type":"identity_correction"}|||

JSON TECHNIQUE OBLIGATOIRE - À ajouter en toute fin de réponse, invisible pour le patient :
|||{"status":"green","reason":"météo émotionnelle en 4-8 mots","notable":false,"victory":"","apaisement":"non"}|||
- status : "red_critical" si urgence vitale implicite détectée, "red_behavioral" si détresse comportementale/TCA/psychologique sévère, "green" si tout va bien
- reason : TOUJOURS rempli — météo émotionnelle du patient en 4-8 mots, dynamique et précise.
  Exemples green : "En confiance", "Motivé(e) malgré la fatigue", "Serein(e) et régulier(e)", "Curieux(se) de progresser", "Anxieux(se) mais motivé(e)", "Frustré(e) face aux écarts"
  Exemples red_behavioral : "Détresse émotionnelle active", "Perte de contrôle alimentaire", "Dégoût de soi exprimé"
  Exemples red_critical : "Urgence vitale exprimée", "Pensées de passage à l'acte"
  Ne jamais laisser vide. Ne jamais écrire "patient va bien" ou "aucune alerte".
- notable : true si ce message révèle quelque chose cliniquement utile à signaler au praticien (émotion significative, tension, progression, régression, victoire, changement de dynamique). false si échange de routine (question nutritionnelle banale, logistique, rappel de règles). En cas de doute, préfère false.
- victory : UNE phrase courte UNIQUEMENT si le patient rapporte une réussite TCC concrète (ex: résister à une fringale, écouter sa satiété, gérer une envie de crise sans craquer, reprendre après un écart sans culpabilité). Exemples : "A écouté sa satiété ce soir", "A résisté à la fringale du soir", "A repris sans culpabilité après l'écart". Vide "" sinon.
  IMPORTANT : le simple fait d'avoir terminé un exercice de relaxation/respiration/marche/ancrage en routine ou en prévention n'est PAS une victoire, même si le patient se dit content ou apaisé. Ne remplis "victory" que si l'exercice (ou l'échange) a permis d'éviter, d'interrompre ou de traverser une crise réelle (alimentaire, anxieuse, compulsive) qui était en cours ou imminente. Engagement/régularité ≠ victoire clinique.
- apaisement : "oui" UNIQUEMENT si le patient exprime un retour au calme réel après une détresse exprimée dans cette même conversation (ex : "je me sens mieux", "ça va mieux", "j'ai soufflé", "je suis plus calme", "ça m'a aidé"). Ne jamais mettre "oui" si aucune détresse n'a été exprimée avant dans la conversation, ni sur un simple "ça va" sans contexte de crise, ni si l'amélioration reste incertaine ou partielle. "non" par défaut.

RÈGLE TRIGGER_SOS (post-chat uniquement) :
Si et seulement si le patient exprime une détresse aiguë (compulsion alimentaire en cours et incontrôlable, crise d'anxiété sévère, pensées intrusives incontrôlables, sentiment de perte de contrôle imminente), ajoute à la toute fin de ta réponse, après le JSON technique, ce tag EXACTEMENT :
[TRIGGER_SOS: exo_1, exo_2]
Remplace exo_1 et exo_2 par les deux exercices les plus adaptés à la situation parmi : breathing, ancrage, manger, ecriture, defusion
N'utilise ce tag QUE pour une détresse aiguë réelle — JAMAIS pour une simple pensée négative, une frustration passagère, un écart alimentaire sans crise, ou une difficulté ordinaire.
Le tag ne doit jamais apparaître dans le texte visible de ta réponse — place-le uniquement après le bloc |||json|||.`;
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
      sosContext,
      origin,
      isPostExercise,
      toolId,
    } = await request.json() as ChatRequest;

    // Auth
    if (patientId) {
      const user = await getSessionUser();
      if (!user) return Response.json({ error: "Non autorisé." }, { status: 401 });
      if (user.id !== patientId) return Response.json({ error: "Accès refusé." }, { status: 403 });
    }

    // ═══ BYPASS IMMÉDIAT — mots-clés urgences vitales ═══
    if (message && isCriticalKeyword(message) && patientId && practitionerId) {
      const supabase = createSupabaseClient();
      const responseType = getCriticalResponseType(message);
      const criticalResponse = CRISIS_CRITICAL_RESPONSES[responseType];

      // Vérification via modèle lourd — urgences vitales absolues (zéro faux négatif acceptable)
      const verifyText = (await vertexGenerate(
        "gemini-3.1-flash-lite",
        `Ce message exprime-t-il un danger de mort immédiat pour le patient ou pour autrui ? Réponds uniquement par "oui" ou "non". Message : "${message}"`,
        { maxOutputTokens: 10, temperature: 0 }
      )).trim().toLowerCase();

      if (verifyText.includes("oui")) {
        await supabase.from("patients").update({ emotional_status: "red_critical", emotional_insight: "Urgence vitale détectée" }).eq("user_id", patientId);
        const { data: current } = await supabase.from("patients").select("admin_alerts").eq("user_id", patientId).single();
        const alerts = (current as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
        await supabase.from("patients").update({
          // type: "crisis" — clé saturée pour traçabilité audit et rendu Dashboard (LeverAlerteCritique)
          admin_alerts: [...alerts, { type: "crisis", alert_type: "critical", date: new Date().toISOString(), seen: false, message: message.slice(0, 200) }]
        }).eq("user_id", patientId);

        try {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-crisis-alert`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-crisis-token": process.env.CRISIS_SECRET_TOKEN ?? "" },
            body: JSON.stringify({ patientId, practitionerId, alertType: responseType, message }),
          });
        } catch { /* silencieux */ }

        return new Response(criticalResponse, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    }

    // ═══ SOS avec triage ═══
    if (isSOS && patientId && practitionerId) {
      const supabase = createSupabaseClient();
      const { context: patientContext } = await getPatientProfile(patientId);

      const { data: patientRaw } = await supabase
        .from("patients")
        .select("first_name, practitioner_instruction, pathologies, defi, motivation, emotional_status")
        .eq("user_id", patientId)
        .single();

      const patient = patientRaw as {
        first_name?: string; practitioner_instruction?: string;
        pathologies?: string; defi?: string; motivation?: string; emotional_status?: string;
      } | null;

      // ═══ ORIGIN — "crise" (situation rouge) vs "pratique" (exercice initié calmement) ═══
      // Cas A (détection auto [TRIGGER_SOS]) : sosContext préfixé "[contexte chat récent]" → toujours "crise".
      // Auto-déclenché ("Mon Soutien") : "crise" uniquement si le patient était déjà en red / red_behavioral
      // au moment du déclenchement, sinon "pratique".
      // Bibliothèque d'exercices : origin forcé "pratique" par le client, quel que soit l'état émotionnel
      // (geste proactif délibéré, même en période rouge).
      const isAiDetected = !!sosContext?.startsWith("[contexte chat récent]");
      const wasInCrisis = patient?.emotional_status === "red" || patient?.emotional_status === "red_behavioral";
      const sosOrigin: "crise" | "pratique" = origin === "pratique"
        ? "pratique"
        : (isAiDetected || wasInCrisis) ? "crise" : "pratique";

      const moodLabels: Record<string, string> = {
        abloc: "Très motivé(e)", optimiste: "Optimiste", anxieux: "Un peu anxieux(se)",
        sceptique: "Un peu sceptique", perdu: "Complètement perdu(e)", fatigue: "Volontaire mais fatigué(e)",
      };

      const mirrorContext = [
        patient?.practitioner_instruction ? `Consigne praticien : "${patient.practitioner_instruction}"` : "",
        patient?.defi ? `Plus gros défi : "${patient.defi}"` : "",
        patient?.motivation ? `État d'esprit habituel : "${moodLabels[patient.motivation] ?? patient.motivation}"` : "",
        patient?.pathologies ? `Pathologies : "${patient.pathologies}"` : "",
        sosContext ? `TYPE DE CRISE DÉCLARÉ PAR LE PATIENT : "${sosContext}"` : "",
      ].filter(Boolean).join("\n");

      const { data: recentMessages } = await supabase
        .from("conversations")
        .select("role, content")
        .eq("patient_id", patientId)
        .eq("practitioner_id", practitionerId)
        .order("created_at", { ascending: false })
        .limit(3);

      const { data: recentSOS } = await supabase
        .from("sos_events")
        .select("raw_response, triggered_at")
        .eq("patient_id", patientId)
        .order("triggered_at", { ascending: false })
        .limit(3);

      const recentTools = (recentSOS ?? [])
        .map(e => { try { return (JSON.parse(e.raw_response as string) as { tool_id?: string }).tool_id ?? null; } catch { return null; } })
        .filter(Boolean).join(", ");

      const context = (recentMessages ?? []).reverse()
        .map((m: { role: string; content: string }) => `${m.role === "user" ? "Patient" : "Jumeau"}: ${m.content}`)
        .join("\n");

      const firstName = patient?.first_name ?? "le patient";

      // Mapping sosContext → outils prioritaires
      const sosToolHints: Record<string, string> = {
        "fringale": "manger ou body_scan",
        "stress": "breathing ou ancrage",
        "culpabilité": "defusion ou ecriture",
        "coup de mou": "marche ou adaptive_coaching",
      };
      const toolHint = sosContext
        ? Object.entries(sosToolHints).find(([key]) => sosContext.toLowerCase().includes(key))?.[1] ?? ""
        : "";

      const sosPrompt = `Tu es le Jumeau Numérique d'un nutritionniste expert. Tu dois choisir et personnaliser un outil de soutien émotionnel pour ${firstName}.

CONTEXTE PATIENT :
${patientContext}

PERSONNALISATION MIROIR :
${mirrorContext || "Pas de données spécifiques."}

DERNIERS ÉCHANGES :
${context || "Aucun échange récent."}

RÈGLES :
- Choisis l'outil parmi : breathing, ancrage, manger, marche, body_scan, defusion, ecriture, adaptive_coaching
${toolHint ? `- TYPE DE CRISE DÉCLARÉ : "${sosContext}" → Privilégie : ${toolHint}` : ""}
- ANTI-REDONDANCE : Outils récemment utilisés : ${recentTools || "aucun"}. Évite de reproposer le même.
- Le twin_message : max 30 mots, valide l'émotion (70%), transition douce vers l'exercice.
- Les steps du tool_script : personnalisés, jamais génériques, adaptés au profil du patient.
- Si adaptive_coaching : génère des steps suivant une approche TCC (identifier pensée automatique, questionner, action concrète).

Réponds UNIQUEMENT en JSON sans markdown ni backticks :
{"tool_id":"breathing","twin_message":"Message personnalisé max 30 mots","tool_script":{"step_1":"instruction personnalisée","step_2":"instruction personnalisée","step_3":"instruction personnalisée"}}`;

      const sosText = (await vertexGenerate(
        "gemini-3.1-flash-lite",
        sosPrompt,
        { maxOutputTokens: 400, temperature: 0.7 }
      )).trim().replace(/```json|```/g, "").trim();

      try {
        await supabase.from("sos_events").insert({
          patient_id: patientId,
          practitioner_id: practitionerId,
          triggered_at: new Date().toISOString(),
          raw_response: sosText,
          sos_context: sosContext ?? null,
          status: "pending",
          origin: sosOrigin,
        });
      } catch { /* silencieux */ }

      try {
        return Response.json({ tool: JSON.parse(sosText) });
      } catch {
        return Response.json({
          tool: { tool_id: "breathing", twin_message: `${firstName}, prenons un moment pour souffler ensemble.`, tool_script: {} },
        });
      }
    }

    // ═══ POST-EXERCICE — question fixe personnalisée, zéro LLM, zéro effet de bord ═══
    // Ce canal ne touche pas emotional_status, ne sauvegarde pas le message système,
    // ne déclenche aucune analyse de crise. Seule la question fixe est renvoyée + persistée.
    if (isPostExercise && patientId && practitionerId) {
      const supabase = createSupabaseClient();

      const { data: patientRow } = await supabase
        .from("patients")
        .select("first_name")
        .eq("user_id", patientId)
        .single();

      const firstName = (patientRow as { first_name?: string } | null)?.first_name?.trim() ?? "";

      // Noms lisibles des exercices
      const toolNames: Record<string, string> = {
        breathing: "la cohérence cardiaque", ancrage: "l'ancrage sensoriel",
        manger: "la pleine conscience alimentaire", marche: "la marche consciente",
        body_scan: "le body scan", defusion: "la défusion cognitive",
        ecriture: "l'écriture cathartique", adaptive_coaching: "le coaching TCC",
      };
      const exerciseName = toolId ? (toolNames[toolId] ?? "l'exercice") : "l'exercice";

      // Si le patient a partagé son ressenti, générer un message de clôture Gemini
      if (message?.trim()) {
        try {
          const closingPrompt = `Tu es le Jumeau Numérique bienveillant d'un nutritionniste.
${firstName ? `Le patient s'appelle ${firstName}.` : ""}
Le patient vient de terminer ${exerciseName} et partage son ressenti : "${message.trim()}"

Génère UN seul message de clôture chaleureux de 1 à 2 phrases courtes. Il doit :
- Valider ce ressenti avec sincérité, sans effusion excessive
- Renforcer le geste positif accompli (prendre soin de soi)
- Aucun conseil, aucune question, aucun sujet nutritionnel
- Jamais plus de 40 mots
- Pas de markdown, texte brut uniquement

Réponds uniquement avec le message de clôture, rien d'autre.`;

          const closingText = (await vertexGenerate(
            "gemini-3.1-flash-lite",
            closingPrompt,
            { maxOutputTokens: 120, temperature: 0.75 }
          )).trim();

          if (closingText) {
            await supabase.from("conversations").insert({
              patient_id: patientId,
              practitioner_id: practitionerId,
              role: "assistant",
              content: closingText,
              session_id: null,
            });

            return new Response(closingText, {
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          }
        } catch { /* fallback ci-dessous */ }
      }

      // Fallback : message de clôture fixe si pas de ressenti ou erreur Gemini
      const greeting = firstName ? `${firstName}, c` : "C";
      const fallbackText = `${greeting}'est noté. Chaque moment de soin que tu t'accordes compte.`;

      return new Response(fallbackText, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // ═══ FLOW PRINCIPAL ═══

    const practitionerData = practitionerId
      ? await getPractitionerData(practitionerId)
      : { plan: "essentiel" as PlanType, profile: null };

    const plan = practitionerData.plan;
    const config = PLAN_CONFIG[plan];

    // Rate limit
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
      const warningThreshold = Math.floor(config.dailyMessageLimit * 0.9);
      showWarning = dailyCount >= warningThreshold && dailyCount < config.dailyMessageLimit;
    }

    // Récupérer statut actuel du patient
    const supabaseMain = createSupabaseClient();
    let currentEmotionalStatus = "green";

    if (patientId) {
      const { data: patientStatus } = await supabaseMain
        .from("patients")
        .select("emotional_status")
        .eq("user_id", patientId)
        .single();
      if (patientStatus) {
        currentEmotionalStatus = (patientStatus as { emotional_status?: string }).emotional_status ?? "green";
      }
    }

    // ID stable généré ici — utilisé pour lier les admin_alerts et victoires au message patient
    const userMsgId = crypto.randomUUID();
    // Flag pour éviter de créer deux admin_alerts comportementaux (détection précoce + Gemini JSON)
    let earlyBehavioralDetected = false;

    // Paralléliser : profil patient + documents + analyse crise LLM
    const profileResult = patientId ? getPatientProfile(patientId) : Promise.resolve({ context: "", pathologies: undefined });
    // Pre-filtre regex : bypass analyzeCrisisWithLLM si aucun signal comportemental détecté
    const crisisPromise = (message && patientId && hasBehavioralSignal(message))
      ? profileResult.then(p => analyzeCrisisWithLLM(message, p.context))
      : Promise.resolve<CrisisAnalysis>({ level: "none", murmure: "" });

    const [{ context: patientContext, pathologies: patientPathologies }, crisisAnalysis] = await Promise.all([
      profileResult,
      crisisPromise,
    ]);

    const documentsContext = practitionerId
      ? await getRelevantDocuments(message, practitionerId, config.ragChunks, patientId, patientPathologies)
      : "";

    // Gérer crise LLM détectée
    if (crisisAnalysis.level === "red_critical" && patientId && practitionerId) {
      await supabaseMain.from("patients").update({ emotional_status: "red_critical", emotional_insight: crisisAnalysis.murmure || "Urgence détectée par IA" }).eq("user_id", patientId);
      const { data: cur } = await supabaseMain.from("patients").select("admin_alerts").eq("user_id", patientId).single();
      const alerts = (cur as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
      await supabaseMain.from("patients").update({
        admin_alerts: [...alerts, { type: "admin_alert", alert_type: "critical_llm", date: new Date().toISOString(), seen: false, murmure: crisisAnalysis.murmure, trigger_message_id: userMsgId }]
      }).eq("user_id", patientId);
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-crisis-alert`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-crisis-token": process.env.CRISIS_SECRET_TOKEN ?? "" },
          body: JSON.stringify({ patientId, practitionerId, alertType: "implicit_critical", message }),
        });
      } catch { /* silencieux */ }
    }

    if (crisisAnalysis.level === "red_behavioral" && patientId && practitionerId) {
      earlyBehavioralDetected = true;
      await supabaseMain.from("patients").update({
        emotional_status: "red_behavioral",
        emotional_insight: crisisAnalysis.murmure || "Alerte comportementale détectée",
      }).eq("user_id", patientId);
      // Alerte discrète sur le Dashboard uniquement (pas d'email pour éviter le spam praticien)
      const { data: cur } = await supabaseMain.from("patients").select("admin_alerts").eq("user_id", patientId).single();
      const alerts = (cur as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
      await supabaseMain.from("patients").update({
        admin_alerts: [...alerts, { type: "admin_alert", alert_type: "behavioral", date: new Date().toISOString(), seen: false, murmure: crisisAnalysis.murmure, trigger_message_id: userMsgId }]
      }).eq("user_id", patientId);
    }

    const forceAncrage = crisisAnalysis.level === "red_behavioral"
      || currentEmotionalStatus === "red_behavioral";

    const practitionerPrompt = systemPrompt ||
      buildSystemPrompt(practitionerData.profile, patientContext, documentsContext, forceAncrage);

    let conversationHistory: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    if (patientId && practitionerId) {
      conversationHistory = await getConversationHistory(patientId, practitionerId, plan, sessionId);
    }

    // ═══ GARDE VISION — plan pro/cabinet/fondateur requis ═══
    if (imageBase64) {
      const visionAllowedPlans: PlanType[] = ["pro", "cabinet", "fondateur"];
      if (!visionAllowedPlans.includes(plan)) {
        // Invalide le cache au cas où le plan aurait changé récemment
        if (practitionerId) await invalidatePractitionerCache(practitionerId);
        return new Response(
          JSON.stringify({ error: "vision_plan_required", message: "L'analyse de repas par photo nécessite un abonnement Pro ou Cabinet." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Routage modèle : gemini-3.1-flash-lite pour tout le texte (tous plans),
    // gemini-3-flash-preview uniquement si image Base64 présente dans la requête.
    const modelName = imageBase64 ? "gemini-3-flash-preview" : "gemini-3.1-flash-lite";

    // Build Vertex AI content array: history + current user turn
    let userParts: unknown[];
    if (imageBase64 && imageMimeType) {
      const visionPrompt = `Tu reçois une photo de repas d'un patient en suivi nutritionnel.
${patientContext}${documentsContext}
Analyse :
1. Identifie les aliments visibles et les proportions approximatives
2. Croise avec le protocole du praticien et le profil patient
3. Signale tout écart (allergies, intolérances, consignes spécifiques)
4. Réponds en tant que jumeau numérique - ton bienveillant, jamais culpabilisant
${message ? `\nMessage du patient : "${message}"` : ""}
Max 150 mots. Sans markdown.`;
      userParts = [
        { inlineData: { data: imageBase64, mimeType: imageMimeType } },
        { text: visionPrompt },
      ];
    } else {
      userParts = [{ text: message }];
    }
    const chatContents = [
      ...conversationHistory,
      { role: "user", parts: userParts },
    ];

    const encoder = new TextEncoder();
    const supabase = createSupabaseClient();

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = "";

        try {
          for await (const chunkText of vertexStreamGenerate(modelName, chatContents, practitionerPrompt, { maxOutputTokens: config.maxOutputTokens, temperature: 0.78 })) {
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
        let apaisementConfirme = false;
        let adminAlert: { action?: string; alert_type?: string } = {};
        const statusMatch = fullText.match(/\|\|\|([\s\S]*?)\|\|\|/);
        if (statusMatch) {
          try {
            const parsed = JSON.parse(statusMatch[1]) as { status: string; reason: string; notable?: boolean; victory?: string; action?: string; alert_type?: string; apaisement?: string };
            emotionalStatus = parsed.status;
            // emotional_insight : uniquement si Gemini juge le moment cliniquement notable
            // (ou si status non-vert — toujours pertinent pour le praticien)
            if (parsed.notable === true || parsed.status !== "green") {
              emotionalInsight = parsed.reason;
            }
            victoryText = parsed.victory ?? "";
            apaisementConfirme = parsed.apaisement === "oui";
            if (parsed.action) adminAlert = { action: parsed.action, alert_type: parsed.alert_type };
          } catch { /* silencieux */ }
          fullText = fullText.replace(/\|\|\|[\s\S]*?\|\|\|/, "").trim();
        }

        // ═══ Résolution apaisement — uniquement piloté par Gemini ═══
        const isRedCritical = currentEmotionalStatus === "red_critical";

        const shouldResolveApaisement = apaisementConfirme && !isRedCritical
          && currentEmotionalStatus === "red_behavioral";

        if (isRedCritical) {
          // red_critical ne change jamais automatiquement — verrou praticien absolu
          emotionalStatus = "red_critical";
        } else if (shouldResolveApaisement) {
          emotionalStatus = "green";
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

          void incrementDailyMessageCount(patientId);

          // ═══ BRIDAGE emotional_status — uniquement sur événements majeurs ═══
          // Ne jamais écrire emotional_status pour les messages de routine (green stable).
          // Seuls changements légitimes :
          //   1) Crise détectée → red_critical ou red_behavioral
          //   2) Résolution apaisement → green (depuis red_behavioral)
          const isSignificantStatusChange =
            emotionalStatus === "red_critical" ||
            emotionalStatus === "red_behavioral" ||
            shouldResolveApaisement ||
            (currentEmotionalStatus !== "green" && emotionalStatus === "green");

          // Apaisement confirmé → identifier le sos_event "pending" le plus récent
          // (servira à le marquer "success" ET à évaluer la 🏆 auto ci-dessous)
          type ResolvedSosEvent = { id: string; origin?: string; sos_context?: string | null; raw_response?: string | null };
          let resolvedSosEvent: ResolvedSosEvent | null = null;
          if (shouldResolveApaisement) {
            try {
              const { data: recentSosEvent } = await supabase
                .from("sos_events")
                .select("id, origin, sos_context, raw_response")
                .eq("patient_id", patientId)
                .in("status", ["pending"])
                .order("triggered_at", { ascending: false })
                .limit(1)
                .single();
              if (recentSosEvent?.id) resolvedSosEvent = recentSosEvent as ResolvedSosEvent;
            } catch { /* silencieux — pas d'event en attente */ }
          }

          // ═══ 🏆 VICTOIRE AUTO — une crise réellement désamorcée (origin "crise") est toujours
          // une victoire, même si Gemini n'a rien détecté dans son champ libre "victory" ═══
          let autoVictoryText = "";
          if (resolvedSosEvent?.origin === "crise" && !victoryText) {
            const sosToolNames: Record<string, string> = {
              breathing: "la cohérence cardiaque", ancrage: "l'ancrage sensoriel",
              manger: "la pleine conscience alimentaire", marche: "la marche consciente",
              body_scan: "le body scan", defusion: "la défusion cognitive",
              ecriture: "l'écriture cathartique", adaptive_coaching: "le coaching TCC",
            };
            let resolvedToolId: string | null = null;
            try { resolvedToolId = (JSON.parse(resolvedSosEvent.raw_response ?? "{}") as { tool_id?: string }).tool_id ?? null; } catch { /* ignore */ }
            const exerciseLabel = resolvedToolId ? sosToolNames[resolvedToolId] ?? null : null;
            const rawContext = (resolvedSosEvent.sos_context ?? "").split("|")[0]?.trim();
            const crisisLabel = rawContext && !rawContext.startsWith("[contexte chat récent]") ? `une crise (${rawContext})` : "un moment difficile";
            autoVictoryText = exerciseLabel ? `A surmonté ${crisisLabel} grâce à ${exerciseLabel}.` : `A surmonté ${crisisLabel}.`;
          }
          const finalVictoryText = victoryText || autoVictoryText;

          const patientStatusUpdate: Record<string, unknown> = {
            // emotional_insight : toujours la météo humaine de Gemini — jamais de libellé technique
            // Uniquement mis à jour si non-vide pour ne pas écraser un insight existant
            ...(emotionalInsight ? { emotional_insight: emotionalInsight } : {}),
            ...(finalVictoryText ? { latest_victory: finalVictoryText, victory_detected_at: new Date().toISOString(), victory_message_id: userMsgId } : {}),
          };
          // emotional_status uniquement sur changements majeurs
          if (isSignificantStatusChange) {
            patientStatusUpdate.emotional_status = emotionalStatus;
          }
          // Mettre à jour le timestamp du dernier message patient (pour indicateur silence 24h)
          patientStatusUpdate.last_patient_message_at = new Date().toISOString();
          await supabase.from("patients").update(patientStatusUpdate).eq("user_id", patientId);

          // Apaisement confirmé → marquer le sos_event résolu en "success"
          if (resolvedSosEvent?.id) {
            try {
              await supabase.from("sos_events").update({ status: "success" }).eq("id", resolvedSosEvent.id);
            } catch { /* silencieux */ }
          }

          // Créer admin_alert via JSON Gemini — seulement si pas déjà créée par détection précoce
          if (adminAlert.action === "admin_alert" && !isRedCritical && !earlyBehavioralDetected) {
            const { data: current } = await supabase.from("patients").select("admin_alerts").eq("user_id", patientId).single();
            const alerts = (current as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
            await supabase.from("patients").update({
              admin_alerts: [...alerts, { type: adminAlert.alert_type, date: new Date().toISOString(), seen: false, trigger_message_id: userMsgId }]
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
