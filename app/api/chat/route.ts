import { GoogleAuth } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { getSessionUser } from "@/lib/api-auth";
import { reportCriticalEvent } from "@/lib/observability";

// ─── Vertex AI ────────────────────────────────────────────────────────────────
// REST API hard-coded to EU multi-region — independent of any env var.
// Gemini Live WebSocket stays on us-central1 (see lib/geminiLiveClient.ts).
const VERTEX_LOCATION = "eu";
const VERTEX_HOST     = "aiplatform.eu.rep.googleapis.com";
const VERTEX_PROJECT  = process.env.GOOGLE_CLOUD_PROJECT_ID!;
const PROMPT_VERSION  = "v2"; // bump when buildCacheablePrompt template changes

function vertexUrl(modelId: string, method: string): string {
  return `https://${VERTEX_HOST}/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${modelId}:${method}`;
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
  opts?: { maxOutputTokens?: number; temperature?: number; thinkingBudget?: number }
): Promise<string> {
  const token = await getVertexToken();
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      ...(opts?.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
      ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
      // thinkingBudget: 0 = désactive le raisonnement (modèle fort sans overhead thinking).
      ...(opts?.thinkingBudget !== undefined ? { thinkingConfig: { thinkingBudget: opts.thinkingBudget } } : {}),
    },
  };
  const res = await fetch(vertexUrl(modelId, "generateContent"), {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Vertex AI ${res.status}: ${await res.text()}`);
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  // Concaténer TOUTES les parts sauf le raisonnement (`thought`) — cf. vertexStreamGenerate.
  // Ne prendre que parts[0] renvoyait la pensée du modèle au lieu de la réponse/JSON.
  return (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
}

/** Streaming Vertex AI generateContent — yields text chunks via SSE.
 *  systemOrCache: pass { type:"system", text } for a plain system instruction,
 *  or { type:"cache", name } to use a pre-created Vertex cachedContent resource. */
async function* vertexStreamGenerate(
  modelId: string,
  contents: { role: string; parts: unknown[] }[],
  systemOrCache: { type: "system"; text: string } | { type: "cache"; name: string },
  generationConfig: { maxOutputTokens?: number; temperature?: number; thinkingConfig?: { thinkingBudget: number } }
): AsyncGenerator<string> {
  const token = await getVertexToken();
  const body = systemOrCache.type === "cache"
    ? { cachedContent: systemOrCache.name, contents, generationConfig }
    : { contents, systemInstruction: { parts: [{ text: systemOrCache.text }] }, generationConfig };
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
        const parsed = JSON.parse(json) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
        // Itérer TOUTES les parts et ignorer les parts de raisonnement (`thought`).
        // gemini-3.5-flash est un modèle "thinking" : il renvoie une/des part(s) de pensée
        // AVANT la réponse. Ne lire que parts[0] faisait (1) FUITER le raisonnement dans le
        // chat et (2) TRONQUER la vraie réponse, souvent située en parts[1+].
        for (const p of parsed.candidates?.[0]?.content?.parts ?? []) {
          if (p.thought) continue;
          if (p.text) yield p.text;
        }
      } catch { /* ignore malformed SSE line */ }
    }
  }
}

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/** Creates (or retrieves from Redis) a Vertex AI cachedContent resource.
 *  Returns the resource name, e.g. "projects/.../cachedContents/123".
 *  Cache key is versioned so any profile change invalidates it automatically. */
async function getOrCreateVertexCache(
  practitionerId: string,
  patientId: string,
  modelName: string,
  cacheablePrompt: string
): Promise<string> {
  const practVersion = (await redis.get<string>(`pract_v:${practitionerId}`)) ?? "0";
  const patientVersion = (await redis.get<string>(`patient_v:${patientId}`)) ?? "0";
  const redisKey = `vertex_cache:${PROMPT_VERSION}:${practitionerId}:${patientId}:${practVersion}:${patientVersion}`;

  const cached = await redis.get<string>(redisKey);
  if (cached) return cached;

  const token = await getVertexToken();
  const modelPath = `projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${modelName}`;
  const res = await fetch(
    `https://${VERTEX_HOST}/v1beta1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/cachedContents`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelPath,
        systemInstruction: { parts: [{ text: cacheablePrompt }] },
        ttl: "3600s",
      }),
    }
  );
  if (!res.ok) throw new Error(`Vertex cache creation failed: ${res.status} ${await res.text()}`);
  const { name } = (await res.json()) as { name: string };
  // Store for 55 min — refresh well before the Vertex 1h TTL expires
  await redis.set(redisKey, name, { ex: 3300 });
  return name;
}

// ═══ CONFIGURATION DES PLANS ═══
// Modèle chat : gemini-3.1-flash-lite pour tous les textes (tous plans confondus)
//               gemini-3.5-flash uniquement si image Base64 détectée
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
  isSosIntakeCheck?: boolean; // check de crise en arrière-plan sur l'intake vocal de SOSExercise
  // Vrai uniquement sur le dernier appel isSosIntakeCheck (depuis enterReadyPhase,
  // sur le transcript complet figé). Autorise l'écriture de emotional_insight —
  // les appels intermédiaires ne l'écrivent jamais pour éviter le scintillement
  // de la météo émotionnelle côté praticien pendant l'exercice.
  isFinalIntake?: boolean;
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
// (hasBehavioralSignal supprimé — code mort : le classifieur LLM tourne toujours,
//  sans pré-filtre regex. Cf. analyzeCrisisWithLLM.)

function getCriticalResponseType(message: string): string {
  const lower = message.toLowerCase();
  if (["suicide", "mourir", "en finir", "tuer", "disparaître", "disparaitre"].some(kw => lower.includes(kw))) return "suicide";
  if (["gorge", "respire", "poitrine", "thoracique", "bras", "paralysie", "tremble", "sueurs froides"].some(kw => lower.includes(kw))) return "medical";
  if (["je vais le tuer", "je vais la tuer", "faire du mal", "frapper"].some(kw => lower.includes(kw))) return "threat";
  return "suicide";
}

// ═══ ANALYSE CRISE LLM (classificateur parallèle enrichi) ═══
// Architecture : lancé en parallèle du stream principal (Promise.all), sans barrière
// regex. Contexte enrichi : 5 derniers messages + état émotionnel patient + victoire
// récente. Détecte aussi les victoires et les signaux d'apaisement pour réduire les
// angles morts du JSON principal (ironie, double-victoire, apaisement de façade…).
type PatientStateContext = {
  emotional_status: string;
  emotional_insight: string;
  latest_victory: string | null;
  victory_detected_at: string | null;
};

type CrisisAnalysis = {
  level: "red_critical" | "red_behavioral" | "none";
  murmure: string;
  victory: string;
  apaisement: boolean;
};

async function analyzeCrisisWithLLM(
  message: string,
  patientContext: string,
  recentMessages: { role: string; content: string }[] = [],
  patientState?: PatientStateContext
): Promise<CrisisAnalysis> {
  try {
    const conversationContext = recentMessages.length > 0
      ? recentMessages.map(m => `${m.role === "user" ? "Patient" : "Jumeau"}: ${m.content.slice(0, 200)}`).join("\n")
      : "Aucun historique disponible.";

    const minutesSinceLastVictory = patientState?.victory_detected_at
      ? Math.round((Date.now() - new Date(patientState.victory_detected_at).getTime()) / 60000)
      : null;

    const stateBlock = patientState ? `
ÉTAT ACTUEL DU PATIENT :
- Statut émotionnel : ${patientState.emotional_status}
- Note clinique : ${patientState.emotional_insight || "Aucune"}
- Dernière victoire : ${patientState.latest_victory || "Aucune"}${minutesSinceLastVictory !== null ? ` (il y a ${minutesSinceLastVictory} min)` : ""}
` : "";

    const prompt = `Tu es un classificateur médical dédié pour un suivi nutritionnel. Analyse le message du patient en tenant compte du contexte.
${stateBlock}
PROFIL PATIENT (extrait) :
${patientContext.slice(0, 400)}

DERNIERS ÉCHANGES :
${conversationContext}

NOUVEAU MESSAGE DU PATIENT : "${message}"

Réponds UNIQUEMENT en JSON strict, sans markdown ni commentaire :
{"level":"...","murmure":"...","victory":"...","apaisement":false}

RÈGLES LEVEL :
- "red_critical" : intention suicidaire ou urgence vitale EXPLICITE dans ce message.
- "red_behavioral" : exprimé à la 1ère personne, temps présent ou très récent (ce soir, aujourd'hui, là maintenant) ; détresse émotionnelle active OU perte de contrôle alimentaire (crise TCA, frigo dévalisé, ingestion sans contrôle, compulsion) ; dégoût profond de soi en ce moment. JAMAIS pour : questions théoriques/éducatives, récit à la 3e personne, événements anciens, formulations au futur ou hypothétiques.
- "none" : tout le reste.

RÈGLES VICTORY (renseigner uniquement si TOUTES les conditions sont réunies) :
- Réussite concrète et NOUVELLE dans CE message, absente des échanges précédents
- Statut actuel différent de "red_behavioral"
- Dernière victoire notée différente (pas le même sujet dans les 30 dernières minutes)
- Formulation certaine (pas future ou hypothétique), non-ironique, non-sarcastique
- 1 phrase courte décrivant la réussite (ex : "A tenu ses apports cibles toute la semaine")
- Si une condition manque : chaîne vide ""

RÈGLES MURMURE :
- Si level est "red_behavioral" ou "red_critical" : note clinique de 4 à 8 mots à la 3e personne, jamais une citation directe du patient (ex : "Stress aigu exprimé ce soir", "Perte de contrôle alimentaire", "Dégoût de soi exprimé", "Détresse émotionnelle active").
- Si level est "none" : chaîne vide "".

RÈGLES APAISEMENT :
- true : soulagement physiologique ou émotionnel EXPLICITE et personnel ("je me sens mieux", "ça va mieux", "je suis plus calme maintenant")
- false : messages courts de fermeture ("ok", "merci", "à bientôt"), politesse sans contenu émotionnel, amélioration relative vague

{"level":"none","murmure":"","victory":"","apaisement":false}`;

    // CD-1 — retry 1× + log : la détection de crise ne doit PAS fail-open en silence.
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Classifieur de crise sur gemini-3.1-flash-lite (léger, non-"thinking", quota
        // SÉPARÉ du chat). L'upgrade CD-3 vers gemini-3.5-flash a été ANNULÉ : il concentrait
        // la charge sur le même modèle que le chat → 429 RESOURCE_EXHAUSTED. Fiabilité assurée
        // par le retry + fail-safe (CD-1/CD-4), pas par un modèle plus lourd.
        const raw = await vertexGenerate("gemini-3.1-flash-lite", prompt, { maxOutputTokens: 150, temperature: 0 });
        const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as CrisisAnalysis;
        return {
          level: parsed.level ?? "none",
          murmure: parsed.murmure ?? "",
          victory: parsed.victory ?? "",
          apaisement: !!parsed.apaisement,
        };
      } catch (err) {
        lastErr = err;
      }
    }
    void reportCriticalEvent("Classifieur de crise en échec après retry — crise potentiellement NON détectée", { error: lastErr instanceof Error ? lastErr.message : String(lastErr) });
    return { level: "none", murmure: "", victory: "", apaisement: false };
  } catch {
    return { level: "none", murmure: "", victory: "", apaisement: false };
  }
}

// ═══ DÉTECTION APAISEMENT (SOS vocal uniquement) ═══
// Symétrique du garde-fou crise, dans l'autre sens : repère un vrai signal de
// retour au calme pendant l'exercice SOS vocal (isSosIntakeCheck), pour
// résoudre emotional_status "red_behavioral" → "green" sans attendre le
// prochain message écrit. N'est appelée que si le patient est déjà
// red_behavioral — le contexte de détresse est donc déjà acquis, pas besoin
// de le redemander à l'IA comme le fait le bloc "apaisement" du flux
// principal (qui lui doit vérifier qu'une détresse a bien été exprimée plus
// tôt DANS LA MÊME conversation écrite, contexte qu'on n'a pas ici).
type ApaisementResult = { confirmed: boolean; murmure: string };

async function detectApaisementWithLLM(message: string): Promise<ApaisementResult> {
  try {
    const prompt = `Un patient suivi pour une détresse comportementale (statut "red_behavioral") vient de prononcer cette phrase à voix haute pendant un exercice de respiration guidée : "${message}"

Réponds en JSON strict (aucun texte avant ou après) :
- confirmed : true si la phrase exprime un retour au calme réel et explicite (ex : "je me sens mieux", "ça va mieux", "j'ai soufflé", "c'est plus calme maintenant", "ça m'a aidé"). false dans tous les autres cas.
- murmure : si confirmed=true, une phrase courte (max 12 mots) décrivant l'état au praticien. Si confirmed=false, chaîne vide.

{"confirmed":false,"murmure":""}`;

    const raw = await vertexGenerate("gemini-3.1-flash-lite", prompt, { maxOutputTokens: 60, temperature: 0 });
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as ApaisementResult;
    return { confirmed: !!parsed.confirmed, murmure: parsed.murmure ?? "" };
  } catch {
    return { confirmed: false, murmure: "" };
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
  specialty?: string;
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
    supabase.from("practitioners").select("plan, specialty").eq("user_id", practitionerId).single(),
    supabase.from("practitioner_profiles").select("*").eq("user_id", practitionerId).single(),
  ]);

  const practitioner = practitionerResult.data as { plan?: string; specialty?: string } | null;
  const plan = practitioner?.plan;
  const validPlan: PlanType = plan && plan in PLAN_CONFIG ? plan as PlanType : "essentiel";
  const specialty = practitioner?.specialty ?? undefined;
  const profile = profileResult.data as Record<string, string> | null;

  const data: CachedPractitioner = { plan: validPlan, profile, specialty };
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

    // Tagger les sources pour que Gemini puisse distinguer protocoles praticien vs docs patient
    const taggedGlobalDocs = ((globalDocs as { content: string; similarity: number }[] | null) ?? [])
      .map(d => ({ ...d, content: `[Protocole praticien] ${d.content}` }));

    const taggedPatientDocs = patientDocs
      .map(d => ({ ...d, content: `[Document patient] ${d.content}` }));

    const allResults = [...taggedGlobalDocs, ...taggedPatientDocs];

    if (allResults.length === 0) return "";

    const relevant = allResults
      .filter(d => d.similarity > 0.70)
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
      .select("first_name, last_name, age, sexe, taille, poids, objective, pathologies, allergies, traitements, objectif_clinique, practitioner_instruction, instruction_updated_at, motivation, defi, situation_vie, rythme_professionnel, aliments_aimes, aliments_detestes, niveau_activite, regime_specifique, notes")
      .eq("user_id", patientId)
      .single();

    const patient = data as {
      first_name?: string; last_name?: string; age?: number; sexe?: string;
      taille?: number; poids?: number; objective?: string; pathologies?: string;
      allergies?: string; traitements?: string; objectif_clinique?: string;
      motivation?: string; defi?: string;
      situation_vie?: string; rythme_professionnel?: string;
      aliments_aimes?: string; aliments_detestes?: string; niveau_activite?: string;
      regime_specifique?: string; notes?: string; practitioner_instruction?: unknown;
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
    const defiLabels: Record<string, string> = {
      temps: "Manque de temps",
      sucre: "Pulsions sucrées",
      restaurant: "Repas au restaurant",
      motivation: "Manque de motivation",
      cuisine: "Manque d'organisation en cuisine",
      stress: "Manger sous le stress",
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
    if (patient.defi) parts.push(`Plus gros défi déclaré : ${defiLabels[patient.defi] ?? patient.defi}`);
    const situationVieLabels: Record<string, string> = {
      seul: "Seul(e)",
      couple: "En couple, sans enfants",
      famille: "En famille avec enfants",
      parents: "Chez ses parents",
    };
    const rythmeProfLabels: Record<string, string> = {
      bureau: "Horaires bureau (9h-18h)",
      decale: "Horaires décalés",
      teletravail: "Télétravail",
      etudiant: "Étudiant(e)",
      sans_emploi: "Sans activité professionnelle",
    };
    if (patient.situation_vie) parts.push(`Situation de vie : ${situationVieLabels[patient.situation_vie] ?? patient.situation_vie}`);
    if (patient.rythme_professionnel) parts.push(`Rythme professionnel : ${rythmeProfLabels[patient.rythme_professionnel] ?? patient.rythme_professionnel}`);
    if (patient.aliments_aimes) parts.push(`Aliments aimés : ${patient.aliments_aimes}`);
    if (patient.aliments_detestes) parts.push(`Aliments détestés : ${patient.aliments_detestes}`);
    if (patient.notes) {
      const labelMap: Record<string, string> = {
        "Équipement":    "Équipement cuisine",
        "Temps cuisine": "Temps disponible pour cuisiner le soir",
        "Budget":        "Budget alimentaire",
        "Repas sautés":  "Repas souvent sautés",
        "Sommeil":       "Heures de sommeil par nuit",
      };
      const remaining: string[] = [];
      for (const segment of patient.notes.split(" | ")) {
        const colonIdx = segment.indexOf(":");
        if (colonIdx === -1) { remaining.push(segment); continue; }
        const key = segment.slice(0, colonIdx).trim();
        const val = segment.slice(colonIdx + 1).trim();
        const label = labelMap[key];
        if (label) parts.push(`${label} : ${val}`);
        else remaining.push(segment);
      }
      if (remaining.length > 0) parts.push(`Données complémentaires : ${remaining.join(" | ")}`);
    }

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
    // Dialogue complet patient + jumeau — pour que le résumé inclue aussi les conseils donnés
    const dialogue = messages
      .map(m => `${m.role === "user" ? "Patient" : "Jumeau"} : ${m.content.slice(0, 400)}`)
      .join("\n");
    const text = await vertexGenerate(
      "gemini-3.1-flash-lite",
      `Résume en 5 lignes maximum les points clés de ces échanges patient-nutritionniste.\nGarde uniquement les faits importants : objectifs déclarés, écarts, progrès, préoccupations, conseils donnés par le jumeau.\nÉchanges :\n${dialogue}`,
      { maxOutputTokens: 200, temperature: 0 }
    );
    return `[RÉSUMÉ DES ÉCHANGES PRÉCÉDENTS : ${text}]`;
  } catch {
    const fallback = messages.filter(m => m.role === "user").slice(0, 10).map(m => m.content.slice(0, 100)).join(" | ");
    return `[RÉSUMÉ : ${fallback}]`;
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
    // Cache Redis 2h — les messages anciens ne changent pas, inutile de résumer à chaque appel
    const summaryCacheKey = `summary:${patientId}:${practitionerId}`;
    const cachedSummary = await redis.get<string>(summaryCacheKey).catch(() => null);
    if (cachedSummary) {
      return [
        { role: "user" as const, parts: [{ text: cachedSummary }] },
        ...recentFormatted,
      ];
    }

    // Prendre les 100 messages anciens les plus récents (les plus contextuellement utiles)
    const { data: olderData } = await supabase
      .from("conversations")
      .select("role, content")
      .eq("patient_id", patientId)
      .eq("practitioner_id", practitionerId)
      .lt("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(100);

    // Remettre en ordre chronologique avant résumé
    const olderMessages = ((olderData as { role: string; content: string }[] | null) ?? []).reverse();
    if (olderMessages.length === 0) return recentFormatted;

    const summary = await summarizeOldMessages(olderMessages);
    // Mettre en cache 2h — TTL assez court pour capter les changements de contexte
    await redis.set(summaryCacheKey, summary, { ex: 7200 }).catch(() => {});

    return [
      { role: "user" as const, parts: [{ text: summary }] },
      ...recentFormatted,
    ];
  } catch {
    return [];
  }
}

// Mappe la préférence longueur_reponses du praticien à une contrainte en mots.
function resolveWordLimit(longueurReponses?: string): string {
  if (!longueurReponses) return "Maximum 150 mots par réponse.";
  if (longueurReponses.startsWith("Court")) return "Maximum 80 mots par réponse. L'essentiel en 2-3 phrases, pas de développement.";
  if (longueurReponses.startsWith("Détaillé")) return "Tu peux développer jusqu'à 200 mots si la question le justifie. Explique, illustre, rassure.";
  if (longueurReponses.startsWith("Empathique")) return "Maximum 150 mots par réponse. Commence toujours par valider l'émotion avant tout conseil.";
  if (longueurReponses.startsWith("Adapté")) return "Adapte la longueur à la complexité : 2-3 phrases pour une question simple, jusqu'à 200 mots pour une question complexe ou émotionnelle.";
  return "Maximum 150 mots par réponse.";
}

// Mappe le mode d'adresse à une règle précise pour Gemini.
function resolveTutoiement(tutoiement?: string): string {
  if (!tutoiement) return "Vouvoie le patient.";
  if (tutoiement.startsWith("Vouvoiement strict")) return "Vouvoie TOUJOURS le patient, sans exception, même s'il te tutoie.";
  if (tutoiement.startsWith("Vouvoiement bienveillant")) return "Vouvoie le patient avec chaleur et bienveillance.";
  if (tutoiement.startsWith("Tutoiement naturel")) return "Tutoie le patient naturellement dans chaque message.";
  if (tutoiement.startsWith("Il s'adapte")) return "Adapte-toi au registre du patient : si le patient te tutoie, réponds en tutoiement ; s'il te vouvoie, réponds en vouvoiement. En cas de doute ou pour le premier message, commence par le vouvoiement.";
  return tutoiement;
}

// Mappe le niveau de technicité à une instruction concrète.
function resolveTechnicite(technicite?: string): string {
  if (!technicite) return "Adapte le niveau de langage au patient.";
  if (technicite.startsWith("Très vulgarisé")) return "Zéro jargon médical ou nutritionnel. Explique tout avec des mots du quotidien. Si tu dois utiliser un terme technique, définis-le immédiatement avec des mots simples.";
  if (technicite.startsWith("Quelques termes")) return "Tu peux utiliser quelques termes techniques (glycémie, micronutriments, FODMAP...) mais explique-les brièvement en même temps pour rester accessible.";
  if (technicite.startsWith("Scientifique")) return "Vocabulaire scientifique et précis assumé. Le patient est à l'aise avec les termes médicaux et nutritionnels, ne simplifie pas.";
  if (technicite.startsWith("Il s'adapte")) return "Adapte le niveau de langage au patient : si le patient utilise des termes techniques, réponds dans le même registre scientifique ; sinon, reste simple, clair et sans jargon.";
  return technicite;
}

// Mappe la politique émojis à une règle précise.
function resolveEmojis(emojis?: string): string {
  if (!emojis) return "Utilise les émojis avec parcimonie : maximum 1 par message, et seulement quand il apporte vraiment quelque chose.";
  if (emojis.startsWith("Jamais")) return "N'utilise JAMAIS d'émojis, dans aucun message, quoi qu'il arrive.";
  if (emojis.startsWith("Avec modération")) return "Maximum 1 émoji par message, uniquement quand il renforce sincèrement le sens ou la chaleur du message. La plupart des messages n'en ont pas besoin.";
  if (emojis.startsWith("Souvent")) return "Utilise des émojis librement et naturellement pour humaniser tes messages, sans en abuser.";
  return emojis;
}

// Mappe le ton de communication à un comportement concret.
function resolveToneOfVoice(tone?: string): string {
  if (!tone) return "Bienveillant et professionnel.";
  if (tone.startsWith("Le Médical")) return "Factuel, précis, sobre. Pas d'effusion ni de flatterie. Phrases directes et claires. Tu informes avec rigueur.";
  if (tone.startsWith("Le Coach")) return "Énergique, motivant, direct. Tu insuffles de l'élan et pousses le patient vers l'action. Ton dynamique, phrases courtes et percutantes.";
  if (tone.startsWith("Le Complice")) return "Chaleureux, empathique, très humain. Tu te mets au niveau du patient, tu valides systématiquement avant de conseiller, tu accompagnes avec douceur et présence.";
  if (tone.startsWith("Le Pédagogue")) return "Tu expliques toujours le pourquoi derrière chaque conseil. Tu vulgarises, tu rassures, tu donnes du sens à chaque recommandation.";
  return tone; // Pour les valeurs libres "Autre (Précisez...)"
}

// Indique la profession du praticien — Gemini adapte son registre naturellement,
// tout le reste (approche, périmètre, convictions) vient des réponses d'onboarding.
function resolveProfession(specialty?: string): string {
  if (!specialty) return "";
  return `Ce praticien est ${specialty}.`;
}

// Mappe le périmètre d'autonomie à une posture générale + règle out_of_scope intégrée.
// Les restrictions spécifiques (médical, traitements...) sont gérées par questions_medicales et ligne_rouge.
function resolvePerimetre(perimetre?: string): string {
  if (!perimetre) return "Fais preuve de bon sens et de prudence sur les questions médicales complexes. Si une question dépasse le cadre nutritionnel courant, invite le patient à en parler avec son praticien lors de la prochaine consultation. Ajoute \"action\":\"out_of_scope\" dans ton JSON technique uniquement pour les vraies questions médicales (pathologies, traitements, bilans) — jamais pour une question de curiosité générale ou de lifestyle.";
  if (perimetre.startsWith("Autonomie totale")) return "Le praticien te fait entièrement confiance. Tu peux aller au bout de ton expertise sans te brider. Adapte-toi à chaque situation avec le jugement d'un professionnel. N'utilise jamais \"action\":\"out_of_scope\".";
  if (perimetre.startsWith("Prudent sur les pathologies")) return "Le praticien souhaite que tu restes prudent dès qu'une pathologie, un traitement médicamenteux ou un bilan médical apparaît dans la conversation. Dans ces situations, réponds avec bienveillance et invite le patient à en parler avec son praticien lors de la prochaine consultation. Ajoute alors \"action\":\"out_of_scope\" dans ton JSON technique. En dehors de ces situations, tu es libre.";
  if (perimetre.startsWith("Questions simples uniquement")) return "Le praticien préfère que tu restes dans le registre des questions nutritionnelles simples et bien établies. Pour tout ce qui dépasse ce cadre, invite le patient à en parler directement avec son praticien lors de la prochaine consultation, et ajoute \"action\":\"out_of_scope\" dans ton JSON technique. Ne déclenche pas out_of_scope pour une question de curiosité générale hors nutrition.";
  return perimetre;
}

// Mappe la gestion des questions médicales complexes — traduit les options "m'alerte" en comportement réel.
function resolveQuestionsMedicales(qm?: string): string {
  if (!qm) return "rediriger avec bienveillance vers le médecin traitant";
  if (qm.includes("m'alerte directement")) return "Il reconnaît honnêtement qu'il ne peut pas répondre seul à cette question, invite le patient à en parler avec son praticien, et ajoute \"action\":\"out_of_scope\" dans son JSON technique pour notifier le praticien.";
  if (qm.includes("attend ma validation")) return "Il propose une piste générale et invite le patient à en valider l'approche avec son praticien lors de la prochaine consultation.";
  return qm;
}

/** Builds the cacheable portion of the system prompt (everything except documentsContext).
 *  documentsContext (RAG) is dynamic per query — injected into userParts at call time. */
function buildCacheablePrompt(
  profile: Record<string, string> | null,
  patientContext: string,
  forceAncrage = false,
  specialty?: string
): string {
  // Sans profil praticien, on reste simple mais on inclut quand même le contexte patient
  // (prénom, objectif, etc.) pour que Gemini connaisse la personne à qui il parle.
  if (!profile) {
    return `Tu es un assistant nutritionniste bienveillant. Réponds sans markdown, en phrases simples, max 150 mots.${patientContext ? `\n\n${patientContext}` : ""}`;
  }

  const isAutonomieTotal = profile.perimetre?.startsWith("Autonomie totale");

  const ancrageBlock = forceAncrage ? `
⚠️ MODE ANCRAGE BIENVEILLANT ACTIF ⚠️
Le patient traverse une période de vulnérabilité comportementale ou émotionnelle.
RÈGLES STRICTES pour ce mode :
- ZÉRO conseil nutritionnel, ZÉRO objectif, ZÉRO programme.
- 100% écoute active, validation émotionnelle, ancrage TCC.
- Si le patient demande un conseil alimentaire, dis doucement que vous y reviendrez quand il se sentira prêt.
- Ton praticien est informé et prendra le relais à la prochaine séance.
` : "";

  const professionInstruction = resolveProfession(specialty);

  const dimensionEmotionnelle = profile.dimension_emotionnelle ?? "";
  const missionStatement = dimensionEmotionnelle.startsWith("C'est le cœur")
    ? "TA MISSION PREMIÈRE : Tu interviens principalement dans les moments difficiles — compulsions, craquages, spirales émotionnelles, perte de contrôle autour de la nourriture. Ta valeur n'est pas dans les conseils nutritionnels généraux (le praticien gère ça en séance) mais dans ta capacité à être présent, à écouter sans juger, et à aider le patient à traverser un moment difficile avec les outils de son praticien."
    : dimensionEmotionnelle.startsWith("C'est une dimension importante")
    ? "TA MISSION : Tu combines écoute émotionnelle et accompagnement nutritionnel. Si le patient exprime une difficulté émotionnelle, l'écoute prime toujours sur le conseil."
    : "TA MISSION : Tu es l'assistant nutritionnel de ce praticien, disponible entre les séances. Si une émotion ou une difficulté émerge, tu l'accueilles avant de conseiller.";

  return `Tu ES le Jumeau Numérique de ce praticien expert. Le patient ne doit jamais sentir qu'il parle à une machine, mais à une extension directe de l'esprit et de la méthode de son praticien.
${ancrageBlock}
${missionStatement}

MA VISION — LA PHILOSOPHIE QUI GUIDE TOUT :
${profile.vision || "Bienveillant, personnalisé, centré sur le patient."}

MON STYLE D'ÉCRITURE — MES EXPRESSIONS, MES MÉTAPHORES, MA FAÇON DE PARLER :
${profile.signature ? profile.signature : "Ton authentique et humain, cohérent avec la posture définie ci-dessous."}
(Intègre ces éléments dans ton style. Ne reproduis jamais ce bloc tel quel en bas d'un message.)

IDENTITÉ & POSTURE :
${professionInstruction ? `- Profession et périmètre : ${professionInstruction}\n` : ""}- Ton de communication : ${resolveToneOfVoice(profile.tone_of_voice)}
- Mode d'adresse : ${resolveTutoiement(profile.tutoiement)}
- Niveau de langage : ${resolveTechnicite(profile.technicite)}
- Émojis : ${resolveEmojis(profile.emojis)}

PHILOSOPHIE NUTRITIONNELLE :
- Approche principale : ${profile.approche_generale || "rééquilibrage progressif"}
- Domaines de spécialité : ${profile.pathologies || "généraliste"}
- Quand un patient évoque un régime restrictif : ${profile.position_regimes || "étudier cas par cas"}
- Quand un patient parle de glucides ou féculents : ${profile.position_glucides || "adapter selon l'objectif et le profil"}
- Quand un patient évoque le jeûne intermittent : ${profile.position_jeune || "utile dans des cas précis, sur indication"}
- Quand un patient demande des compléments alimentaires : ${profile.position_complements || "utiles ponctuellement selon les besoins identifiés"}
- Petit-déjeuner, budget, produits : ${[profile.position_petit_dejeuner, profile.sensibilite_budget, profile.orientation_produits].filter(Boolean).join(" / ") || "adapter selon le patient"}
- Conviction fondamentale qui guide tous les conseils : ${profile.conviction || "non spécifiée"}
- Ne jamais recommander ni valider : ${profile.jamais_dire || "rien de spécifique"}

COMMENT JE GÈRE LES MOMENTS DIFFICILES :
- Ma position sur la culpabilité après un écart : ${profile.gestion_culpabilite || "valider l'émotion d'abord, explorer sans jugement"}
- Le mot que j'utilise pour parler d'un moment de perte de contrôle : ${profile.vocabulaire_crise || "je n'impose pas de mot fixe, j'explore ce qui s'est passé"}
- Quand un patient mange ses émotions ou parle d'alimentation émotionnelle : ${profile.alimentation_emotionnelle || "travail global, orienter si besoin"}
- Quand un patient décroche ou ne suit plus le protocole : ${profile.non_suivi || "bienveillance totale, repartir sans jugement"}
- Quand un patient parle de fêtes, vacances ou sorties : ${profile.fetes_vacances || "l'équilibre se fait sur la durée"}
- Quand un patient perd la motivation ou décroche : ${profile.levier_motivation || "valoriser les petits progrès"}
- Quand un patient perfectionniste stresse face à un écart : ${profile.profil_perfectionniste || "valoriser la rigueur tout en aidant à accepter l'équilibre sur la durée"}
- Adaptation de la communication selon le profil : ${profile.adaptation_profil || "adapter le fond et la forme selon la personne"}
- Quand un patient annonce une victoire : ${profile.situation_victoire || "Célébrer sincèrement. Valoriser l'effort autant que le résultat."}
- Quand un patient veut voler de ses propres ailes : ${profile.situation_arret || "Valoriser l'autonomie acquise. Conclure positivement, rester disponible."}

SÉCURITÉ & LIMITES :
- Périmètre d'action autonome : ${resolvePerimetre(profile.perimetre)}
- Face à une question médicale complexe, un traitement ou un bilan : ${resolveQuestionsMedicales(profile.questions_medicales)}
- Quand un patient exprime une vraie souffrance psychologique : ${profile.urgence_detresse || "empathie immédiate et alerte praticien"}

VOIX DU PRATICIEN — C'est exactement ainsi que ce praticien répond. Reproduis cette intention, ce ton, cette structure. Adapte au contexte précis, ne recopie pas mot pour mot :
- Avant un craquage (patient qui résiste à une envie forte) : "${profile.situation_avant_crise || "Reste là avec moi. L'envie est forte maintenant, mais elle va passer. Dis-moi ce qui se passe."}"
- Craquage ou écart alimentaire : "${profile.situation_craquage || "Un écart ne définit pas votre parcours. On repart ensemble."}"
- Stagnation du poids : "${profile.situation_stagnation || "La stagnation est normale, explorons ce qui se passe ensemble."}"
- Patient disparu / honte de revenir : "${profile.situation_abandon || "Aucun jugement ici. L'important c'est que vous soyez là maintenant."}"
- Question prédiabète / féculents : "${profile.situation_prediabete || "C'est une excellente question pour votre médecin traitant."}"
- Question alcool / week-end : "${profile.situation_alcool || "L'équilibre se construit sur la durée, pas sur une soirée."}"
- Objectif irréaliste ou trop rapide : "${profile.situation_drastique || "Je comprends l'urgence. Voyons ce qui est raisonnablement atteignable."}"
- Flemme / pas le temps de cuisiner : "${profile.situation_flemme || "Pas de panique. Voici 2-3 options rapides qui respectent votre protocole."}"
- Coup dur / plus la force : "${profile.situation_coup_dur || "On met le programme entre parenthèses. Prenez soin de vous d'abord."}"

═══ HIÉRARCHIE ABSOLUE DES INSTRUCTIONS ═══
Tu dois respecter cet ordre de priorité strict, du plus important au moins important :
1. MURMURE DU PRATICIEN (consigne temps réel) - priorité ABSOLUE, écrase tout le reste
2. DOCUMENTS RAG (protocoles et expertise indexés) - ta base de connaissance métier
3. PERSONNALITÉ (les paramètres ci-dessus) - ton style et ta posture

${patientContext}

RÈGLES ABSOLUES :
- LIGNE ROUGE ABSOLUE (priorité maximale) : ${profile.ligne_rouge || "ne jamais culpabiliser le patient, quoi qu'il arrive"}
- ${resolveWordLimit(profile.longueur_reponses)}
- Si le patient exprime une émotion, une difficulté ou une vulnérabilité, commence par valider ce qu'il ressent avant tout conseil. Pour une question purement pratique ou technique, réponds directement.
- Utiliser le prénom du patient avec parcimonie : en début de suivi pour créer le lien, et ponctuellement lors d'un moment fort ou pour marquer une rupture de ton. Jamais de façon systématique à chaque message.
- INTERDICTION de Markdown : pas de gras, pas de tirets en début de ligne, pas d'astérisques, pas de numérotation. Toujours des paragraphes continus.
- Ne JAMAIS dire "En tant qu'IA", "En tant que modèle de langue" ou similaire.
- Ne jamais inventer des informations médicales non confirmées.${!isAutonomieTotal ? `
- Grossesse : félicite, redirige vers gynécologue/sage-femme, praticien adaptera le suivi.
- TCA grave : stop conseils alimentaires, valide l'émotion, annonce relais praticien.
- Arrêt de traitement : invite le patient à consulter son médecin traitant avant tout changement.` : ""}

COMMANDE ADMINISTRATIVE :
Si le message commence par [ADMIN:identity_correction] :
- Réponds uniquement : "C'est noté. J'ai transmis la demande de correction à votre praticien pour que votre dossier soit parfaitement à jour. Pouvez-vous me préciser l'orthographe exacte de votre nom ?"
- Ajoute obligatoirement : |||{"status":"green","reason":"demande correction identité","victory":"","action":"admin_alert","alert_type":"identity_correction"}|||

JSON TECHNIQUE OBLIGATOIRE - À ajouter en toute fin de réponse, après le texte visible :
|||{"status":"green","reason":"météo émotionnelle en 4-8 mots","notable":false,"victory":"","apaisement":"non"}|||
- status : "red_critical" si urgence vitale implicite détectée, "red_behavioral" si détresse comportementale/TCA/psychologique sévère, "green" si tout va bien
- reason : TOUJOURS rempli — météo émotionnelle du patient en 4-8 mots, dynamique et précise. Accorde les adjectifs au genre du patient (voir "Sexe" dans le profil) — jamais de forme neutre entre parenthèses comme "Anxieux(se)".
  Exemples (homme) : "En confiance", "Motivé malgré la fatigue", "Serein et régulier", "Curieux de progresser", "Anxieux mais motivé", "Frustré face aux écarts"
  Exemples (femme) : "En confiance", "Motivée malgré la fatigue", "Sereine et régulière", "Curieuse de progresser", "Anxieuse mais motivée", "Frustrée face aux écarts"
  Exemples red_behavioral : "Détresse émotionnelle active", "Perte de contrôle alimentaire", "Dégoût de soi exprimé"
  Exemples red_critical : "Urgence vitale exprimée", "Pensées de passage à l'acte"
  Ne jamais laisser vide. Ne jamais écrire "patient va bien" ou "aucune alerte".
- notable : true si ce message révèle quelque chose cliniquement utile à signaler au praticien (émotion significative, tension, progression, régression, victoire, changement de dynamique). false si échange de routine (question nutritionnelle banale, logistique, rappel de règles). En cas de doute, préfère false.
- victory : UNE phrase courte UNIQUEMENT si le patient rapporte une réussite TCC concrète (ex: résister à une fringale, écouter sa satiété, gérer une envie de crise sans craquer, reprendre après un écart sans culpabilité). Exemples : "A écouté sa satiété ce soir", "A résisté à la fringale du soir", "A repris sans culpabilité après l'écart". Vide "" sinon.
  IMPORTANT : le simple fait d'avoir terminé un exercice de relaxation/respiration/marche/ancrage en routine ou en prévention n'est PAS une victoire, même si le patient se dit content ou apaisé. Ne remplis "victory" que si l'exercice (ou l'échange) a permis d'éviter, d'interrompre ou de traverser une crise réelle (alimentaire, anxieuse, compulsive) qui était en cours ou imminente. Engagement/régularité ≠ victoire clinique.
- apaisement : "oui" UNIQUEMENT si le patient exprime un retour au calme réel après une détresse exprimée dans cette même conversation (ex : "je me sens mieux", "ça va mieux", "j'ai soufflé", "je suis plus calme", "ça m'a aidé"). Ne jamais mettre "oui" si aucune détresse n'a été exprimée avant dans la conversation, ni sur un simple "ça va" sans contexte de crise, ni si l'amélioration reste incertaine ou partielle. "non" par défaut.`;
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
      practitionerId: bodyPractitionerId, // ⚠️ hint client uniquement — validé server-side ci-dessous
      sessionId,
      imageBase64,
      imageMimeType,
      isSOS,
      sosContext,
      origin,
      isPostExercise,
      toolId,
      isSosIntakeCheck,
      isFinalIntake,
    } = await request.json() as ChatRequest;

    // Auth — toujours requise, que patientId soit présent ou non
    const user = await getSessionUser();
    if (!user) return Response.json({ error: "Non autorisé." }, { status: 401 });
    if (patientId && user.id !== patientId) return Response.json({ error: "Accès refusé." }, { status: 403 });

    // ── H2 — practitioner_id résolu SERVER-SIDE, jamais pris du body seul ──
    // La relation patient↔praticien (patient_practitioner) fait autorité. Le body ne
    // sert que d'indice pour désambiguïser un patient multi-praticien (cabinet) : une
    // valeur non liée au patient est ignorée (anti-IDOR). Fail-safe : si rien ne se
    // résout, practitionerId reste undefined — les blocs aval sont déjà gardés par
    // `if (patientId && practitionerId)`.
    let practitionerId: string | undefined;
    if (patientId) {
      const { data: rels } = await createSupabaseClient()
        .from("patient_practitioner")
        .select("practitioner_id")
        .eq("patient_id", patientId);
      const linked = (rels ?? []).map((r) => (r as { practitioner_id: string }).practitioner_id);
      practitionerId = bodyPractitionerId && linked.includes(bodyPractitionerId)
        ? bodyPractitionerId
        : linked.length === 1
          ? linked[0]
          : undefined;
    }

    // ═══ BYPASS IMMÉDIAT — mots-clés urgences vitales ═══
    if (message && isCriticalKeyword(message) && patientId && practitionerId) {
      const supabase = createSupabaseClient();
      const responseType = getCriticalResponseType(message);
      const criticalResponse = CRISIS_CRITICAL_RESPONSES[responseType];

      // CD-4 — vérification FAIL-SAFE. flash-lite (non-"thinking") pour tenir dans un budget
      // de 10 tokens. Le mot-clé critique a déjà matché (signal fort) : on ne suppresse
      // l'alerte QUE si le modèle répond un "non" franc (ex : "mourir de rire"). Erreur /
      // réponse vide / ambiguë → on ALERTE.
      let verifyText = "";
      try {
        verifyText = (await vertexGenerate(
          "gemini-3.1-flash-lite",
          `Ce message exprime-t-il un danger de mort immédiat pour le patient ou pour autrui ? Réponds uniquement par "oui" ou "non". Message : "${message}"`,
          { maxOutputTokens: 10, temperature: 0 }
        )).trim().toLowerCase();
      } catch { verifyText = ""; } // erreur → non-bénin → on alerte

      const clearlyBenign = verifyText.includes("non") && !verifyText.includes("oui");
      if (!clearlyBenign) {
        await supabase.from("patients").update({ emotional_status: "red_critical", emotional_insight: `Urgence vitale — ${message.slice(0, 80)}` }).eq("user_id", patientId);
        const { data: current } = await supabase.from("patients").select("admin_alerts").eq("user_id", patientId).single();
        const alerts = (current as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
        await supabase.from("patients").update({
          // type: "crisis" — clé saturée pour traçabilité audit et rendu Dashboard (LeverAlerteCritique)
          admin_alerts: [...alerts, { type: "crisis", alert_type: "critical", date: new Date().toISOString(), seen: false, message: message.slice(0, 200) }]
        }).eq("user_id", patientId);

        try {
          const alertRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-crisis-alert`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-crisis-token": process.env.CRISIS_SECRET_TOKEN ?? "" },
            body: JSON.stringify({ patientId, practitionerId, alertType: responseType, message }),
          });
          if (!alertRes.ok) void reportCriticalEvent("Alerte crise NON envoyée (HTTP)", { patientId, status: alertRes.status });
        } catch (e) { void reportCriticalEvent("Alerte crise NON envoyée (réseau)", { patientId, error: String(e) }); }

        // Persiste la paire patient/IA dans le fil de discussion — avant, ce bypass
        // retournait directement la réponse sans jamais sauvegarder le message du
        // patient (seul un extrait de 200 caractères survivait dans admin_alerts),
        // donc le praticien ne voyait jamais le message exact dans l'historique.
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
            content: criticalResponse,
            session_id: sessionId ?? null,
          },
        ]);

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
      const defiLabels2: Record<string, string> = {
        temps: "Manque de temps", sucre: "Pulsions sucrées", restaurant: "Repas au restaurant",
        motivation: "Manque de motivation", cuisine: "Manque d'organisation en cuisine", stress: "Manger sous le stress",
      };

      const mirrorContext = [
        patient?.practitioner_instruction ? `Consigne praticien : "${patient.practitioner_instruction}"` : "",
        patient?.defi ? `Plus gros défi : "${defiLabels2[patient.defi] ?? patient.defi}"` : "",
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
        "fringale": "manger ou ecriture",
        "stress": "breathing ou ancrage",
        "culpabilité": "defusion ou ecriture",
        "coup de mou": "breathing ou ancrage",
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
- Choisis l'outil parmi : breathing, ancrage, manger, defusion, ecriture
${toolHint ? `- TYPE DE CRISE DÉCLARÉ : "${sosContext}" → Privilégie : ${toolHint}` : ""}
- ANTI-REDONDANCE : Outils récemment utilisés : ${recentTools || "aucun"}. Évite de reproposer le même.
- Le twin_message : max 30 mots, valide l'émotion (70%), transition douce vers l'exercice.
- Les steps du tool_script : personnalisés, jamais génériques, adaptés au profil du patient.

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

    // ═══ POST-EXERCICE — question fixe personnalisée ═══
    // Canal partagé par SOSExercise (clôture vocale) ET les 5 exercices de la
    // bibliothèque (modale "Comment tu te sens ?"). Réponse chaleureuse par défaut,
    // zéro friction pour le patient — MAIS double garde-fou sur ce texte libre :
    //   1) grave  (red_critical)   → réponse de sécurité immédiate + alerte praticien
    //   2) légère (red_behavioral) → dashboard praticien mis à jour, réponse inchangée
    // Le message du patient est désormais toujours persisté (avant, seule la réponse
    // de l'IA l'était). Le garde-fou mots-clés bruts (plus haut dans ce fichier)
    // s'applique déjà avant d'arriver ici ; ceci ajoute la détection fine (implicite,
    // sans mot-clé exact) via analyzeCrisisWithLLM, déjà utilisée dans le flux normal.
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
        manger: "la pleine conscience alimentaire", defusion: "la défusion cognitive",
        ecriture: "l'écriture cathartique",
      };
      const exerciseName = toolId ? (toolNames[toolId] ?? "l'exercice") : "l'exercice";
      const trimmedMessage = message?.trim() ?? "";

      if (trimmedMessage) {
        // Toujours persister le ressenti du patient — traçabilité praticien complète,
        // même si rien de préoccupant n'est détecté.
        const { data: savedMsg } = await supabase.from("conversations").insert({
          patient_id: patientId,
          practitioner_id: practitionerId,
          role: "user",
          content: trimmedMessage,
          session_id: null,
        }).select("id").single();
        const savedMessageId = (savedMsg as { id?: string } | null)?.id ?? null;

        await supabase.from("patients").update({ last_patient_message_at: new Date().toISOString() }).eq("user_id", patientId);

        // ── Double garde-fou sur ce texte libre ────────────────────────────────
        const crisisAnalysis = await analyzeCrisisWithLLM(trimmedMessage, `Patient en fin de ${exerciseName}.`);

        if (crisisAnalysis.level === "red_critical") {
          await supabase.from("patients").update({
            emotional_status: "red_critical",
            emotional_insight: crisisAnalysis.murmure || "Urgence détectée en fin d'exercice",
          }).eq("user_id", patientId);
          const { data: cur } = await supabase.from("patients").select("admin_alerts").eq("user_id", patientId).single();
          const alerts = (cur as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
          await supabase.from("patients").update({
            admin_alerts: [...alerts, { type: "admin_alert", alert_type: "critical_llm", date: new Date().toISOString(), seen: false, murmure: crisisAnalysis.murmure, trigger_message_id: savedMessageId }],
          }).eq("user_id", patientId);
          try {
            const alertRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-crisis-alert`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-crisis-token": process.env.CRISIS_SECRET_TOKEN ?? "" },
              body: JSON.stringify({ patientId, practitionerId, alertType: "implicit_critical", message: trimmedMessage }),
            });
            if (!alertRes.ok) void reportCriticalEvent("Alerte crise NON envoyée (HTTP)", { patientId, status: alertRes.status });
          } catch (e) { void reportCriticalEvent("Alerte crise NON envoyée (réseau)", { patientId, error: String(e) }); }

          // On remplace le message chaleureux générique par la réponse de sécurité —
          // valider le ressenti serait inapproprié face à une urgence vitale.
          const safeResponse = CRISIS_CRITICAL_RESPONSES.suicide;
          await supabase.from("conversations").insert({
            patient_id: patientId, practitioner_id: practitionerId, role: "assistant", content: safeResponse, session_id: null,
          });
          return new Response(safeResponse, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }

        if (crisisAnalysis.level === "red_behavioral") {
          await supabase.from("patients").update({
            emotional_status: "red_behavioral",
            emotional_insight: crisisAnalysis.murmure || "Alerte comportementale détectée en fin d'exercice",
            red_behavioral_until: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // LEGACY-1 : fenêtre de mode ancrage (12h) — n'affecte PLUS le statut
          }).eq("user_id", patientId);
          const { data: cur } = await supabase.from("patients").select("admin_alerts").eq("user_id", patientId).single();
          const alerts = (cur as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
          await supabase.from("patients").update({
            admin_alerts: [...alerts, { type: "admin_alert", alert_type: "behavioral", date: new Date().toISOString(), seen: false, murmure: crisisAnalysis.murmure, trigger_message_id: savedMessageId }],
          }).eq("user_id", patientId);
          // Ouvrir une crisis_event si aucune n'est déjà ouverte pour ce patient
          try {
            const { count: openCrises } = await supabase.from("crisis_events")
              .select("id", { count: "exact", head: true })
              .eq("patient_id", patientId).is("resolved_at", null);
            if ((openCrises ?? 0) === 0) {
              await supabase.from("crisis_events").insert({ patient_id: patientId, practitioner_id: practitionerId });
            }
          } catch { /* silencieux */ }
          // Pas d'alerte email (pour ne pas spammer le praticien), pas d'override de
          // la réponse : le message de clôture chaleureux habituel suit normalement.
        }
      }

      // Si le patient a partagé son ressenti (et qu'aucune urgence vitale n'a été
      // détectée ci-dessus), générer un message de clôture Gemini
      if (trimmedMessage) {
        try {
          const closingPrompt = `Tu es le Jumeau Numérique bienveillant d'un nutritionniste.
${firstName ? `Le patient s'appelle ${firstName}.` : ""}
Le patient vient de terminer ${exerciseName} et partage son ressenti : "${trimmedMessage}"

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

    // ═══ INTAKE VOCAL SOS — check de crise en arrière-plan ═══
    // Appelé par SOSExercise.tsx à chaque fin de prise de parole pendant les
    // phases "loading"/"intake", EN PARALLÈLE de la conversation Gemini Live
    // qui continue de répondre normalement pendant ce temps. Avant ce garde-fou,
    // tout ce que le patient disait pendant l'intake vocal ne vivait que dans
    // le navigateur (inputTranscriptRef côté client), invisible pour le
    // praticien si rien d'alarmant n'était redit à la question de clôture.
    // Contrairement à isPostExercise, ce canal ne génère aucun texte de
    // clôture — il renvoie uniquement le niveau détecté ; c'est SOSExercise
    // qui décide quoi faire en direct (rien si red_behavioral, interruption +
    // message de sécurité scripté — jamais improvisé par Gemini — si
    // red_critical).
    if (isSosIntakeCheck && patientId && practitionerId) {
      const supabase = createSupabaseClient();
      const trimmedMessage = message?.trim() ?? "";

      if (!trimmedMessage) {
        return Response.json({ level: "none" });
      }

      await supabase.from("patients").update({ last_patient_message_at: new Date().toISOString() }).eq("user_id", patientId);

      // Statut actuel — sert à décider si une résolution d'apaisement a lieu
      // d'être (uniquement depuis red_behavioral, jamais depuis red_critical).
      const { data: patientStatusRow } = await supabase
        .from("patients")
        .select("emotional_status")
        .eq("user_id", patientId)
        .single();
      const currentEmotionalStatusSos = (patientStatusRow as { emotional_status?: string } | null)?.emotional_status ?? "green";

      // Étage 1 — mots-clés bruts (zéro faux négatif, instantané, pas besoin
      // d'attendre l'appel LLM pour une urgence vitale explicite).
      // Étage 2 — analyzeCrisisWithLLM pour les formulations implicites.
      // On conserve le résultat COMPLET (level + murmure) pour alimenter
      // emotional_insight avec un motif précis, comme le fait isPostExercise.
      const sosIntakeCrisisAnalysis: CrisisAnalysis = isCriticalKeyword(trimmedMessage)
        ? { level: "red_critical", murmure: "", victory: "", apaisement: false }
        : await analyzeCrisisWithLLM(trimmedMessage, "Patient en pleine séance SOS (exercice de respiration guidée), phrase prononcée pendant l'intake vocal.");
      const level = sosIntakeCrisisAnalysis.level;

      // Détection d'apaisement : tourne dès que level === "none", quel que
      // soit l'état émotionnel de départ — le patient peut démarrer l'exercice
      // depuis "green" (pratique) ou "red_behavioral" (crise), et dans les deux
      // cas une phrase d'apaisement en clôture doit être enregistrée.
      const apaisementResult = level === "none"
        ? await detectApaisementWithLLM(trimmedMessage)
        : { confirmed: false, murmure: "" };
      const apaisementConfirme = apaisementResult.confirmed;

      // Volontairement JAMAIS écrit dans `conversations`, quel que soit le
      // niveau détecté — ce que dit le patient pendant l'intake/clôture vocal
      // ne doit apparaître nulle part dans le fil de discussion écrit, ni
      // même de façon ponctuelle sur les alertes. La seule trace visible doit
      // être la fiche "Exercice SOS terminé" (sos_events.intake_message /
      // closing_message, voir lib/sosClosures.ts) — détail au clic, jamais de
      // message épars lié à l'audio. Conséquence acceptée : crisis_trigger_
      // message_id et le "Aller au message" de l'ancien bandeau admin_alerts
      // restent à null pour les événements détectés pendant un exercice SOS
      // vocal — seul le badge "Alerte détectée" sur la fiche (crisis_level_
      // detected) signale l'alerte, sans lien profond vers un message.
      const savedMessageId: string | null = null;

      // Relie cette détection au sos_event de l'exercice en cours.
      // Stocke aussi le murmure LLM (intake_murmure) pour la carte praticien,
      // quelle que soit la sévérité — donnée clinique utile même sans alerte.
      const murmureToStore = sosIntakeCrisisAnalysis.murmure;
      try {
        const { data: recentEvent } = await supabase
          .from("sos_events")
          .select("id")
          .eq("patient_id", patientId)
          .eq("practitioner_id", practitionerId)
          .order("triggered_at", { ascending: false })
          .limit(1)
          .single();
        if (recentEvent?.id) {
          await supabase.from("sos_events").update({
            ...(murmureToStore ? { intake_murmure: murmureToStore } : {}),
            ...((level === "red_critical" || level === "red_behavioral") ? {
              crisis_level_detected: level,
              crisis_trigger_message_id: savedMessageId,
            } : {}),
          }).eq("id", recentEvent.id);
        }
      } catch { /* silencieux */ }

      if (level === "red_critical") {
        const safetyText = CRISIS_CRITICAL_RESPONSES.suicide;
        await supabase.from("patients").update({
          emotional_status: "red_critical",
          // emotional_insight uniquement sur la synthèse finale pour ne pas faire
          // scintiller la météo praticien à chaque fragment d'intake
          ...(isFinalIntake ? { emotional_insight: sosIntakeCrisisAnalysis.murmure || "Urgence détectée pendant l'exercice SOS" } : {}),
        }).eq("user_id", patientId);
        const { data: cur } = await supabase.from("patients").select("admin_alerts").eq("user_id", patientId).single();
        const alerts = (cur as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
        await supabase.from("patients").update({
          admin_alerts: [...alerts, { type: "admin_alert", alert_type: "critical_sos_intake", date: new Date().toISOString(), seen: false, message: trimmedMessage.slice(0, 200), trigger_message_id: savedMessageId }],
        }).eq("user_id", patientId);

        try {
          const alertRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-crisis-alert`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-crisis-token": process.env.CRISIS_SECRET_TOKEN ?? "" },
            body: JSON.stringify({ patientId, practitionerId, alertType: "sos_intake_critical", message: trimmedMessage }),
          });
          if (!alertRes.ok) void reportCriticalEvent("Alerte crise NON envoyée (HTTP)", { patientId, status: alertRes.status });
        } catch (e) { void reportCriticalEvent("Alerte crise NON envoyée (réseau)", { patientId, error: String(e) }); }

        await supabase.from("conversations").insert({
          patient_id: patientId, practitioner_id: practitionerId, role: "assistant", content: safetyText, session_id: null,
        });

        return Response.json({ level: "red_critical", safetyText });
      }

      if (level === "red_behavioral") {
        await supabase.from("patients").update({
          emotional_status: "red_behavioral",
          red_behavioral_until: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // LEGACY-1 : fenêtre de mode ancrage
          // emotional_insight uniquement sur la synthèse finale — pas sur les
          // fragments intermédiaires (scintillement météo côté praticien)
          ...(isFinalIntake ? { emotional_insight: sosIntakeCrisisAnalysis.murmure || "Alerte comportementale détectée pendant l'exercice SOS" } : {}),
        }).eq("user_id", patientId);
        const { data: cur } = await supabase.from("patients").select("admin_alerts").eq("user_id", patientId).single();
        const alerts = (cur as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
        await supabase.from("patients").update({
          admin_alerts: [...alerts, { type: "admin_alert", alert_type: "behavioral_sos_intake", date: new Date().toISOString(), seen: false, message: trimmedMessage.slice(0, 200), trigger_message_id: savedMessageId }],
        }).eq("user_id", patientId);
        // Ouvrir une crisis_event si aucune n'est déjà ouverte pour ce patient
        try {
          const { count: openCrises } = await supabase.from("crisis_events")
            .select("id", { count: "exact", head: true })
            .eq("patient_id", patientId).is("resolved_at", null);
          if ((openCrises ?? 0) === 0) {
            await supabase.from("crisis_events").insert({ patient_id: patientId, practitioner_id: practitionerId });
          }
        } catch { /* silencieux */ }
        // Pas d'alerte email (pour ne pas spammer le praticien), pas d'interruption
        // de l'exercice en cours — Gemini Live continue normalement en direct.
        return Response.json({ level: "red_behavioral" });
      }

      // ═══ Résolution apaisement — uniquement depuis red_behavioral, jamais
      // depuis red_critical (verrou praticien absolu, même règle que le flux
      // principal). Tourne en arrière-plan, sans jamais interrompre
      // l'exercice en cours ni la conversation Gemini Live qui continue.
      // apaisementConfirme déjà calculé plus haut (voir persistance sélective).
      if (apaisementConfirme) {
        try {
          type PendingSosEvent = { id: string; origin?: string | null; sos_context?: string | null; raw_response?: string | null };
          const { data: pendingEventRaw } = await supabase
            .from("sos_events")
            .select("id, origin, sos_context, raw_response")
            .eq("patient_id", patientId)
            .eq("practitioner_id", practitionerId)
            .eq("status", "pending")
            .order("triggered_at", { ascending: false })
            .limit(1)
            .single();
          const pendingEvent = pendingEventRaw as PendingSosEvent | null;

          // 🏆 Victoire auto — même logique que la résolution d'apaisement
          // du flux principal : une crise réellement désamorcée (origin
          // "crise" — toujours le cas pour "Mon Soutien") est une victoire.
          let victoryText = "";
          if (pendingEvent?.origin === "crise") {
            const sosToolNames: Record<string, string> = {
              breathing: "la cohérence cardiaque", ancrage: "l'ancrage sensoriel",
              manger: "la pleine conscience alimentaire", defusion: "la défusion cognitive",
              ecriture: "l'écriture cathartique",
            };
            let resolvedToolId: string | null = null;
            try { resolvedToolId = (JSON.parse(pendingEvent.raw_response ?? "{}") as { tool_id?: string }).tool_id ?? null; } catch { /* ignore */ }
            const exerciseLabel = resolvedToolId ? sosToolNames[resolvedToolId] ?? null : null;
            const rawContext = (pendingEvent.sos_context ?? "").split("|")[0]?.trim();
            const crisisLabel = rawContext && !rawContext.startsWith("[contexte chat récent]") && rawContext !== "Mon Soutien"
              ? `une crise (${rawContext})`
              : "un moment difficile";
            victoryText = exerciseLabel ? `A surmonté ${crisisLabel} grâce à ${exerciseLabel}.` : `A surmonté ${crisisLabel} grâce à l'exercice SOS vocal.`;
          }

          let historique1: { text: string; created_at: string }[] | undefined;
          if (victoryText) {
            const { data: curPat1 } = await supabase.from("patients").select("victories_history").eq("user_id", patientId).single();
            const hist1 = (curPat1?.victories_history as { text: string; created_at: string }[] | null) ?? [];
            historique1 = [...hist1, { text: victoryText, created_at: new Date().toISOString() }].slice(-50);
          }
          await supabase.from("patients").update({
            emotional_status: "green",
            emotional_insight: apaisementResult.murmure || "Apaisement exprimé pendant l'exercice SOS",
            ...(victoryText ? { latest_victory: victoryText, victory_detected_at: new Date().toISOString(), victory_message_id: savedMessageId } : {}),
            ...(historique1 ? { victories_history: historique1 } : {}),
            last_patient_message_at: new Date().toISOString(),
          }).eq("user_id", patientId);

          if (pendingEvent?.id) {
            await supabase.from("sos_events").update({ status: "success" }).eq("id", pendingEvent.id);
          }
        } catch { /* silencieux — ne doit jamais perturber l'exercice en cours */ }

        return Response.json({ level: "none" });
      }

      return Response.json({ level: "none" });
    }

    // ═══ FLOW PRINCIPAL ═══

    const practitionerData = practitionerId
      ? await getPractitionerData(practitionerId)
      : { plan: "essentiel" as PlanType, profile: null };

    const plan = practitionerData.plan;
    const config = PLAN_CONFIG[plan];

    // Rate limit
    let dailyCount = 0;
    let isLastMessage = false;
    if (patientId) {
      dailyCount = await getDailyMessageCount(patientId);
      if (dailyCount >= config.dailyMessageLimit) {
        return Response.json({
          error: "rate_limit",
          remaining: 0,
          count: dailyCount,
          limit: config.dailyMessageLimit,
        }, { status: 429 });
      }
      isLastMessage = dailyCount === config.dailyMessageLimit - 1;
    }

    // Récupérer statut actuel du patient
    const supabaseMain = createSupabaseClient();
    let currentEmotionalStatus = "green";
    let redBehavioralUntil: string | null = null; // LEGACY-1 : fin de fenêtre de mode ancrage
    let patientStateForClassifier: PatientStateContext = {
      emotional_status: "green",
      emotional_insight: "",
      latest_victory: null,
      victory_detected_at: null,
    };

    if (patientId) {
      const { data: patientStatus } = await supabaseMain
        .from("patients")
        .select("emotional_status, emotional_insight, latest_victory, victory_detected_at, red_behavioral_until")
        .eq("user_id", patientId)
        .single();
      if (patientStatus) {
        const ps = patientStatus as { emotional_status?: string; emotional_insight?: string; latest_victory?: string; victory_detected_at?: string; red_behavioral_until?: string | null };
        currentEmotionalStatus = ps.emotional_status ?? "green";
        redBehavioralUntil = ps.red_behavioral_until ?? null;
        patientStateForClassifier = {
          emotional_status: currentEmotionalStatus,
          emotional_insight: ps.emotional_insight ?? "",
          latest_victory: ps.latest_victory ?? null,
          victory_detected_at: ps.victory_detected_at ?? null,
        };
      }
    }

    // ID stable généré ici — utilisé pour lier les admin_alerts et victoires au message patient
    const userMsgId = crypto.randomUUID();
    // Flag pour éviter de créer deux admin_alerts comportementaux (détection précoce + Gemini JSON)
    let earlyBehavioralDetected = false;

    // Paralléliser : profil patient + 5 derniers messages pour le classificateur
    const profileResult = patientId ? getPatientProfile(patientId) : Promise.resolve({ context: "", pathologies: undefined });

    // Derniers échanges pour enrichir le contexte du classificateur (léger, pas de résumé)
    const recentForClassifierPromise: Promise<{ role: string; content: string }[]> = (patientId && practitionerId)
      ? (async () => {
        try {
          const r = await supabaseMain
            .from("conversations")
            .select("role, content")
            .eq("patient_id", patientId)
            .eq("practitioner_id", practitionerId)
            .order("created_at", { ascending: false })
            .limit(5);
          return ((r.data as { role: string; content: string }[] | null) ?? []).reverse();
        } catch {
          return [] as { role: string; content: string }[];
        }
      })()
      : Promise.resolve([] as { role: string; content: string }[]);

    // Classificateur — toujours lancé, sans barrière regex (contexte enrichi : messages + état patient)
    const crisisPromise = (message && patientId)
      ? Promise.all([profileResult, recentForClassifierPromise])
        .then(([p, recent]) => analyzeCrisisWithLLM(message, p.context, recent, patientStateForClassifier))
      : Promise.resolve<CrisisAnalysis>({ level: "none", murmure: "", victory: "", apaisement: false });

    // Lancer RAG en parallèle du classificateur de crise : dès que profileResult
    // est résolu on connaît les pathologies nécessaires à l'embedding, et on peut
    // commencer la recherche vectorielle pendant que le LLM analyse la crise.
    // Si le résultat révèle le mode ancrage, on écarte simplement le résultat RAG.
    const ragPromise: Promise<string> = practitionerId
      ? profileResult.then(({ pathologies }) =>
          getRelevantDocuments(message, practitionerId, config.ragChunks, patientId, pathologies)
        )
      : Promise.resolve("");

    const [{ context: patientContext, pathologies: patientPathologies }, crisisAnalysis, documentsContextRaw] = await Promise.all([
      profileResult,
      crisisPromise,
      ragPromise,
    ]);

    // LEGACY-1 — mode ancrage piloté par la RÉCENCE de la détresse (fenêtre 12h), pas
    // par le statut persistant : le statut praticien peut rester red_behavioral longtemps
    // (jusqu'à apaisement réel ou action praticien), mais le Jumeau ressort du mode ancrage
    // une fois la fenêtre écoulée — un patient qui revient plus tard retrouve un Jumeau normal.
    const ancrageWindowActive = !!redBehavioralUntil && new Date(redBehavioralUntil).getTime() > Date.now();
    const inBehavioralAncrage = currentEmotionalStatus === "red_behavioral" && ancrageWindowActive;
    // Skip RAG en mode ancrage : le jumeau ne doit donner aucun conseil nutritionnel.
    const isAncrageMode = crisisAnalysis.level === "red_behavioral" || inBehavioralAncrage;
    const documentsContext = isAncrageMode ? "" : documentsContextRaw;

    // Gérer crise LLM détectée
    if (crisisAnalysis.level === "red_critical" && patientId && practitionerId) {
      await supabaseMain.from("patients").update({ emotional_status: "red_critical", emotional_insight: crisisAnalysis.murmure || "Urgence détectée par IA" }).eq("user_id", patientId);
      const { data: cur } = await supabaseMain.from("patients").select("admin_alerts").eq("user_id", patientId).single();
      const alerts = (cur as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
      await supabaseMain.from("patients").update({
        admin_alerts: [...alerts, { type: "admin_alert", alert_type: "critical_llm", date: new Date().toISOString(), seen: false, murmure: crisisAnalysis.murmure, trigger_message_id: userMsgId }]
      }).eq("user_id", patientId);
      try {
        const alertRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-crisis-alert`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-crisis-token": process.env.CRISIS_SECRET_TOKEN ?? "" },
          body: JSON.stringify({ patientId, practitionerId, alertType: "implicit_critical", message }),
        });
        if (!alertRes.ok) void reportCriticalEvent("Alerte crise NON envoyée (HTTP)", { patientId, status: alertRes.status });
      } catch (e) { void reportCriticalEvent("Alerte crise NON envoyée (réseau)", { patientId, error: String(e) }); }
    }

    if (crisisAnalysis.level === "red_behavioral" && patientId && practitionerId) {
      earlyBehavioralDetected = true;
      await supabaseMain.from("patients").update({
        emotional_status: "red_behavioral",
        emotional_insight: crisisAnalysis.murmure || "Alerte comportementale détectée",
        red_behavioral_until: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), // LEGACY-1 : fenêtre de mode ancrage
      }).eq("user_id", patientId);
      // Alerte discrète sur le Dashboard uniquement (pas d'email pour éviter le spam praticien)
      const { data: cur } = await supabaseMain.from("patients").select("admin_alerts").eq("user_id", patientId).single();
      const alerts = (cur as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
      await supabaseMain.from("patients").update({
        admin_alerts: [...alerts, { type: "admin_alert", alert_type: "behavioral", date: new Date().toISOString(), seen: false, murmure: crisisAnalysis.murmure, trigger_message_id: userMsgId }]
      }).eq("user_id", patientId);
      // Ouvrir une crisis_event si aucune n'est déjà ouverte pour ce patient
      try {
        const { count: openCrises } = await supabaseMain.from("crisis_events")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", patientId).is("resolved_at", null);
        if ((openCrises ?? 0) === 0) {
          await supabaseMain.from("crisis_events").insert({ patient_id: patientId, practitioner_id: practitionerId });
        }
      } catch { /* silencieux */ }
    }

    const forceAncrage = crisisAnalysis.level === "red_behavioral" || inBehavioralAncrage;

    // Routage modèle — déclaré ici pour que getOrCreateVertexCache puisse l'utiliser
    const modelName = "gemini-3.5-flash";

    // Build the cacheable portion of the system prompt (template + profile + patientContext).
    // documentsContext (RAG) is dynamic — it will be injected into userParts below.
    const cacheablePrompt = systemPrompt ||
      buildCacheablePrompt(practitionerData.profile, patientContext, forceAncrage, practitionerData.specialty);

    const lastMessageNote = `\n\n[Note système — ne pas reproduire textuellement : c'est ta dernière réponse pour ce patient aujourd'hui. Réponds normalement à sa question, puis conclus naturellement et chaleureusement la conversation — une phrase dans ta voix, sans mentionner de limite technique.]`;

    // Determine whether to use a Vertex cachedContent resource or a plain systemInstruction.
    // Cache is skipped for: admin/test overrides, missing IDs, and the rare "last message" case
    // that needs a dynamic suffix appended to the system instruction.
    let systemOrCache: { type: "system"; text: string } | { type: "cache"; name: string };

    if (systemPrompt || !patientId || !practitionerId || (isLastMessage && !imageBase64) || forceAncrage) {
      const finalText = (isLastMessage && !imageBase64 && !systemPrompt)
        ? cacheablePrompt + lastMessageNote
        : cacheablePrompt;
      systemOrCache = { type: "system", text: finalText };
    } else {
      try {
        const cacheName = await getOrCreateVertexCache(practitionerId, patientId, modelName, cacheablePrompt);
        systemOrCache = { type: "cache", name: cacheName };
      } catch {
        // Vertex cache unavailable — fall back to plain system instruction silently
        systemOrCache = { type: "system", text: cacheablePrompt };
      }
    }

    let conversationHistory: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    if (patientId && practitionerId) {
      conversationHistory = await getConversationHistory(patientId, practitionerId, plan, sessionId);
    }

    // ═══ GARDE VISION — plan pro/cabinet requis ═══
    if (imageBase64) {
      const visionAllowedPlans: PlanType[] = ["pro", "cabinet"];
      if (!visionAllowedPlans.includes(plan)) {
        // Invalide le cache au cas où le plan aurait changé récemment
        if (practitionerId) await invalidatePractitionerCache(practitionerId);
        return new Response(
          JSON.stringify({ error: "vision_plan_required", message: "L'analyse de photos nécessite un abonnement Pro ou Cabinet." }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Build Vertex AI content array: history + current user turn
    let userParts: unknown[];
    if (imageBase64 && imageMimeType) {
      const hasMessage = message.trim().length > 0;
      const visionPrompt = hasMessage
        ? `Un patient en suivi nutritionnel te partage cette image avec ce message : "${message}"

${patientContext}${documentsContext}

Réponds directement à sa question ou demande en exploitant l'image. Si elle montre un aliment, un repas, une étiquette nutritionnelle, un menu, un produit alimentaire ou tout élément lié à l'alimentation, intègre une lecture nutritionnelle adaptée à son profil et ses objectifs. Tu restes dans ta posture de jumeau numérique — bienveillant, jamais culpabilisant, jamais dans le jugement.
Max 200 mots. Sans markdown.`
        : `Un patient en suivi nutritionnel te partage une photo sans commentaire.

${patientContext}${documentsContext}

Identifie ce que montre l'image. Si c'est un repas ou un aliment : analyse les portions visibles, la qualité nutritionnelle, les éventuels écarts par rapport aux objectifs et au protocole du praticien. Si c'est une étiquette, un emballage, un menu ou un produit : donne une lecture utile pour son suivi. Croise systématiquement avec son profil (allergies, intolérances, objectifs). Termine par une question courte et naturelle pour approfondir. Tu restes bienveillant, jamais culpabilisant.
Max 150 mots. Sans markdown.`;

      userParts = [
        { inlineData: { data: imageBase64, mimeType: imageMimeType } },
        { text: visionPrompt },
      ];
    } else {
      // Tronquer à 5000 chars pour Gemini — le message complet est toujours stocké en DB.
      // documentsContext (RAG) est injecté ici dans le tour utilisateur (pas dans le system prompt
      // caché) pour respecter l'alternance user/model imposée par l'API Vertex.
      const baseText = message.slice(0, 5000);
      userParts = documentsContext
        ? [{ text: `[Contexte documentaire]:\n${documentsContext}\n\n${baseText}` }]
        : [{ text: baseText }];
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
          // thinkingConfig.thinkingBudget:0 → thinking DÉSACTIVÉ sur le chat : (1) plus de
          // fuite de raisonnement dans la réponse, (2) moins de tokens consommés (aide le quota 429).
          for await (const chunkText of vertexStreamGenerate(modelName, chatContents, systemOrCache, { maxOutputTokens: config.maxOutputTokens, temperature: 0.78, thinkingConfig: { thinkingBudget: 0 } })) {
            fullText += chunkText;
            controller.enqueue(encoder.encode(chunkText));
            await new Promise(resolve => setTimeout(resolve, 5));
          }
        } catch (err) {
          // Propager une erreur lisible via le stream plutôt que silencieusement fermer
          const errMsg = err instanceof Error ? err.message : "Erreur inconnue";
          console.error("[NutriTwin] chat stream — échec Vertex:", errMsg);

          // Si on utilisait un cachedContent Vertex qui a expiré (404) ou est invalide,
          // retry transparent avec un system instruction plain — évite le "service indisponible"
          // causé par un cache Redis périmé pointant vers une ressource Vertex supprimée.
          if (systemOrCache.type === "cache" && !errMsg.includes("400") && !errMsg.includes("INVALID_ARGUMENT")) {
            console.warn("[NutriTwin] cachedContent Vertex expiré/invalide, retry sans cache");
            try {
              const fallbackSystem: { type: "system"; text: string } = { type: "system", text: cacheablePrompt };
              for await (const chunkText of vertexStreamGenerate(modelName, chatContents, fallbackSystem, { maxOutputTokens: config.maxOutputTokens, temperature: 0.78, thinkingConfig: { thinkingBudget: 0 } })) {
                fullText += chunkText;
                controller.enqueue(encoder.encode(chunkText));
                await new Promise(resolve => setTimeout(resolve, 5));
              }
              // Retry réussi — on continue vers le post-stream normalement
            } catch (retryErr) {
              const retryMsg = retryErr instanceof Error ? retryErr.message : "Erreur inconnue";
              console.error("[NutriTwin] retry sans cache échoué:", retryMsg);
              const isVisionErrorRetry = retryMsg.includes("400") || retryMsg.includes("INVALID_ARGUMENT");
              const userMsg = isVisionErrorRetry
                ? "L'analyse de cette image n'a pas abouti. Vérifiez que l'image est lisible et réessayez."
                : "Le service est temporairement indisponible. Réessayez dans un instant.";
              controller.enqueue(encoder.encode(userMsg));
              fullText = userMsg;
              controller.close();
              return;
            }
          } else {
            const isVisionError = errMsg.includes("400") || errMsg.includes("INVALID_ARGUMENT");
            const userMsg = isVisionError
              ? "L'analyse de cette image n'a pas abouti. Vérifiez que l'image est lisible et réessayez."
              : "Le service est temporairement indisponible. Réessayez dans un instant.";
            controller.enqueue(encoder.encode(userMsg));
            fullText = userMsg;
            controller.close();
            return;
          }
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
            // Victoire : classificateur en priorité (contexte enrichi + règles précises),
            // JSON Gemini principal en supplément si le classificateur n'a rien détecté
            victoryText = crisisAnalysis.victory || (parsed.victory ?? "");
            // Apaisement : l'un ou l'autre signal suffit
            apaisementConfirme = crisisAnalysis.apaisement || parsed.apaisement === "oui";
            if (parsed.action) adminAlert = { action: parsed.action, alert_type: parsed.alert_type };
          } catch { /* silencieux */ }
          fullText = fullText.replace(/\|\|\|[\s\S]*?\|\|\|/, "").trim();
        } else {
          // Pas de bloc JSON Gemini (image, réponse courte, échec) → classificateur seul
          victoryText = crisisAnalysis.victory;
          apaisementConfirme = crisisAnalysis.apaisement;
        }

        // ── Gardes victoire ────────────────────────────────────────────────────────
        // 1) Pas de victoire si le patient est en vulnérabilité comportementale
        // 2) Dédup : pas de double-victoire si la précédente date de moins de 30 min
        //    (le classificateur a déjà cette règle dans son prompt, mais le JSON Gemini
        //    principal n'a pas ce contexte — la garde code-side est le filet de sécurité)
        const lastVictoryAt = patientStateForClassifier.victory_detected_at;
        const victoryTooRecent = !!lastVictoryAt
          && (Date.now() - new Date(lastVictoryAt).getTime()) < 30 * 60 * 1000;
        if (currentEmotionalStatus === "red_behavioral" || victoryTooRecent) {
          victoryText = "";
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

        // CD-2 — garantir la ressource d'urgence sur TOUTE bascule red_critical détectée
        // hors fast-path mots-clés (le fast-path, lui, renvoie déjà CRISIS_CRITICAL_RESPONSES).
        // On couvre les deux sources : le JSON principal (emotionalStatus) ET le classifieur
        // parallèle (crisisAnalysis.level), qui peuvent diverger.
        if ((emotionalStatus === "red_critical" || crisisAnalysis.level === "red_critical") && !fullText.includes("3114")) {
          const resource = "\n\n—\nSi tu es en danger immédiat, appelle le 3114 (numéro national de prévention du suicide, 24h/24, gratuit et confidentiel) ou le 15. Ton praticien est informé et va prendre contact avec toi.";
          controller.enqueue(encoder.encode(resource));
          fullText += resource;
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
          // NOTE : on NE remet JAMAIS au vert juste parce que Gemini renvoie "green" sur un
          // message banal. red_behavioral est "sticky" jusqu'à apaisement explicite (signal
          // Gemini + classificateur) ou action praticien (Marquer comme vu / LeverAlerte).
          const isSignificantStatusChange =
            emotionalStatus === "red_critical" ||
            emotionalStatus === "red_behavioral" ||
            shouldResolveApaisement;

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
              manger: "la pleine conscience alimentaire", defusion: "la défusion cognitive",
              ecriture: "l'écriture cathartique",
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
          // Accumuler dans victories_history si nouvelle victoire détectée
          if (finalVictoryText) {
            const { data: curPat2 } = await supabase.from("patients").select("victories_history").eq("user_id", patientId).single();
            const hist2 = (curPat2?.victories_history as { text: string; created_at: string }[] | null) ?? [];
            patientStatusUpdate.victories_history = [...hist2, { text: finalVictoryText, created_at: new Date().toISOString() }].slice(-50);
          }
          // emotional_status uniquement sur changements majeurs
          if (isSignificantStatusChange) {
            patientStatusUpdate.emotional_status = emotionalStatus;
            // Retour au vert (apaisement) → vider la note clinique ET la fenêtre d'ancrage.
            // Sinon l'ancien insight de crise reste collé sur un patient vert et réamorce le
            // classifieur au message suivant (même bug que celui corrigé sur LeverAlerteCritique).
            if (emotionalStatus === "green") {
              patientStatusUpdate.emotional_insight = null;
              patientStatusUpdate.red_behavioral_until = null;
            }
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

          // Apaisement → résoudre la crisis_event ouverte
          if (shouldResolveApaisement) {
            try {
              await supabase.from("crisis_events")
                .update({ resolved_at: new Date().toISOString() })
                .eq("patient_id", patientId)
                .is("resolved_at", null);
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

          // Question hors périmètre détectée par Gemini → stocker dans admin_alerts
          if (adminAlert.action === "out_of_scope") {
            const { data: current } = await supabase.from("patients").select("admin_alerts").eq("user_id", patientId).single();
            const alerts = (current as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
            await supabase.from("patients").update({
              admin_alerts: [...alerts, {
                type: "out_of_scope",
                date: new Date().toISOString(),
                seen: false,
                question_snippet: message.slice(0, 150),
                trigger_message_id: userMsgId,
              }]
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
        ...(patientId ? {
          "X-Daily-Count": String(dailyCount + 1),
          "X-Daily-Limit": String(config.dailyMessageLimit),
        } : {}),
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return Response.json({ response: "Erreur: " + errorMessage }, { status: 500 });
  }
}

export { invalidatePractitionerCache };
