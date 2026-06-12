/**
 * therapeuticVoice.ts
 * Pure utility for preparing text for therapeutic TTS synthesis.
 * Inserts acoustic pause markers to simulate the cadence of a human therapist.
 * Safe to use in Node and browser contexts.
 */

/**
 * Inserts short TTS pause markers around natural speech boundaries.
 * The output is intended ONLY for SpeechSynthesisUtterance — never render it to the UI.
 *
 * @param text  The original display text
 * @returns     A version with ". . , " pause markers injected at punctuation boundaries
 */
export function prepareTextForTherapeuticSpeech(text: string): string {
  if (!text) return text;

  let prepared = text;

  // After sentence-ending punctuation — long pause
  prepared = prepared.replace(/([.!?])\s+/g, "$1 . . . ");

  // After commas and semicolons — medium pause
  prepared = prepared.replace(/([,;])\s+/g, "$1 . , ");

  // After colons — medium-long pause
  prepared = prepared.replace(/([:])\s+/g, "$1 . . ");

  // Em-dashes and en-dashes — short breath pause
  prepared = prepared.replace(/\s*[–—]\s*/g, " . , ");

  // Ellipsis already in text — extend the pause
  prepared = prepared.replace(/\.\.\./g, ". . . . ");

  // Parenthetical asides — slight pause on entry and exit
  prepared = prepared.replace(/\(([^)]+)\)/g, ". , $1 . , ");

  return prepared;
}

/**
 * Returns true if the candidate voice name suggests premium/natural quality.
 * Scores higher = better quality.
 */
export function scoreVoiceQuality(name: string): number {
  const n = name.toLowerCase();
  let score = 0;

  // Top-tier indicators
  if (n.includes("google"))    score += 10;
  if (n.includes("siri"))      score += 10;
  if (n.includes("enhanced"))  score += 8;
  if (n.includes("premium"))   score += 8;
  if (n.includes("natural"))   score += 7;
  if (n.includes("neural"))    score += 9;

  // Mid-tier
  if (n.includes("compact"))   score -= 2; // typically lower quality
  if (n.includes("online"))    score += 3; // cloud-based, usually better

  return score;
}

/** Therapeutic speech constants — calibrated for a calm, supportive voice. */
export const THERAPEUTIC_RATE   = 0.82;
export const THERAPEUTIC_PITCH  = 0.91;
export const THERAPEUTIC_VOLUME = 0.78;
