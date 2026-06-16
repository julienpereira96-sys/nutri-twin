/**
 * GeminiLiveClient
 *
 * Drop-in replacement for `new WebSocket(url)` that routes through the
 * /api/gemini-live-relay Next.js route instead of connecting directly to
 * Vertex AI (which requires OAuth2 Bearer auth — not possible from the browser).
 *
 * Public API is intentionally identical to the browser WebSocket API so that
 * all exercises can be migrated with a one-line change:
 *
 *   - before:  const ws = new WebSocket(GEMINI_WS_URL(apiKey));
 *   + after:   const ws = new GeminiLiveClient();
 *
 * Transport: HTTP streaming with `duplex: "half"` (supported in Chrome 105+,
 * Firefox 119+). The request body is a WritableStream (browser → server);
 * the response body is a ReadableStream (server → browser). Both carry
 * newline-delimited JSON (NDJSON).
 */

export const GEMINI_RELAY_URL = "/api/gemini-live-relay";

// WebSocket readyState constants (mirrored for TS convenience)
const WS_CONNECTING = 0;
const WS_OPEN       = 1;
const WS_CLOSING    = 2;
const WS_CLOSED     = 3;

export class GeminiLiveClient {
  // ── Public state (mirrors WebSocket) ────────────────────────────────────────
  readyState: number = WS_CONNECTING;

  onopen:    (() => void)                        | null = null;
  onmessage: ((evt: { data: string }) => void)   | null = null;
  onclose:   ((evt: { code: number; reason?: string }) => void) | null = null;
  onerror:   ((evt: { message: string }) => void) | null = null;

  // ── Private ──────────────────────────────────────────────────────────────────
  private writer:    WritableStreamDefaultWriter<Uint8Array> | null = null;
  private abortCtrl: AbortController | null = null;
  private encoder  = new TextEncoder();
  private decoder  = new TextDecoder();

  constructor(private relayUrl: string = GEMINI_RELAY_URL) {
    // Connect immediately (same semantics as `new WebSocket(url)`)
    void this._connect();
  }

  // ── Internal: open the fetch tunnel ─────────────────────────────────────────

  private async _connect(): Promise<void> {
    this.abortCtrl = new AbortController();

    // TransformStream gives us a paired (readable, writable).
    // We keep the writer to push outgoing messages (send()).
    // The readable goes as the fetch request body.
    const { readable, writable } = new TransformStream<Uint8Array>();
    this.writer = writable.getWriter();

    let response: Response;
    try {
      response = await fetch(this.relayUrl, {
        method:  "POST",
        body:    readable,
        headers: { "Content-Type": "application/x-ndjson" },
        // @ts-expect-error — `duplex` is a stage-3 fetch proposal; TS types lag behind
        duplex:  "half",
        signal:  this.abortCtrl.signal,
      });
    } catch (err) {
      // Network error or aborted
      this.readyState = WS_CLOSED;
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        this.onerror?.({ message: String(err) });
      }
      this.onclose?.({ code: 1006, reason: "fetch failed" });
      return;
    }

    if (!response.ok) {
      this.readyState = WS_CLOSED;
      this.onerror?.({ message: `Relay returned HTTP ${response.status}` });
      this.onclose?.({ code: 1011, reason: `HTTP ${response.status}` });
      return;
    }

    // Connection established
    this.readyState = WS_OPEN;
    this.onopen?.();

    // ── Read response stream (server → browser) ──────────────────────────────
    const reader = response.body!.getReader();
    let   buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += this.decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) this.onmessage?.({ data: trimmed });
        }
      }

      // Clean close
      this.readyState = WS_CLOSED;
      this.onclose?.({ code: 1000, reason: "normal closure" });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        this.readyState = WS_CLOSED;
        this.onclose?.({ code: 1000, reason: "aborted" });
      } else {
        this.readyState = WS_CLOSED;
        this.onerror?.({ message: String(err) });
        this.onclose?.({ code: 1006, reason: "read error" });
      }
    }
  }

  // ── Public: send ─────────────────────────────────────────────────────────────

  send(data: string): void {
    if (this.readyState !== WS_OPEN || !this.writer) return;
    // Append newline so the server can split on "\n"
    const bytes = this.encoder.encode(data + "\n");
    // Fire-and-forget (backpressure ignored for real-time audio)
    this.writer.write(bytes).catch(() => {});
  }

  // ── Public: close ─────────────────────────────────────────────────────────────

  close(_code?: number, _reason?: string): void {
    if (this.readyState === WS_CLOSED || this.readyState === WS_CLOSING) return;
    this.readyState = WS_CLOSING;
    // Closing the writer signals EOF to the server (it will then close Vertex WS)
    this.writer?.close().catch(() => {});
    // Abort the fetch (cancels the response stream)
    this.abortCtrl?.abort();
  }
}
