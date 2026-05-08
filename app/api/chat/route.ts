import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import OpenAI from "openai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ============================================================
// PLAN CONFIG
// ============================================================
const PLAN_CONFIG = {
  essentiel: {
    model: "gemini-3-flash-lite",
    maxOutputTokens: 200,
    historyLimit: 20,
    ragChunks: 5,
    dailyMessageLimit: 30,
    isFounder: false,
  },
  pro: {
    model: "gemini-3-flash",
    maxOutputTokens: 500,
    historyLimit: 100,
    ragChunks: 5,
    dailyMessageLimit: 100,
    isFounder: false,
  },
  cabinet: {
    model: "gemini-3-flash",
    maxOutputTokens: 500,
    historyLimit: 100,
    ragChunks: 5,
    dailyMessageLimit: 100,
    isFounder: false,
  },
  fondateur: {
    model: "gemini-3-flash",
    maxOutputTokens: 500,
    historyLimit: 100,
    ragChunks: 5,
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
};

// ============================================================
// MOTS-CLÉS POUR MODEL ROUTING
// ============================================================
const COMPLEX_KEYWORDS = [
  "faim", "manger", "repas", "aliment", "calorie", "régime", "poids",
  "maigrir", "grossir", "sport", "exercice", "santé", "maladie", "diabète",
  "cholestérol", "allergie", "intolérance", "fatigue", "stress", "anxieux",
  "triste", "déprime", "craquage", "écart", "motivation", "découragement",
  "résultat", "plateau", "ballonnement", "digestion", "sucre", "glucide",
  "protéine", "lipide", "vitamine", "complément", "jeûne", "détox",
  "j'ai mangé", "j'ai craqué", "je me sens", "j'ai mal", "pourquoi",
  "comment", "que faire", "conseil", "aide", "problème",
];

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

// ============================================================
// REDIS — CACHE PLAN + PROFIL PRATICIEN
// ============================================================
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
    await redis.set(`practitioner:${practitionerId}`, data, { ex: 3600 }); // TTL 1h
  } catch {
    // Silencieux
  }
}

async function invalidatePractitionerCache(practitionerId: string): Promise<void> {
  try {
    await redis.del(`practitioner:${practitionerId}`);
  } catch {
    // Silencieux
  }
}

// ============================================================
// RÉCUPÉRER LE PLAN + PROFIL DU PRATICIEN (avec cache Redis)
// ============================================================
async function getPractitionerData(practitionerId: string): Promise<CachedPractitioner> {
  // 1. Vérifier le cache Redis
  const cached = await getPractitionerFromCache(practitionerId);
  if (cached) return cached;

  // 2. Sinon charger depuis Supabase
  const supabase = createSupabaseClient();

  const [practitionerResult, profileResult] = await Promise.all([
    supabase.from("practitioners").select("plan").eq("user_id", practitionerId).single(),
    supabase.from("practitioner_profiles").select("*").eq("user_id", practitionerId).single(),
  ]);

  const plan = (practitionerResult.data as { plan?: string } | null)?.plan;
  const validPlan: PlanType = plan && plan in PLAN_CONFIG ? plan as PlanType : "essentiel";
  const profile = profileResult.data as Record<string, string> | null;

  const data: CachedPractitioner = { plan: validPlan, profile };

  // 3. Stocker dans Redis pour 1h
  await setPractitionerInCache(practitionerId, data);

  return data;
}

// ============================================================
// SEMANTIC CACHE
// ============================================================
async function getSemanticCache(
  question: string,
  practitionerId: string,
  openai: OpenAI
): Promise<string | null> {
  try {
    const supabase = createSupabaseClient();
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const queryEmbedding = embeddingResponse.data[0]?.embedding;
    if (!queryEmbedding) return null;

    const { data } = await supabase.rpc("match_cached_responses", {
      query_embedding: queryEmbedding,
      practitioner_id: practitionerId,
      similarity_threshold: 0.88,
      match_count: 1,
    });

    const results = data as { response: string; similarity: number }[] | null;
    if (results && results.length > 0) return results[0].response;
    return null;
  } catch {
    return null;
  }
}

async function saveToCache(
  question: string,
  response: string,
  practitionerId: string,
  openai: OpenAI
): Promise<void> {
  try {
    const supabase = createSupabaseClient();
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const embedding = embeddingResponse.data[0]?.embedding;
    if (!embedding) return;

    await supabase.from("cached_responses").insert({
      practitioner_id: practitionerId,
      question,
      response,
      embedding,
    } as never);
  } catch {
    // Silencieux
  }
}

// ============================================================
// RAG
// ============================================================
async function hasDocuments(practitionerId: string): Promise<boolean> {
  const supabase = createSupabaseClient();
  const { count } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("practitioner_id", practitionerId);
  return (count ?? 0) > 0;
}

async function getRelevantDocuments(
  question: string,
  practitionerId: string,
  ragChunks: number,
  openai: OpenAI
): Promise<string> {
  try {
    const hasDocs = await hasDocuments(practitionerId);
    if (!hasDocs) return "";

    const supabase = createSupabaseClient();
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const queryEmbedding = embeddingResponse.data[0]?.embedding;
    if (!queryEmbedding) return "";

    const { data } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      practitioner_id: practitionerId,
      match_count: ragChunks,
    });

    const results = data as { content: string; similarity: number }[] | null;
    if (!results || results.length === 0) return "";

    const relevant = results
      .filter((d) => d.similarity > 0.5)
      .map((d) => d.content)
      .join("\n\n");

    return relevant ? `\nDOCUMENTS DE RÉFÉRENCE DU PRATICIEN :\n${relevant}\n` : "";
  } catch {
    return "";
  }
}

// ============================================================
// PROFIL PATIENT
// ============================================================
async function getPatientProfile(patientId: string): Promise<string> {
  try {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("patients")
      .select("first_name, last_name, age, objective, pathologies, allergies, notes")
      .eq("user_id", patientId)
      .single();

    const patient = data as {
      first_name?: string;
      last_name?: string;
      age?: number;
      objective?: string;
      pathologies?: string;
      allergies?: string;
      notes?: string;
    } | null;

    if (!patient) return "";

    const parts = [];
    if (patient.first_name) parts.push(`Prénom : ${patient.first_name}`);
    if (patient.age) parts.push(`Âge : ${patient.age} ans`);
    if (patient.objective) parts.push(`Objectif : ${patient.objective}`);
    if (patient.pathologies) parts.push(`Pathologies : ${patient.pathologies}`);
    if (patient.allergies) parts.push(`Allergies : ${patient.allergies}`);
    if (patient.notes) parts.push(`Notes : ${patient.notes}`);

    return parts.length > 0 ? `\nPROFIL DU PATIENT :\n${parts.join("\n")}\n` : "";
  } catch {
    return "";
  }
}

// ============================================================
// HISTORIQUE + RÉSUMÉ AUTOMATIQUE
// ============================================================
async function summarizeOldMessages(
  messages: { role: string; content: string }[]
): Promise<string> {
  try {
    const patientMessages = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content.slice(0, 150))
      .join(" | ");

    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-lite" });
    const result = await model.generateContent(
      `Résume en 5 lignes maximum les points clés de ces échanges patient-nutritionniste. 
      Garde uniquement les faits importants : objectifs, écarts, progrès, préoccupations.
      Échanges : ${patientMessages}`
    );
    return `[RÉSUMÉ DES ÉCHANGES PRÉCÉDENTS : ${result.response.text()}]`;
  } catch {
    const patientMessages = messages
      .filter((m) => m.role === "user")
      .slice(0, 10)
      .map((m) => m.content.slice(0, 100))
      .join(" | ");
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

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    }

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

// ============================================================
// SYSTEM PROMPT COMPACT (depuis cache Redis)
// ============================================================
function buildSystemPrompt(
  profile: Record<string, string> | null,
  patientContext: string,
  documentsContext: string
): string {
  if (!profile) return getDefaultPrompt();

  return `Tu es le jumeau numérique d'un nutritionniste.

COMMUNICATION : ton=${profile.tone_of_voice||"bienveillant"} | ${profile.tutoiement||"vouvoiement"} | niveau=${profile.technicite||"adaptatif"} | longueur=${profile.longueur_reponses||"court"} | emojis=${profile.emojis||"modération"}

PHILOSOPHIE : ${profile.approche_generale||"rééquilibrage"} | pathologies=${profile.pathologies||"généraliste"} | régimes=${profile.position_regimes||"cas par cas"} | glucides=${profile.position_glucides||"selon objectif"} | jeûne=${profile.jejune||"cas par cas"} | compléments=${profile.complements||"cas par cas"} | jamais=${profile.jamais_dire||"rien"} | règle d'or=${profile.conviction||"non spécifiée"}

GESTION HUMAINE : écarts=${profile.gestion_ecarts||"sans culpabilité"} | émotions=${profile.emotions||"global"} | non-suivi=${profile.non_suivi||"bienveillance"} | fêtes=${profile.fetes_vacances||"équilibre"} | remotivation=${profile.motivation_berne||"valoriser"} | posture=${profile.posture||"bienveillant"}

SÉCURITÉ : périmètre=${profile.perimetre||"prudence"} | médical=${profile.questions_medicales||"rediriger"} | détresse=${profile.urgence_detresse||"empathie+alerte"} | ligne rouge=${profile.ligne_rouge||"ne pas culpabiliser"}

MON APPROCHE : ${profile.approche_libre||"bienveillant et personnalisé"}

EXEMPLES : craquage="${profile.situation1||"Un écart, on repart."}" | régime="${profile.situation2||"Trouvons ce qui vous convient."}" | décroche="${profile.situation3||"Je suis là."}" | médical="${profile.situation4||"Parlons-en avec votre médecin."}" | victoire="${profile.situation5||"Bravo !"}" | détresse="${profile.situation6||"Vous n'êtes pas seul(e)."}"
${patientContext}${documentsContext}
RÈGLES ABSOLUES : sans markdown | phrases simples et aérées | max 150 mots | tu ES ce praticien | utilise le prénom du patient`;
}

function getDefaultPrompt(): string {
  return "Tu es un assistant nutritionniste. Réponds sans markdown, en phrases simples, max 150 mots.";
}

// ============================================================
// QUOTA JOURNALIER
// ============================================================
async function getDailyMessageCount(patientId: string): Promise<number> {
  const supabase = createSupabaseClient();
  const today = new Date().toISOString().split("T")[0];
  const { count } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .eq("role", "user")
    .gte("created_at", `${today}T00:00:00`);
  return count ?? 0;
}

// ============================================================
// POST HANDLER
// ============================================================
export async function POST(request: Request) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const {
      message,
      systemPrompt,
      patientId,
      practitionerId,
      sessionId,
      imageBase64,
      imageMimeType,
    } = await request.json() as ChatRequest;

    // ── Plan + Profil depuis Redis (ou Supabase si cache miss) ──
    const practitionerData = practitionerId
      ? await getPractitionerData(practitionerId)
      : { plan: "essentiel" as PlanType, profile: null };

    const plan = practitionerData.plan;
    const config = PLAN_CONFIG[plan];

    // ── Quota journalier ──
    if (patientId) {
      const dailyCount = await getDailyMessageCount(patientId);
      if (dailyCount >= config.dailyMessageLimit) {
        return Response.json({
          response: plan === "essentiel"
            ? "Vous avez atteint votre limite de messages pour aujourd'hui. Votre jumeau vous attend demain ! 🌿"
            : "Votre jumeau numérique a besoin de faire le point sur nos échanges d'aujourd'hui pour préparer votre prochain bilan. On se retrouve demain pour continuer ? 🌿",
        });
      }
    }

    // ── Semantic caching (pas pour les images) ──
    if (practitionerId && !systemPrompt && !imageBase64) {
      const cached = await getSemanticCache(message, practitionerId, openai);
      if (cached) {
        return Response.json({ response: cached });
      }
    }

    // ── Contexte patient + documents ──
    const [patientContext, documentsContext] = await Promise.all([
      patientId ? getPatientProfile(patientId) : Promise.resolve(""),
      practitionerId ? getRelevantDocuments(message, practitionerId, config.ragChunks, openai) : Promise.resolve(""),
    ]);

    // ── System prompt ──
    const practitionerPrompt = systemPrompt ||
      buildSystemPrompt(practitionerData.profile, patientContext, documentsContext);

    // ── Historique ──
    let conversationHistory: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    if (patientId && practitionerId) {
      conversationHistory = await getConversationHistory(
        patientId,
        practitionerId,
        config.historyLimit,
        sessionId
      );
    }

    // ── Model routing ──
    const modelName = imageBase64
      ? "gemini-3-flash" // Vision toujours sur Flash
      : plan === "essentiel"
        ? config.model
        : isComplexMessage(message) ? "gemini-3-flash" : "gemini-3-flash-lite";

    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: practitionerPrompt,
      generationConfig: {
        maxOutputTokens: config.maxOutputTokens,
        temperature: 0.7,
      },
    });

    const chat = model.startChat({ history: conversationHistory });

    // ── Envoi message ou image ──
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

      result = await chat.sendMessage([
        {
          inlineData: {
            data: imageBase64,
            mimeType: imageMimeType as "image/jpeg" | "image/png" | "image/webp",
          },
        },
        { text: visionPrompt },
      ]);
    } else {
      result = await chat.sendMessage(message);
    }

    const text = result.response.text();

    // ── Sauvegarde en base ──
    const supabase = createSupabaseClient();
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

      // Cache sémantique (pas les images)
      if (practitionerId && !imageBase64) {
        await saveToCache(message, text, practitionerId, openai);
      }
    }

    return Response.json({ response: text });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return Response.json({ response: "Erreur: " + errorMessage }, { status: 500 });
  }
}

// Export pour invalider le cache quand le praticien met à jour son profil
export { invalidatePractitionerCache };
