"use client";

/**
 * DefusionExercise — Défusion cognitive ACT (Phase 2 — Gemini Live)
 *
 * Principe ACT : on ne débat pas avec la pensée, on change son statut.
 * La pensée devient un objet graphique (nuage) que le patient repousse physiquement.
 *
 * Architecture Phase 2 :
 *   - Gemini Live WebSocket pour la guidance vocale continue
 *   - input_audio_transcription capture la phrase de crise dite à l'oral
 *   - Patient peut aussi écrire (textarea fallback)
 *   - Boutons patient-paced aux checkpoints (robuste, zéro latence)
 *   - output_audio_transcription de la cloture → injection chat à 0 coût
 *
 * State machine :
 *   intro_live    → Gemini pose la question vocalement, patient dit/écrit sa phrase
 *   cloud_display → La phrase matérialisée en nuage, consigne orale de swipe
 *   swiping       → Patient swipe le nuage vers le haut (drag-Y framer-motion)
 *   checkpoint    → Gemini pose la question vocalement, patient choisit un bouton
 *   cloture       → Gemini conclut, capture output_trans → injection chat
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  AnimatePresence,
  type PanInfo,
} from "framer-motion";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BG_DEEP      = "#06030f";
const VIOLET       = "#8b5cf6";
const VIOLET_DIM   = "rgba(139,92,246,0.12)";
const VIOLET_GLOW  = "rgba(139,92,246,0.45)";
const VIOLET_BORD  = "rgba(139,92,246,0.30)";
const VIOLET_SOFT  = "rgba(139,92,246,0.18)";
const INDIGO       = "#6366f1";
const CLOUD_BG     = "rgba(88,40,180,0.22)";
const CLOUD_BORD   = "rgba(139,92,246,0.38)";
const TEXT_PRIMARY = "rgba(255,255,255,0.90)";
const TEXT_MUTED   = "rgba(255,255,255,0.40)";
const TEXT_FADED   = "rgba(255,255,255,0.18)";

// ─── Gemini Live ──────────────────────────────────────────────────────────────
const GEMINI_WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const GEMINI_MODEL  = "models/gemini-3.1-flash-live-preview";

const MAX_CLOUDS      = 3;
const EJECT_THRESHOLD = -280;

// ─── Types ─────────────────────────────────────────────────────────────────────
type Status =
  | "intro_live"
  | "cloud_display"
  | "swiping"
  | "checkpoint"
  | "cloture";

export interface DefusionExerciseProps {
  patientId: string;
  practitionerId: string;
  firstName: string;
  sosContext?: string;
  onTransitionToChat: (evacuatedThoughts: string[], closing: string) => void;
  onClose: () => void;
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
function buildDefusionSystemPrompt(name: string, contextInfo: string): string {
  return `Tu es le Jumeau Numérique thérapeutique de ${name}. Tu guides un exercice de défusion cognitive (ACT).

CONTEXTE PATIENT :
${contextInfo}

EXERCICE — DÉFUSION COGNITIVE ACT
Principe : la pensée devient un objet qu'on observe, pas une vérité qu'on combat.

RÈGLES ABSOLUES :
1. Français uniquement. Voix douce, présente, sans jugement.
2. Réponse AUDIO uniquement. Zéro texte.
3. Ne dure jamais plus de 2-3 phrases par tour.

FLOW EXACT :
• [DEBUT] → Accueil 1 phrase + demande à ${name} de dire ou écrire la pensée exacte qui prend toute la place dans sa tête. Attends.
• [PHRASE_RECUE] → Confirme en 1 phrase que tu as entendu la pensée. Explique que dans quelques secondes elle va apparaître comme un nuage à repousser. Voix apaisante.
• [CHECKPOINT] → "Le nuage est passé. Est-ce qu'il y a une autre pensée qui te retient, ou est-ce que ça commence à s'alléger ?" Voix douce. Attends la réponse du patient (il choisira par un bouton).
• [CLOTURE] → Conclus avec sincérité et chaleur. Rappelle que ces pensées sont des mots, pas des faits. Félicite ${name} pour ce travail de prise de recul. 2-3 phrases.`;
}

// ─── Composant Nuage ──────────────────────────────────────────────────────────
function Cloud({ phrase, cloudIndex, onEjected }: { phrase: string; cloudIndex: number; onEjected: () => void }) {
  const y       = useMotionValue(0);
  const ejected = useRef(false);

  const scale      = useTransform(y, [0, EJECT_THRESHOLD], [1, 0.18]);
  const opacity    = useTransform(y, [0, EJECT_THRESHOLD * 0.75], [1, 0]);
  const blurVal    = useTransform(y, [0, EJECT_THRESHOLD], [0, 14]);
  const filter     = useTransform(blurVal, (v) => `blur(${v}px)`);
  const borderColor = useTransform(
    y,
    [0, EJECT_THRESHOLD * 0.5],
    [CLOUD_BORD, "rgba(103,232,249,0.55)"]
  );

  const handleDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (ejected.current) return;
      if (y.get() < EJECT_THRESHOLD || info.velocity.y < -600) {
        ejected.current = true;
        void animate(y, -window.innerHeight, { duration: 0.32, ease: "easeOut" }).then(() => onEjected());
      } else {
        void animate(y, 0, { type: "spring", stiffness: 220, damping: 22 });
      }
    },
    [y, onEjected]
  );

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: -window.innerHeight * 0.88, bottom: 60 }}
      dragElastic={0.14}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      style={{
        y, scale, opacity, filter, borderColor,
        maxWidth: 340, width: "calc(100vw - 64px)",
        padding: "28px 30px",
        borderRadius: "52% 48% 44% 56% / 40% 44% 56% 60%",
        background: CLOUD_BG,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1.5px solid",
        boxShadow: `0 0 60px ${VIOLET_GLOW}, 0 0 120px rgba(139,92,246,0.10), inset 0 0 40px rgba(139,92,246,0.06)`,
        cursor: "grab", userSelect: "none", touchAction: "none",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14,
      }}
      whileDrag={{ cursor: "grabbing" }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: "rgba(139,92,246,0.55)", textTransform: "uppercase" }}>
        Pensée {cloudIndex} / {MAX_CLOUDS}
      </span>
      <p style={{ margin: 0, fontSize: 17, lineHeight: 1.65, color: TEXT_PRIMARY, textAlign: "center", fontStyle: "italic", fontWeight: 400 }}>
        « {phrase} »
      </p>
      <motion.span
        style={{ fontSize: 12, color: TEXT_MUTED }}
        animate={{ opacity: [0.7, 0.25, 0.7] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
      >
        ↑ Glisse vers le haut pour libérer
      </motion.span>
    </motion.div>
  );
}

// ─── Waveform violet ──────────────────────────────────────────────────────────
function VioletWave({ active, speaking = false }: { active: boolean; speaking?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, height: 36 }}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <motion.div
          key={i}
          style={{ width: 3, borderRadius: 2, background: speaking ? "#a78bfa" : VIOLET }}
          animate={active
            ? { height: [`6px`, `${12 + Math.sin(i * 0.9) * 14}px`, `6px`], opacity: [0.5, 0.85, 0.5] }
            : { height: "4px", opacity: 0.2 }
          }
          transition={active
            ? { repeat: Infinity, duration: 0.9 + i * 0.08, ease: "easeInOut", delay: i * 0.1 }
            : {}
          }
        />
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function DefusionExercise({
  patientId,
  practitionerId,
  firstName,
  sosContext = "",
  onTransitionToChat,
  onClose,
}: DefusionExerciseProps) {
  const [status, setStatus]               = useState<Status>("intro_live");
  const [currentPhrase, setCurrentPhrase] = useState("");
  const [cloudKey, setCloudKey]           = useState(0);
  const [cloudCount, setCloudCount]       = useState(0);
  const [evacuated, setEvacuated]         = useState<string[]>([]);
  const [simInput, setSimInput]           = useState("");
  const [isAiSpeaking, setIsAiSpeaking]   = useState(false);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [phraseCaptured, setPhraseCaptured] = useState(false); // phrase reçue par voix

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const statusRef       = useRef<Status>("intro_live");
  const wsRef           = useRef<WebSocket | null>(null);
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const processorRef    = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef  = useRef<MediaStream | null>(null);
  const micEnabledRef   = useRef(false);
  const audioQueueRef   = useRef<{ data: Float32Array; rate: number }[]>([]);
  const isPlayingRef    = useRef(false);
  const outputTransRef  = useRef("");
  const inputTransRef   = useRef(""); // phrase capturée à l'oral

  const onTransitionRef = useRef(onTransitionToChat);
  const onCloseRef      = useRef(onClose);
  useEffect(() => { onTransitionRef.current = onTransitionToChat; }, [onTransitionToChat]);
  useEffect(() => { onCloseRef.current      = onClose;            }, [onClose]);
  useEffect(() => { statusRef.current       = status;             }, [status]);

  // ─── Audio playback ───────────────────────────────────────────────────────
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
    isPlayingRef.current = false;
    setIsAiSpeaking(false);
  }, []);

  // ─── Send text turn ────────────────────────────────────────────────────────
  const sendTurn = useCallback((text: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ realtimeInput: { text } }));
  }, []);

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
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

  // ─── WS message handler ────────────────────────────────────────────────────
  const handleWSMessage = useCallback((event: MessageEvent) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(event.data as string) as Record<string, unknown>; }
    catch { return; }

    if (msg.setupComplete !== undefined) {
      // Micro actif pour capturer la phrase à l'oral
      micEnabledRef.current = true;
      sendTurn("[DEBUT]");
      return;
    }

    const sc = msg.serverContent as Record<string, unknown> | undefined;
    if (!sc) return;

    // Chunks audio
    const parts = (sc.modelTurn as Record<string, unknown> | undefined)
      ?.parts as Array<Record<string, unknown>> | undefined;
    if (parts) {
      for (const part of parts) {
        const inlineData = part.inlineData as Record<string, unknown> | undefined;
        if (inlineData?.mimeType && typeof inlineData.mimeType === "string"
            && inlineData.mimeType.startsWith("audio/pcm")) {
          const rate = parseInt((inlineData.mimeType.match(/rate=(\d+)/)?.[1]) ?? "24000", 10);
          enqueueAudio(inlineData.data as string, rate);
        }
      }
    }

    // Transcription sortie (cloture)
    const outTrans = sc.outputTranscription as Record<string, unknown> | undefined;
    if (outTrans?.text && typeof outTrans.text === "string") {
      outputTransRef.current += outTrans.text;
    }

    // Transcription entrée (phrase du patient)
    const inTrans = sc.inputTranscription as Record<string, unknown> | undefined;
    if (inTrans?.text && typeof inTrans.text === "string") {
      inputTransRef.current += inTrans.text;
    }

    if (sc.turnComplete === true) {
      const currentStatus = statusRef.current;

      if (currentStatus === "intro_live") {
        // Si le patient a parlé (input_transcription capturée) → utiliser comme phrase
        const voicePhrase = inputTransRef.current.trim();
        if (voicePhrase.length >= 3 && !phraseCaptured) {
          setPhraseCaptured(true);
          setSimInput(voicePhrase);
          // Confirmer et passer au nuage
          sendTurn(`[PHRASE_RECUE] La pensée reçue est : "${voicePhrase}"`);
        }
        return;
      }

      if (currentStatus === "cloture") {
        // Cloture terminée → injection chat
        const closingWords = outputTransRef.current.trim();
        const closing = closingWords || `Tu viens d'observer ${evacuated.length} pensée${evacuated.length > 1 ? "s" : ""} sans te laisser emporter. Ce sont des mots, pas des faits. Tu gardes le contrôle.`;
        setTimeout(() => onTransitionRef.current(evacuated, closing), 800);
      }
    }

    if (sc.interrupted === true) flushAudio();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendTurn, enqueueAudio, flushAudio, phraseCaptured, evacuated]);

  // ─── Init session ─────────────────────────────────────────────────────────
  const initSession = useCallback(async () => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setLoadError("NEXT_PUBLIC_GEMINI_API_KEY manquante.");
      return;
    }

    let contextInfo = `Patient : ${firstName}. Exercice de défusion cognitive ACT.`;
    try {
      const res = await fetch("/api/gemini-live/context", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: patientId ?? "unknown", practitionerId: practitionerId ?? "unknown" }),
      });
      if (res.ok) {
        const d = await res.json() as { systemPrompt?: string };
        if (d.systemPrompt) contextInfo = d.systemPrompt;
      }
    } catch { /* default */ }

    const enriched = contextInfo + (sosContext ? `\n\nCONTEXTE DÉCLENCHEUR : ${sosContext}` : "");
    const systemPrompt = buildDefusionSystemPrompt(firstName, enriched);

    // Micro
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 }, video: false });
      mediaStreamRef.current = stream;
    } catch {
      setLoadError("Accès micro refusé. Active le micro pour cet exercice.");
      return;
    }

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
      wsRef.current.send(JSON.stringify({ realtimeInput: { audio: { data: b64, mimeType: "audio/pcm;rate=16000" } } }));
    };

    const ws = new WebSocket(`${GEMINI_WS_URL}?key=${apiKey}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        config: {
          model: GEMINI_MODEL,
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          outputAudioTranscription: {},
          inputAudioTranscription:  {},
          systemInstruction: { parts: [{ text: systemPrompt }] },
        },
      }));
    };

    ws.onmessage = handleWSMessage;
    ws.onerror   = () => setLoadError("Connexion Gemini Live échouée.");
    ws.onclose = (evt) => {
      // Fermeture inattendue avant que setupComplete soit reçu
      if (statusRef.current === "intro_live") {
        setLoadError(`Connexion fermée (code ${evt.code}). Vérifie ta clé API Gemini Live.`);
      }
    };
  }, [sosContext, firstName, patientId, practitionerId, handleWSMessage]);

  useEffect(() => { void initSession(); }, []); // eslint-disable-line

  useEffect(() => {
    if (wsRef.current) wsRef.current.onmessage = handleWSMessage;
  }, [handleWSMessage]);

  // ─── Créer le nuage depuis la saisie ──────────────────────────────────────
  const handleSimCreate = useCallback(() => {
    const phrase = simInput.trim();
    if (phrase.length < 3) return;
    micEnabledRef.current = false; // Mic OFF pendant le nuage
    setCurrentPhrase(phrase);
    inputTransRef.current = "";
    setCloudKey((k) => k + 1);
    setStatus("cloud_display");
    // Confirmer la phrase si pas encore fait
    if (!phraseCaptured) {
      sendTurn(`[PHRASE_RECUE] La pensée est : "${phrase}"`);
    }
    setTimeout(() => setStatus("swiping"), 700);
  }, [simInput, phraseCaptured, sendTurn]);

  // ─── Nuage éjecté ─────────────────────────────────────────────────────────
  const handleCloudEjected = useCallback(() => {
    const phrase = currentPhrase;
    setEvacuated((prev) => {
      const next = [...prev, phrase];
      const newCount = cloudCount + 1;
      if (newCount >= MAX_CLOUDS) {
        outputTransRef.current = "";
        setTimeout(() => {
          setStatus("cloture");
          sendTurn("[CLOTURE]");
        }, 400);
      } else {
        setTimeout(() => {
          setStatus("checkpoint");
          sendTurn("[CHECKPOINT]");
          micEnabledRef.current = true; // mic actif pour que Gemini entende si patient parle
        }, 400);
      }
      return next;
    });
    setCloudCount((c) => c + 1);
  }, [currentPhrase, cloudCount, sendTurn]);

  // ─── Checkpoint : nouvelle pensée ─────────────────────────────────────────
  const handleCheckpointNew = useCallback(() => {
    micEnabledRef.current = true;
    inputTransRef.current = "";
    setSimInput("");
    setPhraseCaptured(false);
    setStatus("intro_live");
  }, []);

  // ─── Checkpoint : on arrête ───────────────────────────────────────────────
  const handleCheckpointStop = useCallback(() => {
    micEnabledRef.current = false;
    outputTransRef.current = "";
    setStatus("cloture");
    sendTurn("[CLOTURE]");
  }, [sendTurn]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, background: BG_DEEP,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes nebula-pulse {
          0%, 100% { transform: scale(1);    opacity: 0.18; }
          50%       { transform: scale(1.12); opacity: 0.26; }
        }
        @keyframes df-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Fond nébuleuse ────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "-15%", left: "-10%",
          width: "55vw", height: "55vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(109,40,217,0.22) 0%, transparent 70%)",
          animation: "nebula-pulse 6s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "-15%", right: "-10%",
          width: "50vw", height: "50vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 70%)",
          animation: "nebula-pulse 8s ease-in-out infinite 1s",
        }} />
      </div>

      {/* ── Close ─────────────────────────────────────────────────────────── */}
      {status !== "cloture" && (
        <button onClick={() => { cleanup(); onCloseRef.current(); }} aria-label="Fermer" style={{
          position: "absolute", top: 20, right: 20,
          width: 34, height: 34, borderRadius: "50%",
          background: VIOLET_DIM, border: `1px solid ${VIOLET_BORD}`,
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
            style={{ padding: "10px 28px", borderRadius: 10, background: VIOLET_DIM, border: `1px solid ${VIOLET_BORD}`, color: "rgba(255,255,255,0.8)", cursor: "pointer" }}>
            Fermer
          </button>
        </div>
      )}

      {/* ══ INTRO / CHECKPOINT ══════════════════════════════════════════════ */}
      {!loadError && (status === "intro_live" || status === "checkpoint") && (
        <motion.div
          key={status}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 24, padding: "0 28px", width: "100%", maxWidth: 440,
            position: "relative", zIndex: 1,
          }}
        >
          {/* Onde — active si Gemini parle */}
          <VioletWave active={isAiSpeaking || status === "intro_live"} speaking={isAiSpeaking} />

          <p style={{ margin: 0, fontSize: 14, color: TEXT_MUTED, letterSpacing: 0.4, textAlign: "center", lineHeight: 1.6 }}>
            {status === "intro_live"
              ? `${firstName}, quelle est la pensée qui prend toute la place ?`
              : "Le nuage est passé. Une autre pensée bloque encore ?"}
          </p>

          {/* Zone de saisie (avec pré-remplissage vocal si disponible) */}
          {status === "intro_live" && (
            <div style={{
              width: "100%", background: VIOLET_DIM,
              border: `1px solid ${VIOLET_BORD}`, borderRadius: 18,
              padding: "20px 20px 16px", display: "flex", flexDirection: "column", gap: 14,
            }}>
              {phraseCaptured && (
                <p style={{ margin: 0, fontSize: 11, color: "rgba(139,92,246,0.6)", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}>
                  Phrase captée à l'oral · Tu peux modifier
                </p>
              )}
              <textarea
                value={simInput}
                onChange={(e) => setSimInput(e.target.value)}
                placeholder={isAiSpeaking ? "Ton Jumeau parle…" : "Dis-le à voix haute ou écris-le ici…"}
                rows={2}
                style={{
                  width: "100%", background: "rgba(0,0,0,0.3)",
                  border: `1.5px solid ${VIOLET_BORD}`, borderRadius: 12,
                  padding: "12px 14px", color: TEXT_PRIMARY, fontSize: 15,
                  resize: "none", outline: "none", fontFamily: "inherit",
                  caretColor: VIOLET, boxSizing: "border-box",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSimCreate(); }
                }}
              />
              <button
                onClick={handleSimCreate}
                disabled={simInput.trim().length < 3}
                style={{
                  padding: "12px 24px", borderRadius: 12, border: "none",
                  background: simInput.trim().length >= 3
                    ? `linear-gradient(135deg, ${VIOLET}, ${INDIGO})`
                    : "rgba(255,255,255,0.04)",
                  color: simInput.trim().length >= 3 ? "#fff" : TEXT_FADED,
                  fontSize: 14, fontWeight: 700,
                  cursor: simInput.trim().length >= 3 ? "pointer" : "default",
                  transition: "all 0.2s",
                }}
              >
                Matérialiser le nuage →
              </button>
            </div>
          )}

          {/* Boutons checkpoint */}
          {status === "checkpoint" && (
            <>
              {evacuated.length > 0 && (
                <div style={{
                  width: "100%", padding: "14px 18px", borderRadius: 12,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <p style={{ margin: "0 0 8px", fontSize: 11, color: TEXT_FADED, letterSpacing: 1.2, textTransform: "uppercase" }}>
                    Nuages évacués
                  </p>
                  {evacuated.map((t, i) => (
                    <p key={i} style={{ margin: "4px 0", fontSize: 13, color: TEXT_MUTED, fontStyle: "italic" }}>
                      « {t} »
                    </p>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 12, width: "100%", flexWrap: "wrap", justifyContent: "center" }}>
                <button onClick={handleCheckpointNew} style={{
                  flex: "1 1 140px", padding: "13px 18px", borderRadius: 14,
                  background: VIOLET_SOFT, border: `1.5px solid ${VIOLET_BORD}`,
                  color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}>
                  Oui, une autre pensée
                </button>
                <button onClick={handleCheckpointStop} style={{
                  flex: "1 1 140px", padding: "13px 18px", borderRadius: 14,
                  background: `linear-gradient(135deg, ${VIOLET}, ${INDIGO})`,
                  border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}>
                  Ça s'allège ✓
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* ══ CLOUD_DISPLAY / SWIPING ═════════════════════════════════════════ */}
      {!loadError && (status === "cloud_display" || status === "swiping") && (
        <div style={{
          position: "relative", zIndex: 2,
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: status === "swiping" ? 0.5 : 0 }}
            transition={{ delay: 0.6 }}
            style={{
              position: "absolute", top: "11%", margin: 0,
              fontSize: 13, color: TEXT_FADED, textAlign: "center", letterSpacing: 0.3,
            }}
          >
            Ce ne sont que des mots.
          </motion.p>

          <motion.div
            key={`cloud-${cloudKey}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
          >
            <Cloud
              key={cloudKey}
              phrase={currentPhrase}
              cloudIndex={cloudCount + 1}
              onEjected={handleCloudEjected}
            />
          </motion.div>

          {cloudCount < MAX_CLOUDS - 1 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.28 }}
              transition={{ delay: 1.4 }}
              style={{
                position: "absolute", bottom: "9%", margin: 0,
                fontSize: 12, color: TEXT_FADED, textAlign: "center",
              }}
            >
              {MAX_CLOUDS - cloudCount - 1} nuage{MAX_CLOUDS - cloudCount - 1 > 1 ? "s" : ""} encore possible{MAX_CLOUDS - cloudCount - 1 > 1 ? "s" : ""}
            </motion.p>
          )}
        </div>
      )}

      {/* ══ CLOTURE ═════════════════════════════════════════════════════════ */}
      {!loadError && status === "cloture" && (
        <motion.div
          key="cloture"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 24, padding: "0 28px", width: "100%", maxWidth: 420,
            position: "relative", zIndex: 1, textAlign: "center",
          }}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
            style={{
              width: 60, height: 60, borderRadius: "50%",
              background: VIOLET_DIM, border: `2px solid ${VIOLET_BORD}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 32px ${VIOLET_GLOW}`,
            }}
          >
            {isAiSpeaking ? (
              <VioletWave active={true} speaking={true} />
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke={VIOLET} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </motion.div>

          {evacuated.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                width: "100%", background: VIOLET_DIM,
                border: `1px solid ${VIOLET_BORD}`, borderRadius: 16,
                padding: "16px 20px", textAlign: "left",
              }}
            >
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: 1.3, color: "rgba(139,92,246,0.6)", textTransform: "uppercase" }}>
                Pensées observées et libérées
              </p>
              {evacuated.map((t, i) => (
                <motion.p key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.13 }}
                  style={{ margin: "5px 0", fontSize: 14, color: TEXT_MUTED, fontStyle: "italic", lineHeight: 1.55 }}
                >
                  « {t} »
                </motion.p>
              ))}
            </motion.div>
          )}

          <AnimatePresence>
            {!isAiSpeaking && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: TEXT_PRIMARY }}
              >
                {evacuated.length > 0
                  ? `Tu viens d'observer ${evacuated.length} pensée${evacuated.length > 1 ? "s" : ""} sans te laisser emporter. Ce sont des mots, pas des faits.`
                  : "Tu viens de prendre de la distance avec ce qui t'oppressait. Ce sont des mots, pas des faits."}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
