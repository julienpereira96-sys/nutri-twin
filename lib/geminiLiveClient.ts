/**
 * GeminiLiveClient
 *
 * Opens a native browser WebSocket directly to Vertex AI Gemini Live.
 * Authentication uses a short-lived OAuth2 token obtained from /api/gemini-token
 * (service account credentials stay server-side).
 *
 * The projectId is also returned by /api/gemini-token so the browser never
 * needs NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_ID — the model path is always correct.
 *
 * WebSocket URL:
 *   wss://us-central1-aiplatform.googleapis.com/ws/...BidiGenerateContent
 *   ?access_token=TOKEN
 */

const TOKEN_ENDPOINT = "/api/gemini-token";

// Gemini Live is only available in us-central1 — hard-coded independently of
// GOOGLE_CLOUD_LOCATION which may point to "eu" for REST calls.
const LOCATION = "us-central1";

const VERTEX_WS_URL =
  `wss://${LOCATION}-aiplatform.googleapis.com` +
  `/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

// Resolved server-side and cached here; never needs NEXT_PUBLIC_.
let _resolvedProjectId: string =
  process.env.NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_ID ?? "";

// Token cache — OAuth2 tokens are valid for 1h; we reuse for 55min.
// Eliminates the round-trip to /api/gemini-token on every new GeminiLiveClient
// (saves ~150-250ms on all subsequent connections in the same browser tab).
let _tokenCache: { token: string; expiresAt: number } | null = null;

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
    // 1. Get a short-lived OAuth2 token + projectId from the server
    // Use the cached token if still valid (55-min window, tokens live 1h).
    let token: string;
    try {
      const now = Date.now();
      if (_tokenCache && now < _tokenCache.expiresAt) {
        token = _tokenCache.token;
      } else {
        const res = await fetch(TOKEN_ENDPOINT);
        if (!res.ok) throw new Error(`Token endpoint returned ${res.status}`);
        const data = await res.json() as {
          token?: string;
          projectId?: string;
          error?: string;
        };
        if (!data.token) throw new Error(data.error ?? "No token in response");
        token = data.token;
        _tokenCache = { token, expiresAt: now + 55 * 60 * 1000 };
        // Override module-level projectId with the authoritative server value
        if (data.projectId) _resolvedProjectId = data.projectId;
      }
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

    // Vertex AI BidiGenerateContent sends binary frames (not text frames).
    // Setting binaryType = 'arraybuffer' lets us decode them as UTF-8 strings.
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.();
    };

    ws.onmessage = (evt) => {
      let text: string;
      if (typeof evt.data === "string") {
        text = evt.data;
      } else if (evt.data instanceof ArrayBuffer) {
        text = new TextDecoder().decode(evt.data);
      } else {
        // Blob fallback (should not happen with binaryType=arraybuffer)
        return;
      }
      this.onmessage?.({ data: text });
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
 *   → "projects/PROJECT/locations/us-central1/publishers/google/models/gemini-3.1-flash-live-preview"
 *
 * projectId comes from /api/gemini-token (server-side env var), so it is
 * always the real value even if NEXT_PUBLIC_GOOGLE_CLOUD_PROJECT_ID is unset.
 * Call this inside ws.onopen — by then _resolvedProjectId is populated.
 */
export function toVertexModelPath(model: string): string {
  if (model.startsWith("projects/")) return model;
  const modelId = model.replace(/^models\//, "");
  return `projects/${_resolvedProjectId}/locations/${LOCATION}/publishers/google/models/${modelId}`;
}
