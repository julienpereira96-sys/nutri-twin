"use client";

/**
 * SOSExercise V2 — Refonte complète
 *
 * Flow: loading → intake → ready → tracing → reveal → transition
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
import ParticleCanvas from "./ParticleCanvas";

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

// ─── Wave Orb (remplace AiBlob) ──────────────────────────────────────────────
function WaveOrb({ speaking, firstName }: { speaking: boolean; firstName?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speakRef  = useRef(speaking);
  speakRef.current = speaking;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const S   = 220;
    c.width   = S * 2; c.height = S * 2;
    const ctx = c.getContext("2d")!;
    let raf: number, t = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      t  += 0.016;
      ctx.clearRect(0, 0, S * 2, S * 2);
      ctx.save();
      ctx.beginPath();
      ctx.arc(S, S, S - 1, 0, Math.PI * 2);
      ctx.clip();

      // Fond uniforme sombre — pas de dégradé décentré qui crée un "cercle intérieur"
      ctx.fillStyle = "rgb(8,14,40)";
      ctx.fillRect(0, 0, S * 2, S * 2);
      // Lueur centrale subtile et CENTRÉE
      const bg = ctx.createRadialGradient(S, S, 0, S, S, S * 0.8);
      bg.addColorStop(0,   "rgba(6,182,212,0.07)");
      bg.addColorStop(1,   "rgba(6,182,212,0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S * 2, S * 2);

      // Couches de vagues remplies
      const spk = speakRef.current;
      const layers = spk
        ? [[13, 2.8, 0, 0.28], [8, 2.0, Math.PI * 0.65, 0.16], [5, 1.4, Math.PI * 1.35, 0.09]]
        : [[ 3, 1.7, 0, 0.18], [2, 1.3, Math.PI * 0.65, 0.11], [1.2, 1.0, Math.PI * 1.35, 0.06]];

      const yBase = S * 1.12;

      for (const [amp, freq, phaseOff, alpha] of layers) {
        ctx.beginPath();
        for (let x = 0; x <= S * 2; x += 3) {
          const y = yBase - (amp as number) * Math.sin(
            (freq as number) * x / (S * 0.44) + t * 2.1 + (phaseOff as number)
          );
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(S * 2, S * 2);
        ctx.lineTo(0, S * 2);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, yBase - (amp as number), 0, S * 2);
        grad.addColorStop(0, `rgba(6,182,212,${alpha as number})`);
        grad.addColorStop(1, `rgba(6,182,212,0.01)`);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.restore();
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []); // lancé une seule fois

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ position: "relative" }}>
        <div style={{
          position: "absolute", inset: -32,
          background: "radial-gradient(circle, rgba(6,182,212,0.11) 0%, transparent 68%)",
          borderRadius: "50%", pointerEvents: "none",
        }} />
        <canvas
          ref={canvasRef}
          style={{
            width: 220, height: 220,
            borderRadius: "50%",
            border: "1px solid rgba(6,182,212,0.18)",
            boxShadow: speaking
              ? "0 0 32px rgba(6,182,212,0.22), 0 0 64px rgba(6,182,212,0.08)"
              : "0 0 14px rgba(6,182,212,0.08)",
            display: "block",
            transition: "box-shadow 0.6s ease",
          }}
        />
      </div>
      <p style={{
        color: TEXT_MUTED, fontSize: 12,
        letterSpacing: "0.16em", fontWeight: 300,
        textTransform: "uppercase",
      }}>
        {firstName}
      </p>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type SOSPhase   = "loading" | "intake" | "ready" | "tracing" | "reveal" | "transition";
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
  const [wsError,         setWsError]         = useState<string | null>(null);
  const [isAiSpeaking,    setIsAiSpeaking]    = useState(false);
  const [isPatientSpeaking, setIsPatientSpeaking] = useState(false);
  const [breathPhase,      setBreathPhase]      = useState<BreathPhase>("inspire");
  const [currentLetterIdx, setCurrentLetterIdx] = useState(0);
  const [chosenWord,       setChosenWord]       = useState("CALME");
  const [expireStart,      setExpireStart]      = useState<number | null>(null);
  const [litLetters,       setLitLetters]       = useState<boolean[]>([]);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const phaseRef            = useRef<SOSPhase>("loading");
  const wsRef               = useRef<GeminiLiveClient | null>(null);
  const audioCtxRef         = useRef<AudioContext | null>(null);
  const analyserRef         = useRef<AnalyserNode | null>(null);
  const mediaStreamRef      = useRef<MediaStream | null>(null);
  const processorRef        = useRef<ScriptProcessorNode | null>(null);
  const animFrameRef        = useRef<number>(0);

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
  const letterStartTimeRef  = useRef(0);
  const breathPhaseRef      = useRef<BreathPhase>("inspire");
  // isTracingMutedRef supprimé — Gemini peut parler pendant le tracé

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

    // Breathing cues via TTS — avec comptage pour occuper toute la durée
    setBreathPhase("inspire");
    breathPhaseRef.current = "inspire";
    speakTherapeutic("Inspire... deux... trois... quatre...", { skipPrep: true, rate: 0.62, volume: 0.55 });

    const t1 = setTimeout(() => {
      setBreathPhase("expire");
      breathPhaseRef.current = "expire";
      setExpireStart(Date.now());
      speakTherapeutic("Expire... deux... trois... quatre... cinq...", { skipPrep: true, rate: 0.60, volume: 0.55 });
    }, INSPIRE_MS);
    breathTimerRef.current.push(t1);

    const t2 = setTimeout(() => {
      if (phaseRef.current !== "tracing") return;

      if (idx + 1 < word.length) {
        startLetterAt(idx + 1, word);
      } else {
        // All letters done → reveal
        breathTimerRef.current.forEach(clearTimeout);
        breathTimerRef.current = [];
        cancelSpeech();
        setPhase("reveal");
        phaseRef.current = "reveal";
        // Illuminate SVG letters after 600ms
        setTimeout(() => setLitLetters(Array(word.length).fill(true)), 600);

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

  // Phase "ready" — Gemini a fini de parler, patient doit toucher l'écran
  const enterReadyPhase = useCallback(() => {
    // Sélection du mot ici (avant le tap) pour ne pas recalculer au tap
    const word = selectWord(inputTranscriptRef.current);
    chosenWordRef.current = word;
    setChosenWord(word);
    setPhase("ready");
    phaseRef.current = "ready";
  }, []);

  const beginTracing = useCallback(() => {
    // Le mot est déjà sélectionné dans enterReadyPhase
    const word = chosenWordRef.current;
    setLitLetters([]);
    setExpireStart(null);

    setPhase("tracing");
    phaseRef.current = "tracing";

    // Gemini reste actif pour donner des encouragements discrets entre les cycles
    // On lui demande de rester très bref pour ne pas couvrir les cues TTS
    wsRef.current?.send(JSON.stringify({
      clientContent: {
        turns: [{
          role: "user",
          parts: [{ text: `[Le tracé respiratoire commence maintenant. Donne de très brefs encouragements entre les souffles — une phrase douce toutes les 2 lettres environ. Les instructions de respiration sont données localement (Inspire/Expire), donc ne les répète pas.]` }],
        }],
        turnComplete: true,
      },
    }));

    startLetterAt(0, word);
  }, [startLetterAt]);

  // ── Signal patient silence → Gemini TCC validation ──────────────────────────
  const triggerIntakeTransition = useCallback(() => {
    if (intakeSignalSentRef.current) return;
    if (phaseRef.current !== "intake") return;
    intakeSignalSentRef.current = true;

    const signal = patientHasSpokenRef.current
      // Patient a parlé → valide + explique l'exercice
      ? "[Le patient a terminé de s'exprimer. Valide son émotion chaleureusement en 1-2 phrases. Puis guide-le vers l'exercice : il va suivre un point lumineux avec sa respiration — inspirer quand il monte, expirer quand il descend. Dis-lui de toucher l'écran quand il est prêt. Voix douce, 3-4 phrases max. Ne révèle pas le mot.]"
      // Patient n'a pas répondu → guide directement, SANS valider une émotion inexistante
      : "[IMPORTANT: Le patient n'a dit aucun mot — zéro. N'accueille AUCUNE émotion, n'utilise pas 'c'est normal de te sentir comme ça' ni aucune formule qui suppose qu'il a exprimé quelque chose. Dis uniquement qu'il n'a pas besoin de parler pour faire l'exercice. Puis guide-le : il va suivre un point lumineux avec sa respiration — inspirer quand il monte, expirer quand il descend. Dis-lui de toucher l'écran quand il est prêt. 2 phrases max, ton doux, pas de question.]";

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
          const sr = parseInt((id.mimeType.match(/rate=(\d+)/)?.[1]) ?? "24000", 10);
          enqueueAudio(id.data as string, sr);
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
        // Validation TCC terminée → attendre fin audio, puis écran "ready" (tap patient)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (!isPlayingRef.current) {
          enterReadyPhase();
        } else {
          onQueueEmptyRef.current = enterReadyPhase;
        }
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
    // NE PAS connecter proc à destination : évite l'écho micro → hauts-parleurs

    proc.onaudioprocess = (e: AudioProcessingEvent) => {
      const p = phaseRef.current;
      if (p === "loading" || p === "ready" || p === "tracing" || p === "reveal" || p === "transition") return;
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

    ws.onerror = () => {
      if (phaseRef.current === "loading") {
        setLoadError("Connexion Gemini Live échouée.");
      } else {
        setWsError("Connexion interrompue.");
      }
    };

    ws.onclose = (evt) => {
      if (phaseRef.current === "loading") {
        setLoadError(`Connexion fermée (${evt.code}). Vérifie ta connexion.`);
      } else if (phaseRef.current !== "transition") {
        // Déconnexion silencieuse en cours d'exercice
        setWsError(`Connexion interrompue (${evt.code}). Tu peux continuer sans la voix.`);
      }
    };

    // Hard timer — 6 min max
    hardTimerRef.current = setTimeout(() => cleanup(), HARD_TIMER_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, practitionerId, firstName, sosContext]);

  // ── Mount ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    void initSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animation loop — analyser polling uniquement ──────────────────────────────
  useEffect(() => {
    const loop = () => {
      animFrameRef.current = requestAnimationFrame(loop);
      if (analyserRef.current) {
        const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(buf);
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length;
        setIsPatientSpeaking(avg / 60 > 0.12);
      }
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []); // lancé une seule fois

  // ── Render ────────────────────────────────────────────────────────────────────
  const showOrb    = phase === "loading" || phase === "intake";
  const showReady  = phase === "ready";
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
      {/* ── ParticleCanvas — toujours monté pendant l'exercice ─────────────────── */}
      <ParticleCanvas
        word={showTrace || showReveal ? chosenWord : null}
        letterColors={LETTER_COLORS.slice(0, chosenWord.length)}
        letterIdx={currentLetterIdx}
        breathPhase={breathPhase}
        expireStart={expireStart}
        isReveal={showReveal}
        litLetters={litLetters}
        EXPIRE_MS={EXPIRE_MS}
      />

      {/* Bouton fermer — toujours visible */}
      <button
        onClick={() => { cleanup(); onClose(); }}
        aria-label="Fermer"
        style={{
          position: "absolute", top: 18, right: 18, zIndex: 20,
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: TEXT_MUTED, fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >×</button>

      {/* Bannière d'erreur WS (déconnexion en cours d'exercice) */}
      {wsError && (
        <div style={{
          position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)",
          zIndex: 20, maxWidth: 300, textAlign: "center",
          background: "rgba(248,113,113,0.10)",
          border: "1px solid rgba(248,113,113,0.28)",
          borderRadius: 12, padding: "10px 16px",
        }}>
          <p style={{ margin: 0, color: "#f87171", fontSize: 13, lineHeight: 1.5 }}>
            {wsError}
          </p>
          <button
            onClick={() => { setWsError(null); void initSession(); }}
            style={{
              marginTop: 8, fontSize: 12,
              background: "none", border: "none",
              color: "#f87171", cursor: "pointer", textDecoration: "underline",
            }}
          >
            Réessayer
          </button>
        </div>
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

      {/* ══ INTAKE — Wave Orb ═══════════════════════════════════════════════════ */}
      {showOrb && !loadError && (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 36,
          position: "relative", zIndex: 5,
        }}>
          <WaveOrb speaking={isAiSpeaking || isPatientSpeaking} firstName={firstName} />

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

      {/* ══ READY — Tap to start ═════════════════════════════════════════════════ */}
      {showReady && (
        <div
          onClick={beginTracing}
          style={{
            position: "absolute", inset: 0, zIndex: 5,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 48, cursor: "pointer",
            animation: "sos-fade 0.6s ease",
          }}
        >
          <WaveOrb speaking={false} firstName={firstName} />

          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 20,
          }}>
            {/* Dot pulsant */}
            <div style={{
              width: 18, height: 18,
              borderRadius: "50%",
              background: "#00e5b4",
              boxShadow: "0 0 0 0 rgba(0,229,180,0.5)",
              animation: "sos-dot-pulse 2s ease-in-out infinite",
            }} />
            <p style={{
              color: TEXT_PRIMARY,
              fontSize: 15,
              letterSpacing: "0.07em",
              textAlign: "center",
              fontWeight: 300,
            }}>
              Toucher l'écran pour commencer
            </p>
          </div>
        </div>
      )}

      {/* ══ TRACING — overlays uniquement (ParticleCanvas gère le visuel) ════════ */}
      {showTrace && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 }}>
          {/* Breath label */}
          <div style={{
            position: "absolute", bottom: 56, left: 0, right: 0,
            textAlign: "center",
          }}>
            <p style={{
              fontSize: 20, fontWeight: 300, letterSpacing: "0.20em",
              textTransform: "uppercase",
              color: breathPhase === "inspire"
                ? "rgba(6,182,212,0.85)"
                : "rgba(6,182,212,0.42)",
              transition: "color 0.9s ease",
            }}>
              {breathPhase === "inspire" ? "Inspire" : "Expire"}
            </p>
          </div>

          {/* Barre de progression lettre en cours */}
          <div style={{
            position: "absolute", bottom: 32, left: "50%",
            transform: "translateX(-50%)",
            width: 180, height: 2,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 2,
          }}>
            <div style={{
              height: "100%",
              background: breathPhase === "inspire"
                ? "rgba(6,182,212,0.70)"
                : "rgba(0,229,180,0.55)",
              borderRadius: 2,
              // La largeur est animée par CSS : expire remplit, inspire se vide
              width: breathPhase === "expire" ? "100%" : "0%",
              transition: breathPhase === "expire"
                ? `width ${EXPIRE_MS}ms linear`
                : `width ${INSPIRE_MS}ms linear`,
            }} />
          </div>

          {/* Letter counter */}
          <div style={{
            position: "absolute", top: 24, left: 0, right: 0,
            textAlign: "center",
          }}>
            <p style={{ color: TEXT_MUTED, fontSize: 11, letterSpacing: "0.12em" }}>
              Lettre {currentLetterIdx + 1} / {chosenWord.length}
            </p>
          </div>
        </div>
      )}

      {/* ══ REVEAL — SVG géré par ParticleCanvas, on ajoute juste le sous-titre ══ */}
      {showReveal && litLetters.some(Boolean) && (
        <p style={{
          position: "absolute", bottom: 72, left: 0, right: 0,
          textAlign: "center",
          color: TEXT_MUTED, fontSize: 13, letterSpacing: "0.09em",
          animation: "sos-fade 0.5s ease 1.6s both",
          zIndex: 6, pointerEvents: "none",
        }}>
          Tu l'as tracé toi-même
        </p>
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

          {/* Mini wave orb */}
          <div style={{ transform: "scale(0.7)", marginTop: -16 }}>
            <WaveOrb speaking={isAiSpeaking} firstName={firstName} />
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
        @keyframes sos-dot-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(0,229,180,0.55); }
          70%  { box-shadow: 0 0 0 14px rgba(0,229,180,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,229,180,0); }
        }
      `}</style>
    </div>
  );
}
