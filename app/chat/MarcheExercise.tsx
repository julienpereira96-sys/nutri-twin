"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  IconWalker,
  IconHeadphones,
  IconAlertTriangle,
  IconFootprint,
  IconCheckRing,
  IconX,
} from "./SosIcons";

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = "INTRO" | "PERMISSION" | "WALKING_LOOP" | "COMPLETED";

type Props = {
  sosContext: string;
  firstName: string;
  onCompleted: () => void;
  onClose: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TOTAL_STEPS = 60;
const STEP_COOLDOWN_MS = 350;
const ACCEL_THRESHOLD = 12; // m/s² magnitude delta to register a step

// ─── Phase config ─────────────────────────────────────────────────────────────
type PhaseConfig = {
  startStep: number;
  color: string;
  title: string;
  cue: string;
  speech: string;
};

const PHASES: PhaseConfig[] = [
  {
    startStep: 1,
    color: "#4ade80",
    title: "Contact au sol",
    cue: "Sens le sol sous tes pieds",
    speech:
      "Commence à marcher doucement. À chaque pas, sens le contact de ton pied avec le sol. Talon, plante, orteils.",
  },
  {
    startStep: 21,
    color: "#60a5fa",
    title: "Souffle & rythme",
    cue: "Synchronise ta respiration",
    speech:
      "Bien. Maintenant synchronise ta respiration avec tes pas. Inspire sur deux pas, expire sur deux pas. Laisse ton souffle guider ton rythme.",
  },
  {
    startStep: 41,
    color: "#c084fc",
    title: "Posture & présence",
    cue: "Observe ton environnement",
    speech:
      "Dernière étape. Grandis-toi, détends tes épaules. Regarde autour de toi — une couleur, un son, une texture. Tu es ici, maintenant.",
  },
];

// ─── TTS helpers ──────────────────────────────────────────────────────────────
function speakNow(text: string, opts: { rate?: number; volume?: number } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang   = "fr-FR";
  utter.rate   = opts.rate   ?? 0.80;
  utter.volume = opts.volume ?? 0.75;
  const fr = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("fr"));
  if (fr) utter.voice = fr;
  window.speechSynthesis.speak(utter);
}

function unlockAudio() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  u.lang = "fr-FR";
  window.speechSynthesis.speak(u);
}

// ─── SVG arc progress ─────────────────────────────────────────────────────────
function ArcProgress({
  steps,
  total,
  color,
}: {
  steps: number;
  total: number;
  color: string;
}) {
  const R = 70;
  const CX = 90;
  const CY = 90;
  const START_ANGLE = -220; // degrees from positive x-axis
  const ARC_SPAN = 260;    // total degrees swept

  function polarToXY(angle: number) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: CX + R * Math.cos(rad),
      y: CY + R * Math.sin(rad),
    };
  }

  const progress = Math.min(steps / total, 1);
  const endAngle = START_ANGLE + ARC_SPAN * progress;

  const startPt = polarToXY(START_ANGLE);
  const endPt   = polarToXY(endAngle);
  const largeArc = ARC_SPAN * progress > 180 ? 1 : 0;

  // Track arc (full)
  const trackEnd = polarToXY(START_ANGLE + ARC_SPAN);
  const trackLarge = ARC_SPAN > 180 ? 1 : 0;
  const trackD = `M ${startPt.x} ${startPt.y} A ${R} ${R} 0 ${trackLarge} 1 ${trackEnd.x} ${trackEnd.y}`;

  // Fill arc
  const fillD =
    progress === 0
      ? ""
      : `M ${startPt.x} ${startPt.y} A ${R} ${R} 0 ${largeArc} 1 ${endPt.x} ${endPt.y}`;

  return (
    <svg width="180" height="180" viewBox="0 0 180 180">
      {/* Track */}
      <path
        d={trackD}
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Fill */}
      {fillD && (
        <path
          d={fillD}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      )}
      {/* Step count */}
      <text
        x={CX}
        y={CY - 10}
        textAnchor="middle"
        fill="white"
        fontSize="32"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {steps}
      </text>
      <text
        x={CX}
        y={CY + 16}
        textAnchor="middle"
        fill="rgba(255,255,255,0.5)"
        fontSize="12"
        fontFamily="system-ui, sans-serif"
      >
        / {total} pas
      </text>
    </svg>
  );
}

// ─── Step dot pulse animation ──────────────────────────────────────────────────
const PULSE_STYLE = `
@keyframes ma-pulse-ring {
  0%   { transform: scale(1);   opacity: 0.7; }
  60%  { transform: scale(1.9); opacity: 0; }
  100% { transform: scale(1.9); opacity: 0; }
}
@keyframes ma-step-flash {
  0%   { opacity: 1; transform: scale(1.25); }
  100% { opacity: 0; transform: scale(2.2); }
}
@keyframes ma-phase-in {
  0%   { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes ma-complete-pop {
  0%   { transform: scale(0.7); opacity: 0; }
  60%  { transform: scale(1.08); }
  100% { transform: scale(1);   opacity: 1; }
}
`;

// ─── Main component ───────────────────────────────────────────────────────────
export default function MarcheExercise({
  sosContext: _sosContext,
  firstName,
  onCompleted,
  onClose,
}: Props) {
  const [stage, setStage]       = useState<Stage>("INTRO");
  const [steps, setSteps]       = useState(0);
  const [stepFlash, setStepFlash] = useState(false);
  const [usingManual, setUsingManual] = useState(false);
  const [permError, setPermError]    = useState<string | null>(null);

  const stepsRef         = useRef(0);
  const lastStepTime     = useRef(0);
  const lastMagnitude    = useRef(0);
  const spokenPhasesRef  = useRef<Set<number>>(new Set());
  const motionListenerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  // ─── Current phase ──────────────────────────────────────────────────────────
  const currentPhase = useMemo(() => {
    for (let i = PHASES.length - 1; i >= 0; i--) {
      if (steps >= PHASES[i].startStep) return PHASES[i];
    }
    return PHASES[0];
  }, [steps]);

  // ─── Register a step ────────────────────────────────────────────────────────
  const registerStep = useCallback(() => {
    const now = Date.now();
    if (now - lastStepTime.current < STEP_COOLDOWN_MS) return;
    lastStepTime.current = now;

    navigator.vibrate?.(15);
    setStepFlash(true);
    setTimeout(() => setStepFlash(false), 180);

    const next = stepsRef.current + 1;
    stepsRef.current = next;
    setSteps(next);

    // Phase TTS at phase start steps
    for (const phase of PHASES) {
      if (next === phase.startStep && !spokenPhasesRef.current.has(phase.startStep)) {
        spokenPhasesRef.current.add(phase.startStep);
        speakNow(phase.speech);
      }
    }

    // Complete at TOTAL_STEPS
    if (next >= TOTAL_STEPS) {
      setTimeout(() => {
        speakNow(
          `Bravo ${firstName} ! Tu as complété tes ${TOTAL_STEPS} pas de marche consciente. Porte cette présence avec toi.`,
        );
        setStage("COMPLETED");
        setTimeout(onCompleted, 4000);
      }, 300);
    }
  }, [firstName, onCompleted]);

  // ─── DeviceMotion listener ──────────────────────────────────────────────────
  const startDeviceMotion = useCallback(() => {
    if (typeof window === "undefined") return;

    const handler = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const mag = Math.sqrt(
        (acc.x ?? 0) ** 2 +
        (acc.y ?? 0) ** 2 +
        (acc.z ?? 0) ** 2,
      );
      const delta = Math.abs(mag - lastMagnitude.current);
      lastMagnitude.current = mag;
      if (delta > ACCEL_THRESHOLD) registerStep();
    };

    motionListenerRef.current = handler;
    window.addEventListener("devicemotion", handler);
  }, [registerStep]);

  // ─── Cleanup motion listener ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (motionListenerRef.current) {
        window.removeEventListener("devicemotion", motionListenerRef.current);
      }
      window.speechSynthesis?.cancel();
    };
  }, []);

  // ─── Request DeviceMotion permission (iOS) ──────────────────────────────────
  const requestMotionAndStart = useCallback(async () => {
    unlockAudio();
    speakNow(PHASES[0].speech, { rate: 0.80 });
    spokenPhasesRef.current.add(1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DME = DeviceMotionEvent as any;
    if (typeof DME.requestPermission === "function") {
      try {
        const result: string = await DME.requestPermission();
        if (result === "granted") {
          setUsingManual(false);
          setStage("WALKING_LOOP");
          startDeviceMotion();
        } else {
          // User denied — fall back to manual
          setUsingManual(true);
          setStage("WALKING_LOOP");
        }
      } catch {
        setUsingManual(true);
        setStage("WALKING_LOOP");
      }
    } else if (typeof window !== "undefined" && "DeviceMotionEvent" in window) {
      // Android / desktop — no permission needed
      setUsingManual(false);
      setStage("WALKING_LOOP");
      startDeviceMotion();
    } else {
      // No DeviceMotion support → manual
      setUsingManual(true);
      setStage("WALKING_LOOP");
    }
  }, [startDeviceMotion]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#030d08",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflowY: "auto",
      }}
    >
      <style>{PULSE_STYLE}</style>

      {/* Close button */}
      {stage !== "COMPLETED" && (
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "rgba(255,255,255,0.08)",
            border: "none",
            borderRadius: "50%",
            width: 36,
            height: 36,
            cursor: "pointer",
            fontSize: 18,
            color: "rgba(255,255,255,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
          aria-label="Fermer"
        >
          <IconX size={16} color="rgba(255,255,255,0.55)" />
        </button>
      )}

      {/* ── INTRO ─────────────────────────────────────────────────────────── */}
      {stage === "INTRO" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            padding: "40px 28px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconWalker size={64} color="#4ade80" strokeWidth={1.3} style={{ filter: "drop-shadow(0 0 10px rgba(74,222,128,0.35))" }} />
          </div>
          <h1 style={{ color: "white", fontSize: 26, fontWeight: 700, margin: 0 }}>
            Marche Consciente
          </h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 16, lineHeight: 1.6, maxWidth: 320, margin: 0 }}>
            60 pas pour te reconnecter à ton corps. Chaque pas est une ancre dans le moment présent.
          </p>

          <div
            style={{
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.25)",
              borderRadius: 16,
              padding: "16px 20px",
              maxWidth: 320,
              textAlign: "left",
            }}
          >
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, margin: 0, lineHeight: 1.6, display: "flex", alignItems: "flex-start", gap: 8 }}>
              <IconHeadphones size={16} color="#4ade80" strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 2 }} />
              <span><strong style={{ color: "white" }}>Active le son</strong> — une voix guidera chaque
              phase. Tu peux marcher sur place si tu ne peux pas te déplacer.</span>
            </p>
          </div>

          <button
            onClick={requestMotionAndStart}
            style={{
              background: "linear-gradient(135deg, #4ade80, #22c55e)",
              border: "none",
              borderRadius: 50,
              padding: "16px 48px",
              color: "white",
              fontSize: 17,
              fontWeight: 700,
              cursor: "pointer",
              marginTop: 8,
              boxShadow: "0 4px 20px rgba(74,222,128,0.35)",
            }}
          >
            Je commence →
          </button>
        </div>
      )}

      {/* ── PERMISSION error ──────────────────────────────────────────────── */}
      {stage === "PERMISSION" && permError && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 32,
            textAlign: "center",
          }}
        >
          <IconAlertTriangle size={48} color="#f59e0b" strokeWidth={1.4} />
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 15 }}>{permError}</p>
          <button
            onClick={() => { setPermError(null); setUsingManual(true); setStage("WALKING_LOOP"); }}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 50,
              padding: "12px 32px",
              color: "white",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Mode manuel
          </button>
        </div>
      )}

      {/* ── WALKING_LOOP ──────────────────────────────────────────────────── */}
      {stage === "WALKING_LOOP" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "60px 24px 40px",
            width: "100%",
            maxWidth: 420,
            margin: "0 auto",
          }}
        >
          {/* Phase badge */}
          <div
            key={currentPhase.startStep}
            style={{
              background: `${currentPhase.color}22`,
              border: `1px solid ${currentPhase.color}55`,
              borderRadius: 50,
              padding: "8px 20px",
              color: currentPhase.color,
              fontSize: 13,
              fontWeight: 600,
              animation: "ma-phase-in 0.5s ease both",
            }}
          >
            {currentPhase.title}
          </div>

          {/* Arc progress */}
          <div style={{ position: "relative" }}>
            <ArcProgress steps={steps} total={TOTAL_STEPS} color={currentPhase.color} />
            {/* Pulse ring on step */}
            {stepFlash && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    border: `3px solid ${currentPhase.color}`,
                    animation: "ma-pulse-ring 0.4s ease-out both",
                  }}
                />
              </div>
            )}
          </div>

          {/* Cue text */}
          <p
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 15,
              textAlign: "center",
              margin: 0,
              minHeight: 44,
            }}
          >
            {currentPhase.cue}
          </p>

          {/* Manual tap button or sensor indicator */}
          {usingManual ? (
            <button
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                registerStep();
              }}
              style={{
                background: `linear-gradient(135deg, ${currentPhase.color}cc, ${currentPhase.color})`,
                border: "none",
                borderRadius: "50%",
                width: 110,
                height: 110,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 6px 28px ${currentPhase.color}55`,
                transition: "transform 0.1s ease",
                userSelect: "none",
                WebkitUserSelect: "none",
                touchAction: "none",
              }}
              aria-label="Appuyer pour chaque pas"
            >
              <IconFootprint size={36} color="white" strokeWidth={1.4} />
            </button>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "rgba(255,255,255,0.4)",
                fontSize: 13,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: currentPhase.color,
                  boxShadow: `0 0 6px ${currentPhase.color}`,
                  display: "inline-block",
                  animation: "ma-pulse-ring 1.4s ease-out infinite",
                }}
              />
              Capteur de mouvement actif
            </div>
          )}

          {/* Phase dots */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {PHASES.map((p) => {
              const active = currentPhase.startStep === p.startStep;
              const done   = steps >= p.startStep + 20;
              return (
                <div
                  key={p.startStep}
                  style={{
                    width: active ? 28 : 8,
                    height: 8,
                    borderRadius: 50,
                    background: done ? p.color : active ? p.color : "rgba(255,255,255,0.2)",
                    transition: "all 0.4s ease",
                    opacity: done ? 0.5 : active ? 1 : 0.4,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── COMPLETED ─────────────────────────────────────────────────────── */}
      {stage === "COMPLETED" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            padding: "40px 28px",
            textAlign: "center",
            animation: "ma-complete-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconCheckRing size={76} color="#4ade80" strokeWidth={1.2} style={{ filter: "drop-shadow(0 0 12px rgba(74,222,128,0.5))" }} />
          </div>
          <h2 style={{ color: "white", fontSize: 26, fontWeight: 700, margin: 0 }}>
            {TOTAL_STEPS} pas accomplis
          </h2>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, maxWidth: 300, lineHeight: 1.6, margin: 0 }}>
            Tu viens de t&apos;offrir {TOTAL_STEPS} moments de présence consciente. Ton corps et ton esprit
            te remercient.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {PHASES.map((p) => (
              <div
                key={p.startStep}
                style={{
                  width: 28,
                  height: 8,
                  borderRadius: 50,
                  background: p.color,
                  boxShadow: `0 0 8px ${p.color}`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
