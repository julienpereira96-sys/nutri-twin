"use client";

/**
 * SOSExercise V2 — Refonte complète
 *
 * Flow: loading → intake → tracing → reveal → transition
 *
 * Phase loading  : WS ouvert, Gemini accueille, setup avec outputAudioTranscription
 * Phase intake   : Patient parle, RMS silence detection, inputTranscription capturé
 * Phase tracing  : Gemini muet, tracé lettre par lettre time-driven, TTS respiratoire
 * Phase reveal   : Mot révélé lettre par lettre en couleurs, Gemini célèbre
 * Phase transition: outputAudioTranscription accumulé → un seul write Supabase sur close WS
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useTherapeuticVoice } from "@/hooks/useTherapeuticVoice";
import { GeminiLiveClient, toVertexModelPath } from "@/lib/geminiLiveClient";

// ─── Design tokens ────────────────────────────────────────────────────────────
const TEXT_MUTED   = "rgba(255,255,255,0.38)";
const TEXT_PRIMARY = "rgba(255,255,255,0.88)";

// Per-letter colors (up to 8 letters)
const LETTER_COLORS = [
  "#00e5b4", // emerald
  "#818cf8", // indigo
  "#f472b6", // pink
  "#fbbf24", // amber
  "#38bdf8", // sky
  "#34d399", // green
  "#fb923c", // orange
  "#a78bfa", // violet
];

// ─── Constants ────────────────────────────────────────────────────────────────
const GEMINI_MODEL    = "models/gemini-live-2.5-flash-native-audio";
const INSPIRE_MS      = 4500;
const EXPIRE_MS       = 5500;
const CYCLE_MS        = INSPIRE_MS + EXPIRE_MS; // 10s per letter
const HARD_TIMER_MS   = 6 * 60 * 1000;           // 6 min hard stop
const RMS_SILENCE     = 0.007;                    // below = silent, skip PCM

// ─── Word bank (4–8 letters, 4 intensity levels) ──────────────────────────────
const WORD_BANK = {
  /** 4 letters — crisis léger (~40s) */
  mild: [
    "DOUX", "PAIX", "BIEN", "FORT", "LIEN", "SOIN", "VRAI", "POSE",
    "SAIN", "BEAU", "CIEL", "REVE",
  ],
  /** 5–6 letters — crisis modérée (~50–60s) */
  moderate: [
    "CALME", "LIBRE", "FORCE", "REPOS", "ANCRE", "DIGNE",
    "APAISE", "SEREIN", "SOLIDE", "LIBERE", "VIVANT", "SOURIS",
    "LUMIER",
  ],
  /** 7–8 letters — crisis sévère (~70–80s) */
  intense: [
    "APAISER", "LIBERER", "SOULAGE", "CALMONS", "RESPIRE", "LIBERTE",
    "SERENITE", "SOLIDITE", "SOULAGER", "APAISONS",
  ],
};

const CRISIS_KEYWORDS = [
  "craquer", "étouffer", "etouffer", "mourir", "panique",
  "urgence", "crise", "pleurer", "hurler", "souffre", "peur",
  "effroi", "terreur", "impossible", "plus",
];
const CALM_KEYWORDS = [
  "fatigué", "fatigue", "lasse", "las", "pas bien", "un peu",
  "légèrement", "legèrement",
];

function selectWord(transcript: string): string {
  const lower = transcript.toLowerCase();
  let level: keyof typeof WORD_BANK = "moderate";
  if (CRISIS_KEYWORDS.some(k => lower.includes(k))) level = "intense";
  else if (CALM_KEYWORDS.some(k => lower.includes(k)))  level = "mild";
  const list = WORD_BANK[level];
  return list[Math.floor(Math.random() * list.length)];
}

// ─── Parametric letter curves ──────────────────────────────────────────────────
// Each variant: t ∈ [0,1] → [x, y] in normalised [0,1]²
// t 0→0.5 = inspire half; t 0.5→1 = expire half
// Paths are abstract — patient doesn't see the letter, only the motion
const CURVE_FNS: Array<(t: number) => [number, number]> = [
  // 0 — Lemniscate horizontale (figure-8)
  t => [
    0.5 + 0.36 * Math.sin(t * Math.PI * 2),
    0.5 + 0.26 * Math.sin(t * Math.PI * 4),
  ],
  // 1 — Cardioid
  t => {
    const θ = t * Math.PI * 2;
    const r = 0.24 * (1 - Math.cos(θ));
    return [0.5 + r * Math.cos(θ - Math.PI / 2), 0.54 + r * Math.sin(θ - Math.PI / 2)];
  },
  // 2 — Rose à 3 pétales
  t => {
    const θ = t * Math.PI * 2;
    const r = 0.31 * Math.cos(3 * θ);
    return [0.5 + r * Math.cos(θ), 0.5 + r * Math.sin(θ)];
  },
  // 3 — Lissajous 3:2
  t => [
    0.5 + 0.36 * Math.sin(3 * t * Math.PI * 2 + Math.PI / 2),
    0.5 + 0.31 * Math.sin(2 * t * Math.PI * 2),
  ],
  // 4 — Trefoil knot (projection)
  t => {
    const θ = t * Math.PI * 2;
    return [
      0.5 + 0.28 * (Math.sin(θ) + 2 * Math.sin(2 * θ)) / 3,
      0.5 + 0.28 * (Math.cos(θ) - 2 * Math.cos(2 * θ)) / 3,
    ];
  },
  // 5 — Epitrochoid
  t => {
    const θ = t * Math.PI * 2;
    const R = 0.22, r = 0.09, d = 0.17;
    return [
      0.5 + (R - r) * Math.cos(θ) + d * Math.cos((R / r - 1) * θ),
      0.5 + (R - r) * Math.sin(θ) - d * Math.sin((R / r - 1) * θ),
    ];
  },
  // 6 — Spirale rentrante
  t => {
    const θ = t * Math.PI * 6;
    const r2 = 0.36 * (1 - t * 0.65);
    return [0.5 + r2 * Math.cos(θ), 0.5 + r2 * Math.sin(θ)];
  },
  // 7 — Hypotrochoid
  t => {
    const θ = t * Math.PI * 2;
    const R = 0.26, r = 0.08, d = 0.19;
    return [
      0.5 + (R - r) * Math.cos(θ) + d * Math.cos(((R - r) / r) * θ),
      0.5 + (R - r) * Math.sin(θ) - d * Math.sin(((R - r) / r) * θ),
    ];
  },
];

const CURVE_POINT_COUNT = 360;

function getCurvePoints(letterIndex: number): [number, number][] {
  const fn = CURVE_FNS[letterIndex % CURVE_FNS.length];
  return Array.from({ length: CURVE_POINT_COUNT }, (_, i) =>
    fn(i / (CURVE_POINT_COUNT - 1))
  );
}

// ─── Audio helpers ────────────────────────────────────────────────────────────
function float32ToPCM16Base64(f32: Float32Array): string {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++)
    i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
  const bytes = new Uint8Array(i16.buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function pcm16Base64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const i16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;
  return f32;
}

function getRMS(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / data.length);
}

// ─── SVG Blob (AI speaking visual) ───────────────────────────────────────────
function AiBlob({ speaking, firstName }: { speaking: boolean; firstName: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ position: "relative" }}>
        {/* Static ambient glow — no JS, no blur recalc */}
        <div style={{
          position: "absolute",
          inset: -32,
          background: "radial-gradient(circle, rgba(0,229,180,0.11) 0%, transparent 68%)",
          borderRadius: "50%",
          pointerEvents: "none",
        }} />
        <svg
          width="230" height="230" viewBox="0 0 230 230"
          style={{ display: "block", willChange: "transform" }}
          aria-hidden
        >
          <defs>
            {/* SVG filter — GPU-accelerated, zero JS per frame */}
            <filter id="sos-blob-f" x="-35%" y="-35%" width="170%" height="170%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.009 0.007"
                numOctaves="3"
                seed="4"
                result="noise"
              >
                <animate
                  attributeName="baseFrequency"
                  values={
                    speaking
                      ? "0.009 0.007;0.020 0.015;0.009 0.007"
                      : "0.009 0.007;0.013 0.010;0.009 0.007"
                  }
                  dur={speaking ? "1.3s" : "3.8s"}
                  repeatCount="indefinite"
                />
                <animate attributeName="seed" values="4;7;12;4" dur="5s" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={speaking ? "32" : "16"}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
            <radialGradient id="sos-blob-g" cx="44%" cy="38%" r="56%">
              <stop offset="0%"   stopColor="#e0faf5" stopOpacity="0.96" />
              <stop offset="28%"  stopColor="#00e5b4" stopOpacity="0.90" />
              <stop offset="62%"  stopColor="#0ea5e9" stopOpacity="0.74" />
              <stop offset="88%"  stopColor="#7c3aed" stopOpacity="0.50" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"    />
            </radialGradient>
          </defs>
          <circle cx="115" cy="115" r="72" fill="url(#sos-blob-g)" filter="url(#sos-blob-f)" />
        </svg>
      </div>
      <p style={{
        color: TEXT_MUTED,
        fontSize: 12,
        letterSpacing: "0.16em",
        fontWeight: 300,
        textTransform: "uppercase",
      }}>
        {firstName}
      </p>
    </div>
  );
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────
interface CompletedLetter {
  points: [number, number][];
  color: string;
}

function renderTraceCanvas(
  canvas: HTMLCanvasElement,
  completed: CompletedLetter[],
  currentPoints: [number, number][],
  progress: number, // 0–1 within current letter
  color: string,
  breathPhase: "inspire" | "expire",
  dpr: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const px = (p: [number, number]): [number, number] => [p[0] * W, p[1] * H];

  // Draw completed letter traces (low opacity)
  for (const lt of completed) {
    if (lt.points.length < 2) continue;
    ctx.beginPath();
    const [x0, y0] = px(lt.points[0]);
    ctx.moveTo(x0, y0);
    for (let i = 1; i < lt.points.length; i++) {
      const [x, y] = px(lt.points[i]);
      ctx.lineTo(x, y);
    }
    ctx.globalAlpha = 0.20;
    ctx.strokeStyle = lt.color;
    ctx.lineWidth = 1.4 * dpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 5 * dpr;
    ctx.shadowColor = lt.color;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  if (currentPoints.length < 2) return;

  const endIdx = Math.min(
    Math.floor(progress * (currentPoints.length - 1)),
    currentPoints.length - 1,
  );

  // Ghost (entire future path)
  ctx.beginPath();
  const [gx0, gy0] = px(currentPoints[0]);
  ctx.moveTo(gx0, gy0);
  for (let i = 1; i < currentPoints.length; i++) {
    const [x, y] = px(currentPoints[i]);
    ctx.lineTo(x, y);
  }
  ctx.globalAlpha = 0.055;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * dpr;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Completed portion
  if (endIdx > 0) {
    ctx.beginPath();
    const [ax0, ay0] = px(currentPoints[0]);
    ctx.moveTo(ax0, ay0);
    for (let i = 1; i <= endIdx; i++) {
      const [x, y] = px(currentPoints[i]);
      ctx.lineTo(x, y);
    }
    ctx.shadowBlur = 10 * dpr;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4 * dpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Guide dot — pulses with breath phase
  const [dx, dy] = px(currentPoints[Math.max(0, endIdx)]);
  const pulse = breathPhase === "inspire" ? 1.15 : 0.88;
  const dotR  = 7 * dpr * pulse;
  const glowR = 28 * dpr * pulse;

  ctx.beginPath();
  ctx.arc(dx, dy, glowR, 0, Math.PI * 2);
  ctx.fillStyle = color + "44";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.shadowBlur = 10 * dpr;
  ctx.shadowColor = color;
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ─── Word reveal ──────────────────────────────────────────────────────────────
function WordReveal({ word, ready }: { word: string; ready: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", gap: 24,
      animation: "sos-fade 0.7s ease",
    }}>
      <div style={{ display: "flex", gap: "clamp(2px,1.8vw,10px)" }}>
        {word.split("").map((ch, i) => (
          <span
            key={i}
            style={{
              fontSize: "clamp(48px, 13vw, 96px)",
              fontWeight: 900,
              letterSpacing: "0.05em",
              color: ready ? LETTER_COLORS[i % LETTER_COLORS.length] : "transparent",
              textShadow: ready
                ? `0 0 28px ${LETTER_COLORS[i % LETTER_COLORS.length]}99, 0 0 56px ${LETTER_COLORS[i % LETTER_COLORS.length]}33`
                : "none",
              opacity: ready ? 1 : 0,
              transform: ready ? "scale(1) translateY(0)" : "scale(0.55) translateY(20px)",
              transition: `all 0.65s cubic-bezier(0.34,1.56,0.64,1) ${i * 110}ms`,
              display: "inline-block",
              userSelect: "none",
            }}
          >
            {ch}
          </span>
        ))}
      </div>
      {ready && (
        <p style={{
          color: TEXT_MUTED, fontSize: 13, letterSpacing: "0.09em",
          animation: "sos-fade 0.5s ease 1.1s both",
        }}>
          Tu l'as tracé toi-même
        </p>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type SOSPhase   = "loading" | "intake" | "tracing" | "reveal" | "transition";
type BreathPhase = "inspire" | "expire";

export interface SOSExerciseProps {
  patientId:       string;
  practitionerId:  string;
  firstName:       string;
  sosContext?:     string;
  onTransitionToChat: (closingText: string) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SOSExercise({
  patientId,
  practitionerId,
  firstName,
  sosContext = "",
  onTransitionToChat,
  onClose,
}: SOSExerciseProps) {
  const { speakTherapeutic, cancelSpeech } = useTherapeuticVoice();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [phase,           setPhase]           = useState<SOSPhase>("loading");
  const [loadError,       setLoadError]       = useState<string | null>(null);
  const [isAiSpeaking,    setIsAiSpeaking]    = useState(false);
  const [isPatientSpeaking, setIsPatientSpeaking] = useState(false);
  const [breathPhase,     setBreathPhase]     = useState<BreathPhase>("inspire");
  const [currentLetterIdx, setCurrentLetterIdx] = useState(0);
  const [completedLetters, setCompletedLetters] = useState<CompletedLetter[]>([]);
  const [chosenWord,      setChosenWord]      = useState("CALME");
  const [revealReady,     setRevealReady]     = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const phaseRef            = useRef<SOSPhase>("loading");
  const wsRef               = useRef<GeminiLiveClient | null>(null);
  const audioCtxRef         = useRef<AudioContext | null>(null);
  const analyserRef         = useRef<AnalyserNode | null>(null);
  const mediaStreamRef      = useRef<MediaStream | null>(null);
  const processorRef        = useRef<ScriptProcessorNode | null>(null);
  const traceCanvasRef      = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef        = useRef<number>(0);
  const dprRef              = useRef(1);

  // Timers
  const hardTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const breathTimerRef      = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Audio queue
  const audioQueueRef       = useRef<{ data: Float32Array; rate: number }[]>([]);
  const isPlayingRef        = useRef(false);
  const onQueueEmptyRef     = useRef<(() => void) | null>(null);

  // Transcription
  const inputTranscriptRef  = useRef("");
  const outputTranscriptRef = useRef("");

  // Tracing
  const chosenWordRef       = useRef("CALME");
  const currentLetterIdxRef = useRef(0);
  const completedLettersRef = useRef<CompletedLetter[]>([]);
  const letterStartTimeRef  = useRef(0);
  const breathPhaseRef      = useRef<BreathPhase>("inspire");
  const isTracingMutedRef   = useRef(false);

  // Flow control
  const greetingDoneRef     = useRef(false);   // first AI turn complete
  const intakeSignalSentRef = useRef(false);   // TCC validation signal sent
  const patientHasSpokenRef = useRef(false);   // patient said something
  const repromptSentRef     = useRef(false);   // gentle re-prompt sent after first silence
  const isAiSpeakingRef     = useRef(false);   // mirrors isAiSpeaking for use in callbacks

  // Stable message handler ref (avoids stale closure on WS onmessage)
  const handleWSMessageRef  = useRef<((evt: { data: string }) => void) | null>(null);

  // Keep refs in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { breathPhaseRef.current = breathPhase; }, [breathPhase]);
  useEffect(() => { isAiSpeakingRef.current = isAiSpeaking; }, [isAiSpeaking]);

  // ── Audio queue ─────────────────────────────────────────────────────────────
  const playNextChunk = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsAiSpeaking(false);
      const cb = onQueueEmptyRef.current;
      if (cb) { onQueueEmptyRef.current = null; cb(); }
      return;
    }
    isPlayingRef.current = true;
    setIsAiSpeaking(true);
    const { data, rate } = audioQueueRef.current.shift()!;
    const buf = ctx.createBuffer(1, data.length, rate);
    buf.getChannelData(0).set(data);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.onended = playNextChunk;
    src.start(0);
  }, []);

  const enqueueAudio = useCallback((b64: string, sr = 24000) => {
    audioQueueRef.current.push({ data: pcm16Base64ToFloat32(b64), rate: sr });
    if (!isPlayingRef.current) playNextChunk();
  }, [playNextChunk]);

  const flushAudio = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current  = false;
    setIsAiSpeaking(false);
  }, []);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    cancelSpeech();
    processorRef.current?.disconnect();
    processorRef.current = null;
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (hardTimerRef.current) clearTimeout(hardTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    breathTimerRef.current.forEach(clearTimeout);
    breathTimerRef.current = [];
    flushAudio();
  }, [cancelSpeech, flushAudio]);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Begin tracing ────────────────────────────────────────────────────────────
  const startLetterAt = useCallback((idx: number, word: string) => {
    if (phaseRef.current !== "tracing") return;
    currentLetterIdxRef.current = idx;
    setCurrentLetterIdx(idx);
    letterStartTimeRef.current = Date.now();

    // Breathing cues via TTS (no Gemini cost, pure local)
    setBreathPhase("inspire");
    breathPhaseRef.current = "inspire";
    speakTherapeutic("Inspire...", { skipPrep: true, rate: 0.70, volume: 0.60 });

    const t1 = setTimeout(() => {
      setBreathPhase("expire");
      breathPhaseRef.current = "expire";
      speakTherapeutic("Expire, relâche...", { skipPrep: true, rate: 0.68, volume: 0.60 });
    }, INSPIRE_MS);
    breathTimerRef.current.push(t1);

    const t2 = setTimeout(() => {
      if (phaseRef.current !== "tracing") return;
      // Letter done: archive it
      const pts = getCurvePoints(idx);
      const col  = LETTER_COLORS[idx % LETTER_COLORS.length];
      const newCompleted = [...completedLettersRef.current, { points: pts, color: col }];
      completedLettersRef.current = newCompleted;
      setCompletedLetters(newCompleted);

      if (idx + 1 < word.length) {
        startLetterAt(idx + 1, word);
      } else {
        // All letters done → reveal
        breathTimerRef.current.forEach(clearTimeout);
        breathTimerRef.current = [];
        cancelSpeech();
        isTracingMutedRef.current = false;
        setPhase("reveal");
        phaseRef.current = "reveal";
        setTimeout(() => setRevealReady(true), 600);

        // Ask Gemini to celebrate (unmuted now)
        setTimeout(() => {
          wsRef.current?.send(JSON.stringify({
            clientContent: {
              turns: [{
                role: "user",
                parts: [{ text: `[Le tracé est terminé. Le mot "${word}" vient d'apparaître sur l'écran lettre par lettre. Félicite ${firstName} chaleureusement, 2 phrases. Puis pose une question de clôture thérapeutique basée sur ce qu'il t'a partagé tout à l'heure. Voix douce et fière.]` }],
              }],
              turnComplete: true,
            },
          }));
        }, 1600);
      }
    }, CYCLE_MS);
    breathTimerRef.current.push(t2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelSpeech, speakTherapeutic, firstName]);

  const beginTracing = useCallback(() => {
    // Select word from what patient said
    const word = selectWord(inputTranscriptRef.current);
    chosenWordRef.current = word;
    setChosenWord(word);
    completedLettersRef.current = [];
    setCompletedLetters([]);

    setPhase("tracing");
    phaseRef.current = "tracing";

    // Mute Gemini
    isTracingMutedRef.current = true;
    wsRef.current?.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: "user",
          parts: [{ text: "[Phase respiration et tracé en cours. Reste silencieux jusqu'à nouvel ordre.]" }],
        }],
        turnComplete: true,
      },
    }));

    // Resize canvas
    const canvas = traceCanvasRef.current;
    if (canvas) {
      const dpr = dprRef.current;
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    }

    startLetterAt(0, word);
  }, [startLetterAt]);

  // ── Signal patient silence → Gemini TCC validation ──────────────────────────
  const triggerIntakeTransition = useCallback(() => {
    if (intakeSignalSentRef.current) return;
    if (phaseRef.current !== "intake") return;
    intakeSignalSentRef.current = true;

    const signal = patientHasSpokenRef.current
      // Patient a parlé → valide + transition vers l'exercice
      ? "[Le patient a terminé de s'exprimer. Valide son émotion chaleureusement en 2-3 phrases. Puis annonce doucement l'exercice respiratoire du tracé — ne révèle pas le mot.]"
      // Patient n'a pas répondu → accueille le silence, guide directement
      : "[Le patient n'a pas répondu. C'est normal. Dis-lui doucement que ce n'est pas grave, qu'il n'a pas besoin de parler, et guide-le directement vers l'exercice respiratoire. 1-2 phrases apaisantes, pas de question.]";

    wsRef.current?.send(JSON.stringify({
      clientContent: {
        turns: [{ role: "user", parts: [{ text: signal }] }],
        turnComplete: true,
      },
    }));
  }, []);

  // ── WS message handler ───────────────────────────────────────────────────────
  const handleWSMessage = useCallback((event: { data: string }) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(event.data) as Record<string, unknown>; }
    catch { return; }

    // ── setupComplete: send greeting ──────────────────────────────────────────
    if (msg.setupComplete !== undefined) {
      wsRef.current?.send(JSON.stringify({
        clientContent: {
          turns: [{
            role: "user",
            parts: [{ text: `[SOS activé pour ${firstName}. Commence l'accueil maintenant. Voix douce et lente. 2-3 phrases max. Termine par une phrase qui invite le patient à se livrer — pas forcément une question, mais quelque chose qui appelle naturellement à parler, comme "Dis-moi ce qui se passe" ou "Je suis là, tu peux tout me dire".]` }],
          }],
          turnComplete: true,
        },
      }));
      return;
    }

    const sc = msg.serverContent as Record<string, unknown> | undefined;
    if (!sc) return;

    // ── Audio chunks ──────────────────────────────────────────────────────────
    const modelTurn = sc.modelTurn as Record<string, unknown> | undefined;
    const parts = modelTurn?.parts as Array<Record<string, unknown>> | undefined;
    if (parts) {
      for (const part of parts) {
        const id = part.inlineData as Record<string, unknown> | undefined;
        if (id?.mimeType && typeof id.mimeType === "string" && id.mimeType.startsWith("audio/pcm")) {
          if (!isTracingMutedRef.current) {
            const sr = parseInt((id.mimeType.match(/rate=(\d+)/)?.[1]) ?? "24000", 10);
            enqueueAudio(id.data as string, sr);
          }
        }
      }
    }

    // ── outputAudioTranscription (what Gemini said) ───────────────────────────
    const outTrans = sc.outputAudioTranscription as Record<string, unknown> | undefined;
    if (outTrans?.text && typeof outTrans.text === "string") {
      const p = phaseRef.current;
      if (p === "reveal" || p === "transition") {
        outputTranscriptRef.current += outTrans.text as string;
      }
    }

    // ── inputTranscription (what patient said) ────────────────────────────────
    const inTrans = sc.inputTranscription as Record<string, unknown> | undefined;
    if (inTrans?.text && typeof inTrans.text === "string") {
      inputTranscriptRef.current += " " + (inTrans.text as string);
    }

    // ── Interrupted by patient ────────────────────────────────────────────────
    if (sc.interrupted === true) flushAudio();

    // ── Turn complete ─────────────────────────────────────────────────────────
    if (sc.turnComplete === true) {
      const p = phaseRef.current;

      if (p === "loading" && !greetingDoneRef.current) {
        // Accueil terminé côté WS — les timers de silence démarreront
        // uniquement quand l'audio aura fini de jouer (useEffect isAiSpeaking)
        greetingDoneRef.current = true;
        setPhase("intake");
        phaseRef.current = "intake";
      } else if (p === "intake" && intakeSignalSentRef.current) {
        // Validation TCC terminée → tracé (idem : audio peut encore jouer, beginTracing attend)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        beginTracing();
      } else if (p === "transition") {
        // Closing turn complete — close after audio finishes
        const doClose = () => {
          const text = outputTranscriptRef.current.trim() || "Je me sens mieux.";
          void fetch("/api/sos/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              patientId,
              practitionerId,
              closingMessage: text,
              word: chosenWordRef.current,
            }),
          }).catch(() => {});
          onTransitionToChat(text);
          cleanup();
        };
        if (!isPlayingRef.current) {
          doClose();
        } else {
          onQueueEmptyRef.current = doClose;
        }
      }
    }
  }, [
    enqueueAudio, flushAudio, firstName,
    triggerIntakeTransition, beginTracing,
    patientId, practitionerId, onTransitionToChat, cleanup,
  ]);

  // Keep handler ref in sync
  useEffect(() => {
    handleWSMessageRef.current = handleWSMessage;
    if (wsRef.current) wsRef.current.onmessage = handleWSMessage;
  }, [handleWSMessage]);

  // ── Silence detection — piloté par isAiSpeaking + isPatientSpeaking ──────────
  //
  // Règle fondamentale : on ne démarre JAMAIS un timer de silence pendant que
  // Gemini parle. turnComplete arrive avant la fin de l'audio → on attend que
  // la file audio soit vide (isAiSpeaking → false) pour commencer à compter.
  //
  // Cas 1 — AI vient de finir de parler en intake
  //   → Si patient n'a pas encore parlé : 6s → relance douce
  //   → Si patient a parlé puis s'est tu (et AI aussi) : 5s → transition TCC
  // Cas 2 — Patient parle → annuler les timers, noter qu'il a parlé
  //   (guard : ne compter que si AI ne parle pas — évite le feedback micro/haut-parleur)
  useEffect(() => {
    if (phase !== "intake") return;

    // Patient speaking — ne compter que si l'IA ne parle pas (feedback micro)
    if (isPatientSpeaking && !isAiSpeakingRef.current) {
      patientHasSpokenRef.current = true;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      return;
    }

    // AI vient de finir de parler (isAiSpeaking passe de true à false)
    if (!isAiSpeaking) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      if (patientHasSpokenRef.current) {
        // Patient a parlé + silence → 5s → transition TCC
        silenceTimerRef.current = setTimeout(() => {
          if (phaseRef.current === "intake") triggerIntakeTransition();
        }, 5000);
      } else if (!repromptSentRef.current && !intakeSignalSentRef.current) {
        // Patient n'a pas encore parlé → 6s → relance douce
        silenceTimerRef.current = setTimeout(() => {
          if (phaseRef.current !== "intake" || patientHasSpokenRef.current || repromptSentRef.current) return;
          repromptSentRef.current = true;
          wsRef.current?.send(JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: "[Le patient n'a pas encore répondu. Relance-le très doucement en une seule phrase, ton bienveillant et sans pression. Même un souffle ou un mot suffit.]" }] }],
              turnComplete: true,
            },
          }));
        }, 6000);
      } else if (repromptSentRef.current && !patientHasSpokenRef.current && !intakeSignalSentRef.current) {
        // Re-prompt terminé, toujours pas de réponse → 8s → exercice
        silenceTimerRef.current = setTimeout(() => {
          if (phaseRef.current === "intake") triggerIntakeTransition();
        }, 8000);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAiSpeaking, isPatientSpeaking, phase]);

  // Transition phase: set it 16s after reveal starts (Gemini has time to speak)
  useEffect(() => {
    if (phase !== "reveal") return;
    const t = setTimeout(() => {
      setPhase("transition");
      phaseRef.current = "transition";
    }, 16000);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Init session ─────────────────────────────────────────────────────────────
  const initSession = useCallback(async () => {
    // 1. Build system prompt
    let systemPrompt =
      `Tu es le Jumeau Numérique de ${firstName}. Mode SOS actif. ` +
      `Parle exclusivement en français, voix douce, lente, bienveillante. ` +
      `Restes concis (2-3 phrases max par tour). Approche TCC.`;
    try {
      const res = await fetch("/api/gemini-live/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, practitionerId }),
      });
      if (res.ok) {
        const d = await res.json() as { systemPrompt?: string };
        if (d.systemPrompt) systemPrompt = d.systemPrompt;
      }
    } catch { /* use default */ }

    if (sosContext?.trim()) {
      systemPrompt += `\n\nCONTEXTE DÉCLENCHEUR :\n${sosContext}`;
    }

    // 2. Mic permission
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
        video: false,
      });
      mediaStreamRef.current = stream;
    } catch {
      setLoadError("Accès au microphone refusé. Active le micro pour cet exercice.");
      return;
    }

    // 3. AudioContext
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    const micSrc = audioCtx.createMediaStreamSource(stream);
    micSrc.connect(analyser);

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const proc = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = proc;
    micSrc.connect(proc);
    proc.connect(audioCtx.destination);

    proc.onaudioprocess = (e: AudioProcessingEvent) => {
      const p = phaseRef.current;
      if (p === "loading" || p === "tracing" || p === "reveal" || p === "transition") return;
      const data = e.inputBuffer.getChannelData(0);
      // RMS silence suppression — don't send silent frames
      if (getRMS(data) < RMS_SILENCE) return;
      const b64 = float32ToPCM16Base64(data);
      wsRef.current?.send(JSON.stringify({
        realtimeInput: { audio: { data: b64, mimeType: "audio/pcm;rate=16000" } },
      }));
    };

    // 4. Open WS
    const ws = new GeminiLiveClient();
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: toVertexModelPath(GEMINI_MODEL),
          generationConfig: {
            responseModalities: ["AUDIO"],
          },
          // Transcription fields at setup level (not inside generationConfig)
          // Vertex AI BidiGenerateContent spec — may be silently ignored if unsupported
          outputAudioTranscription: {},
          inputAudioTranscription:  {},
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
        },
      }));
    };

    ws.onmessage = (evt) => handleWSMessageRef.current?.(evt);

    ws.onerror = () => setLoadError("Connexion Gemini Live échouée.");

    ws.onclose = (evt) => {
      if (phaseRef.current === "loading") {
        setLoadError(`Connexion fermée (${evt.code}). Vérifie ta connexion.`);
      }
    };

    // Hard timer — 6 min max
    hardTimerRef.current = setTimeout(() => cleanup(), HARD_TIMER_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, practitionerId, firstName, sosContext]);

  // ── Mount ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    dprRef.current = window.devicePixelRatio || 1;
    void initSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animation loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const dpr = dprRef.current;

    // Analyser polling (runs every phase for amplitude)
    let t = 0;
    const loop = () => {
      t++;
      animFrameRef.current = requestAnimationFrame(loop);

      // Patient speaking detection from analyser
      if (analyserRef.current) {
        const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(buf);
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
        setIsPatientSpeaking(avg / 60 > 0.12);
      }

      // Tracing phase: draw canvas at 60fps
      if (phaseRef.current === "tracing" && traceCanvasRef.current) {
        const elapsed  = Date.now() - letterStartTimeRef.current;
        const progress = Math.min(1, elapsed / CYCLE_MS);
        const idx      = currentLetterIdxRef.current;
        const pts      = getCurvePoints(idx);
        const col      = LETTER_COLORS[idx % LETTER_COLORS.length];
        renderTraceCanvas(
          traceCanvasRef.current,
          completedLettersRef.current,
          pts,
          progress,
          col,
          breathPhaseRef.current,
          dpr,
        );
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []); // runs once — reads everything via refs

  // ── Render ────────────────────────────────────────────────────────────────────
  const showOrb    = phase === "loading" || phase === "intake";
  const showTrace  = phase === "tracing";
  const showReveal = phase === "reveal";
  const showTrans  = phase === "transition";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "#060810",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        animation: "sos-fade 0.55s ease",
      }}
    >
      {/* Close button (only during loading/intake) */}
      {showOrb && (
        <button
          onClick={() => { cleanup(); onClose(); }}
          aria-label="Fermer"
          style={{
            position: "absolute", top: 18, right: 18, zIndex: 10,
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: TEXT_MUTED, fontSize: 20, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >×</button>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {loadError && (
        <div style={{ maxWidth: 320, textAlign: "center", padding: 28 }}>
          <p style={{ color: "#f87171", fontSize: 15, lineHeight: 1.7, marginBottom: 22 }}>
            {loadError}
          </p>
          <button
            onClick={() => { cleanup(); onClose(); }}
            style={{
              padding: "10px 28px", borderRadius: 10,
              background: "rgba(0,229,180,0.08)",
              border: "1px solid rgba(0,229,180,0.20)",
              color: TEXT_PRIMARY, cursor: "pointer", fontSize: 14,
            }}
          >
            Fermer
          </button>
        </div>
      )}

      {/* ══ INTAKE — Blob IA ═════════════════════════════════════════════════════ */}
      {showOrb && !loadError && (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 36,
        }}>
          <AiBlob speaking={isAiSpeaking} firstName={firstName} />

          <div style={{ textAlign: "center", minHeight: 24 }}>
            {phase === "intake" && !isAiSpeaking && (
              <p style={{
                color: "#00e5b4",
                fontSize: 14, letterSpacing: "0.05em",
                animation: "sos-fade 0.8s ease",
              }}>
                Je t'écoute…
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══ TRACING ══════════════════════════════════════════════════════════════ */}
      {showTrace && (
        <div style={{ position: "absolute", inset: 0 }}>
          <canvas
            ref={traceCanvasRef}
            style={{ width: "100%", height: "100%", display: "block" }}
          />

          {/* Breath label */}
          <div style={{
            position: "absolute", bottom: 56, left: 0, right: 0,
            textAlign: "center",
            pointerEvents: "none",
          }}>
            <p style={{
              fontSize: 20, fontWeight: 300, letterSpacing: "0.20em",
              textTransform: "uppercase",
              color: breathPhase === "inspire"
                ? "rgba(0,229,180,0.82)"
                : "rgba(0,229,180,0.45)",
              transition: "color 0.9s ease",
            }}>
              {breathPhase === "inspire" ? "Inspire" : "Expire"}
            </p>
          </div>

          {/* Letter counter */}
          <div style={{
            position: "absolute", top: 24, left: 0, right: 0,
            textAlign: "center", pointerEvents: "none",
          }}>
            <p style={{ color: TEXT_MUTED, fontSize: 11, letterSpacing: "0.12em" }}>
              {currentLetterIdx + 1} / {chosenWord.length}
            </p>
          </div>
        </div>
      )}

      {/* ══ REVEAL ═══════════════════════════════════════════════════════════════ */}
      {showReveal && (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 0,
          animation: "sos-fade 0.6s ease",
        }}>
          <WordReveal word={chosenWord} ready={revealReady} />
        </div>
      )}

      {/* ══ TRANSITION ═══════════════════════════════════════════════════════════ */}
      {showTrans && (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 32,
          animation: "sos-fade 0.6s ease",
        }}>
          {/* Word fading */}
          <div style={{
            fontSize: "clamp(44px, 12vw, 82px)",
            fontWeight: 900, letterSpacing: "0.08em",
            color: "#00e5b4", opacity: 0.28,
            textShadow: "0 0 28px rgba(0,229,180,0.5)",
            userSelect: "none",
          }}>
            {chosenWord}
          </div>

          {/* Mini blob */}
          <div style={{ transform: "scale(0.7)", marginTop: -16 }}>
            <AiBlob speaking={isAiSpeaking} firstName={firstName} />
          </div>

          <p style={{
            color: TEXT_MUTED, fontSize: 13,
            textAlign: "center", maxWidth: 240, lineHeight: 1.75,
          }}>
            {isAiSpeaking ? "…" : "Partage en quelques mots comment tu te sens"}
          </p>
        </div>
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes sos-fade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sos-pulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.80; }
        }
      `}</style>
    </div>
  );
}
