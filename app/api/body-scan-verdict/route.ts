import { vertexGenerate } from "@/lib/vertexai";
import { getSessionUser } from "@/lib/api-auth";

type RequestBody = {
  headScore: number;
  chestScore: number;
  stomachScore: number;
};

// ─── Fallback client-side verdict (si Gemini indisponible) ──────────────────
function buildFallback(head: number, chest: number, stomach: number): string {
  if (stomach >= 6 && head <= 4 && chest <= 4)
    return "Ton estomac envoie des signaux clairs de vraie faim physique. C'est le bon moment de manger quelque chose de nourrissant et équilibré.";
  if ((head >= 6 || chest >= 6) && stomach < 5)
    return "Ta fringale semble surtout émotionnelle pour l'instant. Prends trois grandes respirations et explore ce dont tu as vraiment besoin là.";
  return "Signal mixte — ton corps hésite entre faim physique et tension émotionnelle. Bois un grand verre d'eau et observe comment tu te sens dans cinq minutes.";
}

export async function POST(req: Request) {
  // ─── Auth ────────────────────────────────────────────────────────────────
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Non autorisé" }, { status: 401 });

  // ─── Parse body ──────────────────────────────────────────────────────────
  let headScore: number, chestScore: number, stomachScore: number;
  try {
    const body = (await req.json()) as RequestBody;
    headScore = body.headScore;
    chestScore = body.chestScore;
    stomachScore = body.stomachScore;
  } catch {
    return Response.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  // ─── Validate scores ─────────────────────────────────────────────────────
  for (const s of [headScore, chestScore, stomachScore]) {
    if (typeof s !== "number" || s < 1 || s > 10) {
      return Response.json({ error: "Scores invalides (1–10 requis)" }, { status: 400 });
    }
  }

  // ─── Gemini analysis ─────────────────────────────────────────────────────
  try {
    const prompt = `Tu es l'assistant bienveillant d'une application de psychonutrition thérapeutique. \
Un patient vient de réaliser un scanner corporel de ses sensations face à une envie de manger.

Ses scores sur 10 :
- Charge mentale / anxiété (tête) : ${headScore}/10
- Poids émotionnel / oppression (poitrine) : ${chestScore}/10
- Tiraillements physiques / gargouillements (estomac) : ${stomachScore}/10

Règles d'interprétation :
- Estomac ≥ 6 ET tête ≤ 4 ET poitrine ≤ 4 → faim biologique réelle → manger est juste
- Tête ≥ 6 OU poitrine ≥ 6 (avec estomac < 6) → faim émotionnelle dominante
- Sinon → signal mixte → observer 5 min après eau

En exactement 2 phrases courtes, bienveillantes, en tutoyant le patient :
1. Dis-lui clairement si sa fringale est plutôt biologique ou émotionnelle.
2. Donne-lui un conseil immédiat et concret.
Commence directement par le diagnostic, sans formule d'introduction.`;

    const verdict = await vertexGenerate("gemini-3.1-flash-lite", prompt, { maxOutputTokens: 110, temperature: 0.45 });
    return Response.json({ verdict });
  } catch (err) {
    console.error("[body-scan-verdict] Gemini error:", err);
    // Graceful fallback — UX ne doit pas bloquer sur une erreur Gemini
    return Response.json({ verdict: buildFallback(headScore, chestScore, stomachScore) });
  }
}
