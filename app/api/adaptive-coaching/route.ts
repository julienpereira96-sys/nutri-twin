import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/api-auth";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// ─── Fallback objectives (si Gemini indisponible) ────────────────────────────
const FALLBACK_OBJECTIVES = [
  "Bois un grand verre d'eau en pleine conscience, en savourant chaque gorgée.",
  "Prends 3 grandes respirations lentes avant ton prochain repas.",
  "Note une chose positive que tu as mangée ou ressentie aujourd'hui.",
  "Mange ta prochaine bouchée 30 % plus lentement que d'habitude.",
  "Pose ton téléphone pendant 5 minutes et observe simplement ce que tu ressens.",
  "Fais une courte promenade de 5 minutes après ton prochain repas.",
  "Bois un verre d'eau et attends 5 minutes avant de décider de manger.",
];

function pickFallback(): string {
  return FALLBACK_OBJECTIVES[Math.floor(Math.random() * FALLBACK_OBJECTIVES.length)];
}

type RequestBody =
  | { action: "generate"; sosContext: string }
  | { action: "commit"; objective: string };

export async function POST(req: Request) {
  // ─── Auth ──────────────────────────────────────────────────────────────────
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Non autorisé" }, { status: 401 });

  // ─── Parse body ────────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return Response.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  // ─── ACTION: generate ─────────────────────────────────────────────────────
  if (body.action === "generate") {
    const sosContext = body.sosContext?.slice(0, 500) ?? "";

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        generationConfig: {
          maxOutputTokens: 80,
          temperature: 0.55,
        },
      });

      const prompt = `Tu es un coach en psychonutrition bienveillant et expert en approche Kaizen.
Un patient traverse une difficulté émotionnelle. Contexte : "${sosContext}".

Génère UN SEUL micro-objectif Kaizen ultra-concret et immédiatement réalisable (aujourd'hui, maintenant).
Ce geste doit :
- Être faisable en moins de 10 minutes
- Être doux, sans pression
- Toucher soit l'alimentation, soit la conscience corporelle, soit la régulation émotionnelle
- Être formulé à la 2e personne du singulier, en commençant par un verbe d'action

Réponds en UNE SEULE PHRASE (20-35 mots maximum). Pas de guillemets, pas d'introduction, pas d'explication.`;

      const result = await model.generateContent(prompt);
      const objective = result.response.text().trim();

      // Sanity-check: reject if too short or malformed
      if (!objective || objective.length < 15) {
        return Response.json({ objective: pickFallback() });
      }

      return Response.json({ objective });
    } catch (err) {
      console.error("[adaptive-coaching] Gemini error:", err);
      return Response.json({ objective: pickFallback() });
    }
  }

  // ─── ACTION: commit ───────────────────────────────────────────────────────
  if (body.action === "commit") {
    const objective = body.objective?.slice(0, 500) ?? "";
    if (!objective) {
      return Response.json({ error: "Objectif manquant" }, { status: 400 });
    }

    // Best-effort insert — ne jamais bloquer l'UX sur une erreur DB
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      await supabase.from("adaptive_coaching_commitments").insert({
        user_id: user.id,
        objective,
        committed_at: new Date().toISOString(),
      });
    } catch (err) {
      // Graceful: table may not exist yet — log and continue
      console.error("[adaptive-coaching] Commit insert error (non-fatal):", err);
    }

    return Response.json({ ok: true });
  }

  return Response.json({ error: "Action inconnue" }, { status: 400 });
}
