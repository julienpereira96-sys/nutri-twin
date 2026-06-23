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
      // déjà positionné par isSosIntakeCheck ou sos-feedback).
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
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}
