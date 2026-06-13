/**
 * therapeuticVoice.ts
 * Core utilities for therapeutic TTS synthesis.
 *
 * Features:
 * - TherapeuticVoice catalogue — Google Cloud Neural2 voices (fr-FR)
 * - buildSSML() — wraps plain text in SSML with therapeutic pauses
 * - prepareTextForTherapeuticSpeech() — Web Speech fallback text preparation
 * - makeBoundaryHandler() — karaoke word highlighting (Web Speech only)
 * - scoreVoiceQuality() — legacy Web Speech voice ranking (fallback)
 */

// ─── TherapeuticVoice ─────────────────────────────────────────────────────────
// Replaces SpeechSynthesisVoice — used across the hook and the voice selector.

export type VoiceGender = "FEMALE" | "MALE";

export interface TherapeuticVoice {
  /** Google Cloud TTS voice name, e.g. "fr-FR-Neural2-C" */
  id: string;
  /** Human-readable label shown in the selector */
  name: string;
  /** BCP-47 language tag */
  lang: string;
  gender: VoiceGender;
  /** Short description shown as subtitle in the selector */
  description: string;
}

/**
 * Full catalogue of available fr-FR Neural2 voices.
 * Order matters — it drives the display order in the selector.
 */
export const NEURAL2_VOICES: TherapeuticVoice[] = [
  {
    id: "fr-FR-Neural2-A",
    name: "Amélie",
    lang: "fr-FR",
    gender: "FEMALE",
    description: "Voix féminine, douce et posée",
  },
  {
    id: "fr-FR-Neural2-C",
    name: "Camille",
    lang: "fr-FR",
    gender: "FEMALE",
    description: "Voix féminine, chaleureuse et naturelle",
  },
  {
    id: "fr-FR-Neural2-E",
    name: "Élise",
    lang: "fr-FR",
    gender: "FEMALE",
    description: "Voix féminine, claire et bienveillante",
  },
  {
    id: "fr-FR-Neural2-B",
    name: "Baptiste",
    lang: "fr-FR",
    gender: "MALE",
    description: "Voix masculine, grave et apaisante",
  },
  {
    id: "fr-FR-Neural2-D",
    name: "Damien",
    lang: "fr-FR",
    gender: "MALE",
    description: "Voix masculine, posée et rassurante",
  },
];

/** Default voice — Camille (Neural2-C) */
export const DEFAULT_VOICE_ID = "fr-FR-Neural2-C";

// ─── SSML builder ─────────────────────────────────────────────────────────────

/**
 * Wraps plain text in SSML for therapeutic delivery:
 * - Global prosody: slightly slower rate, softer volume
 * - Sentence-ending punctuation → 600 ms break
 * - Commas / semicolons → 300 ms break
 * - Em-dashes / en-dashes → 250 ms break
 * - Ellipsis → 700 ms break
 */
export function buildSSML(text: string, rate = 0.92): string {
  if (!text?.trim()) return `<speak></speak>`;

  const ratePercent = Math.round(rate * 100);

  // Escape XML special chars first
  let safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // Long break after sentence-ending punctuation
  safe = safe.replace(/([.!?])\s+/g, '$1<break time="600ms"/> ');

  // Medium break after commas / semicolons
  safe = safe.replace(/([,;])\s+/g, '$1<break time="300ms"/> ');

  // Medium-long break after colons
  safe = safe.replace(/([:])\s+/g, '$1<break time="450ms"/> ');

  // Short breath pause for dashes
  safe = safe.replace(/\s*[–—]\s*/g, ' <break time="250ms"/> ');

  // Extra pause for ellipsis
  safe = safe.replace(/\.\.\./g, '<break time="700ms"/>');

  return `<speak><prosody rate="${ratePercent}%" volume="-2dB">${safe}</prosody></speak>`;
}

// ─── Web Speech fallback ───────────────────────────────────────────────────────

/**
 * Inserts acoustic pause markers for SpeechSynthesisUtterance.
 * ONLY for the Web Speech fallback — never render to the UI.
 */
export function prepareTextForTherapeuticSpeech(text: string): string {
  if (!text) return text;

  let prepared = text;
  prepared = prepared.replace(/([.!?])\s+/g, "$1 . . . ");
  prepared = prepared.replace(/([,;])\s+/g, "$1 . , ");
  prepared = prepared.replace(/([:])\s+/g, "$1 . . ");
  prepared = prepared.replace(/\s*[–—]\s*/g, " . , ");
  prepared = prepared.replace(/\.\.\./g, ". . . . ");
  prepared = prepared.replace(/\(([^)]+)\)/g, ". , $1 . , ");

  return prepared;
}

/**
 * Scores a Web Speech voice name for quality (used in fallback mode only).
 */
export function scoreVoiceQuality(name: string): number {
  const n = name.toLowerCase();
  let score = 0;
  if (n.includes("google"))    score += 10;
  if (n.includes("siri"))      score += 10;
  if (n.includes("enhanced"))  score += 8;
  if (n.includes("premium"))   score += 8;
  if (n.includes("natural"))   score += 7;
  if (n.includes("neural"))    score += 9;
  if (n.includes("compact"))   score -= 2;
  if (n.includes("online"))    score += 3;
  return score;
}

/** Therapeutic speech constants for the Web Speech fallback. */
export const THERAPEUTIC_RATE   = 0.82;
export const THERAPEUTIC_PITCH  = 0.91;
export const THERAPEUTIC_VOLUME = 0.78;

// ─── Karaoke handler (Web Speech boundary events) ─────────────────────────────

/**
 * Creates an onboundary handler for karaoke word highlighting.
 * Only usable with SpeechSynthesisUtterance (Web Speech fallback).
 * For Google Cloud TTS, use timer-based highlighting driven by audio duration.
 */
export function makeBoundaryHandler(
  words: string[],
  setHighlight: (idx: number) => void,
  cancelFallback: () => void,
): (event: SpeechSynthesisEvent) => void {
  const starts: number[] = [];
  let pos = 0;
  for (const word of words) {
    starts.push(pos);
    pos += word.length + 1;
  }

  let active = false;

  return (event: SpeechSynthesisEvent) => {
    if (!active) {
      active = true;
      cancelFallback();
    }

    let idx = 0;
    for (let i = starts.length - 1; i >= 0; i--) {
      if (starts[i] <= event.charIndex) { idx = i; break; }
    }
    setHighlight(idx);
  };
}

// ─── Karaoke: timer-based duration highlight (Google Cloud TTS) ───────────────

/**
 * Schedules word-highlight timers based on total audio duration.
 * Used when boundary events are not available (Google Cloud TTS path).
 *
 * @param words        Words to highlight
 * @param durationMs   Total audio duration in milliseconds
 * @param setHighlight React state setter for current word index
 * @returns            Array of timer IDs (store in a ref for cleanup)
 */
export function scheduleWordTimers(
  words: string[],
  durationMs: number,
  setHighlight: (idx: number) => void,
): ReturnType<typeof setTimeout>[] {
  if (!words.length || !durationMs) return [];

  const msPerWord = durationMs / words.length;
  const timers: ReturnType<typeof setTimeout>[] = [];

  words.forEach((_, i) => {
    const t = setTimeout(() => setHighlight(i), i * msPerWord);
    timers.push(t);
  });

  return timers;
}
