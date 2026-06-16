/**
 * GeminiLiveClient
 *
 * Drop-in replacement for `new WebSocket(url)` that connects directly to
 * Vertex AI Gemini Live using a short-lived OAuth2 token obtained from
 * the server-side /api/gemini-token endpoint.
 *
 * Architecture:
 *   1. Fetches a short-lived OAuth2 token from /api/gemini-token
 *      (service account credentials stay server-side — never exposed)
 *   2. Opens a native browser WebSocket to Vertex AI using the token
 *      as an `access_token` query parameter
 *   3. Exposes the same onopen/onmessage/onclose/onerror/send/close API
 *      as browser WebSocket so exercises need minimal changes
 *
 * Usage (replaces `new WebSocket(url)`):
 *   const ws = new GeminiLiveClient();
 */

const TOKEN_ENDPOINT  = "/api/gemini-token";
const LOCATION        = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_LOCATION ?? "us-central1";
const PROJECT_ID      = process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_ID!;

/** Full Vertex AI WebSocket URL (model path is set in the setup message) */
const VERTEX_WS_URL =
  `wss://${LOCATION}-aiplatform.googleapis.com` +
  `/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

export class GeminiLiveClient {
  // ── Public state (mirrors WebSocket) ────────────────────────────────────────
  readyState: number = WebSocket.CONNECTING;

  onopen:    (() => void)                                        | null = null;
  onmessage: ((evt: { data: string }) => void)                  | null = null;
  onclose:   ((evt: { code: number; reason?: string }) => void) | null = null;
  onerror:   ((evt: { message: string }) => void)               | null = null;

  private ws: WebSocket | null = null;

  constructor() {
    void this._connect();
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  private async _connect(): Promise<void> {
    // 1. Get a short-lived OAuth2 token from the server
    let token: string;
    try {
      const res = await fetch(TOKEN_ENDPOINT);
      if (!res.ok) throw new Error(`Token endpoint returned ${res.status}`);
      const data = await res.json() as { token?: string; error?: string };
      if (!data.token) throw new Error(data.error ?? "No token in response");
      token = data.token;
    } catch (err) {
      console.error("[GeminiLiveClient] token fetch failed:", err);
      this.readyState = WebSocket.CLOSED;
      this.onerror?.({ message: String(err) });
      this.onclose?.({ code: 1006, reason: "token fetch failed" });
      return;
    }

    // 2. Open native WebSocket directly to Vertex AI
    const url = `${VERTEX_WS_URL}?access_token=${encodeURIComponent(token)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      this.readyState = WebSocket.CLOSED;
      this.onerror?.({ message: String(err) });
      this.onclose?.({ code: 1006, reason: "websocket construction failed" });
      return;
    }

    this.ws = ws;

    ws.onopen = () => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.();
    };

    ws.onmessage = (evt) => {
      this.onmessage?.({ data: evt.data as string });
    };

    ws.onclose = (evt) => {
      this.readyState = WebSocket.CLOSED;
      this.ws = null;
      this.onclose?.({ code: evt.code, reason: evt.reason });
    };

    ws.onerror = () => {
      this.onerror?.({ message: "WebSocket error" });
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  send(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  close(code?: number, reason?: string): void {
    this.readyState = WebSocket.CLOSING;
    this.ws?.close(code, reason);
  }
}

// ── Model path helper ─────────────────────────────────────────────────────────

/**
 * Rewrites an AI-Studio-style model name to the full Vertex AI resource path.
 *   "models/gemini-3.1-flash-live-preview"
 *   → "projects/PROJECT/locations/LOCATION/publishers/google/models/gemini-3.1-flash-live-preview"
 *
 * Call this on the model field inside the setup message before sending.
 */
export function toVertexModelPath(model: string): string {
  if (model.startsWith("projects/")) return model; // already Vertex format
  const modelId = model.replace(/^models\//, "");
  return `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${modelId}`;
}
