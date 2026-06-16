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

export const runtime = "nodejs";

export async function GET() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    return Response.json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON not set" }, { status: 500 });
  }

  try {
    const credentials = JSON.parse(raw) as object;
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    if (!token) {
      return Response.json({ error: "Failed to obtain token" }, { status: 500 });
    }

    return Response.json(
      { token },
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
