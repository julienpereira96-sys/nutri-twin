"use client";

/**
 * useTherapeuticVoice
 * React hook for high-quality therapeutic voice synthesis via Gemini Live.
 *
 * Architecture:
 * - Opens a single Gemini Live WebSocket per session (lazy, on first speak)
 * - Sends text as realtimeInput → receives PCM16 audio chunks → plays via AudioContext
 * - When voice changes, closes WS → reopens on next speak with new voice
 * - Maintains same public API as the legacy Google Cloud TTS version
 *   so existing exercises (BodyScan, Manger, Marche, AdaptiveCoaching) work unchanged
 *
 * Note: rate/pitch/volume options are ignored (Gemini Live uses its own prosody).
 *       onBoundary and onDurationReady are no-ops (no boundary events from Gemini Live).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TherapeuticVoice,
  GEMINI_LIVE_VOICES,
  DEFAULT_VOICE_ID,
  VOICE_STORAGE_KEY,
} from "@/lib/therapeuticVoice";

const GEMINI_WS_URL = (key: string) =>
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${key}`;
const GEMINI_MODEL = "models/gemini-3.1-flash-live-preview";

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
  /** Preview a voice immediately (bypasses selected state). */
  previewVoice: (voice: TherapeuticVoice, text: string) => void;
  /** Stop all audio playback and clear the queue. */
  cancelSpeech: () => void;
  /** Unlock AudioContext on iOS (call on first user gesture). */
  unlockAudio: () => void;
  /** True while waiting for Gemini Live setup to complete. */
  isFetching: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTherapeuticVoice(): UseTherapeuticVoiceReturn {
  const [voices] = useState<TherapeuticVoice[]>(GEMINI_LIVE_VOICES);
  const [selectedVoice, setSelectedVoiceState] = useState<TherapeuticVoice>(
    () => resolveVoice(DEFAULT_VOICE_ID)
  );
  const [isFetching, setIsFetching] = useState(false);

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    setSelectedVoiceState(loadPersistedVoice());
  }, []);

  // WebSocket and audio state
  const wsRef            = useRef<WebSocket | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const audioQueueRef    = useRef<{ data: Float32Array; rate: number }[]>([]);
  const isPlayingRef     = useRef(false);
  const setupCompleteRef = useRef(false);
  const turnCompleteRef  = useRef(false);
  const onEndRef         = useRef<(() => void) | null>(null);
  const pendingTextRef   = useRef<string | null>(null);

  // ── Audio playback queue ───────────────────────────────────────────────────

  const playNextChunk = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
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
  }, []);

  // ── WebSocket management ───────────────────────────────────────────────────

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onmessage = null;
      wsRef.current.onclose   = null;
      wsRef.current.onerror   = null;
      try { wsRef.current.close(); } catch { /* no-op */ }
      wsRef.current = null;
    }
    setupCompleteRef.current = false;
    setIsFetching(false);
  }, []);

  const openWs = useCallback((voiceName: string) => {
    closeWs();
    flushAudio();

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) return;

    setIsFetching(true);

    const ws = new WebSocket(GEMINI_WS_URL(apiKey));
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: GEMINI_MODEL,
          generationConfig: {
            responseModalities: ["AUDIO"],
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

      // Setup complete → send pending text if any
      if (msg.setupComplete) {
        setupCompleteRef.current = true;
        setIsFetching(false);
        if (pendingTextRef.current) {
          ws.send(JSON.stringify({ realtimeInput: { text: pendingTextRef.current } }));
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

    ws.onerror = () => { setIsFetching(false); };
    ws.onclose = () => {
      setupCompleteRef.current = false;
      setIsFetching(false);
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

    ws.send(JSON.stringify({ realtimeInput: { text } }));
  }, [selectedVoice, openWs, flushAudio]);

  const previewVoice = useCallback((voice: TherapeuticVoice, text: string) => {
    flushAudio();
    onEndRef.current = null;
    pendingTextRef.current = text;
    openWs(voice.id);
  }, [openWs, flushAudio]);

  return {
    voices,
    selectedVoice,
    setSelectedVoice,
    speakTherapeutic,
    previewVoice,
    cancelSpeech,
    unlockAudio,
    isFetching,
  };
}
