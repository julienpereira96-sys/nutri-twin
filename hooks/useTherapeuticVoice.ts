"use client";

/**
 * useTherapeuticVoice
 * React hook that provides high-quality, persistent voice selection and
 * therapeutic speech synthesis for the SOS exercise space.
 *
 * Features:
 * - Loads and scores available browser voices on mount
 * - Persists the user's selection in localStorage
 * - Exposes speakTherapeutic(), cancelSpeech(), and unlockAudio()
 * - Zero memory leaks — all listeners cleaned up on unmount
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  prepareTextForTherapeuticSpeech,
  scoreVoiceQuality,
  THERAPEUTIC_RATE,
  THERAPEUTIC_PITCH,
  THERAPEUTIC_VOLUME,
} from "@/lib/therapeuticVoice";

const STORAGE_KEY = "nutritwin_selected_voice_name";

export interface TherapeuticVoiceOptions {
  /** Skip acoustic text preparation (use for karaoke-synced exercises). */
  skipPrep?: boolean;
  /** Override the default volume (0–1). */
  volume?: number;
  /** Override the default rate (0–2). */
  rate?: number;
  /** Callback fired when the utterance finishes. */
  onEnd?: () => void;
  /** Callback fired on word boundary events (if supported by the browser). */
  onBoundary?: (event: SpeechSynthesisEvent) => void;
}

export interface UseTherapeuticVoiceReturn {
  /** All available French-first voices sorted by quality score. */
  voices: SpeechSynthesisVoice[];
  /** The currently selected voice (or null before voices load). */
  selectedVoice: SpeechSynthesisVoice | null;
  /** Select a voice and persist the choice. */
  setSelectedVoice: (voice: SpeechSynthesisVoice) => void;
  /** Speak the given text with therapeutic settings. */
  speakTherapeutic: (text: string, opts?: TherapeuticVoiceOptions) => void;
  /**
   * Speak a short preview with a *specific* voice object (bypasses state so it
   * works immediately in the same event handler that calls setSelectedVoice).
   */
  previewVoice: (voice: SpeechSynthesisVoice, text: string) => void;
  /** Cancel any ongoing speech. */
  cancelSpeech: () => void;
  /** Unlock iOS audio context with a silent utterance (call on first user gesture). */
  unlockAudio: () => void;
}

export function useTherapeuticVoice(): UseTherapeuticVoiceReturn {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoiceState] = useState<SpeechSynthesisVoice | null>(null);

  // ─── Load and rank voices ──────────────────────────────────────────────────

  const loadVoices = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const all = window.speechSynthesis.getVoices();
    if (all.length === 0) return;

    // French voices only, sorted by quality score descending
    const ranked = all
      .filter((v) => v.lang.startsWith("fr"))
      .sort((a, b) => scoreVoiceQuality(b.name) - scoreVoiceQuality(a.name));
    setVoices(ranked);

    // Restore persisted choice or fall back to best available
    setSelectedVoiceState((current) => {
      if (current) return current; // already set, don't override

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const match = ranked.find((v) => v.name === saved);
        if (match) return match;
      }

      return ranked[0] ?? null;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    loadVoices();

    const handler = () => loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", handler);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
    };
  }, [loadVoices]);

  // ─── Persist voice selection ───────────────────────────────────────────────

  const setSelectedVoice = useCallback((voice: SpeechSynthesisVoice) => {
    setSelectedVoiceState(voice);
    try {
      localStorage.setItem(STORAGE_KEY, voice.name);
    } catch {
      // localStorage unavailable (private browsing, etc.) — no-op
    }
  }, []);

  // ─── Speech actions ────────────────────────────────────────────────────────

  const cancelSpeech = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
  }, []);

  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(" ");
    utter.volume = 0;
    window.speechSynthesis.speak(utter);
  }, []);

  // Keep a ref to the active utterance so we can cancel cleanly on unmount
  const activeUtterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakTherapeutic = useCallback(
    (text: string, opts: TherapeuticVoiceOptions = {}) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;

      window.speechSynthesis.cancel();

      const prepared = opts.skipPrep ? text : prepareTextForTherapeuticSpeech(text);

      // Chrome/Android bug: cancel() is async under the hood — speak() called
      // synchronously after cancel() is silently swallowed. A minimal delay fixes it.
      // Also call resume() first: Chrome pauses synthesis when the tab goes to background.
      const doSpeak = () => {
        if (typeof window === "undefined" || !window.speechSynthesis) return;
        window.speechSynthesis.resume();

        const utter = new SpeechSynthesisUtterance(prepared);

        utter.lang   = "fr-FR";
        utter.rate   = opts.rate   ?? THERAPEUTIC_RATE;
        utter.pitch  = THERAPEUTIC_PITCH;
        utter.volume = opts.volume ?? THERAPEUTIC_VOLUME;

        // selectedVoice may still be null if voices haven't fired voiceschanged yet
        // (e.g. user tapped button very quickly after exercise mount).
        // Fall back to a fresh localStorage lookup at speak-time so we never
        // silently drop the patient's persisted preference.
        const voiceToUse = selectedVoice ?? (() => {
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
              const all = window.speechSynthesis.getVoices();
              return all.find((v) => v.name === saved) ?? null;
            }
          } catch { /* localStorage unavailable */ }
          return null;
        })();

        if (voiceToUse) {
          utter.voice = voiceToUse;
        }

        if (opts.onEnd)      utter.onend      = opts.onEnd;
        if (opts.onBoundary) utter.onboundary = opts.onBoundary;

        activeUtterRef.current = utter;
        window.speechSynthesis.speak(utter);
      };

      setTimeout(doSpeak, 50);
    },
    [selectedVoice]
  );

  // ─── Voice preview ─────────────────────────────────────────────────────────
  // Takes the voice as a direct argument so it works in the same event handler
  // that calls setSelectedVoice (React state hasn't updated yet at that point).
  const previewVoice = useCallback((voice: SpeechSynthesisVoice, text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setTimeout(() => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.resume();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang   = "fr-FR";
      utter.rate   = THERAPEUTIC_RATE;
      utter.pitch  = THERAPEUTIC_PITCH;
      utter.volume = THERAPEUTIC_VOLUME;
      utter.voice  = voice;
      window.speechSynthesis.speak(utter);
    }, 50);
  }, []);

  return {
    voices,
    selectedVoice,
    setSelectedVoice,
    speakTherapeutic,
    previewVoice,
    cancelSpeech,
    unlockAudio,
  };
}
