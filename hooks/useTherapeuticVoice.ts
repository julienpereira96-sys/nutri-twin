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
  /** Preview a voice. Reuses existing WS if same voice already connected. */
  previewVoice: (voice: TherapeuticVoice, text: string) => void;
  /** Pre-warm the WebSocket for voiceId so preview is instant. */
  warmUp: (voiceId: string) => void;
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

  // ── Audio playback queue ───────────────────────────────────────────────────

  const playNextChunk = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
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
    isPlayingRef.current = true;
    setIsPlaying(true);
    const { data, rate } = audioQueueRef.current.shift()!;
    const buf = ctx.createBuffer(1, data.length, rate);
    buf.getChannelData(0).set(data);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = playNextChunk;
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

  const flushAudio = useCallback(() => {
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

  const previewVoice = useCallback((voice: TherapeuticVoice, text: string) => {
    // ── iOS AudioContext unlock ────────────────────────────────────────────────
    // Must happen synchronously in the user gesture (button click).
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    // Play a 1-sample silent buffer to fully activate AudioContext on iOS Safari.
    // Without this, async audio (arriving ~500ms later) may be silenced.
    try {
      const ctx = audioCtxRef.current;
      const silentBuf = ctx.createBuffer(1, 1, 22050);
      const silentSrc = ctx.createBufferSource();
      silentSrc.buffer = silentBuf;
      silentSrc.connect(ctx.destination);
      silentSrc.start(0);
    } catch { /* no-op */ }
    if (audioCtxRef.current.state === "suspended") {
      void audioCtxRef.current.resume();
    }

    flushAudio();
    onEndRef.current = null;

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
  }, [openWs, flushAudio]);

  return {
    voices,
    selectedVoice,
    setSelectedVoice,
    speakTherapeutic,
    previewVoice,
    warmUp,
    cancelSpeech,
    unlockAudio,
    isPlaying,
  };
}
