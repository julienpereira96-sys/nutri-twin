import { createClient } from "@supabase/supabase-js";
import { GoogleAuth } from "google-auth-library";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

/**
 * POST /api/exercise/log
 *
 * Endpoint commun aux 4 exercices (breathing, ancrage, restructuration, manger).
 * Remplace /api/breathing/log.
 *
 * Logique :
 *   1. Insère dans sos_events avec origin = exerciseType temporairement
 *   2. Détecte was_crisis via LLM sur intakeMessage
 *   3. Détecte apaisement via LLM sur closingMessage (ou via outcome pour breathing)
 *   4. Met à jour sos_events : origin = "crise" si was_crisis, status = "success" si apaisé
 *   5. Crée un message conversations avec practitioner_only = true (résumé praticien)
 *   6. Si crise désamorcée : met à jour patients.emotional_status + emotional_insight
 */

// ─── Vertex AI ────────────────────────────────────────────────────────────────
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
  if (!token) throw new Error("Vertex token failed");
  _cachedToken = { value: token, exp: Date.now() + 50 * 60 * 1000 };
  return token;
}
async function vertexGenerate(modelId: string, prompt: string, opts?: { maxOutputTokens?: number; temperature?: number }): Promise<string> {
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
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Vertex ${res.status}`);
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─── LLM helpers ──────────────────────────────────────────────────────────────

/** Détecte si le patient était en détresse aiguë à l'intake. */
async function detectCrisisFromIntake(message: string): Promise<boolean> {
  if (!message.trim()) return false;
  try {
    const prompt = `Un patient vient d'exprimer son état avant un exercice thérapeutique : "${message.trim().slice(0, 300)}"
Réponds en JSON strict : {"is_crisis": true/false}
- is_crisis: true UNIQUEMENT si la phrase exprime une détresse aiguë (angoisse marquée, crise, envie compulsive intense, souffrance prononcée, stress élevé).
- is_crisis: false si c'est une pratique préventive, un état légèrement négatif, ou neutre.`;
    const raw = await vertexGenerate("gemini-2.5-flash-lite", prompt, { maxOutputTokens: 20, temperature: 0 });
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as { is_crisis?: boolean };
    return !!parsed.is_crisis;
  } catch {
    return false;
  }
}

/** Détecte si le patient a exprimé un apaisement à la clôture. */
async function detectApaisementFromClosing(message: string): Promise<{ confirmed: boolean; murmure: string }> {
  if (!message.trim()) return { confirmed: false, murmure: "" };
  try {
    const prompt = `Un patient vient de terminer un exercice thérapeutique et a dit : "${message.trim().slice(0, 300)}"
Réponds en JSON strict : {"confirmed": true/false, "murmure": "météo émotionnelle en 4-8 mots"}
- confirmed: true UNIQUEMENT si la phrase exprime clairement un retour au calme ou un mieux-être.
- murmure: état émotionnel final en 4-8 mots.
- confirmed: false si le soulagement est partiel, incertain, ou la phrase neutre.`;
    const raw = await vertexGenerate("gemini-2.5-flash-lite", prompt, { maxOutputTokens: 60, temperature: 0 });
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()) as { confirmed?: boolean; murmure?: string };
    return { confirmed: !!parsed.confirmed, murmure: parsed.murmure?.trim() ?? "" };
  } catch {
    return { confirmed: false, murmure: "" };
  }
}

/** Génère une météo émotionnelle globale (avant → après). */
async function generateGlobalInsight(intake: string, closing: string, exerciseType: string): Promise<string> {
  const labels: Record<string, string> = {
    breathing: "cohérence cardiaque",
    ancrage: "ancrage sensoriel 4-3-2-1",
    restructuration: "restructuration cognitive",
    manger: "pleine conscience alimentaire",
  };
  const exLabel = labels[exerciseType] ?? "exercice thérapeutique";
  if (!intake.trim() && !closing.trim()) return "";
  try {
    const prompt = `Un patient vient de terminer un exercice de ${exLabel}.
- Avant l'exercice : "${intake.trim().slice(0, 200) || "non renseigné"}"
- Après l'exercice : "${closing.trim().slice(0, 150) || "non renseigné"}"
Formule UNE météo émotionnelle globale en 4-8 mots qui capture l'évolution (avant → après).
Exemples : "Anxiété apaisée grâce à la cohérence cardiaque", "Pensée restructurée avec sérénité".
Réponds uniquement avec la phrase, sans guillemets ni ponctuation finale.`;
    const raw = await vertexGenerate("gemini-2.5-flash-lite", prompt, { maxOutputTokens: 30, temperature: 0 });
    return raw.trim().replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ExerciseOutcome = "crise_desamorcee" | "seance_positive" | "sans_resolution" | "neutre";

/** Génère une note clinique narrative de 2-3 phrases (prose, passé, clinique). */
async function generateClinicalNote(
  intake: string,
  closing: string,
  exerciseType: string,
  outcome: ExerciseOutcome,
  extra: Record<string, unknown>
): Promise<string> {
  const labels: Record<string, string> = {
    breathing:       "cohérence cardiaque",
    ancrage:         "ancrage sensoriel 4-3-2-1",
    restructuration: "restructuration cognitive",
    manger:          "pleine conscience alimentaire",
  };
  const outcomeLabels: Record<ExerciseOutcome, string> = {
    crise_desamorcee: "crise désamorcée avec succès",
    seance_positive:  "séance positive sans crise préalable",
    sans_resolution:  "crise non résolue en fin de session",
    neutre:           "session préventive sans marqueur émotionnel notable",
  };
  const exLabel = labels[exerciseType] ?? "exercice thérapeutique";
  const outcomeLabel = outcomeLabels[outcome];

  const extraLines: string[] = [];
  if (exerciseType === "breathing" && extra.blocks_completed !== undefined)
    extraLines.push(`${extra.blocks_completed as number} bloc(s) de respiration complété(s)`);
  if (exerciseType === "ancrage" && extra.senses_completed !== undefined)
    extraLines.push(`${extra.senses_completed as number}/4 sens explorés`);
  if (exerciseType === "restructuration") {
    if (extra.original_thought) extraLines.push(`pensée initiale : "${(extra.original_thought as string).slice(0, 80)}"`);
    if (extra.reformulated_thought) extraLines.push(`pensée reformulée : "${(extra.reformulated_thought as string).slice(0, 80)}"`);
  }

  try {
    const prompt = `Tu es un assistant clinique. Rédige une note de suivi concise (2-3 phrases, prose, au passé, style clinique sobre) pour un praticien, à partir des données suivantes :
- Exercice réalisé : ${exLabel}
- État avant : "${intake.trim().slice(0, 200) || "non renseigné"}"
- État après : "${closing.trim().slice(0, 150) || "non renseigné"}"${extraLines.length ? `\n- Détails : ${extraLines.join(", ")}` : ""}
- Issue : ${outcomeLabel}

Commence directement la note sans titre ni préambule. Ne mentionne pas le nom du patient. Reste factuel et bienveillant.`;
    const raw = await vertexGenerate("gemini-2.5-flash-lite", prompt, { maxOutputTokens: 120, temperature: 0.3 });
    return raw.trim();
  } catch {
    return "";
  }
}

// ─── Résumé praticien ─────────────────────────────────────────────────────────

function buildPractitionerSummary(
  exerciseType: string,
  intakeMessage: string,
  closingMessage: string,
  extra: Record<string, unknown>,
  outcome: ExerciseOutcome
): string {
  const labels: Record<string, string> = {
    breathing:       "Cohérence cardiaque",
    ancrage:         "Ancrage sensoriel 4-3-2-1",
    restructuration: "Restructuration cognitive",
    manger:          "Pleine conscience alimentaire",
  };
  const outcomeLabels: Record<ExerciseOutcome, string> = {
    crise_desamorcee: "Crise désamorcée",
    seance_positive:  "Séance positive",
    sans_resolution:  "Session sans résolution",
    neutre:           "Session neutre",
  };

  const lines: string[] = [
    `[EXERCICE : ${labels[exerciseType] ?? exerciseType.toUpperCase()}]`,
    "",
  ];

  if (intakeMessage) lines.push(`Contexte d'entrée : "${intakeMessage}"`);

  if (exerciseType === "breathing" && extra.blocks_completed !== undefined) {
    lines.push(`Blocs complétés : ${extra.blocks_completed as number}`);
  }
  if (exerciseType === "ancrage" && extra.senses_completed !== undefined) {
    lines.push(`Sens complétés : ${extra.senses_completed as number}/4`);
  }
  if (exerciseType === "restructuration") {
    if (extra.original_thought) lines.push(`Pensée de départ : "${extra.original_thought as string}"`);
    if (extra.reformulated_thought) lines.push(`Pensée reformulée : "${extra.reformulated_thought as string}"`);
  }

  if (closingMessage && exerciseType !== "restructuration") {
    lines.push(`Ressenti de clôture : "${closingMessage}"`);
  }

  lines.push("", `Issue : ${outcomeLabels[outcome]}`);

  return lines.join("\n");
}

// ─── Route handler ────────────────────────────────────────────────────────────

function createSupabaseClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(request: Request) {
  try {
    const {
      patientId,
      practitionerId,
      exerciseType,
      intakeMessage,
      closingMessage,
      emergencyExit,
      extra = {},
    } = await request.json() as {
      patientId: string;
      practitionerId: string;
      exerciseType: "breathing" | "ancrage" | "restructuration" | "manger";
      intakeMessage?: string;
      closingMessage?: string;
      emergencyExit?: boolean;
      extra?: Record<string, unknown>;
    };

    if (!patientId || !practitionerId || !exerciseType) {
      return Response.json({ error: "Paramètres manquants." }, { status: 400 });
    }

    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.id !== patientId) return forbidden();

    const supabase = createSupabaseClient();
    const baseStatus = emergencyExit ? "abandoned" : "completed";

    // Insérer l'entrée initiale dans sos_events
    const { data: eventData } = await supabase.from("sos_events").insert({
      patient_id:      patientId,
      practitioner_id: practitionerId,
      triggered_at:    new Date().toISOString(),
      origin:          exerciseType,   // sera mis à jour à "crise" si was_crisis
      status:          baseStatus,
      sos_context:     intakeMessage?.trim() || `Exercice ${exerciseType}`,
      intake_message:  intakeMessage?.trim() || null,
      closing_message: closingMessage?.trim() || null,
      extra:           Object.keys(extra).length > 0 ? extra : null,
    }).select("id").single();

    if (emergencyExit) return Response.json({ success: true });

    // Analyse LLM asynchrone — n'est pas attendue par le client
    void (async () => {
      try {
        // 1. Détection was_crisis
        const wasCrisis = await detectCrisisFromIntake(intakeMessage ?? "");

        // 2. Détection apaisement
        let apaisementConfirmed = false;
        let apaisementMurmure   = "";

        if (closingMessage?.trim()) {
          const ap = await detectApaisementFromClosing(closingMessage);
          apaisementConfirmed = ap.confirmed;
          apaisementMurmure   = ap.murmure;
        } else if (exerciseType === "breathing" && extra.outcome === "positive") {
          // Breathing sans question de clôture : l'outcome est le proxy
          apaisementConfirmed = true;
          apaisementMurmure   = `Apaisement après cohérence cardiaque (${extra.blocks_completed ?? 0} bloc(s))`;
        } else if (exerciseType === "restructuration" && extra.reformulated_thought) {
          // Restructuration réussie = apaisement implicite
          apaisementConfirmed = true;
          apaisementMurmure   = "Pensée restructurée avec succès";
        }

        // 3. Outcome catégorie
        let outcome: ExerciseOutcome;
        if      (wasCrisis && apaisementConfirmed)  outcome = "crise_desamorcee";
        else if (!wasCrisis && apaisementConfirmed) outcome = "seance_positive";
        else if (wasCrisis && !apaisementConfirmed) outcome = "sans_resolution";
        else                                         outcome = "neutre";

        // 4. Note clinique narrative + mise à jour sos_events
        const finalOrigin = wasCrisis ? "crise" : exerciseType;
        const finalStatus = apaisementConfirmed ? "success" : baseStatus;
        const clinicalNote = await generateClinicalNote(
          intakeMessage?.trim() ?? "",
          closingMessage?.trim() ?? "",
          exerciseType,
          outcome,
          extra
        );
        if (eventData?.id) {
          await supabase.from("sos_events").update({
            origin:       finalOrigin,
            status:       finalStatus,
            summary_text: clinicalNote || null,
          }).eq("id", eventData.id);
        }

        // 5. Résumé praticien dans conversations
        const summaryText = buildPractitionerSummary(
          exerciseType,
          intakeMessage?.trim() ?? "",
          closingMessage?.trim() ?? "",
          extra,
          outcome
        );
        await supabase.from("conversations").insert({
          patient_id:       patientId,
          practitioner_id:  practitionerId,
          role:             "system",
          content:          summaryText,
          practitioner_only: true,
          session_id:       null,
        });

        // 6. Si crise désamorcée → mise à jour émotionnelle patient
        if (wasCrisis && apaisementConfirmed) {
          const globalInsight = await generateGlobalInsight(
            intakeMessage?.trim() ?? "",
            closingMessage?.trim() ?? "",
            exerciseType
          );
          await supabase.from("patients").update({
            emotional_status:        "green",
            emotional_insight:       globalInsight || apaisementMurmure || `Apaisement après exercice`,
            last_patient_message_at: new Date().toISOString(),
          }).eq("user_id", patientId);
        }

      } catch { /* silencieux — ne perturbe jamais la réponse client */ }
    })();

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}
