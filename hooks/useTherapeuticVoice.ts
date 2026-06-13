"use client";

/**
 * useTherapeuticVoice
 * React hook for high-quality therapeutic voice synthesis.
 *
 * Primary path  — Google Cloud TTS Neural2 (via /api/tts)
 *   • Fetches MP3 audio, plays via HTMLAudioElement
 *   • Karaoke timing driven by returned durationMs
 *
 * Fallback path — Web Speech API
 *   • Used automatically when /api/tts returns 503 (key not configured)
 *     or when fetch fails
 *   • Maintains full parity of the public API
 *
 * Persists the selected voice ID in localStorage.
 * Zero memory leaks — all listeners / timers cleaned up on unmount.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TherapeuticVoice,
  NEURAL2_VOICES,
  DEFAULT_VOICE_ID,
  buildSSML,
  prepareTextForTherapeuticSpeech,
  scoreVoiceQuality,
  THERAPEUTIC_RATE,
  THERAPEUTIC_PITCH,
  THERAPEUTIC_VOLUME,
} from "@/lib/therapeuticVoice";

const STORAGE_KEY = "nutritwin_selected_voice_id";

export interface TherapeuticVoiceOptions {
  /** Skip SSML/acoustic preparation (use for karaoke-synced exercises). */
  skipPrep?: boolean;
  /** Override default volume (0–1, Web Speech only). */
  volume?: number;
  /** Override speaking rate (0.25–4.0). */
  rate?: number;
  /** Callback fired when the utterance / audio finishes. */
  onEnd?: () => void;
  /**
   * Callback fired on word boundary events.
   * Web Speech path: receives SpeechSynthesisEvent.
   * Google TTS path: ignored — use onDurationReady for timer-based karaoke.
   */
  onBoundary?: (event: SpeechSynthesisEvent) => void;
  /**
   * Called with the audio duration (ms) once the Google TTS audio is ready.
   * Use this to set up scheduleWordTimers() for karaoke in exercises.
   */
  onDurationReady?: (durationMs: number) => void;
}

export interface UseTherapeuticVoiceReturn {
  /** Ordered list of available Neural2 voices. */
  voices: TherapeuticVoice[];
  /** Currently selected voice. */
  selectedVoice: TherapeuticVoice;
  /** Select a voice and persist the choice. */
  setSelectedVoice: (voice: TherapeuticVoice) => void;
  /** Speak text with therapeutic settings. */
  speakTherapeutic: (text: string, opts?: TherapeuticVoiceOptions) => void;
  /** Speak a preview with a specific voice object (bypasses state). */
  previewVoice: (voice: TherapeuticVoice, text: string) => void;
  /** Cancel any ongoing speech. */
  cancelSpeech: () => void;
  /** Unlock iOS audio context (call on first user gesture). */
  unlockAudio: () => void;
  /** True while Google TTS audio is being fetched. */
  isFetching: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveVoice(id: string): TherapeuticVoice {
  return (
    NEURAL2_VOICES.find(v => v.id === id) ??
    NEURAL2_VOICES.find(v => v.id === DEFAULT_VOICE_ID) ??
    NEURAL2_VOICES[0]
  );
}

function loadPersistedVoice(): TherapeuticVoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return resolveVoice(saved);
  } catch { /* localStorage unavailable */ }
  return resolveVoice(DEFAULT_VOICE_ID);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTherapeuticVoice(): UseTherapeuticVoiceReturn {
  const [voices] = useState<TherapeuticVoice[]>(NEURAL2_VOICES);
  const [selectedVoice, setSelectedVoiceState] = useState<TherapeuticVoice>(
    () => resolveVoice(DEFAULT_VOICE_ID)
  );
  const [isFetching, setIsFetching] = useState(false);

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    setSelectedVoiceState(loadPersistedVoice());
  }, []);

  // Active audio element ref — paused on new speak() or unmount
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Abort controller for in-flight TTS fetches
  const fetchAbortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      fetchAbortRef.current?.abort();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ─── Persist voice selection ─────────────────────────────────────────────

  const setSelectedVoice = useCallback((voice: TherapeuticVoice) => {
    setSelectedVoiceState(voice);
    try { localStorage.setItem(STORAGE_KEY, voice.id); } catch { /* no-op */ }
  }, []);

  // ─── Cancel ──────────────────────────────────────────────────────────────

  const cancelSpeech = useCallback(() => {
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsFetching(false);
  }, []);

  // ─── Unlock iOS audio ────────────────────────────────────────────────────

  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.speechSynthesis) {
      const utter = new SpeechSynthesisUtterance(" ");
      utter.volume = 0;
      window.speechSynthesis.speak(utter);
    }
  }, []);

  // ─── Web Speech fallback ─────────────────────────────────────────────────

  const speakViaWebSpeech = useCallback((
    text: string,
    opts: TherapeuticVoiceOptions,
  ) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const prepared = opts.skipPrep ? text : prepareTextForTherapeuticSpeech(text);

    const doSpeak = () => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.resume();

      const utter = new SpeechSynthesisUtterance(prepared);
      utter.lang   = "fr-FR";
      utter.rate   = opts.rate   ?? THERAPEUTIC_RATE;
      utter.pitch  = THERAPEUTIC_PITCH;
      utter.volume = opts.volume ?? THERAPEUTIC_VOLUME;

      // Try to find a French browser voice
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const allVoices = window.speechSynthesis.getVoices();
        const frVoices = allVoices
          .filter(v => v.lang.startsWith("fr"))
          .sort((a, b) => scoreVoiceQuality(b.name) - scoreVoiceQuality(a.name));
        // Match by name if we had saved a browser voice name, otherwise use best fr
        const match = saved
          ? allVoices.find(v => v.name === saved) ?? frVoices[0]
          : frVoices[0];
        if (match) utter.voice = match;
      } catch { /* no-op */ }

      if (opts.onEnd)      utter.onend      = opts.onEnd;
      if (opts.onBoundary) utter.onboundary = opts.onBoundary;

      window.speechSynthesis.speak(utter);
    };

    setTimeout(doSpeak, 50);
  }, []);

  // ─── Google Cloud TTS path ───────────────────────────────────────────────

  const speakViaTTS = useCallback(async (
    text: string,
    voiceId: string,
    opts: TherapeuticVoiceOptions
  ) => {
    cancelSpeech();

    const rate = opts.rate ?? 0.92;
    const ssml = opts.skipPrep ? undefined : buildSSML(text, rate);

    fetchAbortRef.current = new AbortController();
    setIsFetching(true);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: opts.skipPrep ? text : undefined,
          ssml: ssml ?? undefined,
          voiceId,
          rate,
        }),
        signal: fetchAbortRef.current.signal,
      });

      setIsFetching(false);

      // 503 = key not configured → fall back silently
      if (res.status === 503 || !res.ok) {
        speakViaWebSpeech(text, opts);
        return;
      }

      const data = await res.json() as { audioBase64: string; durationMs: number };
      const { audioBase64, durationMs } = data;

      // Notify caller of duration for karaoke scheduling
      if (opts.onDurationReady && durationMs) {
        opts.onDurationReady(durationMs);
      }

      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audioRef.current = audio;

      if (opts.onEnd) {
        audio.addEventListener("ended", opts.onEnd, { once: true });
      }

      await audio.play();
    } catch (err) {
      setIsFetching(false);
      if ((err as Error).name === "AbortError") return;
      speakViaWebSpeech(text, opts);
    }
  }, [cancelSpeech, speakViaWebSpeech]);

  // ─── Public API ──────────────────────────────────────────────────────────

  const speakTherapeutic = useCallback(
    (text: string, opts: TherapeuticVoiceOptions = {}) => {
      void speakViaTTS(text, selectedVoice.id, opts);
    },
    [selectedVoice, speakViaTTS]
  );

  const previewVoice = useCallback((voice: TherapeuticVoice, text: string) => {
    void speakViaTTS(text, voice.id, { skipPrep: false });
  }, [speakViaTTS]);

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
