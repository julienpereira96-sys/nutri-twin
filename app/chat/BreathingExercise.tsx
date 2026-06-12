"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { IconWave, IconCheckRing } from "./SosIcons";

// ─── Design tokens (mirroring page.tsx) ──────────────────────────────────────
const CYAN = "#06b6d4";
const TEXT_PRIMARY = "rgba(255,255,255,0.88)";
const TEXT_SECONDARY = "rgba(255,255,255,0.45)";
const TEXT_MUTED = "rgba(255,255,255,0.22)";

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = "INTRO" | "READY_CHECK" | "BREATHING_LOOP" | "COMPLETED";
type Phase = "inhale" | "exhale";

export interface BreathingExerciseProps {
  sosContext: string;
  firstName: string;
  onCompleted: () => void;
  onClose: () => void;
}

// ─── Contextual intro texts (4 variants) ─────────────────────────────────────
function getIntroText(sosContext: string, firstName: string): string {
  const ctx = sosContext.toLowerCase();
  if (
    ctx.includes("stress") ||
    ctx.includes("anxiété") ||
    ctx.includes("angoiss") ||
    ctx.includes("tension")
  ) {
    return (
      `${firstName}, le stress que tu ressens en ce moment est réel. ` +
      `Ton système nerveux cherche à te protéger. ` +
      `On va lui envoyer un signal de sécurité — ensemble, par la respiration. ` +
      `Trois minutes de souffle conscient suffisent pour calmer ton cœur et apaiser ton esprit.`
    );
  }
  if (
    ctx.includes("fringale") ||
    ctx.includes("faim") ||
    ctx.includes("envie de manger") ||
    ctx.includes("grignoter")
  ) {
    return (
      `${firstName}, parfois ce que tu ressens comme une fringale ` +
      `est une tension émotionnelle qui cherche à se libérer. ` +
      `Avant d'agir, on va simplement respirer ensemble. ` +
      `Trois minutes pour laisser la vague passer — ton corps sait attendre.`
    );
  }
  if (
    ctx.includes("culpabilité") ||
    ctx.includes("coupable") ||
    ctx.includes("honte") ||
    ctx.includes("j'ai craqué") ||
    ctx.includes("craqué")
  ) {
    return (
      `${firstName}, la culpabilité ne t'aidera pas à avancer. ` +
      `Ce moment de soin que tu te donnes là, maintenant — c'est déjà un acte de bienveillance envers toi. ` +
      `Respirons ensemble, sans jugement. Tu es exactement là où tu dois être.`
    );
  }
  // default — coup de mou / général
  return (
    `${firstName}, prends un moment rien que pour toi. ` +
    `On va ralentir ensemble, retrouver ton centre. ` +
    `Trois minutes de cohérence cardiaque pour apaiser ton rythme cardiaque ` +
    `et recharger ta présence.`
  );
}

// ─── French voice loader ──────────────────────────────────────────────────────
function getFrenchVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "fr-FR") ??
    voices.find((v) => v.lang.startsWith("fr")) ??
    null
  );
}

function speak(
  text: string,
  opts?: { rate?: number; volume?: number; onEnd?: () => void }
) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    opts?.onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  u.rate = opts?.rate ?? 0.85;
  u.volume = opts?.volume ?? 0.75;
  u.pitch = 1.0;
  const voice = getFrenchVoice();
  if (voice) u.voice = voice;
  if (opts?.onEnd) u.onend = opts.onEnd;
  window.speechSynthesis.speak(u);
}

// ─── Haptic crescendo on inhale ───────────────────────────────────────────────
function hapticInhale() {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  // 5 pulses with increasing duration — crescendo feel
  navigator.vibrate([30, 70, 45, 70, 60, 70, 75, 70, 95, 70]);
}

// ─── Format MM:SS ─────────────────────────────────────────────────────────────
function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BreathingExercise({
  sosContext,
  firstName,
  onCompleted,
  onClose,
}: BreathingExerciseProps) {
  const [stage, setStage] = useState<Stage>("INTRO");
  const [currentWordIdx, setCurrentWordIdx] = useState(-1);
  const [phase, setPhase] = useState<Phase>("inhale");
  const [phaseTimer, setPhaseTimer] = useState(5);
  const [totalLeft, setTotalLeft] = useState(180);
  const [expanded, setExpanded] = useState(false); // circle size

  // Refs — mutable state accessed inside setInterval (no stale closure)
  const phaseRef = useRef<Phase>("inhale");
  const phaseSecRef = useRef(5); // seconds left in current phase
  const totalSecRef = useRef(180);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onCompletedRef = useRef(onCompleted);
  useEffect(() => { onCompletedRef.current = onCompleted; }, [onCompleted]);

  const introText = getIntroText(sosContext, firstName);
  const words = introText.split(" ");

  // ─── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      wordTimersRef.current.forEach(clearTimeout);
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  // ─── INTRO: TTS + timer-based karaoke (~420ms/word) ────────────────────────
  useEffect(() => {
    if (stage !== "INTRO") return;

    // Small delay so voices are loaded
    const init = setTimeout(() => {
      // Karaoke timers
      wordTimersRef.current = words.map((_, i) =>
        setTimeout(() => setCurrentWordIdx(i), i * 420)
      );
      // Last word timeout — then transition
      const endTimeout = setTimeout(() => {
        setCurrentWordIdx(-1);
        setTimeout(() => setStage("READY_CHECK"), 500);
      }, words.length * 420 + 400);
      wordTimersRef.current.push(endTimeout);

      // TTS — parallel, slightly slower than karaoke so words stay in sync
      speak(introText, {
        rate: 0.8,
        volume: 0.8,
      });
    }, 400);

    return () => {
      clearTimeout(init);
      wordTimersRef.current.forEach(clearTimeout);
      wordTimersRef.current = [];
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── iOS audio unlock — call synchronously before SpeechSynthesis ──────────
  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const silent = new SpeechSynthesisUtterance("");
    silent.volume = 0;
    window.speechSynthesis.speak(silent);
  }, []);

  // ─── Start breathing loop ────────────────────────────────────────────────────
  const startLoop = useCallback(() => {
    // Reset refs
    phaseRef.current = "inhale";
    phaseSecRef.current = 5;
    totalSecRef.current = 180;

    // Initial display
    setPhase("inhale");
    setPhaseTimer(5);
    setTotalLeft(180);
    setExpanded(true);

    // First inhale prompt
    speak("Inspirez...", { rate: 0.7, volume: 0.55 });
    hapticInhale();

    intervalRef.current = setInterval(() => {
      // Tick
      phaseSecRef.current -= 1;
      totalSecRef.current -= 1;

      setPhaseTimer(phaseSecRef.current);
      setTotalLeft(totalSecRef.current);

      // Phase transition at 0
      if (phaseSecRef.current <= 0) {
        if (phaseRef.current === "inhale") {
          phaseRef.current = "exhale";
          phaseSecRef.current = 5;
          setPhase("exhale");
          setPhaseTimer(5);
          setExpanded(false);
          speak("Expirez...", { rate: 0.65, volume: 0.55 });
          // No haptic on exhale
        } else {
          phaseRef.current = "inhale";
          phaseSecRef.current = 5;
          setPhase("inhale");
          setPhaseTimer(5);
          setExpanded(true);
          speak("Inspirez...", { rate: 0.7, volume: 0.55 });
          hapticInhale();
        }
      }

      // Exercise complete
      if (totalSecRef.current <= 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (typeof window !== "undefined") window.speechSynthesis?.cancel();
        speak("Très bien. Restez dans cet espace un instant.", {
          rate: 0.78,
          volume: 0.7,
        });
        setStage("COMPLETED");
        setTimeout(() => onCompletedRef.current(), 3200);
      }
    }, 1000);
  }, []);

  // ─── Close with full cleanup ─────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    wordTimersRef.current.forEach(clearTimeout);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    onClose();
  }, [onClose]);

  // ─── Circle style — CSS transition drives the animation ──────────────────────
  const circleSize = expanded ? 230 : 140;
  const circleGlow = expanded
    ? "0 0 80px rgba(6,182,212,0.18), 0 0 140px rgba(6,182,212,0.07)"
    : "0 0 24px rgba(6,182,212,0.07)";
  const circleBorder = `rgba(6,182,212,${expanded ? 0.38 : 0.14})`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(5,10,12,0.97)",
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        overflowY: "auto",
      }}
    >
      {/* ── Close button ─────────────────────────────────────── */}
      <button
        onClick={handleClose}
        aria-label="Fermer"
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: TEXT_MUTED,
          fontSize: 20,
          lineHeight: "1",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        ×
      </button>

      {/* ── Ambient background halo ───────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 68%)",
          animation: "breathe-ambient 6s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* ══════════════════════════════════════════════════════════
          STAGE: INTRO
      ══════════════════════════════════════════════════════════ */}
      {stage === "INTRO" && (
        <div
          style={{
            maxWidth: 380,
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Wave icon */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(6,182,212,0.1)",
              border: "1px solid rgba(6,182,212,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 28px",
              boxShadow: "0 0 24px rgba(6,182,212,0.15)",
            }}
          >
            <IconWave size={26} color={CYAN} strokeWidth={1.5} />
          </div>

          {/* Karaoke text */}
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.78,
              color: TEXT_PRIMARY,
              margin: 0,
              fontWeight: 400,
            }}
          >
            {words.map((word, i) => (
              <span
                key={i}
                style={{
                  color: i === currentWordIdx ? CYAN : TEXT_PRIMARY,
                  textShadow:
                    i === currentWordIdx
                      ? `0 0 14px ${CYAN}88`
                      : "none",
                  transition: "color 0.15s ease, text-shadow 0.15s ease",
                  display: "inline",
                }}
              >
                {word}{" "}
              </span>
            ))}
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          STAGE: READY_CHECK
      ══════════════════════════════════════════════════════════ */}
      {stage === "READY_CHECK" && (
        <div
          style={{
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <p
            style={{
              fontSize: 15,
              color: TEXT_SECONDARY,
              marginBottom: 44,
              lineHeight: 1.7,
            }}
          >
            Installe-toi confortablement.
            <br />
            Pose les pieds à plat, les mains sur les genoux.
          </p>

          <button
            onClick={() => {
              unlockAudio();
              setStage("BREATHING_LOOP");
              startLoop();
            }}
            style={{
              width: 168,
              height: 168,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(6,182,212,0.16) 0%, rgba(6,182,212,0.04) 100%)",
              border: "2px solid rgba(6,182,212,0.38)",
              color: CYAN,
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              animation: "pulse-ready 2.4s ease-in-out infinite",
              boxShadow: "0 0 48px rgba(6,182,212,0.14)",
              letterSpacing: 0.2,
            }}
          >
            <span style={{ fontSize: 24, lineHeight: 1 }}>✦</span>
            <span>Je suis prête</span>
          </button>

          <p
            style={{
              marginTop: 36,
              fontSize: 12,
              color: TEXT_MUTED,
              letterSpacing: 0.4,
            }}
          >
            3 minutes · cohérence cardiaque
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          STAGE: BREATHING_LOOP
      ══════════════════════════════════════════════════════════ */}
      {stage === "BREATHING_LOOP" && (
        <div
          style={{
            textAlign: "center",
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Timer countdown */}
          <p
            style={{
              fontSize: 13,
              color: TEXT_MUTED,
              marginBottom: 36,
              letterSpacing: 1.5,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatTime(totalLeft)}
          </p>

          {/* Main breathing circle */}
          <div
            style={{
              width: circleSize,
              height: circleSize,
              borderRadius: "50%",
              background: expanded
                ? "radial-gradient(circle, rgba(6,182,212,0.16) 0%, rgba(6,182,212,0.05) 55%, transparent 100%)"
                : "radial-gradient(circle, rgba(6,182,212,0.07) 0%, rgba(6,182,212,0.02) 55%, transparent 100%)",
              border: `1.5px solid ${circleBorder}`,
              boxShadow: circleGlow,
              transition: "all 4.8s cubic-bezier(0.45, 0.05, 0.55, 0.95)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: CYAN,
                  fontWeight: 600,
                  letterSpacing: 0.8,
                  opacity: 0.9,
                  textTransform: "uppercase",
                  transition: "font-size 0.3s",
                }}
              >
                {phase === "inhale" ? "Inspirez" : "Expirez"}
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 34,
                  fontWeight: 700,
                  color: TEXT_PRIMARY,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}
              >
                {phaseTimer}
              </p>
            </div>
          </div>

          {/* Phase label below circle */}
          <p
            style={{
              marginTop: 32,
              fontSize: 13,
              color: TEXT_MUTED,
              letterSpacing: 0.5,
            }}
          >
            {phase === "inhale"
              ? "↑ Inspirez lentement par le nez..."
              : "↓ Expirez doucement par la bouche..."}
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          STAGE: COMPLETED
      ══════════════════════════════════════════════════════════ */}
      {stage === "COMPLETED" && (
        <div
          style={{
            textAlign: "center",
            position: "relative",
            zIndex: 1,
            maxWidth: 320,
            animation: "fadeUp 0.5s ease",
          }}
        >
          <div style={{ marginBottom: 22, display: "flex", justifyContent: "center" }}>
            <IconCheckRing
              size={52}
              color={CYAN}
              strokeWidth={1.2}
              style={{ filter: `drop-shadow(0 0 10px ${CYAN}66)` }}
            />
          </div>
          <h2
            style={{
              margin: "0 0 14px",
              fontSize: 22,
              fontWeight: 700,
              color: TEXT_PRIMARY,
            }}
          >
            Bravo, {firstName}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              color: TEXT_SECONDARY,
              lineHeight: 1.75,
            }}
          >
            Trois minutes de soin pour toi.
            <br />
            Ton cœur a retrouvé son rythme.
          </p>
        </div>
      )}

      {/* ── Keyframes ─────────────────────────────────────────── */}
      <style>{`
        @keyframes breathe-ambient {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
          50%       { transform: translate(-50%, -50%) scale(1.18); opacity: 0.85; }
        }
        @keyframes pulse-ready {
          0%, 100% { transform: scale(1);    box-shadow: 0 0 48px rgba(6,182,212,0.14); }
          50%       { transform: scale(1.07); box-shadow: 0 0 70px rgba(6,182,212,0.26); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
