/**
 * /api/gemini-live-relay
 *
 * Server-side relay between the browser and Vertex AI Gemini Live WebSocket.
 *
 * Why this exists:
 *   - Vertex AI requires an OAuth2 Bearer token in the Authorization header.
 *   - Browser WebSocket API cannot set custom HTTP headers.
 *   - This route generates the token server-side (using a service-account key
 *     stored in env vars — never exposed to the client) and relays the
 *     bidirectional stream between browser and Vertex AI.
 *
 * Protocol:
 *   Browser → POST body (NDJSON, streaming)  → this route → Vertex AI WS
 *   Browser ← Response body (NDJSON, streaming) ← this route ← Vertex AI WS
 *
 * Each line in both directions is one JSON message (no framing overhead).
 */

import { GoogleAuth } from "google-auth-library";
import { WebSocket } from "ws";

export const runtime   = "nodejs";
export const maxDuration = 300; // 5 minutes — requires Vercel Pro; adjust if needed

// Gemini Live is only available in us-central1 — hard-coded, independent of
// GOOGLE_CLOUD_LOCATION which may point to "eu" for REST calls.
const LOCATION       = "us-central1";
const PROJECT_ID     = process.env.GOOGLE_CLOUD_PROJECT_ID!;
const VERTEX_WS_URL  = `wss://${LOCATION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

  const credentials = JSON.parse(raw);
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain access token");
  return token;
}

// ── Model path rewrite ────────────────────────────────────────────────────────

/**
 * Rewrites AI-Studio-style model names ("models/gemini-2.0-flash-live-001")
 * to the Vertex AI full resource path.
 * No-op if the path is already in Vertex AI format.
 */
function rewriteModelPath(msg: Record<string, unknown>): Record<string, unknown> {
  const setup = msg.setup as Record<string, unknown> | undefined;
  if (!setup?.model || typeof setup.model !== "string") return msg;
  if (setup.model.startsWith("projects/")) return msg; // already Vertex format

  const modelId = setup.model.replace(/^models\//, "");
  return {
    ...msg,
    setup: {
      ...setup,
      model: `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${modelId}`,
    },
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // 1. Authenticate with GCP
  let token: string;
  try {
    token = await getAccessToken();
  } catch (err) {
    console.error("[gemini-live-relay] auth error:", err);
    return Response.json({ error: "Auth failed" }, { status: 500 });
  }

  // 2. Open Vertex AI WebSocket
  const vertexWs = new WebSocket(VERTEX_WS_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // 3. Create a ReadableStream that pumps Vertex AI messages to the browser
  let streamController: ReadableStreamDefaultController<Uint8Array>;

  const responseStream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
    },
    cancel() {
      vertexWs.close(1000, "client cancelled");
    },
  });

  vertexWs.on("message", (data) => {
    const text = typeof data === "string" ? data : data.toString("utf-8");
    try {
      streamController.enqueue(new TextEncoder().encode(text + "\n"));
    } catch { /* stream already closed */ }
  });

  vertexWs.on("close", (code, reason) => {
    console.log(`[gemini-live-relay] Vertex WS closed: ${code} ${reason}`);
    try { streamController.close(); } catch { /* already closed */ }
  });

  vertexWs.on("error", (err) => {
    console.error("[gemini-live-relay] Vertex WS error:", err);
    try { streamController.close(); } catch { /* already closed */ }
  });

  // 4. Wait for Vertex WS to open
  try {
    await new Promise<void>((resolve, reject) => {
      vertexWs.once("open",  resolve);
      vertexWs.once("error", reject);
    });
  } catch (err) {
    console.error("[gemini-live-relay] Vertex WS failed to open:", err);
    return Response.json({ error: "Vertex AI connection failed" }, { status: 502 });
  }

  // 5. Pipe browser request body → Vertex AI WebSocket (async, non-blocking)
  (async () => {
    const reader  = request.body?.getReader();
    if (!reader) { vertexWs.close(); return; }

    const decoder = new TextDecoder();
    let buffer    = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          if (vertexWs.readyState !== WebSocket.OPEN) break;

          try {
            const msg  = JSON.parse(line) as Record<string, unknown>;
            const out  = rewriteModelPath(msg);
            vertexWs.send(JSON.stringify(out));
          } catch {
            // malformed JSON from client — skip
          }
        }
      }
    } catch (err) {
      console.error("[gemini-live-relay] error reading client stream:", err);
    } finally {
      // Don't close Vertex WS here — let the browser close it via response cancel
    }
  })();

  // 6. Return streaming response
  return new Response(responseStream, {
    status: 200,
    headers: {
      "Content-Type":  "application/x-ndjson",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no", // disable nginx buffering (if behind proxy)
    },
  });
}
