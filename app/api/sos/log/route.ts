import { createClient } from "@supabase/supabase-js";
import { GoogleAuth } from "google-auth-library";

import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

// ─── Vertex AI (même config que /api/chat/route.ts) ───────────────────────────
const VERTEX_LOCATION = "eu";
const VERTEX_HOST     = "aiplatform.eu.rep.googleapis.com";
const VERTEX_PROJECT  = process.env.GOOGLE_CLOUD_PROJECT_ID!;
function vertexUrl(modelId: string, method: string) {
  return `https://${VERTEX_HOST}/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${modelId}:${method}`;
}
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
async function vertexGenerate(modelId: string, prompt: string, opts?: { maxOutputTokens?: number; temperature?: number }): Promise<string> {
  const token = await getVertexToken();
  const body = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { ...(opts?.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}), ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}) } };
  const res = await fetch(vertexUrl(modelId, "generateContent"), { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Vertex ${res.status}`);
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─── Détection apaisement ─────────────────────────────────────────────────────
// Copie légère de la même fonction dans /api/chat/route.ts — dupliquée ici pour
// éviter les imports croisés entre routes Next.js. À garder en sync si le prompt
// évolue.
async function detectApaisementWithLLM(message: string): Promise<{ confirmed: boolean; murmure: string }> {
  if (!message.trim()) return { confirmed: false, murmure: "" };
  try {
    const prompt = `Un patient vient de terminer un exercice de respiration/tracé guidé et a dit : "${message.trim().slice(0, 300)}"
Réponds en JSON strict : {"confirmed": true/false, "murmure": "météo émotionnelle en 4-8 mots"}
- confirmed: true si la phrase exprime, à n'importe quel temps, que le patient ressent ou a ressenti un mieux-être, un apaisement ou un bénéfice de l'exercice — même formulé de façon indirecte ou atténuée.
- murmure: description de l'état émotionnel final en 4-8 mots à la 3e personne, jamais une citation directe du patient.
- confirmed: false si le soulagement est absent, incertain, purement rhétorique, ou si la phrase est neutre ou négative.`;
    const raw = await vertexGenerate("gemini-3.1-flash-lite", prompt, { maxOutputTokens: 60, temperature: 0 });
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as { confirmed?: boolean; murmure?: string };
    return { confirmed: !!parsed.confirmed, murmure: parsed.murmure?.trim() ?? "" };
  } catch {
    return { confirmed: false, murmure: "" };
  }
}

// ─── Synthèse globale intake + closing ────────────────────────────────────────
// Génère une météo émotionnelle en 4-8 mots qui capture l'évolution complète
// (motif d'entrée → état de sortie). Appelée uniquement si apaisement confirmé.
async function generateGlobalInsight(intake: string, closing: string): Promise<string> {
  const intakePart = intake.trim().slice(0, 250);
  const closingPart = closing.trim().slice(0, 150);
  if (!intakePart && !closingPart) return "";
  try {
    const prompt = `Un patient vient de terminer un exercice SOS.
- Avant l'exercice : "${intakePart || "non renseigné"}"
- Après l'exercice : "${closingPart || "non renseigné"}"
Formule UNE météo émotionnelle globale en 4-8 mots qui capture l'évolution (avant → après).
Exemples : "Culpabilité post-repas apaisée après tracé guidé", "Anxiété maîtrisée grâce à la respiration", "Tension traversée avec sérénité".
Réponds uniquement avec la phrase, sans guillemets ni ponctuation finale.`;
    const raw = await vertexGenerate("gemini-3.1-flash-lite", prompt, { maxOutputTokens: 30, temperature: 0 });
    return raw.trim().replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

/** Génère une note clinique narrative (2-3 phrases, prose, passé) pour l'exercice SOS vocal. */
async function generateSosClinicalNote(
  intake: string,
  closing: string,
  apaisementConfirmed: boolean,
  sosContext?: string | null
): Promise<string> {
  const contextLabel = sosContext && !sosContext.startsWith("[contexte chat récent]") && sosContext !== "Mon Soutien"
    ? sosContext.split("|")[0]?.trim()
    : null;
  const outcomeLabel = apaisementConfirmed ? "crise désamorcée avec succès" : "crise sans résolution complète en fin de session";
  try {
    const prompt = `Tu es un assistant clinique. Rédige une note de suivi concise (2-3 phrases, prose, au passé, style clinique sobre) pour un praticien, à partir des données suivantes :
- Exercice réalisé : exercice SOS vocal guidé (tracé + respiration)${contextLabel ? `\n- Contexte de crise : ${contextLabel}` : ""}
- État avant : "${intake.trim().slice(0, 200) || "non renseigné"}"
- État après : "${closing.trim().slice(0, 150) || "non renseigné"}"
- Issue : ${outcomeLabel}

Commence directement la note sans titre ni préambule. Ne mentionne pas le nom du patient. Reste factuel et bienveillant.`;
    const raw = await vertexGenerate("gemini-2.5-flash-lite", prompt, { maxOutputTokens: 120, temperature: 0.3 });
    return raw.trim();
  } catch {
    return "";
  }
}

/**
 * Nettoie les transcriptions STT en français lisible.
 * Retourne { intake, closing } reformulés — "" si le texte est vide ou
 * inintelligible. Appel unique pour les deux champs (économie de tokens).
 */
async function reformatTranscripts(
  intakeRaw: string | undefined,
  closingRaw: string | undefined
): Promise<{ intake: string; closing: string }> {
  const hasIntake  = !!(intakeRaw?.trim());
  const hasClosing = !!(closingRaw?.trim());
  if (!hasIntake && !hasClosing) return { intake: "", closing: "" };

  const prompt = `Tu reçois une ou deux transcriptions vocales automatiques (STT) en français.
Reformule chaque texte en une ou deux phrases naturelles, claires, en français standard.
Ne traduis pas, n'invente rien — nettoie uniquement ce qui est présent.
Si un texte est vide, inintelligible, ou en langue étrangère : renvoie "" pour ce champ.

Transcription intake (avant l'exercice) : "${intakeRaw?.trim() ?? ""}"
Transcription closing (après l'exercice) : "${closingRaw?.trim() ?? ""}"

Réponds uniquement en JSON strict, sans markdown :
{"intake":"...","closing":"..."}`;

  try {
    const raw = await vertexGenerate("gemini-3.1-flash-lite", prompt, { maxOutputTokens: 120, temperature: 0 });
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as { intake?: string; closing?: string };
    return { intake: parsed.intake ?? "", closing: parsed.closing ?? "" };
  } catch {
    return { intake: intakeRaw?.trim() ?? "", closing: closingRaw?.trim() ?? "" };
  }
}

function createSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Journalise la clôture de l'exercice SOS vocal (SOSExercise.tsx, Gemini Live).
// Rattache la clôture au sos_event le plus récent de ce patient/praticien —
// celui créé au déclenchement de l'exercice (voir branche isSOS de /api/chat).
// Best-effort : silencieux si aucun événement n'est trouvé (ex: exercice
// relancé hors du triage habituel).
export async function POST(request: Request) {
  try {
    const { patientId, practitionerId, closingMessage, word, emergencyExit, intakeMessage } = await request.json() as {
      patientId: string;
      practitionerId: string;
      closingMessage?: string;
      word?: string | null;
      emergencyExit?: boolean;
      // Ce que le patient a dit pendant l'intake, AVANT de toucher l'écran —
      // distinct de closingMessage (après le tracé). Donne au praticien la
      // vision globale de l'exercice plutôt que le seul ressenti final.
      intakeMessage?: string;
    };

    if (!patientId || !practitionerId) {
      return Response.json({ error: "Paramètres manquants." }, { status: 400 });
    }

    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.id !== patientId) return forbidden();

    const supabase = createSupabaseClient();

    const { data: recent } = await supabase
      .from("sos_events")
      .select("id, status")
      .eq("patient_id", patientId)
      .eq("practitioner_id", practitionerId)
      .order("triggered_at", { ascending: false })
      .limit(1)
      .single();

    if (recent?.id) {
      // Résoudre le statut selon l'issue de l'exercice vocal —
      // uniquement si encore "pending" (ne pas écraser success/failed/expired
      // déjà positionné par isSosIntakeCheck.
      //   "abandoned" → quitte prématurément (emergencyExit ou fermeture app)
      //   "completed"  → exercice terminé normalement avec réponse de clôture,
      //                  mais sans apaisement confirmé (neutre ou négatif)
      let resolvedStatus: string | undefined;
      if ((recent as { status?: string }).status === "pending") {
        if (emergencyExit) {
          resolvedStatus = "abandoned";
        } else if (closingMessage?.trim()) {
          resolvedStatus = "completed";
        }
        // Pas de closingMessage + pas emergencyExit → reste pending (patient silencieux)
      }

      // Reformuler les transcriptions STT avant stockage — meilleure lisibilité
      // côté praticien sans perdre le sens. Silencieux : si l'appel LLM échoue
      // on revient aux textes bruts (voir reformatTranscripts).
      const { intake: intakeClean, closing: closingClean } = emergencyExit
        ? { intake: intakeMessage?.trim() ?? "", closing: "" }  // abandon → pas besoin de reformuler
        : await reformatTranscripts(intakeMessage, closingMessage);

      await supabase.from("sos_events").update({
        closing_message: closingClean || closingMessage?.trim() || null,
        traced_word: word ?? null,
        emergency_exit: !!emergencyExit,
        intake_message: intakeClean || intakeMessage?.trim() || null,
        ...(resolvedStatus ? { status: resolvedStatus } : {}),
      }).eq("id", recent.id);

      // ── Synthèse 2 — apaisement + météo globale ────────────────────────────
      // Tourne uniquement si l'exercice s'est bien terminé avec une réponse de
      // clôture (pas emergencyExit, pas abandon silencieux). On détecte
      // l'apaisement sur le SEUL closingMessage — le texte propre de la réponse
      // finale, sans les mots de crise de l'intake qui fausseraient l'analyse.
      // Si confirmé : météo globale (intake + closing) → green + victoire.
      // Si non confirmé : on ne touche pas emotional_insight (synthèse 1 reste).
      if (!emergencyExit && (closingClean || closingMessage?.trim())) {
        void (async () => {
          try {
            const closingForAnalysis = (closingClean || closingMessage?.trim()) ?? "";
            const apaisement = await detectApaisementWithLLM(closingForAnalysis);
            if (!apaisement.confirmed) return;

            // Météo globale : intake + closing pour capturer l'évolution complète
            const intakeForInsight = intakeClean || intakeMessage?.trim() || "";
            const globalInsight = await generateGlobalInsight(intakeForInsight, closingForAnalysis);

            // Victoire automatique si l'exercice était en réponse à une crise
            const { data: eventFull } = await supabase
              .from("sos_events")
              .select("id, origin, sos_context, raw_response")
              .eq("id", recent.id)
              .single();
            type EventFull = { id: string; origin?: string | null; sos_context?: string | null; raw_response?: string | null };
            const ev = eventFull as EventFull | null;
            let victoryText = "";
            if (ev?.origin === "crise") {
              const sosToolNames: Record<string, string> = {
                breathing: "la cohérence cardiaque", ancrage: "l'ancrage sensoriel",
                manger: "la pleine conscience alimentaire", defusion: "la défusion cognitive",
                ecriture: "l'écriture cathartique",
              };
              let resolvedToolId: string | null = null;
              try { resolvedToolId = (JSON.parse(ev.raw_response ?? "{}") as { tool_id?: string }).tool_id ?? null; } catch { /* ignore */ }
              const exerciseLabel = resolvedToolId ? (sosToolNames[resolvedToolId] ?? null) : null;
              const rawContext = (ev.sos_context ?? "").split("|")[0]?.trim();
              const crisisLabel = rawContext && !rawContext.startsWith("[contexte chat récent]") && rawContext !== "Mon Soutien"
                ? `une crise (${rawContext})`
                : "un moment difficile";
              victoryText = exerciseLabel
                ? `A surmonté ${crisisLabel} grâce à ${exerciseLabel}.`
                : `A surmonté ${crisisLabel} grâce à l'exercice SOS vocal.`;
            }

            let historiqueSos: { text: string; created_at: string }[] | undefined;
            if (victoryText) {
              const { data: curPatSos } = await supabase.from("patients").select("victories_history").eq("user_id", patientId).single();
              const histSos = (curPatSos?.victories_history as { text: string; created_at: string }[] | null) ?? [];
              historiqueSos = [...histSos, { text: victoryText, created_at: new Date().toISOString() }].slice(-50);
            }
            // Note clinique narrative — générée après confirmation de l'apaisement
            const clinicalNote = await generateSosClinicalNote(
              intakeForInsight,
              closingForAnalysis,
              true, // apaisement confirmé ici
              ev?.sos_context ?? null
            );

            await Promise.all([
              supabase.from("patients").update({
                emotional_status: "green",
                emotional_insight: globalInsight || apaisement.murmure || "Apaisement après exercice SOS",
                last_patient_message_at: new Date().toISOString(),
                ...(victoryText ? {
                  latest_victory: victoryText,
                  victory_detected_at: new Date().toISOString(),
                } : {}),
                ...(historiqueSos ? { victories_history: historiqueSos } : {}),
              }).eq("user_id", patientId),
              supabase.from("sos_events").update({
                status: "success",
                summary_text: clinicalNote || null,
              }).eq("id", recent.id),
            ]);
          } catch { /* silencieux — ne doit jamais perturber la réponse client */ }
        })();
      }
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}
