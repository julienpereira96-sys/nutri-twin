import { GoogleAuth } from "google-auth-library";

import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

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
  if (!token) throw new Error("No token");
  _cachedToken = { value: token, exp: Date.now() + 50 * 60 * 1000 };
  return token;
}
async function vertexGenerate(prompt: string): Promise<string> {
  const token = await getVertexToken();
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 20, temperature: 0 },
  };
  const res = await fetch(vertexUrl("gemini-3.1-flash-lite", "generateContent"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Vertex ${res.status}`);
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

// ─── Listes de mots (miroir de SOSExercise.tsx) ───────────────────────────────
// Dupliquées ici pour éviter d'importer un composant React côté serveur.
// À maintenir en sync si la liste côté client évolue.
type WordLevel = "mild" | "moderate" | "intense";

const WORD_BANK_M: Record<WordLevel, string[]> = {
  mild:     ["DOUX", "PAIX", "BIEN", "FORT", "LIEN", "SOIN", "VRAI", "SAIN", "BEAU", "RÊVE", "AISE", "JOIE"],
  moderate: ["CALME", "LIBRE", "FORCE", "REPOS", "ANCRÉ", "DIGNE", "APAISÉ", "SEREIN", "SOLIDE", "VIVANT", "LÉGER", "RELIÉ", "DEBOUT"],
  intense:  ["APAISER", "LIBÉRER", "SOULAGÉ", "RESPIRE", "LIBERTÉ", "SÉRÉNITÉ", "LUMIÈRE", "DOUCEUR", "ANCRAGE", "COURAGE", "CONFIANT", "PRÉSENT"],
};
const WORD_BANK_F: Record<WordLevel, string[]> = {
  mild:     ["JOIE", "PAIX", "BIEN", "LIEN", "SOIN", "RÊVE", "AISE", "DOUCE", "BELLE", "FORTE", "VRAIE", "SAINE"],
  moderate: ["CALME", "LIBRE", "FORCE", "REPOS", "ANCRÉE", "DIGNE", "SOLIDE", "LÉGÈRE", "RELIÉE", "DEBOUT", "SEREINE", "VIVANTE"],
  intense:  ["APAISER", "LIBÉRER", "APAISÉE", "SEREINE", "VIVANTE", "RESPIRE", "LIBERTÉ", "SÉRÉNITÉ", "LUMIÈRE", "DOUCEUR", "ANCRAGE", "COURAGE", "ASSURÉE", "PRÉSENTE", "SOULAGÉE"],
};

const CRISIS_KEYWORDS = ["craquer", "étouffer", "etouffer", "mourir", "panique", "urgence", "crise", "pleurer", "hurler", "souffre", "peur", "effroi", "terreur", "impossible"];
const CALM_KEYWORDS   = ["fatigué", "fatigue", "lasse", "las", "pas bien", "un peu", "légèrement", "legèrement"];

function detectLevel(transcript: string): WordLevel {
  const lower = transcript.toLowerCase();
  if (CRISIS_KEYWORDS.some(k => lower.includes(k))) return "intense";
  if (CALM_KEYWORDS.some(k => lower.includes(k)))   return "mild";
  return "moderate";
}

/**
 * Choisit le mot le plus adapté au contexte de l'intake en demandant à
 * gemini-3.1-flash-lite de sélectionner parmi la liste du niveau détecté.
 * Rapide (~400ms), déterministe (temperature=0), fallback sur aléatoire.
 *
 * POST /api/sos/word
 * Body : { patientId, transcript, gender }
 * Response : { word: string }
 */
export async function POST(request: Request) {
  try {
    const { patientId, transcript, gender } = await request.json() as {
      patientId: string;
      transcript: string;
      gender?: string;
    };

    if (!patientId || !transcript) {
      return Response.json({ error: "Paramètres manquants." }, { status: 400 });
    }

    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.id !== patientId) return forbidden();

    const level = detectLevel(transcript);
    const bank  = (gender ?? "M") === "F" ? WORD_BANK_F : WORD_BANK_M;
    const list  = bank[level];

    // Fallback immédiat si transcript trop court pour que le LLM soit utile
    if (transcript.trim().length < 10) {
      const fallback = list[Math.floor(Math.random() * list.length)];
      return Response.json({ word: fallback });
    }

    const prompt = `Un patient vient de partager à voix haute ce qu'il ressent :
"${transcript.trim().slice(0, 400)}"

Parmi les mots suivants, lequel résonne le mieux avec ce qu'il a exprimé — comme un ancrage juste pour lui en ce moment ?
${list.join(", ")}

Réponds uniquement avec UN seul mot de la liste, sans ponctuation ni explication.`;

    const raw  = await vertexGenerate(prompt);
    // Normaliser : majuscules, enlever ponctuation résiduelle
    const candidate = raw.toUpperCase().replace(/[^A-ZÀÂÄÉÈÊËÎÏÔÙÛÜŸÆŒÇ]/g, "").trim();
    // Valider que le LLM a bien renvoyé un mot de la liste
    const chosen = list.find(w => w === candidate) ?? list[Math.floor(Math.random() * list.length)];

    return Response.json({ word: chosen });
  } catch {
    // Fallback silencieux : on calcule le mot côté client comme avant
    return Response.json({ error: "LLM unavailable" }, { status: 500 });
  }
}
