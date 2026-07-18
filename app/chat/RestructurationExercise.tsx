"use client";

/**
 * RestructurationExercise — Restructuration cognitive (Gemini Live)
 *
 * Objectif clinique : aider le patient à reformuler lui-même une pensée
 * négative en une pensée plus équilibrée via dialogue socratique.
 *
 * Architecture : identique à AncrageExercise (GeminiLiveClient, PCM base64,
 * micEnabledRef gate, pendingAdvanceRef + turnCompleteRef, ScriptProcessor).
 *
 * State machine : loading → active → exploring → complete
 *
 * Tool calls (2 étapes sémantiques) :
 *   1. capturer_pensee(original)       — fin de phase identification
 *   2. valider_restructuration(reformulated) — fin de phase exploration
 *
 * Gardes-fous :
 *   • capturer_pensee  : rejeté si status !== "active" ou patient silencieux
 *   • valider_restructuration : rejeté si status !== "exploring" ou patient silencieux
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GeminiLiveClient, toVertexModelPath } from "@/lib/geminiLiveClient";
import PulseOrb from "./PulseOrb";

// ─── Design tokens — Violet ───────────────────────────────────────────────────
const BG_DEEP    = "#08050f";
const VIOLET     = "#8b5cf6";
const VIOLET_DIM = "rgba(139,92,246,0.11)";
const VIOLET_BDR = "rgba(139,92,246,0.28)";
const VIOLET_GLW = "rgba(139,92,246,0.42)";
const VIOLET_SFT = "rgba(139,92,246,0.18)";
const TEXT_PRI   = "rgba(255,255,255,0.92)";
const TEXT_SEC   = "rgba(255,255,255,0.45)";
const TEXT_MUT   = "rgba(255,255,255,0.22)";

// ─── Gemini Live ──────────────────────────────────────────────────────────────
const GEMINI_MODEL = "models/gemini-live-2.5-flash-native-audio";

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
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) f32[i] = int16[i] / 32768;
  return f32;
}

// ─── VioletWave — réagit à la voix réelle du patient ─────────────────────────
function VioletWave({ active, analyser }: { active: boolean; analyser?: AnalyserNode | null }) {
  const barsRef   = useRef<(HTMLDivElement | null)[]>([]);
  const activeRef = useRef(active);
  const anRef     = useRef<AnalyserNode | null | undefined>(analyser);
  activeRef.current = active;
  anRef.current     = analyser;

  useEffect(() => {
    const buf      = new Uint8Array(32);
    const energies = new Array(8).fill(0.1) as number[];
    let t = 0, raf: number;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      t  += 0.016;
      const isActive = activeRef.current;
      const an       = anRef.current;

      if (isActive && an) {
        an.getByteFrequencyData(buf);
        for (let i = 0; i < 8; i++) {
          const start = i * 4;
          let sum = 0;
          for (let j = start; j < start + 4 && j < buf.length; j++) sum += buf[j];
          energies[i] += ((sum / 4) / 255 - energies[i]) * 0.3;
        }
      } else if (isActive) {
        for (let i = 0; i < 8; i++) {
          const target = 0.28 + 0.22 * Math.sin(t * 2.5 + i * 0.75);
          energies[i] += (target - energies[i]) * 0.15;
        }
      } else {
        for (let i = 0; i < 8; i++) energies[i] += (0 - energies[i]) * 0.1;
      }

      for (let i = 0; i < 8; i++) {
        const bar = barsRef.current[i];
        if (!bar) continue;
        bar.style.height  = `${(3 + energies[i] * 30).toFixed(1)}px`;
        bar.style.opacity = (isActive ? 0.15 + energies[i] * 0.75 : Math.max(0, energies[i] * 0.5)).toFixed(3);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, height: 40 }}>
      {[0,1,2,3,4,5,6,7].map(i => (
        <div key={i} ref={el => { barsRef.current[i] = el; }}
          style={{ width: 3.5, borderRadius: 2, background: VIOLET, height: "3px", opacity: 0, willChange: "height, opacity" }}
        />
      ))}
    </div>
  );
}

// ─── Prompt système ────────────────────────────────────────────────────────────
function buildPrompt(firstName: string, contextInfo: string): string {
  return `Tu es un thérapeute bienveillant qui accompagne ${firstName} dans un exercice de restructuration cognitive. Parle en français, voix calme et chaleureuse, phrases courtes.

SIGNAUX : Tu reçois des signaux entre crochets [comme celui-ci]. Ce sont des instructions privées — tu ne les lis JAMAIS à voix haute.
• [DEBUT] → check-in d'accueil émotionnel (avant l'exercice)
• [SILENCE_DEBUT] → relance douce si le patient n'a pas répondu à l'accueil
• [ACCUEIL] → démarre l'exercice proprement dit

OUTILS DISPONIBLES :
• capturer_pensee(original) — fin de phase identification
• valider_restructuration(reformulated) — fin de phase reformulation; après cet appel, enchaîne directement sur la clôture émotionnelle
• terminer_exercice(closing_message) — après la réponse du patient à la question de clôture. Si silence après relance → terminer_exercice("")

CONTEXTE PATIENT :
${contextInfo}

TON SEUL OBJECTIF : aider ${firstName} à arriver lui-même à une pensée plus équilibrée. Tu ne formules jamais la pensée alternative à sa place.

━━━ [DEBUT] — CHECK-IN D'ACCUEIL ━━━
Accueille ${firstName} chaleureusement. Pose une question courte sur son état actuel ("Comment tu te sens en ce moment ?"). Écoute sa réponse. Accuse réception en une phrase empathique, puis silence.
→ [SILENCE_DEBUT] : relance doucement ("Prends ton temps, comment tu te sens ?"). Si toujours pas de réponse, dis "On commence ensemble" et tais-toi.

━━━ [ACCUEIL] — PHASE 1 : IDENTIFICATION ━━━
Accueille ${firstName} avec chaleur, puis demande-lui quelle pensée revient souvent ou le/la pèse en ce moment. Attends sa réponse.
Reformule la pensée pour confirmer : "Si je comprends bien, la pensée c'est… c'est ça ?" Attends sa confirmation.
Dès que le patient confirme, appelle capturer_pensee(original) avec exactement la pensée telle qu'il/elle la formule.

━━━ PHASE 2 — EXPLORATION SOCRATIQUE ━━━
Engage un dialogue d'exploration — une question à la fois, attends toujours la réponse avant de poser la suivante.
Angles possibles selon ce qui émerge :
  — "Sur quoi tu t'appuies pour croire ça ?"
  — "Est-ce qu'il y a eu des moments où ce n'était pas le cas ?"
  — "Qu'est-ce que tu dirais à un ami proche qui aurait cette pensée ?"
  — "Si tu l'observes de loin, qu'est-ce que tu vois ?"
Laisse ${firstName} cheminer à son rythme. Ne suggère jamais la réponse.

━━━ PHASE 3 — REFORMULATION ━━━
Quand ${firstName} formule lui-même une pensée plus juste ou nuancée, accueille-la ("C'est ça, oui.") et invite-le/la à la répéter ou confirmer.
Appelle valider_restructuration(reformulated) avec exactement ce que le patient a dit.

━━━ CLÔTURE ÉMOTIONNELLE (après valider_restructuration) ━━━
Conclus en 1-2 phrases sincères. Pose la question de clôture : "Comment tu te sens maintenant ?" Écoute la réponse.
→ Quelle que soit la réponse : accueille avec sincérité, puis appelle terminer_exercice(closing_message) avec ce que ${firstName} a dit.
→ Si ${firstName} ne répond pas : relance UNE seule fois ("Prends ton temps…"). Si toujours pas de réponse : appelle terminer_exercice("").

INTERDITS ABSOLUS :
— formuler toi-même la pensée alternative (ex. "et si tu pensais que…")
— appeler capturer_pensee si le patient n'a pas encore répondu
— appeler valider_restructuration avant capturer_pensee
— appeler valider_restructuration si c'est toi qui as suggéré la reformulation
— contredire directement ("c'est faux", "tu as tort")
— minimiser ("c'est pas grave")
— poser deux questions à la fois`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = "loading" | "intake" | "active" | "exploring" | "complete";

export interface RestructurationExerciseProps {
  patientId?:   string;
  practitionerId?: string;
  firstName:    string;
  sosContext?:  string;
  onTransitionToChat: (original: string, reformulated: string, closing: string) => void;
  onClose:      () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RestructurationExercise({
  patientId,
  practitionerId,
  firstName,
  sosContext = "",
  onTransitionToChat,
  onClose,
}: RestructurationExerciseProps) {

  const [status,              setStatus]              = useState<Status>("loading");
  const [isAiSpeaking,        setIsAiSpeaking]        = useState(false);
  const [isListening,         setIsListening]         = useState(false);
  const [loadError,           setLoadError]           = useState<string | null>(null);
  const [originalThought,     setOriginalThought]     = useState("");
  const [reformulatedThought, setReformulatedThought] = useState("");
  const [intakeGeminiHasSpoken, setIntakeGeminiHasSpoken] = useState(false);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const statusRef              = useRef<Status>("loading");
  const wsRef                  = useRef<GeminiLiveClient | null>(null);
  const audioCtxRef            = useRef<AudioContext | null>(null);
  const processorRef           = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef         = useRef<MediaStream | null>(null);
  const outputAnalyserRef      = useRef<AnalyserNode | null>(null);
  const inputAnalyserRef       = useRef<AnalyserNode | null>(null);
  const micEnabledRef          = useRef(false);
  const isAiSpeakingRef        = useRef(false);
  const audioQueueRef          = useRef<{ data: Float32Array; rate: number }[]>([]);
  const isPlayingRef           = useRef(false);
  const turnCompleteRef        = useRef(false);
  const pendingAdvanceRef      = useRef<(() => void) | null>(null);
  const outputTransRef         = useRef("");
  const patientSpokeRef        = useRef(false);
  // Bloque l'activation du micro entre la fin de l'intake et le 1er chunk
  // audio de la réponse [ACCUEIL] — évite la fenêtre "Je t'écoute" prématurée.
  const waitingForAccueilRef   = useRef(false);
  // Intake refs
  const intakeMessageRef       = useRef("");
  const intakePatientSpokeRef  = useRef(false);
  const intakeGeminiHasSpokenRef = useRef(false);
  const intakeTimeoutRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Closing ref
  const closingMessageRef      = useRef("");
  // Thought refs (miroir des états pour lecture dans les tool handlers)
  const originalThoughtRef     = useRef("");
  const reformulatedThoughtRef = useRef("");

  const onTransitionRef = useRef(onTransitionToChat);
  const onCloseRef      = useRef(onClose);
  useEffect(() => { onTransitionRef.current = onTransitionToChat;      }, [onTransitionToChat]);
  useEffect(() => { onCloseRef.current      = onClose;                 }, [onClose]);
  useEffect(() => { statusRef.current       = status;                  }, [status]);
  useEffect(() => { intakeGeminiHasSpokenRef.current = intakeGeminiHasSpoken; }, [intakeGeminiHasSpoken]);

  // ── Log silencieux vers /api/exercise/log ─────────────────────────────────
  const logRestructurationSession = useCallback(async (
    original: string,
    reformulated: string,
    intake: string,
    closing: string,
  ) => {
    if (!patientId || !practitionerId) return;
    try {
      await fetch("/api/exercise/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          practitionerId,
          exerciseType: "restructuration",
          intakeMessage:  intake  || undefined,  // ressenti émotionnel initial
          closingMessage: closing || undefined,  // ressenti émotionnel final
          extra: {
            original_thought:     original    || undefined,
            reformulated_thought: reformulated || undefined,
          },
        }),
      });
    } catch { /* silencieux */ }
  }, [patientId, practitionerId]);

  // ─── Playback queue ───────────────────────────────────────────────────────
  const playNextChunk = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      isPlayingRef.current    = false;
      isAiSpeakingRef.current = false;
      setIsAiSpeaking(false);

      // Appliquer le pendingAdvanceRef seulement quand turnComplete reçu
      if (pendingAdvanceRef.current && turnCompleteRef.current) {
        turnCompleteRef.current    = false;
        const advance              = pendingAdvanceRef.current;
        pendingAdvanceRef.current  = null;
        advance();
      }

      // Ré-activer le mic selon la phase
      const st = statusRef.current;
      if ((st === "active" || st === "exploring") && !waitingForAccueilRef.current) {
        setTimeout(() => {
          const cur = statusRef.current;
          if ((cur === "active" || cur === "exploring") && !waitingForAccueilRef.current) {
            micEnabledRef.current = true;
            setIsListening(true);
          }
        }, 300);
      } else if (st === "intake" && intakeGeminiHasSpokenRef.current) {
        // Intake : ré-activer après que Gemini a posé la question d'accueil
        setTimeout(() => {
          if (statusRef.current !== "intake") return;
          micEnabledRef.current = true;
          setIsListening(true);
          // Timer de silence — une relance, puis transition sans supposition
          if (!intakeTimeoutRef.current && !intakePatientSpokeRef.current) {
            intakeTimeoutRef.current = setTimeout(() => {
              if (statusRef.current !== "intake" || intakePatientSpokeRef.current) return;
              intakeTimeoutRef.current = null;
              wsRef.current?.send(JSON.stringify({ realtimeInput: { text: "[SILENCE_DEBUT]" } }));
              intakeTimeoutRef.current = setTimeout(() => {
                if (statusRef.current !== "intake") return;
                intakeTimeoutRef.current = null;
                micEnabledRef.current = false;
                setIsListening(false);
                setStatus("active");
                statusRef.current = "active";
                setTimeout(() => wsRef.current?.send(JSON.stringify({
                  clientContent: { turns: [{ role: "user", parts: [{ text: "[ACCUEIL]" }] }], turnComplete: true },
                })), 400);
              }, 8000);
            }, 10000);
          }
        }, 300);
      }
      return;
    }

    isPlayingRef.current    = true;
    isAiSpeakingRef.current = true;
    setIsAiSpeaking(true);

    const { data, rate } = audioQueueRef.current.shift()!;
    const buf = ctx.createBuffer(1, data.length, rate);
    buf.getChannelData(0).set(data);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const analyser = outputAnalyserRef.current;
    if (analyser) {
      src.connect(analyser);
    } else {
      src.connect(ctx.destination);
    }
    src.onended = playNextChunk;
    src.start(0);
  }, []);

  const enqueueAudio = useCallback((base64: string, sampleRate = 24000) => {
    audioQueueRef.current.push({ data: pcm16Base64ToFloat32(base64), rate: sampleRate });
    if (!isPlayingRef.current) playNextChunk();
  }, [playNextChunk]);

  const flushAudio = useCallback(() => {
    audioQueueRef.current   = [];
    isPlayingRef.current    = false;
    isAiSpeakingRef.current = false;
    setIsAiSpeaking(false);
  }, []);

  // ─── Send text turn ───────────────────────────────────────────────────────
  const sendTurn = useCallback((text: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ realtimeInput: { text } }));
  }, []);

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (intakeTimeoutRef.current) { clearTimeout(intakeTimeoutRef.current); intakeTimeoutRef.current = null; }
    pendingAdvanceRef.current = null;
    micEnabledRef.current     = false;
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

  // ─── WS message handler ───────────────────────────────────────────────────
  const handleWSMessage = useCallback((event: { data: string }) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(event.data) as Record<string, unknown>; }
    catch { return; }

    // Setup complete → phase intake : Gemini pose d'abord une question d'accueil
    if (msg.setupComplete !== undefined) {
      setStatus("intake");
      statusRef.current               = "intake";
      intakeMessageRef.current        = "";
      intakePatientSpokeRef.current   = false;
      intakeGeminiHasSpokenRef.current = false;
      setIntakeGeminiHasSpoken(false);
      wsRef.current?.send(JSON.stringify({
        clientContent: {
          turns: [{ role: "user", parts: [{ text: "[DEBUT]" }] }],
          turnComplete: true,
        },
      }));
      return;
    }

    // ── Tool calls ─────────────────────────────────────────────────────────
    const toolCallMsg = msg.toolCall as { functionCalls?: Array<{ name: string; id: string; args?: Record<string, unknown> }> } | undefined;
    if (toolCallMsg?.functionCalls) {
      for (const fc of toolCallMsg.functionCalls) {

        // ── capturer_pensee : fin de la phase identification ──────────────
        if (fc.name === "capturer_pensee") {
          const original = typeof fc.args?.original === "string" ? fc.args.original : "";
          const inActivePhase = statusRef.current === "active";
          const isValid = inActivePhase && patientSpokeRef.current && !!original;

          wsRef.current?.send(JSON.stringify({
            toolResponse: {
              functionResponses: [{
                id: fc.id,
                response: {
                  output: isValid
                    ? "ok — Avant de passer à l'exploration, accueille ce que le patient vient de partager en 1-2 phrases chaleureuses et empathiques (ex : reconnaître que cette pensée est lourde à porter, ou que c'est courageux de la regarder en face). Puis engage l'exploration socratique avec une première question ouverte, une seule."
                    : !inActivePhase
                      ? "Erreur : capturer_pensee a déjà été appelé. Passe directement à l'exploration."
                      : !patientSpokeRef.current
                        ? "Erreur : le patient n'a pas encore répondu. Attends."
                        : "Erreur : pensée originale manquante.",
                },
              }],
            },
          }));

          if (!isValid) break;

          patientSpokeRef.current = false;
          originalThoughtRef.current = original;
          setOriginalThought(original);
          pendingAdvanceRef.current = () => {
            setStatus("exploring");
            statusRef.current = "exploring";
          };
        }

        // ── valider_restructuration : fin de la phase exploration ─────────
        if (fc.name === "valider_restructuration") {
          const reformulated = typeof fc.args?.reformulated === "string" ? fc.args.reformulated : "";
          const inExploringPhase = statusRef.current === "exploring";
          const isValid = inExploringPhase && patientSpokeRef.current && !!reformulated;

          wsRef.current?.send(JSON.stringify({
            toolResponse: {
              functionResponses: [{
                id: fc.id,
                response: {
                  output: isValid
                    ? "ok — pose maintenant la question de clôture émotionnelle."
                    : !inExploringPhase
                      ? "Erreur : appelle d'abord capturer_pensee pour identifier la pensée de départ."
                      : !patientSpokeRef.current
                        ? "Erreur : le patient n'a pas encore formulé sa pensée alternative. Attends."
                        : "Erreur : pensée reformulée manquante.",
                },
              }],
            },
          }));

          if (!isValid) break;

          patientSpokeRef.current = false;
          reformulatedThoughtRef.current = reformulated;
          setReformulatedThought(reformulated);
          // Garder le status "exploring" — Gemini enchaîne sur la question de clôture
          // Le mic reste actif (playNextChunk gère la réactivation)
          pendingAdvanceRef.current = () => { /* status unchanged */ };
        }

        // ── terminer_exercice : clôture émotionnelle ──────────────────────
        if (fc.name === "terminer_exercice") {
          const closing = typeof fc.args?.closing_message === "string" ? fc.args.closing_message : "";
          closingMessageRef.current = closing;

          wsRef.current?.send(JSON.stringify({
            toolResponse: {
              functionResponses: [{ id: fc.id, response: { output: "ok" } }],
            },
          }));

          const original    = originalThoughtRef.current;
          const reformulated = reformulatedThoughtRef.current;
          const intake      = intakeMessageRef.current;
          void logRestructurationSession(original, reformulated, intake, closing);

          pendingAdvanceRef.current = () => {
            setStatus("complete");
            statusRef.current = "complete";
            micEnabledRef.current = false;
            setIsListening(false);
            // Le patient lit la nouvelle pensée à son rythme.
            // La transition se déclenche uniquement via le bouton "Terminer".
          };
        }
      }
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
          isAiSpeakingRef.current = true;
          micEnabledRef.current   = false;
          setIsListening(false);
          turnCompleteRef.current = false;
          // Détecter que Gemini a posé la question d'accueil (phase intake)
          if (statusRef.current === "intake" && !intakeGeminiHasSpokenRef.current) {
            intakeGeminiHasSpokenRef.current = true;
            setIntakeGeminiHasSpoken(true);
          }
          // Lever le verrou "attente ACCUEIL" dès que Gemini commence à répondre
          // à [ACCUEIL] en phase active — à partir de là le mic pourra s'activer
          // normalement quand Gemini aura fini de parler.
          if (statusRef.current === "active" && waitingForAccueilRef.current) {
            waitingForAccueilRef.current = false;
          }
          enqueueAudio(inlineData.data as string, rate);
        }
      }
    }

    // Transcription entrée
    const inTrans = sc.inputTranscription as Record<string, unknown> | undefined;
    if (inTrans?.text && typeof inTrans.text === "string" && inTrans.text.trim()) {
      patientSpokeRef.current = true;
      // Capture check-in d'accueil (phase intake)
      if (statusRef.current === "intake") {
        intakeMessageRef.current += inTrans.text;
        intakePatientSpokeRef.current = true;
        if (intakeTimeoutRef.current) { clearTimeout(intakeTimeoutRef.current); intakeTimeoutRef.current = null; }
      }
    }

    // Transcription sortie
    const outTrans = sc.outputTranscription as Record<string, unknown> | undefined;
    if (outTrans?.text && typeof outTrans.text === "string") {
      outputTransRef.current += outTrans.text;
    }

    // Tour Gemini terminé
    if (sc.turnComplete === true) {
      turnCompleteRef.current = true;

      if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
        playNextChunk();
        return;
      }

      if (statusRef.current === "intake") {
        if (intakePatientSpokeRef.current) {
          // Patient a répondu → Gemini a accusé réception → transition vers exercice
          intakePatientSpokeRef.current = false;
          if (intakeTimeoutRef.current) { clearTimeout(intakeTimeoutRef.current); intakeTimeoutRef.current = null; }
          pendingAdvanceRef.current = () => {
            setStatus("active");
            statusRef.current = "active";
            // Bloquer le mic jusqu'au 1er chunk audio de la réponse [ACCUEIL]
            waitingForAccueilRef.current = true;
            setTimeout(() => wsRef.current?.send(JSON.stringify({
              clientContent: { turns: [{ role: "user", parts: [{ text: "[ACCUEIL]" }] }], turnComplete: true },
            })), 200);
          };
        }
        return;
      }

      if (statusRef.current === "active" || statusRef.current === "exploring") {
        // Gemini termine sa réponse → reset pour détecter le prochain tour patient
        patientSpokeRef.current = false;
      }
    }

    // Patient coupe → flush audio
    if (sc.interrupted === true) flushAudio();
  }, [enqueueAudio, flushAudio, playNextChunk, logRestructurationSession]);

  // ─── Init session ─────────────────────────────────────────────────────────
  const initSession = useCallback(async () => {

    // 1. Contexte patient
    let contextInfo = `Patient : ${firstName}. Exercice de restructuration cognitive.`;
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

    const enriched    = contextInfo + (sosContext ? `\n\nCONTEXTE DÉCLENCHEUR : ${sosContext}` : "");
    const systemPrompt = buildPrompt(firstName, enriched);

    // 2. Micro
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      mediaStreamRef.current = stream;
    } catch {
      setLoadError("Accès micro refusé. Active le micro pour cet exercice.");
      return;
    }

    // 3. AudioContext + analysers
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.connect(audioCtx.destination);
    outputAnalyserRef.current = analyser;
    const micSrc      = audioCtx.createMediaStreamSource(stream);
    const inputAnalyser = audioCtx.createAnalyser();
    inputAnalyser.fftSize = 256;
    inputAnalyserRef.current = inputAnalyser;
    micSrc.connect(inputAnalyser);
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

    // 4. WebSocket Gemini Live
    const ws = new GeminiLiveClient();
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: toVertexModelPath(GEMINI_MODEL),
          generationConfig: { responseModalities: ["AUDIO"] },
          outputAudioTranscription: {},
          inputAudioTranscription:  {},
          systemInstruction: { parts: [{ text: systemPrompt }] },
          tools: [{
            functionDeclarations: [
              {
                name: "capturer_pensee",
                description: "Appelle cet outil en fin de phase d'identification, quand tu as reformulé la pensée du patient et qu'il l'a confirmée. Cela marque le début de l'exploration socratique.",
                parameters: {
                  type: "object",
                  properties: {
                    original: { type: "string", description: "La pensée négative telle que formulée et confirmée par le patient." },
                  },
                  required: ["original"],
                },
              },
              {
                name: "valider_restructuration",
                description: "Appelle cet outil uniquement après capturer_pensee, quand le patient a lui-même formulé une pensée alternative plus équilibrée. Ne l'appelle jamais si c'est toi qui as suggéré la reformulation. Après cet appel, enchaîne directement sur la question de clôture émotionnelle.",
                parameters: {
                  type: "object",
                  properties: {
                    reformulated: { type: "string", description: "La pensée plus équilibrée formulée par le patient lui-même, telle qu'il l'a dite." },
                  },
                  required: ["reformulated"],
                },
              },
              {
                name: "terminer_exercice",
                description: "Appelle cet outil après avoir reçu la réponse du patient à la question de clôture émotionnelle. Passe dans closing_message exactement ce que le patient a dit. Si le patient ne répond pas après une relance, appelle terminer_exercice avec closing_message vide.",
                parameters: {
                  type: "object",
                  properties: {
                    closing_message: { type: "string", description: "Ce que le patient a dit en réponse à 'Comment tu te sens maintenant ?'. Chaîne vide si pas de réponse." },
                  },
                  required: ["closing_message"],
                },
              },
            ],
          }],
        },
      }));
    };

    ws.onmessage = handleWSMessage;
    ws.onerror   = () => setLoadError("Connexion Gemini Live échouée.");
    ws.onclose = (evt) => {
      if (statusRef.current === "loading" || statusRef.current === "intake") {
        setLoadError(`Connexion fermée (code ${evt.code}). Vérifie ta clé API Gemini Live.`);
      }
    };
  }, [sosContext, firstName, patientId, practitionerId, handleWSMessage]);

  useEffect(() => { void initSession(); }, []); // eslint-disable-line

  // Mettre à jour le handler WS
  useEffect(() => {
    if (wsRef.current) wsRef.current.onmessage = handleWSMessage;
  }, [handleWSMessage]);

  // ─── Clôture (bouton manuel) ─────────────────────────────────────────────
  const handleClose = useCallback(() => {
    cleanup();
    onCloseRef.current();
  }, [cleanup]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, background: BG_DEEP,
      display: "flex", flexDirection: "column",
      fontFamily: "system-ui, sans-serif", overflow: "hidden",
    }}>
      <style>{`
        @keyframes violet-pulse {
          0%, 100% { opacity: 0.08; transform: scale(1); }
          50%       { opacity: 0.16; transform: scale(1.06); }
        }
        @keyframes rv-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rv-loading-bar {
          0%   { left: -45%; }
          100% { left: 110%; }
        }
      `}</style>

      {/* ── Halo violet fond ─────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)",
          width: "90vw", height: "90vw", borderRadius: "50%",
          background: `radial-gradient(circle, ${VIOLET_GLW.replace("0.42", "0.18")} 0%, transparent 65%)`,
          animation: "violet-pulse 7s ease-in-out infinite",
        }} />
      </div>

      {/* ── Bouton fermer ────────────────────────────────────────────────── */}
      {status !== "complete" && status !== "intake" && (
        <button onClick={() => { cleanup(); onCloseRef.current(); }} aria-label="Fermer" style={{
          position: "absolute", top: 20, right: 20,
          width: 34, height: 34, borderRadius: "50%",
          background: VIOLET_DIM, border: `1px solid ${VIOLET_BDR}`,
          color: TEXT_SEC, fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10,
        }}>×</button>
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      {status !== "complete" && !loadError && (
        <div style={{
          position: "absolute", top: 28,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          width: "100%", pointerEvents: "none",
        }}>
          <p style={{
            margin: 0, fontSize: 11, fontWeight: 400,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: `rgba(139,92,246,0.45)`,
          }}>
            {status === "exploring" ? "Exploration" : "Restructuration cognitive"}
          </p>
        </div>
      )}

      {/* ── Erreur ───────────────────────────────────────────────────────── */}
      {loadError && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <p style={{ color: "#f87171", fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>{loadError}</p>
          <button onClick={() => { cleanup(); onCloseRef.current(); }}
            style={{ padding: "10px 28px", borderRadius: 10, background: VIOLET_DIM, border: `1px solid ${VIOLET_BDR}`, color: TEXT_PRI, cursor: "pointer" }}>
            Fermer
          </button>
        </div>
      )}

      {/* ══ Contenu central ══════════════════════════════════════════════════ */}
      {!loadError && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px 24px" }}>
          <AnimatePresence mode="wait">

            {/* ── Loading ───────────────────────────────────────────────── */}
            {status === "loading" && (
              <motion.div key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}
              >
                <motion.div
                  animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  style={{
                    width: 68, height: 68, borderRadius: "50%",
                    background: VIOLET_DIM, border: `1.5px solid ${VIOLET_BDR}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 0 28px ${VIOLET_GLW}`,
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke={VIOLET} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </motion.div>
                <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, letterSpacing: 0.4, animation: "rv-fade-in 0.3s ease" }}>
                  Connexion en cours…
                </p>
                <div style={{ width: 160, height: 2, borderRadius: 2, background: VIOLET_DIM, overflow: "hidden", position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "45%", borderRadius: 2, background: `linear-gradient(90deg, transparent 0%, ${VIOLET} 50%, transparent 100%)`, animation: "rv-loading-bar 1.6s ease-in-out infinite" }} />
                </div>
              </motion.div>
            )}

            {/* ── Intake (check-in d'accueil) ───────────────────────────── */}
            {status === "intake" && (
              <motion.div key="intake"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
              >
                <PulseOrb speaking={isAiSpeaking} analyser={outputAnalyserRef.current} color={VIOLET} size={160} />
                {!isAiSpeaking && intakeGeminiHasSpoken && (
                  <p style={{
                    margin: 0, fontSize: 13, fontWeight: 300,
                    letterSpacing: "0.14em",
                    color: `rgba(139,92,246,0.55)`,
                    animation: "rv-fade-in 0.3s ease",
                  }}>
                    Je t&apos;écoute…
                  </p>
                )}
              </motion.div>
            )}

            {/* ── Active / Exploring ────────────────────────────────────── */}
            {(status === "active" || status === "exploring") && (
              <motion.div key="active"
                initial={{ opacity: 0, scale: 0.93 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%", maxWidth: 360 }}
              >
                {/* Badge pensée capturée — visible seulement en phase exploring */}
                {status === "exploring" && originalThought && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 10,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.09)",
                    }}
                  >
                    <p style={{ margin: "0 0 4px", fontSize: 9, fontWeight: 600, color: TEXT_MUT, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                      Pensée explorée
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, lineHeight: 1.45 }}>
                      {originalThought}
                    </p>
                  </motion.div>
                )}

                <PulseOrb
                  speaking={isAiSpeaking}
                  analyser={outputAnalyserRef.current}
                  color={VIOLET}
                  size={160}
                />
                {isListening && !isAiSpeaking && (
                  <p style={{
                    margin: 0, fontSize: 13, fontWeight: 300,
                    letterSpacing: "0.14em",
                    color: `rgba(139,92,246,0.55)`,
                    animation: "rv-fade-in 0.3s ease",
                  }}>
                    Je t&apos;écoute…
                  </p>
                )}
              </motion.div>
            )}

            {/* ── Complete ──────────────────────────────────────────────── */}
            {status === "complete" && (
              <motion.div key="complete"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
              >
                {/* Pensée originale */}
                <div style={{
                  width: "100%", padding: "16px 18px", borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: TEXT_MUT, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Pensée de départ
                  </p>
                  <p style={{ margin: 0, fontSize: 15, color: TEXT_SEC, textDecoration: "line-through", textDecorationColor: "rgba(255,255,255,0.2)", lineHeight: 1.5 }}>
                    {originalThought}
                  </p>
                </div>

                {/* Flèche */}
                <svg width="20" height="28" viewBox="0 0 20 28" fill="none">
                  <path d="M10 0 L10 20 M4 14 L10 22 L16 14" stroke={VIOLET} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>

                {/* Pensée reformulée */}
                <div style={{
                  width: "100%", padding: "16px 18px", borderRadius: 14,
                  background: VIOLET_DIM,
                  border: `1px solid ${VIOLET_BDR}`,
                }}>
                  <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: `${VIOLET}99`, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    Pensée plus équilibrée
                  </p>
                  <p style={{ margin: 0, fontSize: 15, color: TEXT_PRI, lineHeight: 1.5, fontWeight: 500 }}>
                    {reformulatedThought}
                  </p>
                </div>

                <button onClick={() => {
                  cleanup();
                  onTransitionRef.current(originalThought, reformulatedThought, closingMessageRef.current);
                }} style={{
                  marginTop: 8, padding: "12px 32px", borderRadius: 12,
                  background: VIOLET_SFT, border: `1px solid ${VIOLET_BDR}`,
                  color: VIOLET, fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}>
                  Terminer
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      )}

      {/* ── VioletWave (bas d'écran) ─────────────────────────────────────── */}
      {!loadError && (status === "intake" || status === "active" || status === "exploring") && (
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 0, paddingBottom: 34, zIndex: 1 }}>
          <VioletWave
            active={isListening && !isAiSpeaking}
            analyser={isListening && !isAiSpeaking ? inputAnalyserRef.current : undefined}
          />
        </div>
      )}
    </div>
  );
}
