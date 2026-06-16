"use client";

/**
 * SOSExercise — Exercice SOS multimodal Gemini Live
 *
 * Flow :
 *   loading → intake → tracing → reveal → transition
 *
 * Gemini Live gère : accueil personnalisé · écoute patient · transition · clôture
 * TTS local gère   : murmures respiratoires (inspire/expire) pendant le tracé
 *
 * WebSocket direct → Gemini AI Studio (phase test)
 * La clé est en NEXT_PUBLIC — à remplacer par relay WS serveur en prod.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useTherapeuticVoice } from "@/hooks/useTherapeuticVoice";

// ─── Design ───────────────────────────────────────────────────────────────────
const ACCENT       = "#00e5b4";
const ACCENT_GLOW  = "rgba(0,229,180,0.55)";
const ACCENT_DIM   = "rgba(0,229,180,0.08)";
const ACCENT_BORDER= "rgba(0,229,180,0.22)";
const TEXT_PRIMARY = "rgba(255,255,255,0.90)";
const TEXT_MUTED   = "rgba(255,255,255,0.35)";

// ─── Constants ────────────────────────────────────────────────────────────────
const GEMINI_WS_URL    = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";
const GEMINI_MODEL     = "models/gemini-2.0-flash-live-001";
const SOS_WORDS        = ["APAISE", "LIBERE", "CALME", "LIBRE"] as const;
const INSPIRE_MS       = 4000;
const EXPIRE_MS        = 6000;
const CYCLE_MS         = INSPIRE_MS + EXPIRE_MS;  // 10s
const SHORT_EXERCISE   = 40000;  // 4 cycles
const LONG_EXERCISE    = 70000;  // 7 cycles
const SILENCE_TIMEOUT  = 5000;   // auto-advance intake if no audio after 5s
const ABANDON_TIMEOUT  = 20000;  // close if pointer up 20s continuously

// ─── Types ────────────────────────────────────────────────────────────────────
type SOSStatus = "loading" | "intake" | "tracing" | "reveal" | "transition";
type BreathPhase = "inspire" | "expire";

export interface SOSExerciseProps {
  patientId: string;
  practitionerId: string;
  firstName: string;
  /** Called when the closing chat message is ready (transcribed text) */
  onTransitionToChat: (closingText: string) => void;
  onClose: () => void;
}

// ─── Audio helpers ────────────────────────────────────────────────────────────

/** Encode Float32 mic samples → PCM16 → base64 */
function float32ToPCM16Base64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Decode base64 PCM16 → Float32Array */
function pcm16Base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16   = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
  return float32;
}

// ─── Path generator (sine-wave breathwork path) ───────────────────────────────
/**
 * Génère le chemin du tracé : onde sinusoïdale horizontale synchronisée
 * avec le cycle respiratoire (4s monte → inspire, 6s descend → expire).
 * Le chemin parcourt l'écran de gauche à droite sur toute la durée.
 */
function generateTracePath(
  w: number, h: number, durationMs: number, fps = 60
): [number, number][] {
  const totalFrames = Math.round((durationMs / 1000) * fps);
  const framesPerCycle = Math.round((CYCLE_MS / 1000) * fps);
  const inspireFrames  = Math.round((INSPIRE_MS / 1000) * fps);
  const path: [number, number][] = [];

  const margin = w * 0.08;
  const topY   = h * 0.18;
  const botY   = h * 0.82;

  for (let i = 0; i < totalFrames; i++) {
    const x = margin + (w - 2 * margin) * (i / (totalFrames - 1));
    const posInCycle = i % framesPerCycle;
    let y: number;
    if (posInCycle < inspireFrames) {
      // Montée (inspire)
      const t = posInCycle / (inspireFrames - 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      y = botY - (botY - topY) * eased;
    } else {
      // Descente (expire)
      const t = (posInCycle - inspireFrames) / (framesPerCycle - inspireFrames - 1);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      y = topY + (botY - topY) * eased;
    }
    path.push([x, y]);
  }
  return path;
}

// ─── Canvas renderers ─────────────────────────────────────────────────────────

function drawWaveOrb(
  canvas: HTMLCanvasElement,
  amplitude: number,
  t: number,
  isListening: boolean
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width  / dpr;
  const H = canvas.height / dpr;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width  / 2;
  const cy = canvas.height / 2;
  const baseR = Math.min(canvas.width, canvas.height) * 0.28;
  const pulse  = 1 + amplitude * 0.35 * Math.sin(t * 0.003);
  const r = baseR * pulse;

  // Outer glow rings
  for (let i = 3; i >= 1; i--) {
    const ringR = r * (1 + i * 0.22);
    const alpha = isListening ? (0.55 - i * 0.15) * amplitude : (0.18 - i * 0.04);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ringR);
    grad.addColorStop(0, `rgba(0,229,180,${alpha})`);
    grad.addColorStop(1, "rgba(0,229,180,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Core orb
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  coreGrad.addColorStop(0, "rgba(255,255,255,0.92)");
  coreGrad.addColorStop(0.35, "rgba(0,229,180,0.85)");
  coreGrad.addColorStop(1, "rgba(0,229,180,0.08)");
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.fill();

  // Frequency wave around the orb when listening
  if (isListening && amplitude > 0.05) {
    ctx.beginPath();
    const segments = 120;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const noise = 1 + amplitude * 0.25 * Math.sin(i * 5.3 + t * 0.008);
      const rx = cx + r * noise * Math.cos(angle);
      const ry = cy + r * noise * Math.sin(angle);
      i === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(0,229,180,${0.5 * amplitude})`;
    ctx.lineWidth = dpr * 1.5;
    ctx.stroke();
  }
}

function drawTrace(
  canvas: HTMLCanvasElement,
  path: [number, number][],
  progress: number, // 0–1
  paused: boolean,
  dpr: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || path.length === 0) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const currentIdx = Math.min(
    Math.floor(progress * path.length),
    path.length - 1
  );

  // Faint ghost path (entire route)
  ctx.beginPath();
  ctx.moveTo(path[0][0] * dpr, path[0][1] * dpr);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i][0] * dpr, path[i][1] * dpr);
  }
  ctx.strokeStyle = "rgba(0,229,180,0.07)";
  ctx.lineWidth = 1.5 * dpr;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();

  // Completed bright path
  if (currentIdx > 0) {
    ctx.shadowBlur  = 10 * dpr;
    ctx.shadowColor = ACCENT_GLOW;
    ctx.beginPath();
    ctx.moveTo(path[0][0] * dpr, path[0][1] * dpr);
    for (let i = 1; i <= currentIdx; i++) {
      ctx.lineTo(path[i][0] * dpr, path[i][1] * dpr);
    }
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth   = 2.5 * dpr;
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }

  // Cursor (glowing dot)
  if (currentIdx < path.length) {
    const [px, py] = path[currentIdx];
    const cx = px * dpr;
    const cy = py * dpr;

    // Outer glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28 * dpr);
    glow.addColorStop(0, paused ? "rgba(255,200,0,0.7)" : "rgba(0,229,180,0.7)");
    glow.addColorStop(1, "rgba(0,229,180,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, 28 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Inner dot
    ctx.beginPath();
    ctx.arc(cx, cy, 6 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = paused ? "#ffcc00" : "#fff";
    ctx.fill();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SOSExercise({
  patientId,
  practitionerId,
  firstName,
  onTransitionToChat,
  onClose,
}: SOSExerciseProps) {
  const { speakTherapeutic, cancelSpeech } = useTherapeuticVoice();

  // ── Status ────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<SOSStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [chosenWord, setChosenWord] = useState<string>(
    SOS_WORDS[Math.floor(Math.random() * SOS_WORDS.length)]
  );
  const [exerciseDuration, setExerciseDuration] = useState(SHORT_EXERCISE);
  const [breathPhase, setBreathPhase] = useState<BreathPhase>("inspire");
  const [traceProgress, setTraceProgress] = useState(0); // 0–1
  const [tracePaused, setTracePaused] = useState(true);
  const [waveAmplitude, setWaveAmplitude] = useState(0.15);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isPatientSpeaking, setIsPatientSpeaking] = useState(false);
  const [revealReady, setRevealReady] = useState(false);
  const [closingTranscript, setClosingTranscript] = useState("");
  const [geminiReady, setGeminiReady] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const wsRef           = useRef<WebSocket | null>(null);
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const analyserRef     = useRef<AnalyserNode | null>(null);
  const mediaStreamRef  = useRef<MediaStream | null>(null);
  const processorRef    = useRef<ScriptProcessorNode | null>(null);
  const orbCanvasRef    = useRef<HTMLCanvasElement | null>(null);
  const traceCanvasRef  = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef    = useRef<number>(0);
  const tracePathRef    = useRef<[number, number][]>([]);
  const pointerDownRef  = useRef(false);
  const statusRef       = useRef<SOSStatus>("loading");
  const progressRef     = useRef(0);
  const traceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abandonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const breathTimerRef  = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audioQueueRef   = useRef<{ data: Float32Array; rate: number }[]>([]);
  const isPlayingRef    = useRef(false);
  const dprRef          = useRef(1);
  const phaseTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTextRef    = useRef("");
  const intakeStartRef  = useRef(false);

  // Keep refs in sync
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { progressRef.current = traceProgress; }, [traceProgress]);

  // ── Audio playback queue ──────────────────────────────────────────────────
  const playNextChunk = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsAiSpeaking(false);
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

  const enqueueAudio = useCallback((base64: string, sampleRate = 24000) => {
    const float32 = pcm16Base64ToFloat32(base64);
    audioQueueRef.current.push({ data: float32, rate: sampleRate });
    if (!isPlayingRef.current) playNextChunk();
  }, [playNextChunk]);

  const flushAudioQueue = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current  = false;
    setIsAiSpeaking(false);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    cancelSpeech();
    // Stop mic
    processorRef.current?.disconnect();
    processorRef.current = null;
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    // Stop audio ctx
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    // Close WS
    wsRef.current?.close();
    wsRef.current = null;
    // Cancel animation
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    // Clear all timers
    [traceTimerRef, abandonTimerRef, silenceTimerRef, phaseTimerRef].forEach(r => {
      if (r.current) clearTimeout(r.current);
    });
    breathTimerRef.current.forEach(clearTimeout);
    breathTimerRef.current = [];
    flushAudioQueue();
  }, [cancelSpeech, flushAudioQueue]);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── WS message handler ────────────────────────────────────────────────────
  const handleWSMessage = useCallback((event: MessageEvent) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(event.data as string) as Record<string, unknown>; }
    catch { return; }

    // Setup complete → trigger AI greeting
    if (msg.setupComplete !== undefined) {
      setGeminiReady(true);
      // Kick off the greeting
      wsRef.current?.send(JSON.stringify({
        client_content: {
          turns: [{
            role: "user",
            parts: [{ text: `[SOS activé pour ${firstName}. Commence l'accueil maintenant.]` }],
          }],
          turn_complete: true,
        },
      }));
      return;
    }

    const sc = msg.server_content as Record<string, unknown> | undefined;
    if (!sc) return;

    // Audio chunks from Gemini
    const modelTurn = sc.model_turn as Record<string, unknown> | undefined;
    const parts = modelTurn?.parts as Array<Record<string, unknown>> | undefined;
    if (parts) {
      for (const part of parts) {
        const inline = part.inline_data as Record<string, unknown> | undefined;
        if (inline?.mime_type && typeof inline.mime_type === "string" && inline.mime_type.startsWith("audio/pcm")) {
          const rate = parseInt((inline.mime_type.match(/rate=(\d+)/)?.[1]) ?? "24000", 10);
          enqueueAudio(inline.data as string, rate);
        }
      }
    }

    // Transcript of patient speech (closing phase)
    const inputTrans = sc.input_transcription as Record<string, unknown> | undefined;
    if (inputTrans?.text && typeof inputTrans.text === "string") {
      finalTextRef.current = inputTrans.text;
      setClosingTranscript(inputTrans.text);
    }

    // AI turn complete
    if (sc.turn_complete === true) {
      const currentStatus = statusRef.current;

      // If we're still in loading/intake, switch to intake now that greeting done
      if (currentStatus === "loading" || currentStatus === "intake") {
        if (!intakeStartRef.current) {
          intakeStartRef.current = true;
          setStatus("intake");
          // Start silence timer — after 5s without patient audio, auto-advance
          silenceTimerRef.current = setTimeout(() => {
            if (statusRef.current === "intake") triggerTracingTransition();
          }, SILENCE_TIMEOUT + 8000); // give time for AI greeting first
        } else {
          // Patient spoke and AI responded — now move to tracing
          triggerTracingTransition();
        }
      }

      // If we're in transition (closing question answered), finish
      if (currentStatus === "transition") {
        const text = finalTextRef.current || "Je me sens mieux.";
        onTransitionToChat(text);
        cleanup();
      }
    }

    // Patient interrupted AI → flush queue
    if (sc.interrupted === true) {
      flushAudioQueue();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enqueueAudio, flushAudioQueue, firstName, onTransitionToChat, cleanup]);

  // Needs to be defined as function (not const arrow) because it's referenced in handleWSMessage
  function triggerTracingTransition() {
    if (statusRef.current === "tracing" || statusRef.current === "reveal" || statusRef.current === "transition") return;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    // Ask Gemini to speak the tracing instructions
    wsRef.current?.send(JSON.stringify({
      client_content: {
        turns: [{
          role: "user",
          parts: [{ text: `[Analyse la décharge émotionnelle. Si la crise semble intense, prévois 70 secondes d'exercice. Sinon 40 secondes. Guide maintenant vers l'exercice du tracé. Parle très lentement, voix grave et douce. 3-4 phrases max. Dis-lui de poser son pouce sur le point lumineux qui va apparaître.]` }],
        }],
        turn_complete: true,
      },
    }));

    // The actual tracing phase starts when THIS response finishes (turn_complete will catch it)
    // We set a flag so next turn_complete triggers startTracing
    statusRef.current = "tracing" as SOSStatus; // will be confirmed by setStatus below
    // Give Gemini 12s max to speak the transition, then force start
    phaseTimerRef.current = setTimeout(() => startTracing(), 12000);
  }

  // ── Start tracing ─────────────────────────────────────────────────────────
  const startTracing = useCallback(() => {
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    setStatus("tracing");
    setTracePaused(true);

    // Generate path once we know canvas size
    const canvas = traceCanvasRef.current;
    if (canvas) {
      const dpr = dprRef.current;
      const W = canvas.width  / dpr;
      const H = canvas.height / dpr;
      tracePathRef.current = generateTracePath(W, H, exerciseDuration);
    }

    // Breathwork whispers via TTS (local — no Gemini latency)
    const scheduleBreathCycle = (elapsed: number) => {
      if (elapsed >= exerciseDuration) return;
      const phase = (elapsed % CYCLE_MS) < INSPIRE_MS ? "inspire" : "expire";
      const nextMs = phase === "inspire" ? INSPIRE_MS : EXPIRE_MS;
      const timer = setTimeout(() => {
        const nextPhase: BreathPhase = phase === "inspire" ? "expire" : "inspire";
        setBreathPhase(nextPhase);
        speakTherapeutic(
          nextPhase === "expire" ? "Expire, relâche tout..." : "Inspire...",
          { skipPrep: true, rate: 0.72, volume: 0.65 }
        );
        scheduleBreathCycle(elapsed + nextMs);
      }, nextMs);
      breathTimerRef.current.push(timer);
    };

    // First inspire
    setBreathPhase("inspire");
    speakTherapeutic("Inspire...", { skipPrep: true, rate: 0.72, volume: 0.65 });
    scheduleBreathCycle(0);

    // Exercise timer
    traceTimerRef.current = setTimeout(() => {
      finishTracing();
    }, exerciseDuration);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseDuration, speakTherapeutic]);

  // ── Finish tracing → reveal ───────────────────────────────────────────────
  const finishTracing = useCallback(() => {
    breathTimerRef.current.forEach(clearTimeout);
    breathTimerRef.current = [];
    cancelSpeech();
    setTraceProgress(1);
    setTracePaused(true);
    setStatus("reveal");
    setRevealReady(false);

    // Small delay for reveal animation
    setTimeout(() => setRevealReady(true), 400);

    // Ask Gemini to celebrate
    setTimeout(() => {
      wsRef.current?.send(JSON.stringify({
        client_content: {
          turns: [{
            role: "user",
            parts: [{ text: `[Le tracé est terminé. Le mot "${chosenWord}" vient d'apparaître sur l'écran. Félicite le patient chaleureusement, 2 phrases, puis pose ta question de clôture thérapeutique adaptée à ce qu'il a partagé. Voix douce et fière.]` }],
          }],
          turn_complete: true,
        },
      }));
    }, 1500);

    // Switch Gemini to capture final patient voice → transcript
    statusRef.current = "transition";
    setTimeout(() => setStatus("transition"), 15000);
  }, [cancelSpeech, chosenWord]);

  // ── Init WebSocket + Mic ──────────────────────────────────────────────────
  const initSession = useCallback(async () => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setLoadError("NEXT_PUBLIC_GEMINI_API_KEY manquante (voir .env.local)");
      return;
    }

    // 1. Fetch context from backend
    let systemPrompt = `Tu es le Jumeau Numérique de ${firstName}. Mode SOS actif. Parle français uniquement, voix douce et lente.`;
    try {
      const res = await fetch("/api/gemini-live/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, practitionerId }),
      });
      if (res.ok) {
        const data = await res.json() as { systemPrompt: string };
        systemPrompt = data.systemPrompt;
      }
    } catch { /* use default prompt */ }

    // 2. Get mic permission
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 }, video: false });
      mediaStreamRef.current = stream;
    } catch {
      setLoadError("Accès au microphone refusé. Active le micro pour cette expérience.");
      return;
    }

    // 3. Create AudioContext for mic capture + playback
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;

    // Analyser for wave visualization
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    const micSource = audioCtx.createMediaStreamSource(stream);
    micSource.connect(analyser);

    // ScriptProcessor for PCM16 encoding
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    micSource.connect(processor);
    processor.connect(audioCtx.destination);

    processor.onaudioprocess = (e: AudioProcessingEvent) => {
      if (statusRef.current === "loading") return;
      if (statusRef.current === "reveal" || statusRef.current === "transition") return;
      const inputData = e.inputBuffer.getChannelData(0);
      const base64 = float32ToPCM16Base64(inputData);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          realtime_input: {
            media_chunks: [{ mime_type: "audio/pcm;rate=16000", data: base64 }],
          },
        }));
      }
    };

    // 4. Open WebSocket
    const ws = new WebSocket(`${GEMINI_WS_URL}?key=${apiKey}`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send setup message
      ws.send(JSON.stringify({
        setup: {
          model: GEMINI_MODEL,
          generation_config: {
            response_modalities: ["AUDIO"],
            speech_config: {
              voice_config: {
                prebuilt_voice_config: { voice_name: "Aoede" },
              },
            },
          },
          input_audio_transcription: {},
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
        },
      }));
    };

    ws.onerror = () => setLoadError("Connexion Gemini Live échouée. Vérifier la clé API.");
    ws.onclose = () => {
      if (statusRef.current !== "transition" && statusRef.current !== "reveal") {
        // Unexpected close
      }
    };
  }, [patientId, practitionerId, firstName]);

  // ── Mount: init session + canvas DPR ─────────────────────────────────────
  useEffect(() => {
    dprRef.current = window.devicePixelRatio || 1;

    const orbCanvas = orbCanvasRef.current;
    const traceCanvas = traceCanvasRef.current;
    const dpr = dprRef.current;

    if (orbCanvas) {
      orbCanvas.width  = orbCanvas.offsetWidth  * dpr;
      orbCanvas.height = orbCanvas.offsetHeight * dpr;
    }
    if (traceCanvas) {
      traceCanvas.width  = traceCanvas.offsetWidth  * dpr;
      traceCanvas.height = traceCanvas.offsetHeight * dpr;
    }

    void initSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wire up WS message handler
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.onmessage = handleWSMessage;
  }, [geminiReady, handleWSMessage]);

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    let t = 0;
    const dpr = dprRef.current;

    const loop = () => {
      t++;
      animFrameRef.current = requestAnimationFrame(loop);

      // Wave amplitude from analyser
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((s, v) => s + v, 0) / data.length;
        const amplitude = Math.min(1, avg / 60);
        setWaveAmplitude(amplitude);
        setIsPatientSpeaking(amplitude > 0.12);
      }

      const currentStatus = statusRef.current;

      // Intake: draw orb on orbCanvas
      if ((currentStatus === "loading" || currentStatus === "intake") && orbCanvasRef.current) {
        drawWaveOrb(orbCanvasRef.current, waveAmplitude, t, isPatientSpeaking);
      }

      // Tracing: advance progress + draw
      if (currentStatus === "tracing" && traceCanvasRef.current) {
        const path = tracePathRef.current;
        if (!pointerDownRef.current) {
          // Pointer up
          setTracePaused(true);
        } else {
          // Advance progress proportionally to fps
          const totalFrames = path.length;
          const increment = 1 / totalFrames;
          const next = Math.min(1, progressRef.current + increment);
          progressRef.current = next;
          setTraceProgress(next);
          setTracePaused(false);
          if (next >= 1) finishTracing();
        }
        drawTrace(traceCanvasRef.current, path, progressRef.current, !pointerDownRef.current, dpr);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, waveAmplitude, isPatientSpeaking]);

  // ── Pointer handlers (touch + mouse) ─────────────────────────────────────
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (statusRef.current !== "tracing") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointerDownRef.current = true;
    if (abandonTimerRef.current) clearTimeout(abandonTimerRef.current);
    if (typeof navigator !== "undefined") navigator.vibrate?.(15);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (statusRef.current !== "tracing") return;
    pointerDownRef.current = false;
    // Abandon if pointer up > 20s
    abandonTimerRef.current = setTimeout(() => {
      if (!pointerDownRef.current && statusRef.current === "tracing") {
        // Gemini says goodbye
        wsRef.current?.send(JSON.stringify({
          client_content: {
            turns: [{
              role: "user",
              parts: [{ text: "[Le patient a arrêté le tracé. Dis-lui doucement que c'est ok, qu'on peut reprendre une autre fois. 1 phrase. Puis ferme la session.]" }],
            }],
            turn_complete: true,
          },
        }));
        setTimeout(() => { cleanup(); onClose(); }, 4000);
      }
    }, ABANDON_TIMEOUT);
  }, [cleanup, onClose]);

  // ── Silence timer restart on patient audio ────────────────────────────────
  useEffect(() => {
    if (status !== "intake") return;
    if (isPatientSpeaking) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    } else {
      // Reset silence timer
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (statusRef.current === "intake") triggerTracingTransition();
      }, SILENCE_TIMEOUT);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPatientSpeaking, status]);

  // ── Render ────────────────────────────────────────────────────────────────
  const showOrb    = status === "loading" || status === "intake";
  const showTrace  = status === "tracing";
  const showReveal = status === "reveal";
  const showTrans  = status === "transition";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "#000",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        animation: "sos-fade-in 0.6s ease",
      }}
    >
      {/* ── Close ──────────────────────────────────────────────────────────── */}
      {(status === "loading" || status === "intake") && (
        <button
          onClick={() => { cleanup(); onClose(); }}
          aria-label="Fermer"
          style={{
            position: "absolute", top: 20, right: 20, zIndex: 10,
            width: 38, height: 38, borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: TEXT_MUTED, fontSize: 20, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >×</button>
      )}

      {/* ══ LOADING ERROR ══════════════════════════════════════════════════════ */}
      {loadError && (
        <div style={{ maxWidth: 340, textAlign: "center", padding: 24 }}>
          <p style={{ color: "#f87171", fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>{loadError}</p>
          <button
            onClick={() => { cleanup(); onClose(); }}
            style={{ padding: "10px 28px", borderRadius: 10, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, color: TEXT_PRIMARY, cursor: "pointer" }}
          >
            Fermer
          </button>
        </div>
      )}

      {/* ══ INTAKE — Orb vocale ════════════════════════════════════════════════ */}
      {showOrb && !loadError && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, position: "relative", zIndex: 1 }}>
          {/* Orb canvas */}
          <div style={{ position: "relative", width: "min(320px, 80vw)", height: "min(320px, 80vw)" }}>
            <canvas
              ref={orbCanvasRef}
              style={{ width: "100%", height: "100%", display: "block" }}
            />
          </div>

          {/* Status text */}
          <div style={{ textAlign: "center" }}>
            {status === "loading" && (
              <p style={{ color: TEXT_MUTED, fontSize: 14, letterSpacing: "0.08em", animation: "sos-pulse 2s ease-in-out infinite" }}>
                Connexion en cours…
              </p>
            )}
            {status === "intake" && (
              <p style={{ color: isPatientSpeaking ? ACCENT : TEXT_MUTED, fontSize: 15, letterSpacing: "0.04em", transition: "color 0.3s" }}>
                {isPatientSpeaking ? "Je t'écoute…" : "Lâche tout au micro"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══ TRACING ════════════════════════════════════════════════════════════ */}
      {showTrace && (
        <div
          style={{ position: "absolute", inset: 0, touchAction: "none", userSelect: "none" }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <canvas
            ref={traceCanvasRef}
            style={{ width: "100%", height: "100%", display: "block" }}
          />

          {/* Breathwork label */}
          <div style={{
            position: "absolute", bottom: 60, left: 0, right: 0,
            textAlign: "center",
            animation: "sos-fade-in 0.4s ease",
          }}>
            <p style={{
              fontSize: 22, fontWeight: 300, letterSpacing: "0.18em",
              color: breathPhase === "inspire" ? "rgba(0,229,180,0.85)" : "rgba(0,229,180,0.5)",
              textTransform: "uppercase",
              transition: "color 0.8s ease",
            }}>
              {breathPhase === "inspire" ? "Inspire" : "Expire"}
            </p>
          </div>

          {/* Pause indicator */}
          {tracePaused && (
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center", pointerEvents: "none",
              animation: "sos-fade-in 0.3s ease",
            }}>
              <p style={{ color: "rgba(255,204,0,0.7)", fontSize: 14, letterSpacing: "0.06em" }}>
                Pose ton pouce pour continuer
              </p>
            </div>
          )}

          {/* Mini wave (bottom) */}
          <div style={{
            position: "absolute", bottom: 20, left: 0, right: 0,
            display: "flex", justifyContent: "center", gap: 3,
          }}>
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} style={{
                width: 3, borderRadius: 2,
                background: ACCENT,
                height: isAiSpeaking ? `${6 + Math.sin(Date.now() * 0.005 + i) * 6}px` : "3px",
                opacity: 0.5,
                transition: "height 0.15s ease",
              }} />
            ))}
          </div>
        </div>
      )}

      {/* ══ REVEAL ═════════════════════════════════════════════════════════════ */}
      {showReveal && (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 0, position: "relative", zIndex: 1,
          animation: "sos-fade-in 0.5s ease",
        }}>
          {/* The word */}
          <div style={{
            fontSize: "clamp(72px, 22vw, 140px)",
            fontWeight: 900,
            letterSpacing: "0.08em",
            color: revealReady ? ACCENT : "transparent",
            textShadow: revealReady
              ? `0 0 40px ${ACCENT_GLOW}, 0 0 80px rgba(0,229,180,0.3), 0 0 160px rgba(0,229,180,0.15)`
              : "none",
            transform: revealReady ? "scale(1)" : "scale(0.5)",
            opacity: revealReady ? 1 : 0,
            transition: "all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
            userSelect: "none",
          }}>
            {chosenWord}
          </div>

          {/* Subtitle */}
          {revealReady && (
            <p style={{
              marginTop: 28,
              color: TEXT_MUTED, fontSize: 14, letterSpacing: "0.06em",
              animation: "sos-fade-in 0.6s ease 0.8s both",
            }}>
              Tu l'as tracé toi-même
            </p>
          )}
        </div>
      )}

      {/* ══ TRANSITION ═════════════════════════════════════════════════════════ */}
      {showTrans && (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 28, position: "relative", zIndex: 1,
          animation: "sos-fade-in 0.6s ease",
        }}>
          {/* Word fading */}
          <div style={{
            fontSize: "clamp(48px, 14vw, 90px)",
            fontWeight: 900, letterSpacing: "0.08em",
            color: ACCENT, opacity: 0.35,
            textShadow: `0 0 30px ${ACCENT_GLOW}`,
            userSelect: "none",
          }}>
            {chosenWord}
          </div>

          {/* Orb mini */}
          <div style={{
            width: "min(200px, 50vw)", height: "min(200px, 50vw)",
            position: "relative",
          }}>
            <canvas
              ref={orbCanvasRef}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

          <p style={{ color: TEXT_MUTED, fontSize: 14, textAlign: "center", maxWidth: 260, lineHeight: 1.7 }}>
            {closingTranscript
              ? "Merci. Ton jumeau prend le relais dans le chat."
              : "Partage en quelques mots comment tu te sens maintenant…"}
          </p>

          {closingTranscript && (
            <button
              onClick={() => { onTransitionToChat(closingTranscript); cleanup(); }}
              style={{
                padding: "12px 32px", borderRadius: 12,
                background: ACCENT, border: "none",
                color: "#000", fontSize: 15, fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Continuer dans le chat →
            </button>
          )}
        </div>
      )}

      {/* ── Keyframes ──────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes sos-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sos-pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
