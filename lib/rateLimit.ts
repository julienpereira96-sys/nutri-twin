import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * INFRA-2 — Rate limiting par utilisateur (fenêtre fixe) pour les routes coûteuses
 * (appels LLM / TTS). Protège contre l'abus de coût Vertex/TTS par un compte authentifié.
 *
 * Fenêtre fixe via INCR + EXPIRE : simple, suffisant pour du garde-fou de coût.
 * Fail-open sur erreur Redis : on ne bloque jamais un usage légitime pour une panne cache
 * (c'est une protection de coût, pas une barrière de sécurité).
 *
 * @returns true si la requête est autorisée, false si le quota est dépassé.
 */
export async function checkRateLimit(
  bucket: string,
  id: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  try {
    const key = `rl:${bucket}:${id}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return count <= limit;
  } catch {
    return true; // fail-open — ne pas bloquer sur panne Redis
  }
}

/** Réponse 429 standard pour les routes rate-limitées. */
export const tooManyRequests = () =>
  Response.json(
    { error: "Trop de requêtes. Réessayez dans quelques minutes." },
    { status: 429 }
  );
