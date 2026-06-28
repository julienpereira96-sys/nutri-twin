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
import { getSelectedGeminiVoice } from "@/lib/therapeuticVoice";
import { GeminiLiveClient, toVertexModelPath } from "@/lib/geminiLiveClient";
import PulseOrb from "./PulseOrb";

// ─── Design ───────────────────────────────────────────────────────────────────
const ACCENT        = "#10b981";
const ACCENT_GLOW   = "rgba(16,185,129,0.55)";
const ACCENT_DIM    = "rgba(16,185,129,0.10)";
const ACCENT_BORDER = "rgba(16,185,129,0.28)";
const TEXT_MUTED    = "rgba(255,255,255,0.30)";

// ─── GreenWave — onde audio-réactive pour l'écoute patient (checkpoint) ───────
function GreenWave({ active, analyser }: { active: boolean; analyser?: AnalyserNode | null }) {
  const barsRef   = useRef<(HTMLDivElement | null)[]>([]);
  const activeRef = useRef(active);
  const anRef     = useRef<AnalyserNode | null | undefined>(analyser);
  activeRef.current = active;
  anRef.current     = analyser;

  useEffect(() => {
    const buf = new Uint8Array(32);
    let raf: number;
    let t = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      t += 0.06;
      const isActive = activeRef.current;
      const an = anRef.current;
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        let h: number;
        if (isActive && an) {
          an.getByteFrequencyData(buf);
          const raw = buf[Math.floor((i / barsRef.current.length) * buf.length)] / 255;
          h = 4 + raw * 28;
        } else if (isActive) {
          h = 6 + 10 * Math.abs(Math.sin(t + i * 0.5));
        } else {
          h = 3 + 1.5 * Math.abs(Math.sin(t * 0.4 + i * 0.4));
        }
        bar.style.height  = `${h}px`;
        bar.style.opacity = isActive ? "0.75" : "0.18";
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 40 }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} ref={el => { barsRef.current[i] = el; }} style={{
          width: 3, height: 4, borderRadius: 2,
          background: ACCENT,
          transition: "height 0.05s ease, opacity 0.3s ease",
        }} />
      ))}
    </div>
  );
}

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
const GEMINI_MODEL  = "models/gemini-live-2.5-flash-native-audio";

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = "loading" | "intake" | "intro" | "breathing_cycle" | "checkpoint" | "cloture";

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
  return `Tu es le Jumeau Numérique thérapeutique de ${name}. Tu guides un exercice de cohérence cardiaque en temps réel.

TON RÔLE : Tu parles directement à ${name}, à voix haute, avec douceur. Tu es sa présence thérapeutique pendant l'exercice — pas un assistant, pas un narrateur. Un accompagnant incarné.

SIGNAUX : Tu reçois des signaux entre crochets [comme celui-ci]. Ce sont des instructions privées pour toi — tu ne les lis JAMAIS à voix haute. Tu les utilises pour savoir quoi faire, puis tu parles naturellement.

CONTEXTE PATIENT :
${contextInfo}

RYTHME : ${INSPIRE_DUR}s inspire / ${EXPIRE_DUR}s expire (cycle de ${CYCLE_DUR}s)

RÈGLES ABSOLUES :
1. Français uniquement. Voix douce, grave, lente — présence parasympathique.
2. Réponse AUDIO uniquement. Zéro texte.
3. Adapte chaque intervention au contexte de ${name}. Jamais générique.
4. N'invente JAMAIS de contexte. Si une information n'est pas explicitement présente dans le CONTEXTE PATIENT ci-dessus, ne la mentionne pas et ne la suppose pas. Contexte vide ou générique = accueil chaleureux mais neutre, sans aucune supposition sur la situation de ${name}.

FLOW :

• [DEBUT] — ACCUEIL ET CHECK-IN :
  Accueille chaleureusement ${name} avec une phrase naturelle. Intègre une question courte et ouverte sur son état actuel ou ce qui l'amène ici — contextuelle à la cohérence cardiaque, jamais clinique. Attends sa réponse vocale. Accuse réception en une phrase empathique qui fait le lien avec ce qu'on va faire ensemble. Si ${name} ne répond pas dans les 12 secondes, enchaîne doucement sans attendre. Puis silence.

• [ACCUEIL] — DÉMARRAGE DU SOUFFLE : Tu sais ce que traverse ${name} en ce moment. Crée un espace de calme, invite à s'installer et à fermer les yeux si possible. Puis une phrase de transition qui amorce le premier souffle — naturelle, sans mentionner "l'exercice" ni "la respiration". Puis silence absolu.

• [MURMURE — inspire en cours] / [MURMURE — expire en cours] : tu reçois ces signaux 3 fois par bloc, à des moments précis.
  À chaque signal : une seule phrase murmurée, profondément adaptée au contexte de ${name}. Ni trop courte pour être vide, ni trop longue pour alourdir — laisse le souffle guider sa longueur naturelle.
  INTERDIT pendant les cycles : questions, dialogue, sollicitations. Zéro.
  Ne répète JAMAIS deux fois la même phrase sur toute la durée de l'exercice.
  Le reste du temps : silence absolu.

• [CHECKPOINT] : STOP IMMÉDIAT. Tu sors du mode respiration. Change complètement de registre.
  Pose une question empathique courte (1-2 phrases) pour savoir comment ${name} se sent maintenant. Écoute la réponse vocale.
  - ${name} va MIEUX, se sent apaisé·e, soulagé·e, plus calme → accueille avec chaleur et sincérité, termine EXACTEMENT par "On s'arrête là."
  - ${name} ne se sent PAS MIEUX, toujours tendu·e, anxieux·se, peu de changement → accueille avec bienveillance, termine EXACTEMENT par "On repart ensemble." puis une phrase d'ancrage douce pour le souffle suivant. Puis silence.
  - ${name} est AMBIGU·E ("bof", "pas trop mal", "moyen", hésitant·e) → pose une question directe et douce ("Tu veux qu'on s'arrête là ou qu'on continue ?"), écoute. Si continue → termine par "On repart ensemble." Si s'arrêter → termine par "On s'arrête là."
  - ${name} exprime une DÉTRESSE ou souffrance → accueille avec empathie totale, reste présent·e, termine EXACTEMENT par "Je t'entends."
  - Réponse toujours ambiguë après la question directe → termine par "On s'arrête là."

• [SILENCE_CHECKPOINT] : ${name} n'a pas encore répondu. Relance doucement avec son prénom et une question courte et bienveillante. Attends.

• [CLOTURE] : Conclus avec sincérité. Félicite ${name} pour ce moment de soin. Rappelle-lui que tu restes présent·e dans le chat si besoin. 2-3 phrases max. Invite à reprendre doucement sa journée.`;
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
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [breathPhaseLabel, setBreathPhaseLabel] = useState<"inspire" | "expire" | null>(null);
  const [checkpointGeminiHasSpoken, setCheckpointGeminiHasSpoken] = useState(false);
  const [intakeGeminiHasSpoken, setIntakeGeminiHasSpoken] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const statusRef      = useRef<Status>("loading");
  const blockCountRef  = useRef(0);
  const wsRef          = useRef<GeminiLiveClient | null>(null);
  const audioCtxRef         = useRef<AudioContext | null>(null);
  const outputAnalyserRef   = useRef<AnalyserNode | null>(null);
  const inputAnalyserRef    = useRef<AnalyserNode | null>(null); // pour GreenWave (voix patient)
  const processorRef   = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const micEnabledRef  = useRef(false);           // mic ON/OFF selon la phase
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef     = useRef(0);               // secondes dans le bloc courant
  const hardStopRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioQueueRef  = useRef<{ data: Float32Array; rate: number }[]>([]);
  const isPlayingRef        = useRef(false);
  const isAiSpeakingRef     = useRef(false);   // pour bloquer l'écho mic en temps réel
  const outputTransRef      = useRef("");              // transcription de Gemini (checkpoint)
  const outcomeRef          = useRef<"positive" | "negative" | "interrupted">("positive");
  const clotureHandledRef   = useRef(false);           // garde-fou double-close
  const clotureFallbackRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decisionFiredRef    = useRef(false);           // garde-fou double turnComplete au checkpoint
  const cpSilenceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);  // 8s → relance
  const cpForceCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 14s → force stop

  // ── Refs intake ────────────────────────────────────────────────────────────
  const intakeMessageRef       = useRef("");
  const intakePatientSpokeRef  = useRef(false);
  const intakeTimeoutRef       = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Log silencieux vers /api/exercise/log ─────────────────────────────────
  const logBreathingSession = useCallback(async (outcome: "positive" | "negative" | "interrupted", blocks: number) => {
    if (!patientId || !practitionerId) return;
    try {
      await fetch("/api/exercise/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          practitionerId,
          exerciseType: "breathing",
          intakeMessage: intakeMessageRef.current || undefined,
          emergencyExit: outcome === "interrupted",
          extra: { blocks_completed: blocks, outcome },
        }),
      });
    } catch { /* silencieux */ }
  }, [patientId, practitionerId]);

  // Stable refs pour callbacks dans closures
  const onTransitionToChatRef = useRef(onTransitionToChat);
  const onCloseRef            = useRef(onClose);
  useEffect(() => { onTransitionToChatRef.current = onTransitionToChat; }, [onTransitionToChat]);
  useEffect(() => { onCloseRef.current            = onClose;            }, [onClose]);
  useEffect(() => { statusRef.current        = status;       }, [status]);
  useEffect(() => { blockCountRef.current   = blockCount;   }, [blockCount]);
  // isAiSpeakingRef est synchronisé directement dans playNextChunk/flushAudio — pas via useEffect

  // ── Audio playback queue ───────────────────────────────────────────────────
  const playNextChunk = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      isAiSpeakingRef.current = false;
      setIsAiSpeaking(false);
      // Checkpoint : Gemini vient de finir de parler
      // Si aucune décision n'a encore été prise → réactiver le mic (patient doit répondre)
      // 300ms de délai pour absorber les micro-pauses entre chunks Gemini
      if (statusRef.current === "checkpoint" && !decisionFiredRef.current) {
        setTimeout(() => {
          if (statusRef.current === "checkpoint" && !decisionFiredRef.current) {
            micEnabledRef.current = true;
            // Timer silence : 8s sans réponse → relance douce, 6s de plus → force stop
            if (cpSilenceTimerRef.current) clearTimeout(cpSilenceTimerRef.current);
            if (cpForceCloseTimerRef.current) clearTimeout(cpForceCloseTimerRef.current);
            cpSilenceTimerRef.current = setTimeout(() => {
              if (statusRef.current === "checkpoint" && !decisionFiredRef.current) {
                sendTurn("[SILENCE_CHECKPOINT]");
                cpForceCloseTimerRef.current = setTimeout(() => {
                  if (statusRef.current === "checkpoint" && !decisionFiredRef.current) {
                    decisionFiredRef.current = true;
                    micEnabledRef.current = false;
                    outcomeRef.current = "positive";
                    handleClotureRef.current();
                  }
                }, 6000);
              }
            }, 8000);
          }
        }, 300);
      }
      return;
    }
    isPlayingRef.current = true;
    isAiSpeakingRef.current = true;
    setIsAiSpeaking(true);
    const { data, rate } = audioQueueRef.current.shift()!;
    const buf = ctx.createBuffer(1, data.length, rate);
    buf.getChannelData(0).set(data);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(outputAnalyserRef.current ?? ctx.destination);
    src.onended = playNextChunk;
    src.start(0);
  }, []);

  const enqueueAudio = useCallback((base64: string, sampleRate = 24000) => {
    audioQueueRef.current.push({ data: pcm16Base64ToFloat32(base64), rate: sampleRate });
    if (!isPlayingRef.current) playNextChunk();
  }, [playNextChunk]);

  const flushAudio = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current    = false;
    isAiSpeakingRef.current = false;  // sync immédiat
    setIsAiSpeaking(false);
  }, []);

  // ── Send text turn to Gemini ───────────────────────────────────────────────
  const sendTurn = useCallback((text: string) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ realtimeInput: { text } }));
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (hardStopRef.current) clearTimeout(hardStopRef.current);
    if (clotureFallbackRef.current) clearTimeout(clotureFallbackRef.current);
    if (intakeTimeoutRef.current) clearTimeout(intakeTimeoutRef.current);
    if (cpSilenceTimerRef.current) clearTimeout(cpSilenceTimerRef.current);
    if (cpForceCloseTimerRef.current) clearTimeout(cpForceCloseTimerRef.current);
    intervalRef.current = null;
    micEnabledRef.current = false;
    processorRef.current?.disconnect();
    processorRef.current = null;
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    outputAnalyserRef.current = null;
    inputAnalyserRef.current  = null;
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
    if (clotureHandledRef.current) return;          // garde-fou double-call
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    micEnabledRef.current = false;
    setStatus("cloture");
    setBreathPhaseLabel(null);
    outputTransRef.current = "";
    // Demande à Gemini de conclure
    setTimeout(() => sendTurn("[CLOTURE]"), 400);
    // Fallback : log + fermeture après 12s si turnComplete ne se déclenche pas
    clotureFallbackRef.current = setTimeout(() => {
      if (!clotureHandledRef.current) {
        clotureHandledRef.current = true;
        void logBreathingSession(outcomeRef.current, blockCountRef.current);
        cleanup();
        onCloseRef.current();
      }
    }, 12000);
  }, [sendTurn, logBreathingSession, cleanup]);

  // ── Start a 60s breathing block ────────────────────────────────────────────
  const startBreathingBlock = useCallback(() => {
    elapsedRef.current = 0;
    micEnabledRef.current = false;   // mic OFF pendant le souffle
    setStatus("breathing_cycle");

    hapticInspire();
    setBreathPhaseLabel("inspire");

    // 3 murmures planifiés à des moments précis du bloc (en ms depuis le début)
    // 14s → 2e expire | 30s → 4e inspire | 44s → 5e expire
    const murmureTimers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => { if (!isPlayingRef.current) sendTurn("[MURMURE — expire en cours]"); }, 14000),
      setTimeout(() => { if (!isPlayingRef.current) sendTurn("[MURMURE — inspire en cours]"); }, 30000),
      setTimeout(() => { if (!isPlayingRef.current) sendTurn("[MURMURE — expire en cours]"); }, 44000),
    ];

    // setInterval — uniquement pour les labels visuels et la fin de bloc
    intervalRef.current = setInterval(() => {
      elapsedRef.current += 1;
      const pos = elapsedRef.current % CYCLE_DUR;

      if (pos === INSPIRE_DUR) {
        hapticExpire();
        setBreathPhaseLabel("expire");
      } else if (pos === 0) {
        hapticInspire();
        setBreathPhaseLabel("inspire");
      }

      if (elapsedRef.current >= BLOCK_DUR) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        murmureTimers.forEach(t => clearTimeout(t));
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

    setStatus("checkpoint");
    setBreathPhaseLabel(null);
    setCheckpointGeminiHasSpoken(false);
    outputTransRef.current = "";
    decisionFiredRef.current = false;

    // Attendre que Gemini finisse de parler avant d'envoyer [CHECKPOINT]
    // (évite que le signal soit ignoré si Gemini est encore en train de murmurer)
    const waitAndSend = () => {
      if (isPlayingRef.current) {
        setTimeout(waitAndSend, 100);
      } else {
        // 400ms de silence avant le checkpoint — rupture claire de registre
        setTimeout(() => {
          micEnabledRef.current = true;
          sendTurn("[CHECKPOINT]");
        }, 400);
      }
    };
    waitAndSend();
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
    if (decisionFiredRef.current) return;  // éviter double déclenchement sur turnComplete partiel
    const lower = text.toLowerCase();
    const hasDecision = lower.includes("on repart") || lower.includes("on s'arrête") || lower.includes("je t'entends");
    if (!hasDecision) return;  // Gemini pose encore une question → on attend le prochain turnComplete
    decisionFiredRef.current = true;
    // Annuler les timers silence dès qu'une décision est détectée
    if (cpSilenceTimerRef.current) { clearTimeout(cpSilenceTimerRef.current); cpSilenceTimerRef.current = null; }
    if (cpForceCloseTimerRef.current) { clearTimeout(cpForceCloseTimerRef.current); cpForceCloseTimerRef.current = null; }
    if (lower.includes("on repart")) {
      // Continuer → prochain bloc
      micEnabledRef.current = false;
      outcomeRef.current = "positive";
      if (blockCountRef.current >= MAX_BLOCKS) {
        handleClotureRef.current();
      } else {
        // Attendre que Gemini finisse "On repart ensemble. + ancrage" avant de démarrer le bloc
        const waitForAudioEnd = () => {
          if (!isPlayingRef.current) {
            setTimeout(() => startBreathingRef.current(), 400);
          } else {
            setTimeout(waitForAudioEnd, 100);
          }
        };
        waitForAudioEnd();
      }
    } else if (lower.includes("je t'entends")) {
      // Détresse → log négatif + transition vers le chat
      micEnabledRef.current = false;
      outcomeRef.current = "negative";
      const blocs = blockCountRef.current;
      void logBreathingSession("negative", blocs);
      cleanup();
      onTransitionToChatRef.current(
        `Je viens de faire un exercice de cohérence cardiaque (${blocs} bloc${blocs > 1 ? "s" : ""}), mais je ne me sens pas bien.`
      );
    } else if (lower.includes("on s'arrête")) {
      // Arrêt propre
      micEnabledRef.current = false;
      outcomeRef.current = "positive";
      setTimeout(() => handleClotureRef.current(), 1200);
    }
  }, [logBreathingSession, cleanup]);

  // ── WS message handler ────────────────────────────────────────────────────
  const handleWSMessage = useCallback((event: { data: string }) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(event.data as string) as Record<string, unknown>; }
    catch { return; }

    // Setup complete → phase intake : check-in Gemini avant l'exercice
    if (msg.setupComplete !== undefined) {
      setStatus("intake");
      statusRef.current = "intake";
      intakeMessageRef.current      = "";
      intakePatientSpokeRef.current = false;
      setIntakeGeminiHasSpoken(false);
      micEnabledRef.current         = true;  // mic ON dès l'accueil pour capter la réponse patient
      wsRef.current?.send(JSON.stringify({
        clientContent: {
          turns: [{ role: "user", parts: [{ text: "[DEBUT]" }] }],
          turnComplete: true,
        },
      }));
      return;
    }

    const sc = msg.serverContent as Record<string, unknown> | undefined;
    if (!sc) return;

    // Chunks audio de Gemini → lecture
    const parts = (sc.modelTurn as Record<string, unknown> | undefined)
      ?.parts as Array<Record<string, unknown>> | undefined;
    if (parts) {
      for (const part of parts) {
        const inlineData = part.inlineData as Record<string, unknown> | undefined;
        if (inlineData?.mimeType && typeof inlineData.mimeType === "string"
            && inlineData.mimeType.startsWith("audio/pcm")) {
          const rate = parseInt((inlineData.mimeType.match(/rate=(\d+)/)?.[1]) ?? "24000", 10);
          // Couper le mic immédiatement dès le premier chunk audio de Gemini —
          // avant même de l'enqueuer, pour éviter que du résidu patient parte vers le serveur
          isAiSpeakingRef.current = true;
          if (statusRef.current === "checkpoint") {
            micEnabledRef.current = false;
            setCheckpointGeminiHasSpoken(true);
          }
          if (statusRef.current === "intake") {
            setIntakeGeminiHasSpoken(true);
          }
          enqueueAudio(inlineData.data as string, rate);
        }
      }
    }

    // Transcription entrée patient — capturer pendant l'intake
    const inTrans = sc.inputTranscription as Record<string, unknown> | undefined;
    if (inTrans?.text && typeof inTrans.text === "string" && inTrans.text.trim()) {
      if (statusRef.current === "intake") {
        intakeMessageRef.current += inTrans.text;
        intakePatientSpokeRef.current = true;
      }
    }

    // Transcription sortie de Gemini (utilisée au checkpoint)
    const outTrans = sc.outputTranscription as Record<string, unknown> | undefined;
    if (outTrans?.text && typeof outTrans.text === "string") {
      outputTransRef.current += outTrans.text;
    }

    // Tour Gemini terminé
    if (sc.turnComplete === true) {
      const currentStatus = statusRef.current;

      // ── Intake : check-in avant le souffle ──────────────────────────────
      if (currentStatus === "intake") {
        if (!intakePatientSpokeRef.current) {
          // Tour 1 : Gemini vient de poser sa question. Mic déjà ON.
          // Timeout 12s : si pas de réponse patient, on avance quand même.
          intakeTimeoutRef.current = setTimeout(() => {
            if (statusRef.current !== "intake") return;
            if (intakeTimeoutRef.current) clearTimeout(intakeTimeoutRef.current);
            micEnabledRef.current = false;
            setStatus("intro");
            statusRef.current = "intro";
            const waitAndSend = () => {
              if (isPlayingRef.current) { setTimeout(waitAndSend, 100); return; }
              setTimeout(() => wsRef.current?.send(JSON.stringify({
                clientContent: { turns: [{ role: "user", parts: [{ text: "[ACCUEIL]" }] }], turnComplete: true },
              })), 400);
            };
            waitAndSend();
          }, 12000);
        } else {
          // Tour 2 : Gemini accuse réception. Avancer vers le souffle.
          if (intakeTimeoutRef.current) { clearTimeout(intakeTimeoutRef.current); intakeTimeoutRef.current = null; }
          micEnabledRef.current = false;
          const waitAndSend = () => {
            if (isPlayingRef.current) { setTimeout(waitAndSend, 100); return; }
            setStatus("intro");
            statusRef.current = "intro";
            setTimeout(() => wsRef.current?.send(JSON.stringify({
              clientContent: { turns: [{ role: "user", parts: [{ text: "[ACCUEIL]" }] }], turnComplete: true },
            })), 400);
          };
          waitAndSend();
        }
        return;
      }

      // Intro terminée → démarrer le premier bloc (attendre la fin de l'audio)
      if (currentStatus === "intro") {
        const waitForAudioEnd = () => {
          if (!isPlayingRef.current) {
            setTimeout(() => startBreathingRef.current(), 400);
          } else {
            setTimeout(waitForAudioEnd, 100);
          }
        };
        waitForAudioEnd();
        return;
      }

      // Checkpoint : analyser la décision de Gemini
      if (currentStatus === "checkpoint") {
        checkCheckpointDecision(outputTransRef.current);
        return;
      }

      // Cloture terminée → log silencieux + fermeture (guard double-close)
      if (currentStatus === "cloture") {
        if (!clotureHandledRef.current) {
          clotureHandledRef.current = true;
          if (clotureFallbackRef.current) clearTimeout(clotureFallbackRef.current);
          const blocs = blockCountRef.current;
          void logBreathingSession(outcomeRef.current, blocs);
          setTimeout(() => { cleanup(); onCloseRef.current(); }, 800);
        }
      }
    }

    // Patient coupe → flush audio Gemini
    if (sc.interrupted === true) flushAudio();

  }, [sendTurn, enqueueAudio, flushAudio, checkCheckpointDecision, firstName]);

  // ── Init session ───────────────────────────────────────────────────────────
  const initSession = useCallback(async () => {
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
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000, channelCount: 1,
          echoCancellation: true,   // empêche Gemini d'entendre sa propre voix
          noiseSuppression: true,
          autoGainControl: false,
        },
        video: false,
      });
      mediaStreamRef.current = stream;
    } catch {
      setLoadError("Accès micro refusé. Active le micro pour cet exercice.");
      return;
    }

    // 3. AudioContext
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;

    // Analyser sur la sortie audio Gemini — lu par PulseOrb pour moduler le glow
    const outAnalyser = audioCtx.createAnalyser();
    outAnalyser.fftSize = 256;
    outAnalyser.connect(audioCtx.destination);
    outputAnalyserRef.current = outAnalyser;

    const micSrc = audioCtx.createMediaStreamSource(stream);
    // Analyser branché en parallèle sur le mic (pour GreenWave — aucun son en sortie)
    const inputAnalyser = audioCtx.createAnalyser();
    inputAnalyser.fftSize = 256;
    inputAnalyserRef.current = inputAnalyser;
    micSrc.connect(inputAnalyser);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const proc    = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = proc;
    micSrc.connect(proc);
    proc.connect(audioCtx.destination);

    proc.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!micEnabledRef.current) return;       // silence pendant le souffle
      if (isAiSpeakingRef.current) return;      // bloquer l'écho pendant que Gemini parle
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
  }, [sosContext, firstName, handleWSMessage]);

  // Mount → init
  useEffect(() => { void initSession(); }, []); // eslint-disable-line

  // Mettre à jour le handler WS quand il change
  useEffect(() => {
    if (wsRef.current) wsRef.current.onmessage = handleWSMessage;
  }, [handleWSMessage]);

  // ── Close (avant ou pendant l'exercice = interrompu) ─────────────────────
  const handleClose = useCallback(() => {
    void logBreathingSession("interrupted", blockCountRef.current);
    cleanup();
    onCloseRef.current();
  }, [cleanup, logBreathingSession]);

  // ─── Render ───────────────────────────────────────────────────────────────

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
      {/* ── Close (toujours visible — dim pendant breathing_cycle) ───────── */}
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
          opacity: status === "breathing_cycle" ? 0.3 : 1,
          transition: "opacity 0.4s ease",
        }}
      >×</button>

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

      {/* ══ ORB PRINCIPALE — permanente hors loading ════════════════════════ */}
      {status !== "loading" && !loadError && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
          <PulseOrb
            color={ACCENT}
            speaking={isAiSpeaking}
            analyser={outputAnalyserRef.current}
            size={200}
            breathPhase={status === "breathing_cycle" ? breathPhaseLabel : null}
          />
          {/* "Je t'écoute" sous l'orbe — intake ou checkpoint */}
          {((status === "intake" && intakeGeminiHasSpoken) || (status === "checkpoint" && checkpointGeminiHasSpoken)) && !isAiSpeaking && (
            <p style={{
              margin: 0, color: ACCENT, fontSize: 14,
              letterSpacing: "0.05em",
              animation: "br-fade-in 0.8s ease",
            }}>
              Je t&apos;écoute…
            </p>
          )}
        </div>
      )}

      {/* ── Header exercice (tous états sauf cloture) ────────────────────── */}
      {status !== "cloture" && !loadError && (
        <div style={{
          position: "absolute", top: 30,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          pointerEvents: "none",
        }}>
          <p style={{
            margin: 0, fontSize: 11, fontWeight: 400,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: "rgba(16,185,129,0.45)",
          }}>
            Cohérence cardiaque
          </p>
          {status === "breathing_cycle" && (
            <p style={{
              margin: 0, fontSize: 10, fontWeight: 300,
              letterSpacing: "0.12em",
              color: "rgba(255,255,255,0.18)",
            }}>
              Bloc {blockCount + 1} · {MAX_BLOCKS} min
            </p>
          )}
        </div>
      )}

      {/* ── Phase bar + label (inspire / expire) ─────────────────────────── */}
      {status === "breathing_cycle" && breathPhaseLabel && (
        <div key={breathPhaseLabel} style={{
          position: "absolute", bottom: 72,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
          pointerEvents: "none", animation: "br-fade-in 0.3s ease",
        }}>
          {/* Barre de progression */}
          <div style={{ width: 120, height: 3, borderRadius: 3, background: "rgba(16,185,129,0.14)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 3,
              background: "linear-gradient(90deg, rgba(16,185,129,0.5), #10B981)",
              animation: breathPhaseLabel === "inspire"
                ? "br-inspire-fill 4s linear forwards"
                : "br-expire-drain 6s linear forwards",
            }} />
          </div>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 300,
            letterSpacing: "0.22em", textTransform: "uppercase",
            color: "rgba(16,185,129,0.65)",
          }}>
            {breathPhaseLabel === "inspire" ? "Inspire" : "Expire"}
          </p>
        </div>
      )}

      {/* ── Hint "yeux fermés" (disparaît après 5s) ─────────────────────── */}
      {status === "breathing_cycle" && (
        <p style={{
          position: "absolute", bottom: 40,
          fontSize: 12, color: "rgba(16,185,129,0.55)",
          letterSpacing: "0.06em", textAlign: "center",
          animation: "br-fade-out 5s ease forwards",
          pointerEvents: "none",
        }}>
          Tu peux fermer les yeux
        </p>
      )}

      {/* ── Status loading ────────────────────────────────────────────────── */}
      {(status === "loading") && !loadError && (
        <div style={{
          marginTop: 36,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
        }}>
          <div style={{
              width: 68, height: 68, borderRadius: "50%",
              background: "rgba(16,185,129,0.08)",
              border: "1.5px solid rgba(16,185,129,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 28px rgba(16,185,129,0.18)",
              animation: "br-blink 3s ease-in-out infinite",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <p style={{
            margin: 0, color: "#10B981", fontSize: 13,
            letterSpacing: "0.10em", fontWeight: 400,
            animation: "br-blink 2s ease-in-out infinite",
          }}>
            Connexion en cours…
          </p>
          <div style={{ width: 160, height: 2, borderRadius: 2, background: "rgba(16,185,129,0.12)", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: "45%", borderRadius: 2, background: "linear-gradient(90deg, transparent 0%, #10B981 50%, transparent 100%)", animation: "br-loading-bar 1.6s ease-in-out infinite" }} />
          </div>
        </div>
      )}

      {/* ── GreenWave (bas d'écran) — intake ou checkpoint ──────────────────── */}
      {(status === "intake" || status === "checkpoint") && !loadError && (
        <div style={{ position: "absolute", bottom: 34, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1 }}>
          {status === "intake" && (
            <GreenWave
              active={intakeGeminiHasSpoken && !isAiSpeaking}
              analyser={intakeGeminiHasSpoken && !isAiSpeaking ? inputAnalyserRef.current : undefined}
            />
          )}
          {status === "checkpoint" && (
            <GreenWave
              active={checkpointGeminiHasSpoken && !isAiSpeaking}
              analyser={checkpointGeminiHasSpoken && !isAiSpeaking ? inputAnalyserRef.current : undefined}
            />
          )}
        </div>
      )}

      {/* ── Keyframes ─────────────────────────────────────────────────────── */}
      <style>{`
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
        @keyframes br-loading-bar {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(280%); }
        }
        @keyframes br-inspire-fill {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes br-expire-drain {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
