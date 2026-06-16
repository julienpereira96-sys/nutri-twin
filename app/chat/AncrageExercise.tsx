"use client";

/**
 * AncrageExercise — Technique sensorielle 5-4-3-2-1 (Phase 2 — Gemini Live)
 *
 * Objectif clinique : stopper dissociation / angoisse aiguë / obsession TCA
 * en forçant le système cognitif à scanner l'environnement réel via les 5 sens,
 * saturant la mémoire de travail pour éteindre la rumination.
 *
 * Architecture Phase 2 :
 *   - Gemini Live WebSocket gère accueil + questions + validations + cloture
 *   - Server-side VAD de Gemini Live : détecte quand le patient a fini de parler
 *   - Mic actif dès que Gemini a terminé de parler sa question
 *   - geminiTurnCountRef suit les turn_complete → avance la machine d'état
 *   - outputTransRef capture les mots de clôture → injection chat à 0 coût
 *
 * State machine : loading → sight_5 → touch_4 → hearing_3 → smell_2 → taste_1 → cloture
 * Hard stop : 3 minutes
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Design tokens — Terre / Ocre ─────────────────────────────────────────────
const BG_DEEP      = "#080501";
const OCHRE        = "#d4a255";
const OCHRE_DIM    = "rgba(212,162,85,0.11)";
const OCHRE_GLOW   = "rgba(212,162,85,0.42)";
const OCHRE_BORD   = "rgba(212,162,85,0.28)";
const OCHRE_SOFT   = "rgba(212,162,85,0.18)";
const TEXT_WARM    = "rgba(255,248,230,0.88)";
const TEXT_MUTED   = "rgba(255,248,230,0.36)";
const TEXT_FADED   = "rgba(255,248,230,0.16)";

// ─── Gemini Live ──────────────────────────────────────────────────────────────
const GEMINI_WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";
const GEMINI_MODEL  = "models/gemini-2.0-flash-live-001";
const HARD_STOP_MS  = 180_000; // 3 minutes

// ─── State machine ─────────────────────────────────────────────────────────────
type SenseStatus =
  | "loading"
  | "sight_5"
  | "touch_4"
  | "hearing_3"
  | "smell_2"
  | "taste_1"
  | "cloture";

// ─── Config par sens ──────────────────────────────────────────────────────────
interface SenseConfig {
  count: number;
  label: string;
  icon: React.ReactNode;
}

// ─── SVG Icons inline ─────────────────────────────────────────────────────────
function IconEye({ size = 36, color = OCHRE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function IconHand({ size = 36, color = OCHRE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
    </svg>
  );
}

function IconEar({ size = 36, color = OCHRE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 0 1-7 0"/>
      <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 0 0 4 0 2 2 0 0 0-4 0"/>
    </svg>
  );
}

function IconWind({ size = 36, color = OCHRE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
    </svg>
  );
}

function IconDroplet({ size = 36, color = OCHRE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
    </svg>
  );
}

const SENSE_CONFIG: Record<Exclude<SenseStatus, "loading" | "cloture">, SenseConfig> = {
  sight_5:   { count: 5, label: "choses que tu vois",       icon: <IconEye /> },
  touch_4:   { count: 4, label: "sensations que tu ressens", icon: <IconHand /> },
  hearing_3: { count: 3, label: "sons que tu entends",       icon: <IconEar /> },
  smell_2:   { count: 2, label: "odeurs que tu perçois",     icon: <IconWind /> },
  taste_1:   { count: 1, label: "saveur sur ta langue",      icon: <IconDroplet /> },
};

const ACTIVE_SENSES: Exclude<SenseStatus, "loading" | "cloture">[] = [
  "sight_5", "touch_4", "hearing_3", "smell_2", "taste_1",
];

// ─── Indicateur géométrique 5-4-3-2-1 ────────────────────────────────────────
function GeoIndicator({ completedCount }: { completedCount: number }) {
  const nodes = [5, 4, 3, 2, 1];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {nodes.map((n, i) => {
        const done    = i < completedCount;
        const current = i === completedCount;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center" }}>
            {i > 0 && (
              <div style={{
                width: 28, height: 2,
                background: done ? OCHRE : "rgba(255,248,230,0.08)",
                transition: "background 0.5s ease",
              }} />
            )}
            <motion.div
              animate={done
                ? { boxShadow: [`0 0 0px ${OCHRE_GLOW}`, `0 0 14px ${OCHRE_GLOW}`, `0 0 6px ${OCHRE_GLOW}`] }
                : { boxShadow: "0 0 0px rgba(0,0,0,0)" }
              }
              transition={{ repeat: done ? Infinity : 0, duration: 2.5, ease: "easeInOut" }}
              style={{
                width: current ? 48 : 40, height: current ? 48 : 40,
                borderRadius: "50%",
                background: done ? OCHRE_SOFT : current ? OCHRE_DIM : "rgba(255,255,255,0.03)",
                border: `2px solid ${done ? OCHRE : current ? OCHRE_BORD : "rgba(255,255,255,0.07)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.4s ease",
              }}
            >
              {done ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                  stroke={OCHRE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 8 3.5 3.5 6.5-7" />
                </svg>
              ) : (
                <span style={{ fontSize: current ? 18 : 15, fontWeight: 700, color: current ? OCHRE : TEXT_FADED, transition: "all 0.3s ease" }}>
                  {n}
                </span>
              )}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Onde ocre (bas d'écran) ─────────────────────────────────────────────────
function OchreWave({ active }: { active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, height: 40 }}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const baseH = 4 + Math.sin(i * 0.7) * 2;
        const peakH = 10 + Math.sin(i * 1.1) * 14;
        return (
          <motion.div
            key={i}
            style={{ width: 3.5, borderRadius: 2, background: OCHRE }}
            animate={active
              ? { height: [`${baseH}px`, `${peakH}px`, `${baseH}px`], opacity: [0.35, 0.8, 0.35] }
              : { height: "4px", opacity: 0.15 }
            }
            transition={active
              ? { repeat: Infinity, duration: 1.0 + i * 0.09, ease: "easeInOut", delay: i * 0.11 }
              : { duration: 0.4 }
            }
          />
        );
      })}
    </div>
  );
}

// ─── Audio helpers ─────────────────────────────────────────────────────────────
function float32ToPCM16Base64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
  }
  const bytes = new Uint8Array(int16.buffer);
  let b = "";
  for (let i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i]);
  return btoa(b);
}

function pcm16Base64ToFloat32(base64: string): Float32Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
  return f32;
}

// ─── Prompt système ────────────────────────────────────────────────────────────
function buildAncrageSystemPrompt(name: string, contextInfo: string): string {
  return `Tu es le Jumeau Numérique thérapeutique de ${name}. Tu guides un exercice d'ancrage sensoriel 5-4-3-2-1 pour interrompre une rumination ou une envie compulsive.

CONTEXTE PATIENT :
${contextInfo}

EXERCICE — ANCRAGE SENSORIEL 5-4-3-2-1
Objectif : saturer la mémoire de travail avec des perceptions concrètes pour éteindre la rumination.

RÈGLES ABSOLUES :
1. Français uniquement. Voix calme, ancrée, bienveillante.
2. Réponse AUDIO uniquement. Zéro texte.
3. Adapte chaque validation au prénom de ${name}. Sois spécifique et chaleureux.

FLOW EXACT :
• À l'ouverture (turn 1) : accueil 1 phrase chaude + demande à ${name} de citer 5 choses qu'il/elle voit autour de lui/elle. Attends sa réponse.
• Après la vue (turn 2) : valide avec 1 phrase empathique ce qu'il/elle a dit + demande 4 sensations tactiles (température, texture, poids). Attends.
• Après le toucher (turn 3) : valide + demande 3 sons distincts qu'il/elle entend. Attends.
• Après l'ouïe (turn 4) : valide + demande 2 odeurs perçues ou imaginées. Attends.
• Après l'odorat (turn 5) : valide + demande 1 saveur sur la langue. Attends.
• [CLOTURE] → Conclure avec sincérité et chaleur. Félicite ${name} pour ce moment de présence. 2-3 phrases. Invite à reprendre la journée avec cet ancrage.

IMPORTANT : Ne passe JAMAIS au sens suivant sans que le patient ait répondu. Écoute sa réponse et valide ce qu'il/elle a dit spécifiquement.`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface AncrageExerciseProps {
  patientId?: string;
  practitionerId?: string;
  firstName: string;
  sosContext?: string;
  onTransitionToChat?: (summary: string, closing: string) => void;
  onCompleted?: () => void;
  onClose: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AncrageExercise({
  patientId,
  practitionerId,
  firstName,
  sosContext = "",
  onTransitionToChat,
  onCompleted,
  onClose,
}: AncrageExerciseProps) {
  const [status, setStatus]               = useState<SenseStatus>("loading");
  const [completedCount, setCompletedCount] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking]   = useState(false);
  const [isListening, setIsListening]     = useState(false); // mic actif
  const [waveActive, setWaveActive]       = useState(false);
  const [loadError, setLoadError]         = useState<string | null>(null);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const statusRef           = useRef<SenseStatus>("loading");
  const completedCountRef   = useRef(0);
  const geminiTurnCountRef  = useRef(0); // nb de turn_complete reçus
  const wsRef               = useRef<WebSocket | null>(null);
  const audioCtxRef         = useRef<AudioContext | null>(null);
  const processorRef        = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef      = useRef<MediaStream | null>(null);
  const micEnabledRef       = useRef(false);
  const hardStopRef         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioQueueRef       = useRef<{ data: Float32Array; rate: number }[]>([]);
  const isPlayingRef        = useRef(false);
  const outputTransRef      = useRef("");

  const onTransRef   = useRef(onTransitionToChat);
  const onCompRef    = useRef(onCompleted);
  const onCloseRef   = useRef(onClose);
  useEffect(() => { onTransRef.current  = onTransitionToChat; }, [onTransitionToChat]);
  useEffect(() => { onCompRef.current   = onCompleted;        }, [onCompleted]);
  useEffect(() => { onCloseRef.current  = onClose;            }, [onClose]);
  useEffect(() => { statusRef.current   = status;             }, [status]);
  useEffect(() => { completedCountRef.current = completedCount; }, [completedCount]);

  // ─── Audio playback queue ─────────────────────────────────────────────────
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
    audioQueueRef.current.push({ data: pcm16Base64ToFloat32(base64), rate: sampleRate });
    if (!isPlayingRef.current) playNextChunk();
  }, [playNextChunk]);

  const flushAudio = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current  = false;
    setIsAiSpeaking(false);
  }, []);

  // ─── Send text turn to Gemini ─────────────────────────────────────────────
  const sendTurn = useCallback((text: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      client_content: {
        turns: [{ role: "user", parts: [{ text }] }],
        turn_complete: true,
      },
    }));
  }, []);

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (hardStopRef.current) clearTimeout(hardStopRef.current);
    micEnabledRef.current = false;
    processorRef.current?.disconnect();
    processorRef.current = null;
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    flushAudio();
  }, [flushAudio]);

  useEffect(() => () => cleanup(), [cleanup]);

  // ─── Hard stop 3min ──────────────────────────────────────────────────────
  useEffect(() => {
    hardStopRef.current = setTimeout(() => {
      if (statusRef.current !== "cloture") {
        outputTransRef.current = "";
        setStatus("cloture");
        setIsListening(false);
        setTimeout(() => sendTurn("[CLOTURE]"), 300);
      }
    }, HARD_STOP_MS);
    return () => { if (hardStopRef.current) clearTimeout(hardStopRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── WS message handler ──────────────────────────────────────────────────
  const handleWSMessage = useCallback((event: MessageEvent) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(event.data as string) as Record<string, unknown>; }
    catch { return; }

    // Setup complete → déclencher le premier tour
    if (msg.setupComplete !== undefined) {
      sendTurn(`[Bonjour ${firstName}, commence l'accueil et demande les 5 choses vues.]`);
      return;
    }

    const sc = msg.server_content as Record<string, unknown> | undefined;
    if (!sc) return;

    // Chunks audio → lecture
    const parts = (sc.model_turn as Record<string, unknown> | undefined)
      ?.parts as Array<Record<string, unknown>> | undefined;
    if (parts) {
      for (const part of parts) {
        const inline = part.inline_data as Record<string, unknown> | undefined;
        if (inline?.mime_type && typeof inline.mime_type === "string"
            && inline.mime_type.startsWith("audio/pcm")) {
          const rate = parseInt((inline.mime_type.match(/rate=(\d+)/)?.[1]) ?? "24000", 10);
          enqueueAudio(inline.data as string, rate);
        }
      }
    }

    // Transcription sortie (cloture)
    const outTrans = sc.output_transcription as Record<string, unknown> | undefined;
    if (outTrans?.text && typeof outTrans.text === "string") {
      outputTransRef.current += outTrans.text;
    }

    // Tour Gemini terminé
    if (sc.turn_complete === true) {
      geminiTurnCountRef.current += 1;
      const count = geminiTurnCountRef.current;
      const currentStatus = statusRef.current;

      // Cloture terminée → injection chat
      if (currentStatus === "cloture") {
        const closingWords = outputTransRef.current.trim();
        const done = completedCountRef.current;
        const summary = `🪨 Ancrage 5-4-3-2-1 · ${done}/5 sens explorés`;
        setTimeout(() => {
          if (onTransRef.current) {
            onTransRef.current(summary, closingWords);
          } else {
            onCompRef.current?.();
          }
        }, 800);
        return;
      }

      if (count === 1) {
        // Premier tour : Gemini a posé la question vue → afficher sight_5, activer mic
        setStatus("sight_5");
        setWaveActive(true);
        micEnabledRef.current = true;
        setIsListening(true);
        return;
      }

      // Tours suivants : patient a répondu, Gemini a validé + posé la prochaine question
      // On désactive le mic pendant que Gemini parle, puis on le réactive après
      micEnabledRef.current = false;
      setIsListening(false);
      setWaveActive(false);

      const sensesDone = count - 1; // nb de sens complétés
      setCompletedCount(sensesDone);
      completedCountRef.current = sensesDone;
      navigator.vibrate?.([25, 30, 50]);

      if (sensesDone >= ACTIVE_SENSES.length) {
        // Tous les 5 sens validés → cloture
        outputTransRef.current = "";
        setStatus("cloture");
        setTimeout(() => sendTurn("[CLOTURE]"), 400);
      } else {
        // Sens suivant — activer le mic après que Gemini a fini de parler la validation
        const nextSense = ACTIVE_SENSES[sensesDone];
        setStatus(nextSense);
        // Petit délai pour laisser l'audio de validation se terminer
        setTimeout(() => {
          micEnabledRef.current = true;
          setIsListening(true);
          setWaveActive(true);
        }, 800);
      }
    }

    // Patient coupe → flush audio
    if (sc.interrupted === true) flushAudio();
  }, [sendTurn, enqueueAudio, flushAudio, firstName]);

  // ─── Init session ─────────────────────────────────────────────────────────
  const initSession = useCallback(async () => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setLoadError("NEXT_PUBLIC_GEMINI_API_KEY manquante.");
      return;
    }

    // 1. Fetch patient context
    let contextInfo = `Patient : ${firstName}. Exercice d'ancrage sensoriel 5-4-3-2-1.`;
    try {
      const res = await fetch("/api/gemini-live/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: patientId ?? "unknown", practitionerId: practitionerId ?? "unknown" }),
      });
      if (res.ok) {
        const d = await res.json() as { systemPrompt?: string };
        if (d.systemPrompt) contextInfo = d.systemPrompt;
      }
    } catch { /* default */ }

    const enriched = contextInfo + (sosContext ? `\n\nCONTEXTE DÉCLENCHEUR : ${sosContext}` : "");
    const systemPrompt = buildAncrageSystemPrompt(firstName, enriched);

    // 2. Mic
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 }, video: false });
      mediaStreamRef.current = stream;
    } catch {
      setLoadError("Accès micro refusé. Active le micro pour cet exercice.");
      return;
    }

    // 3. AudioContext
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;
    const micSrc = audioCtx.createMediaStreamSource(stream);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const proc = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = proc;
    micSrc.connect(proc);
    proc.connect(audioCtx.destination);

    proc.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!micEnabledRef.current) return;
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;
      const b64 = float32ToPCM16Base64(e.inputBuffer.getChannelData(0));
      wsRef.current.send(JSON.stringify({
        realtime_input: { media_chunks: [{ mime_type: "audio/pcm;rate=16000", data: b64 }] },
      }));
    };

    // 4. WebSocket Gemini Live
    const ws = new WebSocket(`${GEMINI_WS_URL}?key=${apiKey}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: GEMINI_MODEL,
          generation_config: {
            response_modalities: ["AUDIO"],
            speech_config: {
              voice_config: { prebuilt_voice_config: { voice_name: "Aoede" } },
            },
          },
          output_audio_transcription: {},
          input_audio_transcription:  {},
          system_instruction: { parts: [{ text: systemPrompt }] },
        },
      }));
    };

    ws.onmessage = handleWSMessage;
    ws.onerror   = () => setLoadError("Connexion Gemini Live échouée.");
  }, [sosContext, firstName, patientId, practitionerId, handleWSMessage]);

  // Mount → init
  useEffect(() => { void initSession(); }, []); // eslint-disable-line

  // Mettre à jour le handler WS
  useEffect(() => {
    if (wsRef.current) wsRef.current.onmessage = handleWSMessage;
  }, [handleWSMessage]);

  // ─── Sens courant config ──────────────────────────────────────────────────
  const senseKey = status !== "loading" && status !== "cloture"
    ? status as Exclude<SenseStatus, "loading" | "cloture">
    : null;
  const senseConf = senseKey ? SENSE_CONFIG[senseKey] : null;

  const showClose = status === "loading" || senseKey !== null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, background: BG_DEEP,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "space-between",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes earth-pulse {
          0%, 100% { opacity: 0.10; transform: scale(1); }
          50%       { opacity: 0.20; transform: scale(1.07); }
        }
        @keyframes an-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Halo de fond terre ────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)",
          width: "90vw", height: "90vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(180,110,30,0.20) 0%, transparent 65%)",
          animation: "earth-pulse 7s ease-in-out infinite",
        }} />
      </div>

      {/* ── Close ─────────────────────────────────────────────────────────── */}
      {showClose && (
        <button onClick={() => { cleanup(); onCloseRef.current(); }} aria-label="Fermer" style={{
          position: "absolute", top: 20, right: 20,
          width: 34, height: 34, borderRadius: "50%",
          background: OCHRE_DIM, border: `1px solid ${OCHRE_BORD}`,
          color: TEXT_MUTED, fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10,
        }}>×</button>
      )}

      {/* ── Load error ────────────────────────────────────────────────────── */}
      {loadError && (
        <div style={{ maxWidth: 320, textAlign: "center", padding: 24, zIndex: 1 }}>
          <p style={{ color: "#f87171", fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>{loadError}</p>
          <button onClick={() => { cleanup(); onCloseRef.current(); }}
            style={{ padding: "10px 28px", borderRadius: 10, background: OCHRE_DIM, border: `1px solid ${OCHRE_BORD}`, color: TEXT_WARM, cursor: "pointer" }}>
            Fermer
          </button>
        </div>
      )}

      {/* ── Indicateur géométrique (haut) ─────────────────────────────────── */}
      {!loadError && (
        <div style={{ paddingTop: 52, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, zIndex: 1 }}>
          <GeoIndicator completedCount={completedCount} />
          {senseKey && (
            <p style={{ margin: 0, fontSize: 10, color: TEXT_FADED, letterSpacing: 1.3, textTransform: "uppercase" }}>
              {completedCount} / 5 sens explorés
            </p>
          )}
        </div>
      )}

      {/* ══ Contenu central ══════════════════════════════════════════════════ */}
      {!loadError && (
        <AnimatePresence mode="wait">

          {/* ── LOADING ───────────────────────────────────────────────────── */}
          {status === "loading" && (
            <motion.div key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, zIndex: 1 }}
            >
              <motion.div
                animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                style={{
                  width: 68, height: 68, borderRadius: "50%",
                  background: OCHRE_DIM, border: `1.5px solid ${OCHRE_BORD}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 28px ${OCHRE_GLOW}`,
                }}
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                  stroke={OCHRE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="3"/>
                  <line x1="12" y1="8" x2="12" y2="22"/>
                  <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
                </svg>
              </motion.div>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED, letterSpacing: 0.4 }}>
                Connexion en cours…
              </p>
            </motion.div>
          )}

          {/* ── SENS ACTIF ────────────────────────────────────────────────── */}
          {senseConf && (
            <motion.div key={status}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 28, zIndex: 1, width: "100%", maxWidth: 360, padding: "0 28px",
              }}
            >
              {/* Grande icône du sens */}
              <motion.div
                animate={{ boxShadow: [`0 0 0px ${OCHRE_GLOW}`, `0 0 32px ${OCHRE_GLOW}`, `0 0 12px ${OCHRE_GLOW}`] }}
                transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
                style={{
                  width: 88, height: 88, borderRadius: "50%",
                  background: OCHRE_DIM, border: `1.5px solid ${OCHRE_BORD}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {senseConf.icon}
              </motion.div>

              {/* Compteur du sens (grand chiffre) */}
              <div style={{ textAlign: "center" }}>
                <motion.p
                  key={`count-${status}`}
                  initial={{ scale: 1.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  style={{
                    margin: "0 0 4px", fontSize: 56, fontWeight: 700,
                    color: OCHRE, lineHeight: 1, textShadow: `0 0 24px ${OCHRE_GLOW}`,
                  }}
                >
                  {senseConf.count}
                </motion.p>
                <p style={{ margin: 0, fontSize: 12, color: TEXT_FADED, letterSpacing: 1.2, textTransform: "uppercase" }}>
                  {senseConf.label}
                </p>
              </div>

              {/* Indicateur état (Gemini parle / patient répond) */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                {isAiSpeaking ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "flex-end", animation: "an-fade-in 0.3s ease" }}>
                    {[0.6, 1, 0.7, 1.1, 0.5].map((h, i) => (
                      <div key={i} style={{
                        width: 3, borderRadius: 2, background: OCHRE,
                        height: `${6 * h}px`, opacity: 0.65,
                      }} />
                    ))}
                  </div>
                ) : isListening ? (
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                    style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: OCHRE_DIM, border: `1.5px solid ${OCHRE_BORD}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke={OCHRE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                    </svg>
                  </motion.div>
                ) : null}
                <p style={{ margin: 0, fontSize: 11, color: TEXT_FADED }}>
                  {isAiSpeaking ? "Ton Jumeau parle…" : isListening ? "Réponds à voix haute…" : ""}
                </p>
              </div>
            </motion.div>
          )}

          {/* ── CLOTURE ───────────────────────────────────────────────────── */}
          {status === "cloture" && (
            <motion.div key="cloture"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 24, zIndex: 1, textAlign: "center",
                padding: "0 28px", maxWidth: 380, width: "100%",
              }}
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
                style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: OCHRE_SOFT, border: `2px solid ${OCHRE_BORD}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 32px ${OCHRE_GLOW}`,
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke={OCHRE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                style={{
                  width: "100%", background: OCHRE_DIM,
                  border: `1px solid ${OCHRE_BORD}`, borderRadius: 16,
                  padding: "16px 20px",
                }}
              >
                <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: 1.3, color: `rgba(212,162,85,0.6)`, textTransform: "uppercase" }}>
                  Ancrage complété
                </p>
                <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                  {ACTIVE_SENSES.slice(0, completedCount).map((s, i) => {
                    const conf = SENSE_CONFIG[s];
                    return (
                      <motion.div key={s}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 + i * 0.1 }}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          background: OCHRE_SOFT, border: `1px solid ${OCHRE_BORD}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <div style={{ transform: "scale(0.6)" }}>{conf.icon}</div>
                        </div>
                        <span style={{ fontSize: 10, color: TEXT_MUTED }}>{conf.count}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: TEXT_WARM }}
              >
                {isAiSpeaking
                  ? "Ton Jumeau conclut…"
                  : `Magnifique ${firstName}. Ton esprit est de retour dans la pièce.`}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ── Onde ocre (bas d'écran) ───────────────────────────────────────── */}
      {!loadError && (
        <div style={{ paddingBottom: 34, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 1 }}>
          <OchreWave active={waveActive} />
          {status !== "cloture" && (
            <p style={{ margin: 0, fontSize: 10, color: TEXT_FADED, letterSpacing: 1.1, textTransform: "uppercase" }}>
              {isListening ? "Ton Jumeau écoute" : "Jumeau · Présent"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
