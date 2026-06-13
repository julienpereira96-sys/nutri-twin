"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  IconAnchor, IconCheckRing, IconEye, IconTouch, IconEar, IconWind, IconDroplet,
} from "./SosIcons";
import { useTherapeuticVoice } from "@/hooks/useTherapeuticVoice";
import { makeBoundaryHandler, scheduleWordTimers } from "@/lib/therapeuticVoice";

// ─── Tiny inline SVG check for validated states ───────────────────────────────
function SvgCheck({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 8 3.5 3.5 6.5-7" />
    </svg>
  );
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const ACCENT = "#10b981";
const ACCENT_DIM = "rgba(16,185,129,0.10)";
const ACCENT_BORDER = "rgba(16,185,129,0.28)";
const TEXT_PRIMARY = "rgba(255,255,255,0.88)";
const TEXT_SECONDARY = "rgba(255,255,255,0.45)";
const TEXT_MUTED = "rgba(255,255,255,0.22)";

// ─── Circular progress constants ──────────────────────────────────────────────
const GAUGE_R = 36;
const GAUGE_CIRC = 2 * Math.PI * GAUGE_R;

// ─── Types ────────────────────────────────────────────────────────────────────
export type AncrageStage =
  | "INTRO"
  | "STEP_5_SEE"
  | "STEP_4_FEEL"
  | "STEP_3_HEAR"
  | "STEP_2_SMELL"
  | "STEP_1_TASTE"
  | "COMPLETED";

export interface AncrageExerciseProps {
  sosContext: string;
  firstName: string;
  onCompleted: () => void;
  onClose: () => void;
}

// ─── TTS speech texts for each step ──────────────────────────────────────────
const STEP_SPEECH: Partial<Record<AncrageStage, string>> = {
  STEP_5_SEE:
    "Regardez autour de vous. Nommez mentalement cinq choses que vous voyez. Tapez sur chaque case dès que vous en avez identifié une.",
  STEP_4_FEEL:
    "Le toucher maintenant. Posez votre doigt sur quatre surfaces différentes — votre peau, un tissu, une table. Maintenez deux secondes et ressentez.",
  STEP_3_HEAR:
    "Fermez les yeux. Écoutez. Identifiez trois sons distincts autour de vous.",
  STEP_2_SMELL:
    "Respirez lentement. Concentrez-vous sur deux odeurs que vous percevez en ce moment.",
  STEP_1_TASTE:
    "Pour finir, prenez conscience d'un goût dans votre bouche. Salivez légèrement. Observez.",
};

// ─── Contextual intro texts ───────────────────────────────────────────────────
function getIntroText(ctx: string, name: string): string {
  const c = ctx.toLowerCase();
  if (c.includes("stress") || c.includes("anxiété") || c.includes("angoiss"))
    return `${name}, quand l'anxiété monte, le cerveau s'emballe. La technique 5-4-3-2-1 va le ramener dans le présent — sens par sens, ici et maintenant.`;
  if (c.includes("fringale") || c.includes("faim") || c.includes("envie"))
    return `${name}, cette envie que tu ressens est réelle, mais elle peut passer. Ancrons ton attention dans l'instant pour laisser la vague s'apaiser.`;
  if (c.includes("culpabilité") || c.includes("coupable") || c.includes("craqué"))
    return `${name}, la culpabilité t'emporte dans les pensées. Revenons dans ton corps, dans le présent, là où tu es en sécurité.`;
  return `${name}, prenons le temps de revenir dans l'instant. L'ancrage sensoriel va interrompre la spirale et te reconnecter à toi.`;
}

// ─── Circular progress gauge ─────────────────────────────────────────────────
function Gauge({
  progress,
  validated,
  idx,
  isHolding,
}: {
  progress: number;
  validated: boolean;
  idx: number;
  isHolding: boolean;
}) {
  const active = validated || isHolding;
  return (
    <svg
      width={88}
      height={88}
      viewBox="0 0 88 88"
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Glow when active */}
      {active && (
        <circle
          cx={44}
          cy={44}
          r={GAUGE_R + 6}
          fill="none"
          stroke={`rgba(16,185,129,${isHolding && !validated ? 0.15 : 0.08})`}
          strokeWidth={8}
          style={{ transition: "opacity 0.2s" }}
        />
      )}
      {/* Track */}
      <circle
        cx={44}
        cy={44}
        r={GAUGE_R}
        fill="none"
        stroke="rgba(16,185,129,0.12)"
        strokeWidth={3}
      />
      {/* Progress arc */}
      <circle
        cx={44}
        cy={44}
        r={GAUGE_R}
        fill="none"
        stroke={validated ? ACCENT : "rgba(16,185,129,0.65)"}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={String(GAUGE_CIRC)}
        strokeDashoffset={GAUGE_CIRC * (1 - progress / 100)}
        transform="rotate(-90 44 44)"
        style={{ transition: "stroke-dashoffset 0.05s linear, stroke 0.25s" }}
      />
      {/* Background fill */}
      <circle
        cx={44}
        cy={44}
        r={GAUGE_R - 2}
        fill={
          validated
            ? "rgba(16,185,129,0.08)"
            : isHolding
            ? "rgba(16,185,129,0.05)"
            : "rgba(255,255,255,0.02)"
        }
        style={{ transition: "fill 0.2s" }}
      />
      {/* Center label */}
      <text
        x={44}
        y={50}
        textAnchor="middle"
        fill={validated ? ACCENT : isHolding ? ACCENT : TEXT_MUTED}
        fontSize={validated ? 18 : 16}
        fontWeight={700}
        style={{ transition: "fill 0.2s", userSelect: "none" }}
      >
        {validated ? "✓" : String(idx + 1)}
      </text>
    </svg>
  );
}

// ─── Step progress dots ───────────────────────────────────────────────────────
const STAGE_ORDER: AncrageStage[] = [
  "INTRO",
  "STEP_5_SEE",
  "STEP_4_FEEL",
  "STEP_3_HEAR",
  "STEP_2_SMELL",
  "STEP_1_TASTE",
  "COMPLETED",
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function AncrageExercise({
  sosContext,
  firstName,
  onCompleted,
  onClose,
}: AncrageExerciseProps) {
  const { speakTherapeutic, cancelSpeech } = useTherapeuticVoice();

  const [stage, setStage] = useState<AncrageStage>("INTRO");

  // INTRO
  const introText = getIntroText(sosContext, firstName);
  const introWords = introText.split(" ");
  const [wordIdx, setWordIdx] = useState(-1);
  const [introReady, setIntroReady] = useState(false);

  // STEP_5_SEE — 5 tap boxes
  const [seeChecked, setSeeChecked] = useState<boolean[]>(Array(5).fill(false));

  // STEP_4_FEEL — 4 hold circles
  const [holdProgress, setHoldProgress] = useState<number[]>(Array(4).fill(0));
  const [holdValidated, setHoldValidated] = useState<boolean[]>(Array(4).fill(false));
  const [isHolding, setIsHolding] = useState<boolean[]>(Array(4).fill(false));

  // STEP_3_HEAR — 3 tap buttons
  const [hearChecked, setHearChecked] = useState<boolean[]>(Array(3).fill(false));

  // STEP_2_SMELL — 2 tap boxes
  const [smellChecked, setSmellChecked] = useState<boolean[]>(Array(2).fill(false));

  // STEP_1_TASTE — 1 button
  const [tasteDone, setTasteDone] = useState(false);

  // ─── Refs (stale-closure proof) ───────────────────────────────────────────
  const wordTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const holdIntervalsRef = useRef<(ReturnType<typeof setInterval> | null)[]>([
    null, null, null, null,
  ]);
  const vibIntervalsRef = useRef<(ReturnType<typeof setInterval> | null)[]>([
    null, null, null, null,
  ]);
  const holdValidRef = useRef<boolean[]>([false, false, false, false]);
  const onCompletedRef = useRef(onCompleted);
  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  // ─── Full cleanup ─────────────────────────────────────────────────────────
  const cleanupAll = useCallback(() => {
    wordTimersRef.current.forEach(clearTimeout);
    holdIntervalsRef.current.forEach((id) => id && clearInterval(id));
    vibIntervalsRef.current.forEach((id) => id && clearInterval(id));
    cancelSpeech();
    if (typeof navigator !== "undefined") navigator.vibrate?.(0);
  }, [cancelSpeech]);

  useEffect(() => () => cleanupAll(), [cleanupAll]);

  // ─── INTRO: karaoke (boundary-driven, timer fallback for iOS) ───────────────
  useEffect(() => {
    if (stage !== "INTRO") return;
    const bootstrap = setTimeout(() => {
      wordTimersRef.current = introWords.map((_, i) =>
        setTimeout(() => setWordIdx(i), i * 420)
      );
      const endTimer = setTimeout(() => {
        setWordIdx(-1);
        setIntroReady(true);
      }, introWords.length * 420 + 400);
      wordTimersRef.current.push(endTimer);

      const cancelFallback = () => {
        wordTimersRef.current.forEach(clearTimeout);
        wordTimersRef.current = [];
      };

      speakTherapeutic(introText, {
        skipPrep: true,
        rate: 0.82,
        volume: 0.8,
        onBoundary: makeBoundaryHandler(introWords, setWordIdx, cancelFallback),
        onDurationReady: (durationMs: number) => {
          wordTimersRef.current.forEach(clearTimeout);
          wordTimersRef.current = [];
          const timers = scheduleWordTimers(introWords, durationMs, setWordIdx);
          const endTimer = setTimeout(() => {
            setWordIdx(-1);
            setIntroReady(true);
          }, durationMs + 400);
          wordTimersRef.current = [...timers, endTimer];
        },
      });
    }, 380);

    return () => {
      clearTimeout(bootstrap);
      wordTimersRef.current.forEach(clearTimeout);
      wordTimersRef.current = [];
      cancelSpeech();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, speakTherapeutic, cancelSpeech]);

  // ─── Stage transition + speech ────────────────────────────────────────────
  const goTo = useCallback((next: AncrageStage) => {
    setStage(next);
    const speech = STEP_SPEECH[next];
    if (speech) {
      setTimeout(() => speakTherapeutic(speech, { rate: 0.82, volume: 0.75 }), 280);
    }
  }, [speakTherapeutic]);

  // ─── Auto-advance effects ─────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "STEP_5_SEE" || !seeChecked.every(Boolean)) return;
    const t = setTimeout(() => goTo("STEP_4_FEEL"), 650);
    return () => clearTimeout(t);
  }, [seeChecked, stage, goTo]);

  useEffect(() => {
    if (stage !== "STEP_4_FEEL" || !holdValidated.every(Boolean)) return;
    const t = setTimeout(() => goTo("STEP_3_HEAR"), 650);
    return () => clearTimeout(t);
  }, [holdValidated, stage, goTo]);

  useEffect(() => {
    if (stage !== "STEP_3_HEAR" || !hearChecked.every(Boolean)) return;
    const t = setTimeout(() => goTo("STEP_2_SMELL"), 650);
    return () => clearTimeout(t);
  }, [hearChecked, stage, goTo]);

  useEffect(() => {
    if (stage !== "STEP_2_SMELL" || !smellChecked.every(Boolean)) return;
    const t = setTimeout(() => goTo("STEP_1_TASTE"), 650);
    return () => clearTimeout(t);
  }, [smellChecked, stage, goTo]);

  // STEP_1_TASTE → COMPLETED
  useEffect(() => {
    if (!tasteDone) return;
    speakTherapeutic("Excellent. Tu es ancré. Ton esprit est revenu au présent.", {
      rate: 0.8,
      volume: 0.75,
    });
    setStage("COMPLETED");
    const t = setTimeout(() => onCompletedRef.current(), 3200);
    return () => clearTimeout(t);
  }, [tasteDone, speakTherapeutic]);

  // ─── SEE: tap handler ─────────────────────────────────────────────────────
  const handleSeeClick = useCallback((i: number) => {
    setSeeChecked((prev) => {
      if (prev[i]) return prev;
      if (typeof navigator !== "undefined") navigator.vibrate?.(40);
      const n = [...prev];
      n[i] = true;
      return n;
    });
  }, []);

  // ─── FEEL: hold vibration helpers ─────────────────────────────────────────
  const startVib = useCallback((i: number) => {
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    navigator.vibrate(200);
    vibIntervalsRef.current[i] = setInterval(
      () => navigator.vibrate?.(200),
      310
    );
  }, []);

  const stopVib = useCallback((i: number) => {
    if (vibIntervalsRef.current[i]) {
      clearInterval(vibIntervalsRef.current[i]!);
      vibIntervalsRef.current[i] = null;
    }
    if (typeof navigator !== "undefined") navigator.vibrate?.(0);
  }, []);

  // ─── FEEL: hold start / end ───────────────────────────────────────────────
  const handleHoldStart = useCallback(
    (i: number) => {
      if (holdValidRef.current[i]) return;
      if (holdIntervalsRef.current[i]) return; // already running

      setIsHolding((prev) => {
        const n = [...prev];
        n[i] = true;
        return n;
      });
      startVib(i);

      holdIntervalsRef.current[i] = setInterval(() => {
        setHoldProgress((prev) => {
          const next = [...prev];
          // 2.5% per 50ms → 40 ticks = 2s
          next[i] = Math.min(100, next[i] + 2.5);
          if (next[i] >= 100) {
            clearInterval(holdIntervalsRef.current[i]!);
            holdIntervalsRef.current[i] = null;
            stopVib(i);
            holdValidRef.current[i] = true;
            // Success haptic
            if (typeof navigator !== "undefined")
              navigator.vibrate?.([60, 40, 80]);
            setHoldValidated((v) => {
              const nv = [...v];
              nv[i] = true;
              return nv;
            });
            setIsHolding((h) => {
              const nh = [...h];
              nh[i] = false;
              return nh;
            });
          }
          return next;
        });
      }, 50);
    },
    [startVib, stopVib]
  );

  const handleHoldEnd = useCallback(
    (i: number) => {
      if (holdValidRef.current[i]) return;
      if (holdIntervalsRef.current[i]) {
        clearInterval(holdIntervalsRef.current[i]!);
        holdIntervalsRef.current[i] = null;
      }
      stopVib(i);
      setIsHolding((prev) => {
        const n = [...prev];
        n[i] = false;
        return n;
      });
      setHoldProgress((prev) => {
        const n = [...prev];
        n[i] = 0;
        return n;
      });
    },
    [stopVib]
  );

  // ─── HEAR: tap handler ────────────────────────────────────────────────────
  const handleHearClick = useCallback((i: number) => {
    setHearChecked((prev) => {
      if (prev[i]) return prev;
      if (typeof navigator !== "undefined") navigator.vibrate?.(40);
      const n = [...prev];
      n[i] = true;
      return n;
    });
  }, []);

  // ─── SMELL: tap handler ───────────────────────────────────────────────────
  const handleSmellClick = useCallback((i: number) => {
    setSmellChecked((prev) => {
      if (prev[i]) return prev;
      if (typeof navigator !== "undefined") navigator.vibrate?.(40);
      const n = [...prev];
      n[i] = true;
      return n;
    });
  }, []);

  // ─── Stage index for progress dots ───────────────────────────────────────
  const stageIdx = STAGE_ORDER.indexOf(stage); // 0=INTRO … 6=COMPLETED

  // ─── Dark background for STEP_3_HEAR ─────────────────────────────────────
  const bgColor =
    stage === "STEP_3_HEAR" ? "rgba(1,2,4,0.99)" : "rgba(5,10,12,0.97)";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: bgColor,
        backdropFilter: "blur(32px)",
        WebkitBackdropFilter: "blur(32px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        overflowY: "auto",
        transition: "background 1.4s ease",
      }}
    >
      {/* ── Close ─────────────────────────────────────────────────────────── */}
      <button
        onClick={() => { cleanupAll(); onClose(); }}
        aria-label="Fermer"
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: TEXT_MUTED,
          fontSize: 20,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        ×
      </button>

      {/* ── Progress dots (visible during steps 1–5) ──────────────────────── */}
      {stageIdx >= 1 && stageIdx <= 5 && (
        <div
          style={{
            position: "absolute",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 8,
          }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  n < stageIdx
                    ? ACCENT
                    : n === stageIdx
                    ? "rgba(16,185,129,0.55)"
                    : "rgba(255,255,255,0.12)",
                transition: "background 0.4s ease",
              }}
            />
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          INTRO
      ══════════════════════════════════════════════════════════════════════ */}
      {stage === "INTRO" && (
        <div
          style={{
            maxWidth: 380,
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: ACCENT_DIM,
              border: `1px solid ${ACCENT_BORDER}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 28px",
              boxShadow: `0 0 20px ${ACCENT}22`,
            }}
          >
            <IconAnchor size={26} color={ACCENT} strokeWidth={1.5} />
          </div>

          <p
            style={{
              fontSize: 17,
              lineHeight: 1.78,
              color: TEXT_PRIMARY,
              margin: "0 0 36px",
              fontWeight: 400,
            }}
          >
            {introWords.map((w, i) => (
              <span
                key={i}
                style={{
                  color: i === wordIdx ? ACCENT : TEXT_PRIMARY,
                  textShadow:
                    i === wordIdx ? `0 0 12px ${ACCENT}88` : "none",
                  transition: "color 0.15s ease, text-shadow 0.15s ease",
                }}
              >
                {w}{" "}
              </span>
            ))}
          </p>

          {introReady && (
            <button
              onClick={() => goTo("STEP_5_SEE")}
              style={{
                padding: "14px 36px",
                borderRadius: 14,
                background: ACCENT,
                border: "none",
                color: "#000",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                animation: "fadeUp 0.4s ease",
              }}
            >
              Commencer l'ancrage →
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP_5_SEE — 5 tap boxes
      ══════════════════════════════════════════════════════════════════════ */}
      {stage === "STEP_5_SEE" && (
        <div
          style={{
            textAlign: "center",
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 360,
          }}
        >
          <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}>
            <IconEye size={30} color={ACCENT} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 6px ${ACCENT}55)` }} />
          </div>
          <p
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              margin: "0 0 6px",
            }}
          >
            5 choses que vous{" "}
            <span style={{ color: ACCENT }}>voyez</span>
          </p>
          <p
            style={{
              fontSize: 13,
              color: TEXT_SECONDARY,
              marginBottom: 32,
              lineHeight: 1.6,
            }}
          >
            Tapez sur chaque case dès que vous avez identifié un objet
          </p>

          {/* 5 boxes */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              justifyContent: "center",
              maxWidth: 280,
              margin: "0 auto",
            }}
          >
            {seeChecked.map((checked, i) => (
              <button
                key={i}
                onClick={() => handleSeeClick(i)}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 16,
                  background: checked
                    ? ACCENT_DIM
                    : "rgba(255,255,255,0.04)",
                  border: `2px solid ${
                    checked ? ACCENT : "rgba(255,255,255,0.09)"
                  }`,
                  cursor: checked ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: checked ? 22 : 15,
                  fontWeight: 700,
                  color: checked ? ACCENT : TEXT_MUTED,
                  transition: "all 0.22s ease",
                  transform: checked ? "scale(1.06)" : "scale(1)",
                  boxShadow: checked ? `0 0 14px ${ACCENT}44` : "none",
                }}
              >
                {checked ? <SvgCheck size={18} color={ACCENT} /> : String(i + 1)}
              </button>
            ))}
          </div>

          <p style={{ marginTop: 22, fontSize: 12, color: TEXT_MUTED }}>
            {seeChecked.filter(Boolean).length} / 5
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP_4_FEEL — 4 hold circles with progress gauge
      ══════════════════════════════════════════════════════════════════════ */}
      {stage === "STEP_4_FEEL" && (
        <div
          style={{
            textAlign: "center",
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 360,
          }}
        >
          <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}>
            <IconTouch size={30} color={ACCENT} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 6px ${ACCENT}55)` }} />
          </div>
          <p
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              margin: "0 0 6px",
            }}
          >
            4 textures à{" "}
            <span style={{ color: ACCENT }}>ressentir</span>
          </p>
          <p
            style={{
              fontSize: 13,
              color: TEXT_SECONDARY,
              marginBottom: 32,
              lineHeight: 1.6,
            }}
          >
            Maintenez votre doigt{" "}
            <strong style={{ color: TEXT_PRIMARY }}>2 secondes</strong> sur
            chaque cercle
          </p>

          {/* 2×2 grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              maxWidth: 220,
              margin: "0 auto",
            }}
          >
            {holdProgress.map((prog, i) => (
              <div
                key={i}
                onMouseDown={() => handleHoldStart(i)}
                onMouseUp={() => handleHoldEnd(i)}
                onMouseLeave={() => handleHoldEnd(i)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleHoldStart(i);
                }}
                onTouchEnd={() => handleHoldEnd(i)}
                onTouchCancel={() => handleHoldEnd(i)}
                style={{
                  cursor: holdValidated[i] ? "default" : "pointer",
                  userSelect: "none",
                  touchAction: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Gauge
                  progress={prog}
                  validated={holdValidated[i]}
                  idx={i}
                  isHolding={isHolding[i]}
                />
              </div>
            ))}
          </div>

          <p style={{ marginTop: 22, fontSize: 12, color: TEXT_MUTED }}>
            {holdValidated.filter(Boolean).length} / 4
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP_3_HEAR — 3 pulsing buttons on dark background
      ══════════════════════════════════════════════════════════════════════ */}
      {stage === "STEP_3_HEAR" && (
        <div
          style={{
            textAlign: "center",
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 360,
          }}
        >
          <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}>
            <IconEar size={30} color={ACCENT} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 6px ${ACCENT}55)` }} />
          </div>
          <p
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              margin: "0 0 6px",
            }}
          >
            3 sons à{" "}
            <span style={{ color: ACCENT }}>identifier</span>
          </p>
          <p
            style={{
              fontSize: 13,
              color: TEXT_SECONDARY,
              marginBottom: 44,
              lineHeight: 1.6,
            }}
          >
            Écoutez. Validez chaque son dès que vous le percevez
          </p>

          <div
            style={{ display: "flex", gap: 24, justifyContent: "center" }}
          >
            {hearChecked.map((checked, i) => (
              <button
                key={i}
                onClick={() => handleHearClick(i)}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  background: checked
                    ? ACCENT_DIM
                    : "rgba(255,255,255,0.04)",
                  border: `2px solid ${
                    checked ? ACCENT : "rgba(255,255,255,0.11)"
                  }`,
                  cursor: checked ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  color: checked ? ACCENT : "rgba(255,255,255,0.3)",
                  animation: !checked
                    ? `pulse-hear 2.6s ease-in-out infinite`
                    : "none",
                  animationDelay: `${i * 0.45}s`,
                  transition: "all 0.25s ease",
                  boxShadow: checked ? `0 0 18px ${ACCENT}44` : "none",
                }}
              >
                {checked ? <SvgCheck size={20} color={ACCENT} /> : "~"}
              </button>
            ))}
          </div>

          <p style={{ marginTop: 28, fontSize: 12, color: TEXT_MUTED }}>
            {hearChecked.filter(Boolean).length} / 3
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP_2_SMELL — 2 tap boxes, screen re-lit
      ══════════════════════════════════════════════════════════════════════ */}
      {stage === "STEP_2_SMELL" && (
        <div
          style={{
            textAlign: "center",
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 360,
          }}
        >
          <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}>
            <IconWind size={30} color={ACCENT} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 6px ${ACCENT}55)` }} />
          </div>
          <p
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              margin: "0 0 6px",
            }}
          >
            2 odeurs à{" "}
            <span style={{ color: ACCENT }}>percevoir</span>
          </p>
          <p
            style={{
              fontSize: 13,
              color: TEXT_SECONDARY,
              marginBottom: 40,
              lineHeight: 1.6,
            }}
          >
            Respirez lentement. Tapez sur chaque case dès que vous
            identifiez une odeur
          </p>

          <div
            style={{ display: "flex", gap: 24, justifyContent: "center" }}
          >
            {smellChecked.map((checked, i) => (
              <button
                key={i}
                onClick={() => handleSmellClick(i)}
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 22,
                  background: checked
                    ? ACCENT_DIM
                    : "rgba(255,255,255,0.04)",
                  border: `2px solid ${
                    checked ? ACCENT : "rgba(255,255,255,0.09)"
                  }`,
                  cursor: checked ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: checked ? 26 : 16,
                  fontWeight: 700,
                  color: checked ? ACCENT : TEXT_MUTED,
                  transition: "all 0.25s ease",
                  transform: checked ? "scale(1.06)" : "scale(1)",
                  boxShadow: checked ? `0 0 18px ${ACCENT}44` : "none",
                }}
              >
                {checked ? <SvgCheck size={22} color={ACCENT} /> : String(i + 1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          STEP_1_TASTE — 1 central pulsing button
      ══════════════════════════════════════════════════════════════════════ */}
      {stage === "STEP_1_TASTE" && (
        <div
          style={{
            textAlign: "center",
            position: "relative",
            zIndex: 1,
            maxWidth: 320,
          }}
        >
          <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}>
            <IconDroplet size={30} color={ACCENT} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 6px ${ACCENT}55)` }} />
          </div>
          <p
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: TEXT_PRIMARY,
              margin: "0 0 6px",
            }}
          >
            1 goût à{" "}
            <span style={{ color: ACCENT }}>percevoir</span>
          </p>
          <p
            style={{
              fontSize: 13,
              color: TEXT_SECONDARY,
              marginBottom: 44,
              lineHeight: 1.7,
            }}
          >
            Salivez légèrement. Observez le goût dans votre bouche.
          </p>

          <button
            onClick={() => {
              if (typeof navigator !== "undefined")
                navigator.vibrate?.([40, 30, 80]);
              setTasteDone(true);
            }}
            style={{
              width: 164,
              height: 164,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${ACCENT_DIM}, rgba(16,185,129,0.02))`,
              border: `2px solid ${ACCENT_BORDER}`,
              color: ACCENT,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              boxShadow: `0 0 52px ${ACCENT}22`,
              animation: "pulse-taste 2.4s ease-in-out infinite",
              lineHeight: 1.4,
              letterSpacing: 0.2,
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>✦</span>
            <span>
              Prendre conscience
              <br />
              du goût
            </span>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          COMPLETED
      ══════════════════════════════════════════════════════════════════════ */}
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
          <div style={{ marginBottom: 20, display: "flex", justifyContent: "center" }}>
            <IconCheckRing size={52} color={ACCENT} strokeWidth={1.2} style={{ filter: `drop-shadow(0 0 12px ${ACCENT}55)` }} />
          </div>
          <h2
            style={{
              margin: "0 0 14px",
              fontSize: 22,
              fontWeight: 700,
              color: TEXT_PRIMARY,
            }}
          >
            Tu es ancré·e, {firstName}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              color: TEXT_SECONDARY,
              lineHeight: 1.75,
            }}
          >
            5 · 4 · 3 · 2 · 1<br />
            Ton esprit est revenu au présent.
          </p>
        </div>
      )}

      {/* ── Keyframes ──────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-hear {
          0%, 100% { transform: scale(1);    opacity: 0.6; }
          50%       { transform: scale(1.10); opacity: 1;   }
        }
        @keyframes pulse-taste {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 52px rgba(16,185,129,0.22);
          }
          50% {
            transform: scale(1.07);
            box-shadow: 0 0 80px rgba(16,185,129,0.38);
          }
        }
      `}</style>
    </div>
  );
}
