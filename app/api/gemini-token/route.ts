/**
 * GET /api/gemini-token
 *
 * Returns a short-lived OAuth2 access token for Vertex AI.
 * The browser uses it to connect directly to the Vertex AI WebSocket:
 *   wss://LOCATION-aiplatform.googleapis.com/ws/...?access_token=TOKEN
 *
 * The service account credentials never leave the server.
 * Tokens expire after ~1 hour (well within any exercise duration).
 */

import { GoogleAuth } from "google-auth-library";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    return Response.json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON not set" }, { status: 500 });
  }

  try {
    const credentials = JSON.parse(raw) as object;
    // ⚠️ M4 — Ce token OAuth est renvoyé au navigateur (WebSocket Vertex / Gemini Live).
    // `cloud-platform` est le SEUL scope accepté par l'API Vertex AI : il n'existe pas
    // de scope OAuth plus étroit côté Google. La réduction du risque se fait donc au
    // niveau IAM, PAS dans ce code :
    //   • Le compte de service GOOGLE_SERVICE_ACCOUNT_JSON doit porter UNIQUEMENT le
    //     rôle `roles/aiplatform.user` (aucun autre droit GCP) : ainsi, même exposé
    //     ~1h, le token ne peut faire que des appels Vertex AI.
    //   • Amélioration future : migrer vers les ephemeral tokens Gemini Live (portée
    //     et durée restreintes par session) une fois la feature stabilisée.
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    if (!token) {
      return Response.json({ error: "Failed to obtain token" }, { status: 500 });
    }

    // Also expose projectId so the browser can build the Vertex model path
    // without needing a NEXT_PUBLIC_ env var.
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID ?? "";

    return Response.json(
      { token, projectId },
      {
        headers: {
          // Don't cache — always generate fresh
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("[gemini-token] error:", err);
    return Response.json({ error: "Auth failed" }, { status: 500 });
  }
}
