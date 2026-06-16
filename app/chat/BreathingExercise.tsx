"use client";

/**
 * BreathingExercise — Cohérence cardiaque guidée (Niveau 1)
 *
 * Gemini Live via WebSocket gère :
 *   • L'accueil personnalisé + consigne posturale (intro)
 *   • Le guidage vocal continu non-monotone ([INSPIRE] / [EXPIRE] triggers)
 *   • La question de checkpoint + écoute vocale de la réponse patient
 *   • La clôture empathique adaptée au contexte
 *
 * CSS Animation gère :
 *   • L'Onde de Pouls — orb 4s inspire / 6s expire
 *   • animation-play-state: paused au checkpoint (sans saccade)
 *
 * Mic : OFF pendant breathing_cycle (patient ne parle pas), ON au checkpoint/cloture
 *
 * State machine : loading → intro → breathing_cycle → checkpoint → cloture
 * Max 3 blocs de 60s · Hard stop à 3m15s
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Design ───────────────────────────────────────────────────────────────────
const ACCENT        = "#10b981";
const ACCENT_GLOW   = "rgba(16,185,129,0.55)";
const ACCENT_DIM    = "rgba(16,185,129,0.10)";
const ACCENT_BORDER = "rgba(16,185,129,0.28)";
const TEXT_MUTED    = "rgba(255,255,255,0.30)";

// ─── Timing CSS variables ─────────────────────────────────────────────────────
// Pour changer le ratio inspire/expire : modifier INSPIRE_DUR + EXPIRE_DUR
// La CSS keyframe est calculée à partir de INSPIRE_DUR / CYCLE_DUR = 40%
const INSPIRE_DUR = 4;   // secondes
const EXPIRE_DUR  = 6;   // secondes
const CYCLE_DUR   = INSPIRE_DUR + EXPIRE_DUR;  // 10s total
const BLOCK_DUR   = 60;  // secondes par palier
const MAX_BLOCKS  = 3;   // paliers max = 3 minutes
const HARD_STOP_MS = (MAX_BLOCKS * BLOCK_DUR + 15) * 1000; // 3m15s
const INSPIRE_PCT  = Math.round((INSPIRE_DUR / CYCLE_DUR) * 100); // 40%

// ─── Gemini Live ──────────────────────────────────────────────────────────────
const GEMINI_WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent";
const GEMINI_MODEL  = "models/gemini-2.0-flash-live-001";

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = "loading" | "intro" | "breathing_cycle" | "checkpoint" | "cloture";

export interface BreathingExerciseProps {
  sosContext: string;
  firstName: string;
  patientId?: string;
  practitionerId?: string;
  onTransitionToChat: (message: string) => void;
  onClose: () => void;
}

// ─── Audio helpers ────────────────────────────────────────────────────────────
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
  const bin  = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const f32   = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
  return f32;
}

// ─── Haptics ──────────────────────────────────────────────────────────────────
function hapticInspire() {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  navigator.vibrate([15, 50, 25, 50, 40]); // crescendo léger
}
function hapticExpire() {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  navigator.vibrate([80, 0, 80]); // décharge apaisante
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildBreathingSystemPrompt(name: string, contextInfo: string): string {
  return `Tu es le Jumeau Numérique thérapeutique de ${name}. Tu guides un exercice de cohérence cardiaque (Niveau 1).

CONTEXTE PATIENT :
${contextInfo}

EXERCICE — COHÉRENCE CARDIAQUE : ${INSPIRE_DUR}s inspire / ${EXPIRE_DUR}s expire
Tu es le métronome humain et thérapeute. Ta voix remplace tout texte à l'écran.

RÈGLES ABSOLUES :
1. Français uniquement. Voix douce, grave, lente — co-régulation parasympathique.
2. Réponse AUDIO uniquement. Zéro texte.
3. Adapte chaque phrase au contexte de ${name}. Ne sois jamais générique.

FLOW PRÉCIS :
• À l'ouverture : accueille ${name} par son prénom (1 phrase chaude). Donne la consigne posturale brève : décroiser les jambes, relâcher les épaules, fermer les yeux si possible. Annonce qu'on commence.
• [INSPIRE] → prononce UNE formule courte pour guider l'inspiration. MAX 4 mots. Varie à chaque fois. Exemples : "Inspire...", "Accueille l'air...", "Ouvre ta poitrine...", "Laisse entrer le calme...", "Inspire profondément..."
• [EXPIRE]  → prononce UNE formule courte pour guider l'expiration. MAX 4 mots. Varie à chaque fois. Exemples : "Expire...", "Laisse partir...", "Relâche tout...", "Vide complètement...", "Souffle vers le sol..."
• NE RÉPÈTE JAMAIS deux fois la même formule de suite. La variété est essentielle.
• [CHECKPOINT] → Pose ta question de checkpoint avec chaleur et empathie (2-3 phrases max). Adapte la formulation selon le cycle (1er ou 2e checkpoint). Écoute la réponse vocale du patient.
  - Si le patient veut CONTINUER : réponds avec bienveillance et termine ta réponse par "On repart ensemble." (ces mots EXACTEMENT en fin de réponse)
  - Si le patient veut STOPPER : réponds avec fierté et termine par "On s'arrête là." (ces mots EXACTEMENT en fin de réponse)
  - Si silence > 5s ou réponse ambiguë : relance doucement. Après 7s total sans réponse claire : conclus par "On s'arrête là."
• [CLOTURE] → Conclus avec sincérité et personnalisation. Félicite ${name} pour ce moment de soin. 2-3 phrases. Invite à reprendre doucement le cours de sa journée.`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BreathingExercise({
  sosContext,
  firstName,
  patientId,
  practitionerId,
  onTransitionToChat,
  onClose,
}: BreathingExerciseProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [status, setStatus]           = useState<Status>("loading");
  const [blockCount, setBlockCount]   = useState(0);      // blocs complétés
  const [animPaused, setAnimPaused]   = useState(true);   // CSS animation-play-state
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [breathPhaseLabel, setBreathPhaseLabel] = useState<"inspire" | "expire" | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const statusRef      = useRef<Status>("loading");
  const blockCountRef  = useRef(0);
  const wsRef          = useRef<WebSocket | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const processorRef   = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const micEnabledRef  = useRef(false);           // mic ON/OFF selon la phase
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef     = useRef(0);               // secondes dans le bloc courant
  const hardStopRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioQueueRef  = useRef<{ data: Float32Array; rate: number }[]>([]);
  const isPlayingRef   = useRef(false);
  const outputTransRef = useRef("");              // transcription de Gemini (checkpoint)

  // Stable refs pour callbacks dans closures
  const onTransitionToChatRef = useRef(onTransitionToChat);
  const onCloseRef            = useRef(onClose);
  useEffect(() => { onTransitionToChatRef.current = onTransitionToChat; }, [onTransitionToChat]);
  useEffect(() => { onCloseRef.current            = onClose;            }, [onClose]);
  useEffect(() => { statusRef.current      = status;      }, [status]);
  useEffect(() => { blockCountRef.current  = blockCount;  }, [blockCount]);

  // ── Audio playback queue ───────────────────────────────────────────────────
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

  // ── Send text turn to Gemini ───────────────────────────────────────────────
  const sendTurn = useCallback((text: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      client_content: {
        turns: [{ role: "user", parts: [{ text }] }],
        turn_complete: true,
      },
    }));
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (hardStopRef.current) clearTimeout(hardStopRef.current);
    intervalRef.current = null;
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

  // ── Hard stop global à 3m15s ───────────────────────────────────────────────
  useEffect(() => {
    hardStopRef.current = setTimeout(() => {
      if (statusRef.current !== "cloture") handleClotureInternal();
    }, HARD_STOP_MS);
    return () => { if (hardStopRef.current) clearTimeout(hardStopRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cloture interne (appelée depuis hard stop ou handleCheckpointDecision) ─
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleClotureInternal = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    micEnabledRef.current = false;
    setAnimPaused(true);
    setStatus("cloture");
    setBreathPhaseLabel(null);
    outputTransRef.current = ""; // Reset pour capturer uniquement les mots de clôture
    // Demande à Gemini de conclure
    setTimeout(() => sendTurn("[CLOTURE]"), 400);
    // Fallback : transition après 12s sans transcription
    setTimeout(() => {
      if (statusRef.current === "cloture") {
        const blocs = blockCountRef.current;
        const msg = `🌿 Cohérence cardiaque · ${blocs} bloc${blocs > 1 ? "s" : ""}`;
        onTransitionToChatRef.current(msg);
      }
    }, 12000);
  }, [sendTurn]);

  // ── Start a 60s breathing block ────────────────────────────────────────────
  const startBreathingBlock = useCallback(() => {
    elapsedRef.current = 0;
    micEnabledRef.current = false;   // mic OFF pendant le souffle
    setAnimPaused(false);
    setStatus("breathing_cycle");

    // Premier inspire immédiat
    hapticInspire();
    sendTurn("[INSPIRE]");
    setBreathPhaseLabel("inspire");

    intervalRef.current = setInterval(() => {
      elapsedRef.current += 1;
      const pos = elapsedRef.current % CYCLE_DUR;

      if (pos === INSPIRE_DUR) {
        hapticExpire();
        sendTurn("[EXPIRE]");
        setBreathPhaseLabel("expire");
      } else if (pos === 0) {
        hapticInspire();
        sendTurn("[INSPIRE]");
        setBreathPhaseLabel("inspire");
      }

      if (elapsedRef.current >= BLOCK_DUR) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        goToCheckpointInternal();
      }
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendTurn]);

  // ── Checkpoint ────────────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const goToCheckpointInternal = useCallback(() => {
    const newCount = blockCountRef.current + 1;
    blockCountRef.current = newCount;
    setBlockCount(newCount);

    setAnimPaused(true);
    setStatus("checkpoint");
    setBreathPhaseLabel(null);
    outputTransRef.current = "";

    // Activer le mic pour que le patient puisse répondre
    micEnabledRef.current = true;

    sendTurn("[CHECKPOINT]");
  }, [sendTurn]);

  // Refs stables pour éviter stale closures dans setInterval
  const goToCheckpointRef    = useRef(goToCheckpointInternal);
  const handleClotureRef     = useRef(handleClotureInternal);
  const startBreathingRef    = useRef(startBreathingBlock);
  useEffect(() => { goToCheckpointRef.current  = goToCheckpointInternal; }, [goToCheckpointInternal]);
  useEffect(() => { handleClotureRef.current   = handleClotureInternal;  }, [handleClotureInternal]);
  useEffect(() => { startBreathingRef.current  = startBreathingBlock;    }, [startBreathingBlock]);

  // ── Parse checkpoint decision from Gemini output transcription ─────────────
  const checkCheckpointDecision = useCallback((text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes("on repart")) {
      // Continuer
      micEnabledRef.current = false;
      if (blockCountRef.current >= MAX_BLOCKS) {
        handleClotureRef.current();
      } else {
        setTimeout(() => startBreathingRef.current(), 1200);
      }
    } else if (lower.includes("on s'arrête")) {
      // Victoire
      micEnabledRef.current = false;
      setTimeout(() => handleClotureRef.current(), 1200);
    }
  }, []);

  // ── WS message handler ────────────────────────────────────────────────────
  const handleWSMessage = useCallback((event: MessageEvent) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(event.data as string) as Record<string, unknown>; }
    catch { return; }

    // Setup complete → déclencher l'accueil Gemini
    if (msg.setupComplete !== undefined) {
      setStatus("intro");
      sendTurn(`[Bonjour ${firstName}, commence l'accueil et la consigne posturale maintenant.]`);
      return;
    }

    const sc = msg.server_content as Record<string, unknown> | undefined;
    if (!sc) return;

    // Chunks audio de Gemini → lecture
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

    // Transcription sortie de Gemini (utilisée au checkpoint)
    const outTrans = sc.output_transcription as Record<string, unknown> | undefined;
    if (outTrans?.text && typeof outTrans.text === "string") {
      outputTransRef.current += outTrans.text;
    }

    // Tour Gemini terminé
    if (sc.turn_complete === true) {
      const currentStatus = statusRef.current;

      // Intro terminée → démarrer le premier bloc
      if (currentStatus === "intro") {
        setTimeout(() => startBreathingRef.current(), 600);
        return;
      }

      // Checkpoint : analyser la décision de Gemini
      if (currentStatus === "checkpoint") {
        checkCheckpointDecision(outputTransRef.current);
        return;
      }

      // Cloture terminée → injecter le résumé dans le chat
      if (currentStatus === "cloture") {
        const closingWords = outputTransRef.current.trim();
        const blocs = blockCountRef.current;
        const message = `🌿 Cohérence cardiaque · ${blocs} bloc${blocs > 1 ? "s" : ""}${closingWords ? `\n\n${closingWords}` : ""}`;
        setTimeout(() => onTransitionToChatRef.current(message), 1000);
      }
    }

    // Patient coupe → flush audio Gemini
    if (sc.interrupted === true) flushAudio();

  }, [sendTurn, enqueueAudio, flushAudio, checkCheckpointDecision, firstName]);

  // ── Init session ───────────────────────────────────────────────────────────
  const initSession = useCallback(async () => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setLoadError("NEXT_PUBLIC_GEMINI_API_KEY manquante.");
      return;
    }

    // 1. Fetch patient context
    let contextInfo = `Patient : ${firstName}. Exercice de cohérence cardiaque.`;
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

    // Intégrer le sosContext au prompt
    const enriched = contextInfo + (sosContext ? `\n\nCONTEXTE DÉCLENCHEUR : ${sosContext}` : "");
    const systemPrompt = buildBreathingSystemPrompt(firstName, enriched);

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

    const micSrc  = audioCtx.createMediaStreamSource(stream);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const proc    = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = proc;
    micSrc.connect(proc);
    proc.connect(audioCtx.destination);

    proc.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!micEnabledRef.current) return;   // silence pendant le souffle
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
  }, [sosContext, firstName, handleWSMessage]);

  // Mount → init
  useEffect(() => { void initSession(); }, []); // eslint-disable-line

  // Mettre à jour le handler WS quand il change
  useEffect(() => {
    if (wsRef.current) wsRef.current.onmessage = handleWSMessage;
  }, [handleWSMessage]);

  // ── Close (avant premier checkpoint = interrompu) ──────────────────────────
  const handleClose = useCallback(() => {
    // TODO: si blockCount === 0 → log silencieux "interrompu"
    cleanup();
    onCloseRef.current();
  }, [cleanup]);

  // ─── Render ───────────────────────────────────────────────────────────────
  const showClose = status === "loading" || status === "intro" || status === "checkpoint";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "#030a06",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        animation: "br-fade-in 0.5s ease",
      }}
    >
      {/* ── Close ─────────────────────────────────────────────────────────── */}
      {showClose && (
        <button
          onClick={handleClose}
          aria-label="Fermer"
          style={{
            position: "absolute", top: 20, right: 20, zIndex: 10,
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: TEXT_MUTED, fontSize: 20, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >×</button>
      )}

      {/* ── Load error ────────────────────────────────────────────────────── */}
      {loadError && (
        <div style={{ maxWidth: 320, textAlign: "center", padding: 24 }}>
          <p style={{ color: "#f87171", fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>{loadError}</p>
          <button onClick={handleClose} style={{ padding: "10px 28px", borderRadius: 10, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, color: "rgba(255,255,255,0.8)", cursor: "pointer" }}>
            Fermer
          </button>
        </div>
      )}

      {/* ── Halo ambiant permanent ────────────────────────────────────────── */}
      {!loadError && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at center, rgba(16,185,129,0.04) 0%, transparent 65%)",
        }} />
      )}

      {/* ══ ORB PRINCIPALE ═════════════════════════════════════════════════
          Présente depuis le loading (dim), s'anime en breathing_cycle.
          animation-play-state: paused = gel propre sans saccade.
      ══════════════════════════════════════════════════════════════════════ */}
      {!loadError && (
        <div style={{ position: "relative", zIndex: 1, width: 240, height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Anneau externe — pulse lent */}
          <div style={{
            position: "absolute", width: "100%", height: "100%",
            borderRadius: "50%",
            border: "1px solid rgba(16,185,129,0.10)",
            animation: "br-ring 5s ease-in-out infinite",
            animationPlayState: animPaused ? "paused" : "running",
          }} />

          {/* Orb */}
          <div style={{
            width: 200, height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle at 42% 42%, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0.06) 55%, transparent 100%)",
            border: `1.5px solid ${ACCENT_BORDER}`,
            boxShadow: `0 0 40px rgba(16,185,129,0.28), 0 0 90px rgba(16,185,129,0.12), 0 0 180px rgba(16,185,129,0.05)`,
            animationName: "br-breathe",
            animationDuration: `${CYCLE_DUR}s`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationPlayState: animPaused ? "paused" : "running",
            opacity: (status === "loading" || status === "cloture") ? 0.35 : 1,
            transition: "opacity 1.4s ease",
          }} />

          {/* Indicateur AI parle — mini-wave sous l'orb */}
          {isAiSpeaking && (
            <div style={{
              position: "absolute", bottom: -28,
              display: "flex", gap: 4, alignItems: "flex-end",
              animation: "br-fade-in 0.3s ease",
            }}>
              {[0.6, 1, 0.7, 1.1, 0.5].map((h, i) => (
                <div key={i} style={{
                  width: 3, borderRadius: 2, background: ACCENT,
                  height: `${6 * h}px`, opacity: 0.6,
                  animation: `br-wave-bar 0.8s ease-in-out ${i * 0.12}s infinite alternate`,
                }} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Compteur de blocs (breathing_cycle only) ──────────────────────── */}
      {status === "breathing_cycle" && (
        <div style={{ position: "absolute", top: 28, display: "flex", gap: 8 }}>
          {Array.from({ length: MAX_BLOCKS }, (_, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: "50%",
              background: i < blockCount ? ACCENT : "rgba(16,185,129,0.18)",
              transition: "background 0.5s",
            }} />
          ))}
        </div>
      )}

      {/* ── Breath phase label ────────────────────────────────────────────── */}
      {status === "breathing_cycle" && breathPhaseLabel && (
        <p key={breathPhaseLabel} style={{
          position: "absolute", bottom: 80,
          margin: 0, fontSize: 17, fontWeight: 300,
          letterSpacing: "0.20em", textTransform: "uppercase",
          color: "rgba(16,185,129,0.68)",
          animation: "br-fade-in 0.3s ease",
          pointerEvents: "none",
        }}>
          {breathPhaseLabel === "inspire" ? "Inspire" : "Expire"}
        </p>
      )}

      {/* ── Hint "yeux fermés" (disparaît après 5s) ─────────────────────── */}
      {status === "breathing_cycle" && (
        <p style={{
          position: "absolute", bottom: 40,
          fontSize: 12, color: "rgba(16,185,129,0.22)",
          letterSpacing: "0.06em", textAlign: "center",
          animation: "br-fade-out 5s ease forwards",
          pointerEvents: "none",
        }}>
          Tu peux fermer les yeux
        </p>
      )}

      {/* ── Status loading ────────────────────────────────────────────────── */}
      {(status === "loading") && !loadError && (
        <p style={{
          position: "absolute", bottom: 60,
          fontSize: 13, color: TEXT_MUTED,
          letterSpacing: "0.08em",
          animation: "br-blink 2s ease-in-out infinite",
        }}>
          Connexion en cours…
        </p>
      )}

      {/* ── Checkpoint — micro ouvert, Gemini écoute ─────────────────────── */}
      {status === "checkpoint" && (
        <div style={{
          position: "absolute", bottom: 50,
          display: "flex", alignItems: "center", gap: 10,
          animation: "br-fade-in 0.4s ease",
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#f87171",
            animation: "br-blink 1.2s ease-in-out infinite",
            boxShadow: "0 0 8px rgba(248,113,113,0.6)",
          }} />
          <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED }}>
            Réponds à voix haute…
          </p>
        </div>
      )}

      {/* ── Keyframes ─────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes br-breathe {
          0%          { transform: scale(1.0); box-shadow: 0 0 40px rgba(16,185,129,0.28), 0 0 90px rgba(16,185,129,0.10); }
          ${INSPIRE_PCT}% { transform: scale(1.5); box-shadow: 0 0 90px rgba(16,185,129,0.65), 0 0 180px rgba(16,185,129,0.28), 0 0 360px rgba(16,185,129,0.08); }
          100%        { transform: scale(1.0); box-shadow: 0 0 40px rgba(16,185,129,0.28), 0 0 90px rgba(16,185,129,0.10); }
        }
        @keyframes br-ring {
          0%, 100% { transform: scale(1);    opacity: 0.35; }
          50%       { transform: scale(1.06); opacity: 0.60; }
        }
        @keyframes br-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes br-fade-out {
          0%   { opacity: 0.55; }
          70%  { opacity: 0.30; }
          100% { opacity: 0; }
        }
        @keyframes br-blink {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.85; }
        }
        @keyframes br-wave-bar {
          from { transform: scaleY(0.5); }
          to   { transform: scaleY(1.5); }
        }
      `}</style>
    </div>
  );
}
