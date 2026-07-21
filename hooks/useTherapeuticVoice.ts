"use client";

/**
 * useTherapeuticVoice
 * React hook for high-quality therapeutic voice synthesis via Gemini Live.
 *
 * Architecture:
 * - Opens a single Gemini Live WebSocket per session (lazy, on first speak)
 * - Sends text as clientContent → receives PCM16 audio chunks → plays via AudioContext
 * - warmUp(voiceId) pre-opens the connection so preview is near-instant
 * - previewVoice reuses existing connection if same voice is already connected
 * - iOS fix: plays a 1-sample silent buffer at click time to unlock AudioContext
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TherapeuticVoice,
  GEMINI_LIVE_VOICES,
  DEFAULT_VOICE_ID,
  VOICE_STORAGE_KEY,
} from "@/lib/therapeuticVoice";
import { GeminiLiveClient, toVertexModelPath } from "@/lib/geminiLiveClient";
import {
  PreviewChunk,
  PREVIEW_TEXT,
  loadAllPreviews,
  savePreview,
} from "@/lib/voicePreviewCache";

// Model name — same as SOSExercise (validated in prod)
const GEMINI_MODEL = "models/gemini-live-2.5-flash-native-audio";

// ─── PCM helpers ──────────────────────────────────────────────────────────────

function pcm16Base64ToFloat32(base64: string): Float32Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
  return f32;
}

// ─── iOS detection ────────────────────────────────────────────────────────────
//
// On iOS Safari, Web Audio API (AudioContext) is ALWAYS muted by the hardware
// ringer/silent switch — no workaround exists at the Web Audio layer.
// For preview audio we instead encode PCM chunks into a WAV Blob and play via
// an HTML <audio> element, which uses the AVAudioSession "Playback" category
// and is NOT affected by the silent switch (same as video/music apps).

const IS_IOS =
  typeof navigator !== "undefined" &&
  /iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * Encode decoded Float32 PCM chunks into a WAV Blob suitable for
 * HTMLAudioElement playback. Works with any sample rate.
 */
function chunksToWavBlob(
  chunks: Array<{ data: Float32Array; rate: number }>,
): Blob | null {
  if (!chunks.length) return null;
  const rate = chunks[0].rate;
  const totalLen = chunks.reduce((s, c) => s + c.data.length, 0);
  const pcm16 = new Int16Array(totalLen);
  let off = 0;
  for (const { data } of chunks) {
    for (let i = 0; i < data.length; i++) {
      pcm16[off++] = Math.max(-32768, Math.min(32767, Math.round(data[i] * 32767)));
    }
  }
  const dataSize = pcm16.byteLength;
  const ab = new ArrayBuffer(44 + dataSize);
  const v = new DataView(ab);
  const str = (s: string, o: number) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str("RIFF", 0); v.setUint32(4, 36 + dataSize, true);
  str("WAVE", 8); str("fmt ", 12);
  v.setUint32(16, 16, true);       // PCM subchunk size
  v.setUint16(20, 1,  true);       // PCM format
  v.setUint16(22, 1,  true);       // mono
  v.setUint32(24, rate, true);     // sample rate
  v.setUint32(28, rate * 2, true); // byte rate
  v.setUint16(32, 2,  true);       // block align
  v.setUint16(34, 16, true);       // bits per sample
  str("data", 36); v.setUint32(40, dataSize, true);
  new Int16Array(ab, 44).set(pcm16);
  return new Blob([ab], { type: "audio/wav" });
}

// ─── Voice helpers ────────────────────────────────────────────────────────────

function resolveVoice(id: string): TherapeuticVoice {
  return (
    GEMINI_LIVE_VOICES.find(v => v.id === id) ??
    GEMINI_LIVE_VOICES.find(v => v.id === DEFAULT_VOICE_ID) ??
    GEMINI_LIVE_VOICES[0]
  );
}

function loadPersistedVoice(): TherapeuticVoice {
  try {
    const saved = localStorage.getItem(VOICE_STORAGE_KEY);
    if (saved) return resolveVoice(saved);
  } catch { /* localStorage unavailable */ }
  return resolveVoice(DEFAULT_VOICE_ID);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TherapeuticVoiceOptions {
  /** Ignored — kept for API compatibility with legacy exercises. */
  skipPrep?: boolean;
  /** Ignored — Gemini Live manages its own volume. */
  volume?: number;
  /** Ignored — Gemini Live manages its own rate. */
  rate?: number;
  /** Fired when audio playback finishes. */
  onEnd?: () => void;
  /** No-op — Gemini Live doesn't emit boundary events. */
  onBoundary?: (event: SpeechSynthesisEvent) => void;
  /** No-op — audio duration not known upfront with Gemini Live. */
  onDurationReady?: (durationMs: number) => void;
}

export interface UseTherapeuticVoiceReturn {
  /** Ordered list of available Gemini Live voices. */
  voices: TherapeuticVoice[];
  /** Currently selected voice. */
  selectedVoice: TherapeuticVoice;
  /** Select a voice and persist the choice. Closes current WS connection. */
  setSelectedVoice: (voice: TherapeuticVoice) => void;
  /** Speak text with therapeutic voice via Gemini Live. */
  speakTherapeutic: (text: string, opts?: TherapeuticVoiceOptions) => void;
  /** Preview a voice — serves from IndexedDB cache if available, falls back to live WS. */
  previewVoice: (voice: TherapeuticVoice, text: string) => Promise<void>;
  /** Pre-warm the WebSocket for voiceId so preview is instant. */
  warmUp: (voiceId: string) => void;
  /**
   * Sequentially generate preview audio for all voices not yet cached.
   * Each voice opens its own temporary WS (independent of the playback WS).
   * Results are stored in IndexedDB for zero-latency future previews.
   */
  generatePreviews: (voices: TherapeuticVoice[]) => Promise<void>;
  /** Stop all audio playback and clear the queue. */
  cancelSpeech: () => void;
  /** Unlock AudioContext on iOS (call on first user gesture). */
  unlockAudio: () => void;
  /** True while audio is actively playing (drives visual bars). */
  isPlaying: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTherapeuticVoice(): UseTherapeuticVoiceReturn {
  const [voices] = useState<TherapeuticVoice[]>(GEMINI_LIVE_VOICES);
  const [selectedVoice, setSelectedVoiceState] = useState<TherapeuticVoice>(
    () => resolveVoice(DEFAULT_VOICE_ID)
  );
  const [isPlaying, setIsPlaying] = useState(false);

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    setSelectedVoiceState(loadPersistedVoice());
  }, []);

  // WebSocket and audio state
  const wsRef              = useRef<WebSocket | null>(null);
  const audioCtxRef        = useRef<AudioContext | null>(null);
  const audioQueueRef      = useRef<{ data: Float32Array; rate: number }[]>([]);
  const isPlayingRef       = useRef(false);
  const setupCompleteRef   = useRef(false);
  const turnCompleteRef    = useRef(false);
  const onEndRef           = useRef<(() => void) | null>(null);
  const pendingTextRef     = useRef<string | null>(null);
  const setupTimeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentWsVoiceRef  = useRef<string | null>(null);

  // ── Preview cache (IndexedDB → in-memory) ─────────────────────────────────
  const previewCacheRef    = useRef<Map<string, PreviewChunk[]>>(new Map());
  const isGeneratingRef    = useRef(false);

  // ── iOS audio element (replaces Web Audio for preview on iOS) ─────────────
  // HTMLAudioElement bypasses the ringer/silent switch; Web Audio API does not.
  const iosAudioRef        = useRef<HTMLAudioElement | null>(null);
  // Tracks which voice the current iOS preview is for; cleared by flushAudio
  // so a stale WS callback doesn't play audio after the user switched voices.
  const previewVoiceIdRef  = useRef<string | null>(null);

  // Load persisted previews from IndexedDB on mount
  useEffect(() => {
    const ids = GEMINI_LIVE_VOICES.map(v => v.id);
    loadAllPreviews(ids).then(cached => {
      previewCacheRef.current = cached;
    });
  }, []);

  // ── Audio playback queue ───────────────────────────────────────────────────

  // Tracks the AudioBufferSourceNode currently playing so flushAudio() can
  // stop it immediately (prevents overlap when switching voices mid-playback).
  const currentSrcRef = useRef<AudioBufferSourceNode | null>(null);

  const playNextChunk = useCallback(async () => {
    const ctx = audioCtxRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      currentSrcRef.current = null;
      setIsPlaying(false);
      // Fire onEnd once queue drains after turnComplete
      if (turnCompleteRef.current) {
        turnCompleteRef.current = false;
        const cb = onEndRef.current;
        onEndRef.current = null;
        cb?.();
      }
      return;
    }
    // Guard against concurrent calls (e.g. when enqueueAudio is called
    // in a tight loop for cached chunks — each call sees isPlayingRef===false
    // before the first async tick, causing multiple simultaneous dequeues).
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setIsPlaying(true);
    // Safety net: previewVoice now awaits ctx.resume() before calling enqueueAudio,
    // so the context should already be "running" here. This guard covers the WS
    // fallback path where audio arrives asynchronously after the gesture.
    if (ctx.state !== "running") {
      try { await ctx.resume(); } catch { /* no-op */ }
    }
    // Re-check after any await: flushAudio() may have been called while we waited.
    if (!isPlayingRef.current) return;
    const { data, rate } = audioQueueRef.current.shift()!;
    const buf = ctx.createBuffer(1, data.length, rate);
    buf.getChannelData(0).set(data);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    currentSrcRef.current = src;
    src.onended = () => { void playNextChunk(); };
    src.start(0);
  }, []);

  const enqueueAudio = useCallback((base64: string, sampleRate = 24000) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
    audioQueueRef.current.push({ data: pcm16Base64ToFloat32(base64), rate: sampleRate });
    if (!isPlayingRef.current) playNextChunk();
  }, [playNextChunk]);

  // ── iOS playback via HTMLAudioElement ─────────────────────────────────────

  const playViaAudioElement = useCallback(
    (chunks: Array<{ data: Float32Array; rate: number }>) => {
      const blob = chunksToWavBlob(chunks);
      if (!blob) return;
      // Stop any previous preview
      if (iosAudioRef.current) {
        iosAudioRef.current.pause();
        try { URL.revokeObjectURL(iosAudioRef.current.src); } catch { /* no-op */ }
      }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      iosAudioRef.current = audio;
      isPlayingRef.current = true;
      setIsPlaying(true);
      audio.onended = () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        if (iosAudioRef.current === audio) iosAudioRef.current = null;
      };
      audio.onerror = () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
      };
      void audio.play();
    },
    [],
  );

  const flushAudio = useCallback(() => {
    // Stop the currently playing source node immediately to prevent overlap
    // (e.g. when the user taps a different voice before the current one ends).
    if (currentSrcRef.current) {
      try {
        currentSrcRef.current.onended = null; // prevent onended → playNextChunk
        currentSrcRef.current.stop();
      } catch { /* no-op — already stopped */ }
      currentSrcRef.current = null;
    }
    // Stop iOS audio element and cancel any pending iOS preview WS
    previewVoiceIdRef.current = null;
    if (iosAudioRef.current) {
      iosAudioRef.current.pause();
      try { URL.revokeObjectURL(iosAudioRef.current.src); } catch { /* no-op */ }
      iosAudioRef.current = null;
    }
    audioQueueRef.current   = [];
    isPlayingRef.current    = false;
    turnCompleteRef.current = false;
    onEndRef.current        = null;
    setIsPlaying(false);
  }, []);

  // ── WebSocket management ───────────────────────────────────────────────────

  const closeWs = useCallback(() => {
    if (setupTimeoutRef.current) {
      clearTimeout(setupTimeoutRef.current);
      setupTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onmessage = null;
      wsRef.current.onclose   = null;
      wsRef.current.onerror   = null;
      try { wsRef.current.close(); } catch { /* no-op */ }
      wsRef.current = null;
    }
    setupCompleteRef.current  = false;
    currentWsVoiceRef.current = null;
  }, []);

  const openWs = useCallback((voiceName: string) => {
    closeWs();
    flushAudio();

    currentWsVoiceRef.current = voiceName;

    // Safety: log if setupComplete never arrives
    setupTimeoutRef.current = setTimeout(() => {
      console.warn("[useTherapeuticVoice] setup timeout — no setupComplete after 10s");
    }, 10000);

    const ws = new GeminiLiveClient();
    wsRef.current = ws as unknown as WebSocket;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: toVertexModelPath(GEMINI_MODEL),
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName,
                },
              },
            },
          },
          systemInstruction: {
            parts: [{
              text: "Tu es un assistant vocal thérapeutique. Prononce exactement le texte reçu, avec une voix douce, posée et bienveillante. Ne rajoute aucun mot.",
            }],
          },
        },
      }));
    };

    ws.onmessage = (evt) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(evt.data as string); } catch { return; }

      // Gemini error response
      if (msg.error) return;

      // Setup complete → send pending text if any
      if (msg.setupComplete) {
        if (setupTimeoutRef.current) {
          clearTimeout(setupTimeoutRef.current);
          setupTimeoutRef.current = null;
        }
        setupCompleteRef.current = true;
        if (pendingTextRef.current) {
          ws.send(JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: pendingTextRef.current }] }],
              turnComplete: true,
            },
          }));
          pendingTextRef.current = null;
        }
        return;
      }

      const sc = msg.serverContent as Record<string, unknown> | undefined;
      if (!sc) return;

      // Audio chunks
      const modelTurn = sc.modelTurn as Record<string, unknown> | undefined;
      const parts = (modelTurn?.parts as unknown[]) ?? [];
      for (const p of parts) {
        const part = p as Record<string, unknown>;
        const inlineData = part.inlineData as Record<string, unknown> | undefined;
        if (
          inlineData?.mimeType &&
          typeof inlineData.mimeType === "string" &&
          inlineData.mimeType.startsWith("audio/pcm")
        ) {
          const rate = parseInt(
            (inlineData.mimeType.match(/rate=(\d+)/)?.[1]) ?? "24000",
            10
          );
          enqueueAudio(inlineData.data as string, rate);
        }
      }

      // Turn complete → fire onEnd once audio queue drains
      if (sc.turnComplete === true) {
        turnCompleteRef.current = true;
        if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
          turnCompleteRef.current = false;
          const cb = onEndRef.current;
          onEndRef.current = null;
          cb?.();
        }
      }
    };

    ws.onerror = () => { /* silent — no UI spinner to clear */ };
    ws.onclose = () => {
      setupCompleteRef.current  = false;
      currentWsVoiceRef.current = null;
    };
  }, [closeWs, flushAudio, enqueueAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeWs();
      flushAudio();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [closeWs, flushAudio]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const cancelSpeech = useCallback(() => { flushAudio(); }, [flushAudio]);

  const unlockAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }
  }, []);

  /** Pre-warm WebSocket for voiceId — call when voice picker opens. */
  const warmUp = useCallback((voiceId: string) => {
    // Already connected (or connecting) for this voice → no-op
    if (currentWsVoiceRef.current === voiceId && wsRef.current) return;
    pendingTextRef.current = null;
    openWs(voiceId);
  }, [openWs]);

  /**
   * Sequentially generate & cache preview audio for every voice not yet in IndexedDB.
   * Opens one independent WebSocket per voice (never touches wsRef).
   * Safe to call multiple times — guards with isGeneratingRef.
   */
  const generatePreviews = useCallback(async (voices: TherapeuticVoice[]) => {
    if (isGeneratingRef.current) return;
    const toGenerate = voices.filter(v => !previewCacheRef.current.has(v.id));
    if (toGenerate.length === 0) return;

    isGeneratingRef.current = true;

    for (const voice of toGenerate) {
      await new Promise<void>((resolve) => {
        const chunks: PreviewChunk[] = [];
        const ws = new GeminiLiveClient();
        const timeout = setTimeout(() => {
          try { ws.close(); } catch { /* no-op */ }
          resolve();
        }, 15000);

        ws.onopen = () => {
          ws.send(JSON.stringify({
            setup: {
              model: toVertexModelPath(GEMINI_MODEL),
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice.id },
                  },
                },
              },
              systemInstruction: {
                parts: [{
                  text: "Prononce exactement le texte reçu, avec une voix douce et posée.",
                }],
              },
            },
          }));
        };

        let setupDone = false;
        ws.onmessage = (evt) => {
          let msg: Record<string, unknown>;
          try { msg = JSON.parse(evt.data as string); } catch { return; }

          if (msg.error) {
            clearTimeout(timeout);
            try { ws.close(); } catch { /* no-op */ }
            resolve();
            return;
          }

          if (msg.setupComplete) {
            setupDone = true;
            ws.send(JSON.stringify({
              clientContent: {
                turns: [{ role: "user", parts: [{ text: PREVIEW_TEXT }] }],
                turnComplete: true,
              },
            }));
            return;
          }

          if (!setupDone) return;

          const sc = msg.serverContent as Record<string, unknown> | undefined;
          if (!sc) return;

          const parts =
            ((sc.modelTurn as Record<string, unknown> | undefined)?.parts as unknown[]) ?? [];
          for (const p of parts) {
            const part       = p as Record<string, unknown>;
            const inlineData = part.inlineData as Record<string, unknown> | undefined;
            if (
              inlineData?.mimeType &&
              typeof inlineData.mimeType === "string" &&
              inlineData.mimeType.startsWith("audio/pcm")
            ) {
              const rate = parseInt(
                (inlineData.mimeType.match(/rate=(\d+)/)?.[1]) ?? "24000",
                10,
              );
              chunks.push({ data: inlineData.data as string, rate });
            }
          }

          if (sc.turnComplete === true) {
            clearTimeout(timeout);
            try { ws.close(); } catch { /* no-op */ }
            if (chunks.length > 0) {
              previewCacheRef.current.set(voice.id, chunks);
              void savePreview(voice.id, chunks);
            }
            resolve();
          }
        };

        ws.onerror = () => { clearTimeout(timeout); resolve(); };
        ws.onclose = () => { clearTimeout(timeout); resolve(); };
      });
    }

    isGeneratingRef.current = false;
  }, []);

  const setSelectedVoice = useCallback((voice: TherapeuticVoice) => {
    setSelectedVoiceState(voice);
    try { localStorage.setItem(VOICE_STORAGE_KEY, voice.id); } catch { /* no-op */ }
    closeWs();
    flushAudio();
  }, [closeWs, flushAudio]);

  const speakTherapeutic = useCallback((
    text: string,
    opts: TherapeuticVoiceOptions = {}
  ) => {
    flushAudio();
    onEndRef.current = opts.onEnd ?? null;

    const ws = wsRef.current;
    const voiceName = selectedVoice.id;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      pendingTextRef.current = text;
      openWs(voiceName);
      return;
    }

    if (!setupCompleteRef.current) {
      pendingTextRef.current = text;
      return;
    }

    ws.send(JSON.stringify({
      clientContent: {
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true,
      },
    }));
  }, [selectedVoice, openWs, flushAudio]);

  const previewVoice = useCallback(async (voice: TherapeuticVoice, text: string) => {
    flushAudio(); // stops any current preview (Web Audio or <audio>)
    onEndRef.current = null;
    previewVoiceIdRef.current = voice.id; // mark active preview

    // ══════════════════════════════════════════════════════════════════════════
    // iOS path — Web Audio API is always silenced by the ringer switch on iOS.
    // We use HTMLAudioElement instead: encode PCM chunks → WAV Blob → <audio>.
    // Cache hit:  immediate (all chunks already in memory)
    // Cache miss: open an independent WS, buffer all chunks, play on complete
    //             (same approach as generatePreviews but plays instead of only saving)
    // ══════════════════════════════════════════════════════════════════════════
    if (IS_IOS) {
      const cached = previewCacheRef.current.get(voice.id);
      if (cached && cached.length > 0) {
        const decoded = cached.map(c => ({ data: pcm16Base64ToFloat32(c.data), rate: c.rate }));
        playViaAudioElement(decoded);
        return;
      }

      // Cache miss on iOS: open independent WS, buffer, then play via <audio>
      // Show loading state during generation
      isPlayingRef.current = true;
      setIsPlaying(true);

      const voiceId = voice.id; // capture for async closure safety
      await new Promise<void>((resolve) => {
        const chunks: PreviewChunk[] = [];
        const ws = new GeminiLiveClient();
        const timeout = setTimeout(() => {
          try { ws.close(); } catch { /* no-op */ }
          isPlayingRef.current = false;
          setIsPlaying(false);
          resolve();
        }, 15000);

        ws.onopen = () => {
          ws.send(JSON.stringify({
            setup: {
              model: toVertexModelPath(GEMINI_MODEL),
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } },
                },
              },
              systemInstruction: {
                parts: [{ text: "Prononce exactement le texte reçu, avec une voix douce et posée." }],
              },
            },
          }));
        };

        let setupDone = false;
        ws.onmessage = (evt) => {
          let msg: Record<string, unknown>;
          try { msg = JSON.parse(evt.data as string); } catch { return; }
          if (msg.setupComplete) {
            setupDone = true;
            ws.send(JSON.stringify({
              clientContent: {
                turns: [{ role: "user", parts: [{ text }] }],
                turnComplete: true,
              },
            }));
            return;
          }
          if (!setupDone) return;
          const sc = msg.serverContent as Record<string, unknown> | undefined;
          if (!sc) return;
          const modelTurn = sc.modelTurn as Record<string, unknown> | undefined;
          const parts = (modelTurn?.parts as unknown[]) ?? [];
          for (const p of parts) {
            const part = p as Record<string, unknown>;
            const inlineData = part.inlineData as Record<string, unknown> | undefined;
            if (
              inlineData?.mimeType &&
              typeof inlineData.mimeType === "string" &&
              inlineData.mimeType.startsWith("audio/pcm")
            ) {
              const rate = parseInt(
                (inlineData.mimeType.match(/rate=(\d+)/)?.[1]) ?? "24000", 10,
              );
              chunks.push({ data: inlineData.data as string, rate });
            }
          }
          if (sc.turnComplete === true) {
            clearTimeout(timeout);
            try { ws.close(); } catch { /* no-op */ }
            // Save to IndexedDB cache for future visits
            if (chunks.length) {
              previewCacheRef.current.set(voiceId, chunks);
              void savePreview(voiceId, chunks);
            }
            // Only play if this preview is still the active one
            if (previewVoiceIdRef.current === voiceId && chunks.length) {
              isPlayingRef.current = false;
              setIsPlaying(false);
              const decoded = chunks.map(c => ({ data: pcm16Base64ToFloat32(c.data), rate: c.rate }));
              playViaAudioElement(decoded);
            } else {
              isPlayingRef.current = false;
              setIsPlaying(false);
            }
            resolve();
          }
        };
        ws.onerror = () => {
          clearTimeout(timeout);
          isPlayingRef.current = false;
          setIsPlaying(false);
          resolve();
        };
        ws.onclose = () => { clearTimeout(timeout); resolve(); };
      });
      return;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Non-iOS path — Web Audio API with AudioContext
    // ══════════════════════════════════════════════════════════════════════════

    // Unlock AudioContext within the user gesture (button click)
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;

    // Play a 1-sample silent buffer to unlock AudioContext on iOS-like browsers.
    try {
      const silentBuf = ctx.createBuffer(1, 1, 22050);
      const silentSrc = ctx.createBufferSource();
      silentSrc.buffer = silentBuf;
      silentSrc.connect(ctx.destination);
      silentSrc.start(0);
    } catch { /* no-op */ }

    // Await resume() within the gesture frame before enqueuing any audio.
    try { await ctx.resume(); } catch { /* no-op */ }

    // ── Cache hit → play from IndexedDB buffer (0 ms latency) ────────────────
    const cached = previewCacheRef.current.get(voice.id);
    if (cached && cached.length > 0) {
      for (const chunk of cached) {
        enqueueAudio(chunk.data, chunk.rate);
      }
      return;
    }

    // ── Cache miss → fall back to live WebSocket ──────────────────────────────
    const ws = wsRef.current;

    // Reuse existing connection if same voice is warmed up and ready
    if (
      ws &&
      ws.readyState === WebSocket.OPEN &&
      setupCompleteRef.current &&
      currentWsVoiceRef.current === voice.id
    ) {
      ws.send(JSON.stringify({
        clientContent: {
          turns: [{ role: "user", parts: [{ text }] }],
          turnComplete: true,
        },
      }));
      return;
    }

    // Different voice or not yet connected → open fresh connection
    pendingTextRef.current = text;
    openWs(voice.id);
  }, [openWs, flushAudio, enqueueAudio, playViaAudioElement]);

  return {
    voices,
    selectedVoice,
    setSelectedVoice,
    speakTherapeutic,
    previewVoice,
    warmUp,
    generatePreviews,
    cancelSpeech,
    unlockAudio,
    isPlaying,
  };
}
