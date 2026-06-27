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
import { GeminiLiveClient, toVertexModelPath } from "@/lib/geminiLiveClient";
import PulseOrb from "./PulseOrb";

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
const GEMINI_MODEL  = "models/gemini-live-2.5-flash-native-audio";
const HARD_STOP_MS  = 180_000; // 3 minutes

// ─── State machine ─────────────────────────────────────────────────────────────
type SenseStatus =
  | "loading"
  | "vue_4"
  | "toucher_3"
  | "ouie_2"
  | "odorat_1"
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

const SENSE_CONFIG: Record<Exclude<SenseStatus, "loading" | "cloture">, SenseConfig> = {
  vue_4:     { count: 4, label: "choses que tu vois",        icon: <IconEye /> },
  toucher_3: { count: 3, label: "sensations que tu ressens", icon: <IconHand /> },
  ouie_2:    { count: 2, label: "sons que tu entends",       icon: <IconEar /> },
  odorat_1:  { count: 1, label: "odeur que tu perçois",      icon: <IconWind /> },
};

const ACTIVE_SENSES: Exclude<SenseStatus, "loading" | "cloture">[] = [
  "vue_4", "toucher_3", "ouie_2", "odorat_1",
];

// ─── Indicateur géométrique 4-3-2-1 ──────────────────────────────────────────
function GeoIndicator({
  completedCount,
  currentSenseKey,
}: {
  completedCount: number;
  currentSenseKey?: Exclude<SenseStatus, "loading" | "cloture"> | null;
}) {
  const nodes = [4, 3, 2, 1];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {nodes.map((n, i) => {
        const done    = i < completedCount;
        const current = i === completedCount;
        const senseAtIndex = ACTIVE_SENSES[i];
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
              ) : current && currentSenseKey ? (
                // Icône du sens actif à la place du chiffre
                <div style={{ transform: "scale(0.52)", transformOrigin: "center" }}>
                  {SENSE_CONFIG[senseAtIndex].icon}
                </div>
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
  return `Tu es le Jumeau Numérique thérapeutique de ${name}. Tu guides un exercice d'ancrage sensoriel 4-3-2-1 pour interrompre une rumination ou une envie compulsive.

TON RÔLE : Tu parles directement à ${name}, à voix haute, avec calme et bienveillance. Tu es sa présence thérapeutique pendant l'exercice.

SIGNAUX : Tu reçois des signaux entre crochets [comme celui-ci]. Ce sont des instructions privées — tu ne les lis JAMAIS à voix haute.
• [ACCUEIL] → démarre l'exercice
• [CLOTURE] → conclus l'exercice + pose la question du check-in
• [SILENCE_RELANCE] → ${name} n'a pas encore répondu, relance doucement

CONTEXTE PATIENT :
${contextInfo}

EXERCICE — ANCRAGE SENSORIEL 4-3-2-1
Objectif : saturer la mémoire de travail avec des perceptions concrètes pour éteindre la rumination.

RÈGLES ABSOLUES :
1. Français uniquement. Voix calme, ancrée, bienveillante.
2. Réponse AUDIO uniquement. Zéro texte.
3. Rebondis toujours sur ce que ${name} a dit — valide avec précision, jamais de façon générique.
4. N'invente JAMAIS de contexte. Si une information n'est pas explicitement présente dans le CONTEXTE PATIENT ci-dessus, ne la mentionne pas et ne la suppose pas. Contexte vide ou générique = accueil chaleureux mais neutre, sans aucune supposition sur la situation de ${name}.

OUTIL DISPONIBLE :
• valider_sens — Appelle cet outil UNIQUEMENT quand ${name} a cité suffisamment d'éléments pour le sens en cours et que tu es prêt à passer au suivant. Ne l'appelle JAMAIS si tu fais une relance pour demander plus d'éléments.

FLOW :
• [ACCUEIL] : accueille ${name} avec chaleur et contexte. Explique brièvement l'exercice. Demande-lui de citer 4 choses qu'il/elle voit autour de lui/elle. Attends.

• Après la VUE (4 choses) :
  → Si ${name} a cité 2 éléments ou plus : valide en rebondissant sur 1-2 éléments concrets. Appelle valider_sens. Puis demande 3 sensations physiques (texture, température, poids, contact).
  → Si ${name} n'a cité qu'un seul élément : relance doucement ("tu en vois d'autres autour de toi ?"). UNE seule relance — après sa réponse, appelle valider_sens quoi qu'il arrive.

• Après le TOUCHER (3 sensations) :
  → Si ${name} a cité 2 sensations ou plus : valide + appelle valider_sens + demande 2 sons distincts.
  → Si ${name} n'a cité qu'une sensation : relance douce. Puis appelle valider_sens.

• Après l'OUÏE (2 sons) :
  → Valide + appelle valider_sens + demande 1 odeur qu'il/elle perçoit (même légère, même imaginée).

• Après l'ODORAT (1 odeur) :
  → Valide + appelle valider_sens. (La clôture sera déclenchée automatiquement.)

• [CLOTURE] : conclus l'exercice avec chaleur en 1-2 phrases. Puis pose UNE question ouverte : "Comment tu te sens maintenant ?" Attends sa réponse.
  → Si ${name} exprime un mieux, du soulagement ou de la détente : valide avec sincérité (1-2 phrases). Invite à reprendre la journée avec cet ancrage.
  → Si ${name} exprime encore de la tension, de la difficulté ou de la confusion : reconnais-le sans minimiser — dis-lui que c'est tout à fait normal, que l'exercice est un outil parmi d'autres, et qu'il/elle peut continuer à déposer ce qu'il/elle ressent dans le chat.

• [SILENCE_RELANCE] : ${name} n'a pas encore répondu au check-in. Relance doucement et avec chaleur : "Prends ton temps… comment tu te sens ?" Attends.`;
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
  const patientSpokeRef     = useRef(false); // patient a répondu (inputAudioTranscription reçue)
  const isAiSpeakingRef     = useRef(false);  // sync direct (pas via useEffect)
  const outputAnalyserRef   = useRef<AnalyserNode | null>(null); // pour PulseOrb
  const wsRef               = useRef<GeminiLiveClient | null>(null);
  const audioCtxRef         = useRef<AudioContext | null>(null);
  const processorRef        = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef      = useRef<MediaStream | null>(null);
  const micEnabledRef       = useRef(false);
  const hardStopRef         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioQueueRef       = useRef<{ data: Float32Array; rate: number }[]>([]);
  const isPlayingRef        = useRef(false);
  const outputTransRef      = useRef("");
  const pendingAdvanceRef   = useRef<(() => void) | null>(null);
  const turnCompleteRef     = useRef(false); // true = Gemini a fini de générer le tour courant
  const cloturePhaseRef     = useRef<0 | 1>(0);   // 0 = Gemini pose la question, 1 = check-in ouvert
  const silenceTimer5sRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimer7sRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      isPlayingRef.current    = false;
      isAiSpeakingRef.current = false;
      setIsAiSpeaking(false);

      // Appliquer le changement d'état en attente — seulement si turnComplete a été reçu.
      // Guard essentiel : Gemini streame l'audio en chunks avec des micro-pauses entre eux.
      // La queue peut être temporairement vide entre deux chunks du même tour.
      // Sans ce guard, pendingAdvanceRef s'appliquerait pendant que Gemini parle encore.
      if (pendingAdvanceRef.current && turnCompleteRef.current) {
        turnCompleteRef.current = false;
        const advance = pendingAdvanceRef.current;
        pendingAdvanceRef.current = null;
        advance(); // peut mettre à jour statusRef.current
      }

      // Re-activer le mic après 300ms selon le contexte
      // (lecture de statusRef.current APRÈS application du pending)
      const st = statusRef.current;
      if (st !== "loading" && st !== "cloture") {
        // Phases de sens actifs : toujours ré-activer
        setTimeout(() => {
          if (statusRef.current !== "loading" && statusRef.current !== "cloture") {
            micEnabledRef.current = true;
            setIsListening(true);
            setWaveActive(true);
          }
        }, 300);
      } else if (st === "cloture" && cloturePhaseRef.current === 1) {
        // Cloture check-in : ré-activer le mic après que Gemini ait parlé
        // (question initiale OU relance silence — dans les deux cas le patient doit pouvoir répondre)
        setTimeout(() => {
          if (statusRef.current === "cloture" && cloturePhaseRef.current === 1) {
            micEnabledRef.current = true;
            setIsListening(true);
            setWaveActive(true);
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
    // Connecter via l'analyser pour que PulseOrb réagisse
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
    isAiSpeakingRef.current = false; // sync immédiat
    setIsAiSpeaking(false);
  }, []);

  // ─── Send text turn to Gemini ─────────────────────────────────────────────
  const sendTurn = useCallback((text: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ realtimeInput: { text } }));
  }, []);

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (hardStopRef.current)     clearTimeout(hardStopRef.current);
    if (silenceTimer5sRef.current) clearTimeout(silenceTimer5sRef.current);
    if (silenceTimer7sRef.current) clearTimeout(silenceTimer7sRef.current);
    pendingAdvanceRef.current = null;
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
        cloturePhaseRef.current = 0;
        setStatus("cloture");
        statusRef.current = "cloture";
        micEnabledRef.current = false;
        setIsListening(false);
        setWaveActive(false);
        setTimeout(() => sendTurn("[CLOTURE]"), 300);
      }
    }, HARD_STOP_MS);
    return () => { if (hardStopRef.current) clearTimeout(hardStopRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── WS message handler ──────────────────────────────────────────────────
  const handleWSMessage = useCallback((event: { data: string }) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(event.data as string) as Record<string, unknown>; }
    catch { return; }

    // Setup complete → déclencher l'accueil via clientContent (tour complet, pas realtimeInput)
    if (msg.setupComplete !== undefined) {
      wsRef.current?.send(JSON.stringify({
        clientContent: {
          turns: [{ role: "user", parts: [{ text: "[ACCUEIL]" }] }],
          turnComplete: true,
        },
      }));
      return;
    }

    // ── Tool call : valider_sens ──────────────────────────────────────────
    const toolCallMsg = msg.toolCall as { functionCalls?: Array<{ name: string; id: string }> } | undefined;
    if (toolCallMsg?.functionCalls) {
      for (const fc of toolCallMsg.functionCalls) {
        if (fc.name === "valider_sens") {
          const st = statusRef.current;
          // Garde-fou : le patient doit avoir réellement parlé pour ce sens,
          // et on ne doit pas être en loading (accueil) ou cloture.
          const isValidContext =
            patientSpokeRef.current &&
            st !== "loading" &&
            st !== "cloture";

          // Toujours répondre au tool call (Gemini bloque s'il n'obtient pas de toolResponse).
          // En cas d'appel prématuré, on renvoie un message d'erreur pour que Gemini
          // comprenne qu'il doit attendre la réponse du patient.
          wsRef.current?.send(JSON.stringify({
            toolResponse: {
              functionResponses: [{
                id: fc.id,
                response: {
                  output: isValidContext
                    ? "ok"
                    : "Erreur : le patient n'a pas encore répondu pour ce sens. Continue à attendre sa réponse avant d'appeler valider_sens.",
                },
              }],
            },
          }));

          if (!isValidContext) break; // Gemini réessaiera après la réponse du patient

          // Préparer l'avancement visuel — appliqué quand l'audio de validation se termine
          patientSpokeRef.current = false;
          const newCount = completedCountRef.current + 1;
          pendingAdvanceRef.current = () => {
            setCompletedCount(newCount);
            completedCountRef.current = newCount;
            navigator.vibrate?.([25, 30, 50]);
            if (newCount >= ACTIVE_SENSES.length) {
              outputTransRef.current   = "";
              cloturePhaseRef.current  = 0;
              setStatus("cloture");
              statusRef.current        = "cloture";
              setTimeout(() => sendTurn("[CLOTURE]"), 400);
            } else {
              const nextSense   = ACTIVE_SENSES[newCount];
              setStatus(nextSense);
              statusRef.current = nextSense;
            }
          };
        }
      }
      return;
    }

    const sc = msg.serverContent as Record<string, unknown> | undefined;
    if (!sc) return;

    // Chunks audio → mic gate + lecture
    const parts = (sc.modelTurn as Record<string, unknown> | undefined)
      ?.parts as Array<Record<string, unknown>> | undefined;
    if (parts) {
      for (const part of parts) {
        const inlineData = part.inlineData as Record<string, unknown> | undefined;
        if (inlineData?.mimeType && typeof inlineData.mimeType === "string"
            && inlineData.mimeType.startsWith("audio/pcm")) {
          const rate = parseInt((inlineData.mimeType.match(/rate=(\d+)/)?.[1]) ?? "24000", 10);
          // Couper le mic dès le premier chunk de Gemini
          isAiSpeakingRef.current = true;
          micEnabledRef.current   = false;
          setIsListening(false);
          setWaveActive(false);
          // Nouveau chunk = turnComplete pas encore reçu pour CE tour
          turnCompleteRef.current = false;
          enqueueAudio(inlineData.data as string, rate);
        }
      }
    }

    // Transcription entrée → patient a répondu
    const inTrans = sc.inputTranscription as Record<string, unknown> | undefined;
    if (inTrans?.text && typeof inTrans.text === "string" && inTrans.text.trim()) {
      patientSpokeRef.current = true;
      // Pendant le check-in de clôture : annuler les timers silence
      if (statusRef.current === "cloture") {
        if (silenceTimer5sRef.current) { clearTimeout(silenceTimer5sRef.current); silenceTimer5sRef.current = null; }
        if (silenceTimer7sRef.current) { clearTimeout(silenceTimer7sRef.current); silenceTimer7sRef.current = null; }
      }
    }

    // Transcription sortie → pour la clôture
    const outTrans = sc.outputTranscription as Record<string, unknown> | undefined;
    if (outTrans?.text && typeof outTrans.text === "string") {
      outputTransRef.current += outTrans.text;
    }

    // Tour Gemini terminé
    if (sc.turnComplete === true) {
      // Signaler que la génération est complète — playNextChunk peut maintenant appliquer pendingAdvanceRef
      turnCompleteRef.current = true;

      // Cas edge : l'audio a fini de jouer AVANT que turnComplete arrive.
      // playNextChunk ne sera plus rappelé → on le déclenche manuellement.
      if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
        playNextChunk();
        return;
      }

      const currentStatus = statusRef.current;

      // ── CLOTURE : deux phases ─────────────────────────────────────────────
      if (currentStatus === "cloture") {
        if (cloturePhaseRef.current === 0) {
          // Gemini vient de poser "comment tu te sens ?" → attendre le patient
          cloturePhaseRef.current = 1;
          patientSpokeRef.current = false;
          // Différer l'activation du mic + timers silence jusqu'à la fin de l'audio
          pendingAdvanceRef.current = () => {
            micEnabledRef.current = true;
            setIsListening(true);
            setWaveActive(true);
            // 5s sans réponse → relance douce
            silenceTimer5sRef.current = setTimeout(() => {
              if (statusRef.current === "cloture" && !patientSpokeRef.current) {
                sendTurn("[SILENCE_RELANCE]");
                // 7s de plus → transition forcée
                silenceTimer7sRef.current = setTimeout(() => {
                  if (statusRef.current === "cloture") {
                    micEnabledRef.current = false;
                    setIsListening(false);
                    setWaveActive(false);
                    const closingWords = outputTransRef.current.trim();
                    const done = completedCountRef.current;
                    const summary = `🪨 Ancrage 4-3-2-1 · ${done}/${ACTIVE_SENSES.length} sens explorés`;
                    if (onTransRef.current) {
                      onTransRef.current(summary, closingWords);
                    } else {
                      onCompRef.current?.();
                    }
                  }
                }, 7000);
              }
            }, 5000);
          };
          return;
        }

        // Phase 1 : Gemini a répondu à quelque chose en cloture
        if (patientSpokeRef.current) {
          // Patient a parlé → Gemini a validé → transition
          patientSpokeRef.current = false;
          if (silenceTimer5sRef.current) { clearTimeout(silenceTimer5sRef.current); silenceTimer5sRef.current = null; }
          if (silenceTimer7sRef.current) { clearTimeout(silenceTimer7sRef.current); silenceTimer7sRef.current = null; }
          // Différer la transition jusqu'à la fin de l'audio de Gemini
          pendingAdvanceRef.current = () => {
            const closingWords = outputTransRef.current.trim();
            const done = completedCountRef.current;
            const summary = `🪨 Ancrage 4-3-2-1 · ${done}/${ACTIVE_SENSES.length} sens explorés`;
            setTimeout(() => {
              if (onTransRef.current) {
                onTransRef.current(summary, closingWords);
              } else {
                onCompRef.current?.();
              }
            }, 400);
          };
        }
        // Si patientSpokeRef = false → Gemini a répondu à la relance silence, on attend encore
        return;
      }

      // ── Premier tour : ACCUEIL terminé → passer au premier sens ──────────
      if (currentStatus === "loading") {
        patientSpokeRef.current = false;
        // Différer jusqu'à la fin de l'audio de l'accueil
        pendingAdvanceRef.current = () => {
          setStatus("vue_4");
          statusRef.current = "vue_4";
          // mic activé par playNextChunk (300ms) après pendingAdvanceRef
        };
        return;
      }

      // ── Tours suivants (sens actifs) : l'avancement est piloté par le tool call valider_sens ──
      // pendingAdvanceRef est positionné dans le handler toolCall ci-dessus.
      // playNextChunk réactivera le mic après l'audio de relance ou de validation.
    }

    // Patient coupe → flush audio
    if (sc.interrupted === true) flushAudio();
  }, [sendTurn, enqueueAudio, flushAudio, playNextChunk]);

  // ─── Init session ─────────────────────────────────────────────────────────
  const initSession = useCallback(async () => {

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
      stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
      mediaStreamRef.current = stream;
    } catch {
      setLoadError("Accès micro refusé. Active le micro pour cet exercice.");
      return;
    }

    // 3. AudioContext + analyser pour PulseOrb
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.connect(audioCtx.destination);
    outputAnalyserRef.current = analyser;
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

    // 4. WebSocket Gemini Live
    const ws = new GeminiLiveClient();
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: toVertexModelPath(GEMINI_MODEL),
          generationConfig: {
            responseModalities: ["AUDIO"],
          },
          outputAudioTranscription: {},
          inputAudioTranscription:  {},
          systemInstruction: { parts: [{ text: systemPrompt }] },
          tools: [{
            functionDeclarations: [{
              name: "valider_sens",
              description: "Appelle cet outil quand le patient a cité suffisamment d'éléments pour le sens en cours et que tu es prêt à passer au suivant. Ne l'appelle JAMAIS si tu poses une relance pour demander plus d'éléments.",
              parameters: { type: "object", properties: {} },
            }],
          }],
        },
      }));
    };

    ws.onmessage = handleWSMessage;
    ws.onerror   = () => setLoadError("Connexion Gemini Live échouée.");
    ws.onclose = (evt) => {
      if (statusRef.current === "loading") {
        setLoadError(`Connexion fermée (code ${evt.code}). Vérifie ta clé API Gemini Live.`);
      }
    };
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
        @keyframes an-loading-bar {
          0%   { left: -45%; }
          100% { left: 110%; }
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

      {/* ── Header exercice ────────────────────────────────────────────────── */}
      {status !== "cloture" && !loadError && (
        <div style={{
          position: "absolute", top: 30,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          pointerEvents: "none",
        }}>
          <p style={{
            margin: 0, fontSize: 11, fontWeight: 400,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: `rgba(212,162,85,0.45)`,
          }}>
            Ancrage sensoriel
          </p>
        </div>
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
        <div style={{ paddingTop: 72, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, zIndex: 1 }}>
          <GeoIndicator completedCount={completedCount} currentSenseKey={senseKey} />
          {senseKey && (
            <p style={{ margin: 0, fontSize: 10, color: TEXT_FADED, letterSpacing: 1.3, textTransform: "uppercase" }}>
              {completedCount} / 4 sens explorés
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
              <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED, letterSpacing: 0.4, animation: "an-fade-in 0.3s ease" }}>
                Connexion en cours…
              </p>
              <div style={{ width: 160, height: 2, borderRadius: 2, background: OCHRE_DIM, overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "45%", borderRadius: 2, background: `linear-gradient(90deg, transparent 0%, ${OCHRE} 50%, transparent 100%)`, animation: "an-loading-bar 1.6s ease-in-out infinite" }} />
              </div>
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

              {/* Orb toujours visible + "Je t'écoute" quand c'est au patient */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <PulseOrb
                  speaking={isAiSpeaking}
                  analyser={outputAnalyserRef.current}
                  color={OCHRE}
                  size={160}
                />
                {isListening && !isAiSpeaking && (
                  <p style={{
                    margin: 0, fontSize: 13, fontWeight: 300,
                    letterSpacing: "0.14em",
                    color: `rgba(212,162,85,0.55)`,
                    animation: "an-fade-in 0.3s ease",
                  }}>
                    Je t&apos;écoute…
                  </p>
                )}
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
                style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: TEXT_WARM, textAlign: "center" }}
              >
                {isAiSpeaking
                  ? "Ton Jumeau conclut…"
                  : isListening
                  ? "Je t'écoute…"
                  : `Magnifique ${firstName}. Ton esprit est de retour dans la pièce.`}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ── Onde ocre (bas d'écran) ───────────────────────────────────────── */}
      {!loadError && (
        <div style={{ paddingBottom: 34, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1 }}>
          <OchreWave active={waveActive} />
        </div>
      )}
    </div>
  );
}
