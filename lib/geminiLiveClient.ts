/**
 * GeminiLiveClient
 *
 * Routes all Gemini Live traffic through the server-side relay at
 * /api/gemini-live-relay instead of opening a direct browser WebSocket.
 *
 * Why the relay:
 *   - Vertex AI BidiGenerateContent rejects ?access_token= in the query string
 *     (closes with code 1008 Policy Violation).
 *   - The browser WebSocket API cannot set custom headers.
 *   - The relay opens the WebSocket server-side with Authorization: Bearer TOKEN
 *     and bridges both directions over a single streaming HTTP POST.
 *
 * Wire protocol (NDJSON over HTTP):
 *   Browser → POST body (one JSON message per line)  → relay → Vertex AI WS
 *   Browser ← Response body (one JSON message per line) ← relay ← Vertex AI WS
 *
 * API: same onopen / onmessage / onclose / onerror / send / close surface as a
 * plain WebSocket so exercises need zero changes.
 */

const RELAY_ENDPOINT = "/api/gemini-live-relay";

// Numeric WebSocket ready-state constants (avoids referencing the class itself
// at module scope in case of SSR or non-browser environments).
const WS_CONNECTING = 0;
const WS_OPEN       = 1;
const WS_CLOSING    = 2;
const WS_CLOSED     = 3;

export class GeminiLiveClient {
  // ── Public state (mirrors WebSocket) ────────────────────────────────────────
  readyState: number = WS_CONNECTING;

  onopen:    (() => void)                                        | null = null;
  onmessage: ((evt: { data: string }) => void)                  | null = null;
  onclose:   ((evt: { code: number; reason?: string }) => void) | null = null;
  onerror:   ((evt: { message: string }) => void)               | null = null;

  // ── Internal ─────────────────────────────────────────────────────────────────
  private writer:    WritableStreamDefaultWriter<Uint8Array> | null = null;
  private sendQueue: string[] = [];
  private encoder = new TextEncoder();

  constructor() {
    void this._connect();
  }

  // ── Connection ───────────────────────────────────────────────────────────────

  private async _connect(): Promise<void> {
    // Create a TransformStream whose readable half becomes the POST request body
    // and whose writable half we hold onto to send messages later.
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    this.writer = writable.getWriter();

    // Start the streaming POST to the relay.
    // `duplex: "half"` tells the browser to start reading the response before
    // the request body is fully sent — required for bidirectional streaming.
    let res: Response;
    try {
      res = await fetch(RELAY_ENDPOINT, {
        method:  "POST",
        headers: { "Content-Type": "application/x-ndjson" },
        body:    readable,
        // @ts-expect-error — non-standard option, required for streaming body
        duplex:  "half",
      });
      if (!res.ok) throw new Error(`Relay returned HTTP ${res.status}`);
    } catch (err) {
      console.error("[GeminiLiveClient] relay connection failed:", err);
      this.readyState = WS_CLOSED;
      this.onerror?.({ message: String(err) });
      this.onclose?.({ code: 1006, reason: "relay connection failed" });
      return;
    }

    // Relay is up — fire onopen and flush any messages queued during connect.
    this.readyState = WS_OPEN;
    this.onopen?.();
    for (const msg of this.sendQueue) {
      void this.writer.write(this.encoder.encode(msg + "\n"));
    }
    this.sendQueue = [];

    // Read the response stream line-by-line and dispatch onmessage events.
    const reader  = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) this.onmessage?.({ data: line });
        }
      }
    } catch (err) {
      this.onerror?.({ message: String(err) });
    } finally {
      this.readyState = WS_CLOSED;
      this.onclose?.({ code: 1000, reason: "relay stream ended" });
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  send(data: string): void {
    if (this.readyState === WS_OPEN && this.writer) {
      void this.writer.write(this.encoder.encode(data + "\n"));
    } else if (this.readyState === WS_CONNECTING) {
      // Queue until onopen fires
      this.sendQueue.push(data);
    }
  }

  close(code?: number, reason?: string): void {
    void code; void reason; // unused — relay closes naturally when body ends
    this.readyState = WS_CLOSING;
    void this.writer?.close().catch(() => {});
  }
}

// ── Model path helper ─────────────────────────────────────────────────────────

/**
 * The relay rewrites model paths server-side (rewriteModelPath in route.ts),
 * so exercises can pass either the short AI-Studio form ("models/gemini-...")
 * or the full Vertex path — both work.
 *
 * This function is kept for backwards-compatibility; it's now a no-op.
 */
export function toVertexModelPath(model: string): string {
  return model;
}
