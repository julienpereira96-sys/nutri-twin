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
    maxOutputTokens: 200,
    historyLimit: 20,
    ragChunks: 5,
    dailyMessageLimit: 30,
    isFounder: false,
  },
  pro: {
    model: "gemini-3-flash-preview",
    maxOutputTokens: 500,
    historyLimit: 100,
    ragChunks: 5,
    dailyMessageLimit: 100,
    isFounder: false,
  },
  cabinet: {
    model: "gemini-3-flash-preview",
    maxOutputTokens: 500,
    historyLimit: 100,
    ragChunks: 5,
    dailyMessageLimit: 100,
    isFounder: false,
  },
  fondateur: {
    model: "gemini-3-flash-preview",
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
  "échec", "honte", "culpabilité", "désespoir", "craquer", "pleurer",
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

async function getSemanticCache(question: string, practitionerId: string): Promise<string | null> {
  try {
    const supabase = createSupabaseClient();
    const queryEmbedding = await getGeminiEmbedding(question);
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

async function saveToCache(question: string, response: string, practitionerId: string): Promise<void> {
  try {
    const supabase = createSupabaseClient();
    const embedding = await getGeminiEmbedding(question);
    await supabase.from("cached_responses").insert({
      practitioner_id: practitionerId,
      question,
      response,
      embedding,
    } as never);
  } catch {}
}

async function hasDocuments(practitionerId: string): Promise<boolean> {
  const supabase = createSupabaseClient();
  const { count } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("practitioner_id", practitionerId);
  return (count ?? 0) > 0;
}

async function getRelevantDocuments(question: string, practitionerId: string, ragChunks: number): Promise<string> {
  try {
    const hasDocs = await hasDocuments(practitionerId);
    if (!hasDocs) return "";

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

async function getPatientProfile(patientId: string): Promise<string> {
  try {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("patients")
      .select("first_name, last_name, age, sexe, taille, poids, objective, pathologies, allergies, traitements, objectif_clinique, brief_jumeau, practitioner_instruction, notes, motivation, defi, aliments_aimes, aliments_detestes, niveau_activite, regime_specifique")
      .eq("user_id", patientId)
      .single();

    const patient = data as {
      first_name?: string;
      last_name?: string;
      age?: number;
      sexe?: string;
      taille?: number;
      poids?: number;
      objective?: string;
      pathologies?: string;
      allergies?: string;
      traitements?: string;
      objectif_clinique?: string;
      brief_jumeau?: string;
      notes?: string;
      motivation?: string;
      defi?: string;
      aliments_aimes?: string;
      aliments_detestes?: string;
      niveau_activite?: string;
      regime_specifique?: string;
      practitioner_instruction?: string;
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
    if (patient.notes) parts.push(`Notes praticien : ${patient.notes}`);

    const instructionDate = (patient as { instruction_updated_at?: string }).instruction_updated_at
  ? `(mis à jour le ${new Date((patient as { instruction_updated_at?: string }).instruction_updated_at!).toLocaleDateString("fr-FR")})`
  : "";

const briefSection = [
  patient.brief_jumeau ? `CONTEXTE DE DÉPART : ${patient.brief_jumeau}` : "",
  patient.practitioner_instruction ? `⚡ CONSIGNE ACTUELLE DU PRATICIEN ${instructionDate} : ${patient.practitioner_instruction}` : "",
].filter(Boolean).join("\n");

const briefFinal = briefSection
  ? `\nINSTRUCTIONS SPÉCIFIQUES DU PRATICIEN POUR CE PATIENT :\n${briefSection}\n`
  : "";

  // Injecter journal : 3 dernières entrées détaillées + synthèse 7 jours
try {
  const supabaseJournal = createSupabaseClient();
  
  const { data: recentEntries } = await supabaseJournal
    .from("journal_entries")
    .select("date, mood, food_rating, emotions, content")
    .eq("patient_id", patientId)
    .order("date", { ascending: false })
    .limit(3);

  const { data: weekEntries } = await supabaseJournal
    .from("journal_entries")
    .select("mood, food_rating")
    .eq("patient_id", patientId)
    .order("date", { ascending: false })
    .limit(7);

  if (recentEntries && recentEntries.length > 0) {
    // Synthèse 7 jours
    let weekSummary = "";
    if (weekEntries && weekEntries.length >= 3) {
      const avgMood = (weekEntries.reduce((sum, e) => sum + e.mood, 0) / weekEntries.length).toFixed(1);
      const avgFood = (weekEntries.reduce((sum, e) => sum + e.food_rating, 0) / weekEntries.length).toFixed(1);
      const firstMood = weekEntries[weekEntries.length - 1].mood;
      const lastMood = weekEntries[0].mood;
      const trend = lastMood > firstMood ? "en hausse" : lastMood < firstMood ? "en baisse" : "stable";
      weekSummary = `Synthèse 7 jours : humeur moyenne ${avgMood}/10 (${trend}), alimentation moyenne ${avgFood}/3.`;
    }

    // 3 dernières entrées détaillées
    const detailedEntries = recentEntries.map((e) => {
      const moodLabel = e.mood <= 3 ? "difficile" : e.mood <= 6 ? "moyen" : e.mood <= 8 ? "bien" : "excellent";
      const foodLabel = e.food_rating === 1 ? "difficile" : e.food_rating === 2 ? "bien" : "excellent";
      const emotions = (e.emotions as string[])?.join(", ") || "non renseignées";
      const note = e.content ? ` — "${e.content}"` : "";
      return `  • ${e.date} : humeur ${moodLabel} (${e.mood}/10), alimentation ${foodLabel}, émotions : ${emotions}${note}`;
    }).join("\n");

    parts.push(`\nJOURNAL DU PATIENT :\n${weekSummary}\nDernières entrées :\n${detailedEntries}\nUtilise ces données subtilement pour adapter ton ton et tes conseils, sans jamais citer explicitement le journal.`);
  }
} catch {
  // Silencieux
}

    return parts.length > 0
      ? `\nPROFIL DU PATIENT :\n${parts.join("\n")}\n${briefFinal}`
      : "";
  } catch {
    return "";
  }
}

async function summarizeOldMessages(messages: { role: string; content: string }[]): Promise<string> {
  try {
    const patientMessages = messages.filter((m) => m.role === "user").map((m) => m.content.slice(0, 150)).join(" | ");
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

${patientContext}${documentsContext}

RÈGLES ABSOLUES :
- INTERDICTION de Markdown (gras, listes, titres). Texte brut uniquement.
- Maximum 150 mots par réponse.
- Commencer par une validation empathique avant tout conseil.
- Utiliser le prénom du patient pour créer du lien.
- Ne JAMAIS dire "En tant qu'IA", "En tant que modèle de langue" ou similaire. Tu ES ce praticien.
- Ne jamais inventer des informations médicales non confirmées.

JSON TECHNIQUE OBLIGATOIRE — À ajouter en toute fin de réponse, invisible pour le patient :
|||{"status":"green","reason":"résumé état en 8 mots max","victory":""}|||
- status : "red" si détresse/découragement sévère, "orange" si difficulté modérée, "green" si tout va bien
- reason : phrase courte décrivant l'état émotionnel du patient
- victory : UNE phrase UNIQUEMENT si le patient rapporte un changement de comportement MAJEUR ou une réussite sur un défi difficile (ex: première semaine sans grignotage nocturne, gestion réussie d'un repas stressant). Laisser vide "" dans tous les autres cas. Ne pas en créer artificiellement.`;
}

function getDefaultPrompt(): string {
  return "Tu es un assistant nutritionniste. Réponds sans markdown, en phrases simples, max 150 mots.";
}

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
    } = await request.json() as ChatRequest;

    const practitionerData = practitionerId
      ? await getPractitionerData(practitionerId)
      : { plan: "essentiel" as PlanType, profile: null };

    const plan = practitionerData.plan;
    const config = PLAN_CONFIG[plan];

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

    if (practitionerId && !systemPrompt && !imageBase64) {
      const cached = await getSemanticCache(message, practitionerId);
      if (cached) return Response.json({ response: cached });
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
      ? "gemini-3-flash-preview"
      : plan === "essentiel"
        ? config.model
        : isComplexMessage(message) ? "gemini-3-flash-preview" : "gemini-3.1-flash-lite";

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
    
          result = await chat.sendMessageStream([
            { inlineData: { data: imageBase64, mimeType: imageMimeType as "image/jpeg" | "image/png" | "image/webp" } },
            { text: visionPrompt },
          ]);
        } else {
          result = await chat.sendMessageStream(message);
        }
    
        // ── Stream vers le client ──
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
              }
            } catch {
              controller.close();
              return;
            }
    
            // ── Parser le statut émotionnel ──
            let emotionalStatus = "green";
            let emotionalInsight = "";
            let victoryText = "";
            const statusMatch = fullText.match(/\|\|\|([\s\S]*?)\|\|\|/);
            if (statusMatch) {
              try {
                const parsed = JSON.parse(statusMatch[1]) as { status: string; reason: string; victory?: string };
                emotionalStatus = parsed.status;
                emotionalInsight = parsed.reason;
                victoryText = parsed.victory ?? "";
              } catch { /* silencieux */ }
              fullText = fullText.replace(/\|\|\|[\s\S]*?\|\|\|/, "").trim();
            }
    
            // ── Sauvegarde en base ──
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
    
              await supabase.from("patients").update({
                emotional_status: emotionalStatus,
                emotional_insight: emotionalInsight,
                ...(victoryText ? { latest_victory: victoryText, victory_detected_at: new Date().toISOString() } : {}),
              }).eq("user_id", patientId);
    
              if (sessionId) {
                await supabase.from("conversations_sessions").update({
                  last_message: fullText.slice(0, 100),
                  last_message_at: new Date().toISOString(),
                }).eq("id", sessionId);
              }
    
              if (practitionerId && !imageBase64) {
                await saveToCache(message, fullText, practitionerId);
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
          },
        });    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return Response.json({ response: "Erreur: " + errorMessage }, { status: 500 });
  }
}

export { invalidatePractitionerCache };
