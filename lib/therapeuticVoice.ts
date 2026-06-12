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

/**
 * Creates an onboundary handler that drives karaoke word highlighting.
 *
 * Strategy:
 *  - Primary: use SpeechSynthesisUtterance boundary events (perfectly synced to audio)
 *  - Fallback: the timer array passed in keeps running undisturbed on platforms
 *    that don't fire onboundary (iOS Safari). On the first boundary event the timers
 *    are cancelled and event-driven highlighting takes over exclusively.
 *
 * @param words         The display text pre-split on spaces
 * @param setHighlight  React state setter for the current word index
 * @param cancelFallback  Called once on first boundary event to cancel timer fallback
 */
export function makeBoundaryHandler(
  words: string[],
  setHighlight: (idx: number) => void,
  cancelFallback: () => void,
): (event: SpeechSynthesisEvent) => void {
  // Pre-compute the character start position of every word
  const starts: number[] = [];
  let pos = 0;
  for (const word of words) {
    starts.push(pos);
    pos += word.length + 1; // +1 for the space separator
  }

  let active = false;

  return (event: SpeechSynthesisEvent) => {
    if (!active) {
      active = true;
      cancelFallback(); // kill timer-based fallback on first real event
    }

    // Find the last word whose start position ≤ charIndex
    let idx = 0;
    for (let i = starts.length - 1; i >= 0; i--) {
      if (starts[i] <= event.charIndex) {
        idx = i;
        break;
      }
    }
    setHighlight(idx);
  };
}
