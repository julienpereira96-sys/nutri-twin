"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { IconForkKnife, IconCheckRing, IconEye, IconMouth, IconSpiral, IconDroplet, IconRefresh } from "./SosIcons";
import { useTherapeuticVoice } from "@/hooks/useTherapeuticVoice";

// ─── Types ───────────────────────────────────────────────────────────────────
type Stage =
  | "INTRO"
  | "ALIMENT_CHECK"
  | "PHASE_LOOK"
  | "PHASE_MOUTH"
  | "PHASE_CHEW"
  | "PHASE_SWALLOW"
  | "EVALUATION"
  | "COMPLETED";

type Props = {
  sosContext: string;
  firstName: string;
  onCompleted: () => void;
  onClose: () => void;
};

type PhaseKey = "PHASE_LOOK" | "PHASE_MOUTH" | "PHASE_CHEW" | "PHASE_SWALLOW";

type PhaseConfig = {
  duration: number;
  color: string;
  icon: React.ReactNode;
  title: string;
  instruction: string;
  speech: string;
};

// ─── Phase definitions ───────────────────────────────────────────────────────
const PHASE_CONFIG: Record<PhaseKey, PhaseConfig> = {
  PHASE_LOOK: {
    duration: 10,
    color: "#f59e0b",
    icon: <IconEye size={38} color="#f59e0b" strokeWidth={1.4} />,
    title: "Observe",
    instruction: "Regarde ton aliment. Sa couleur, sa texture, sa forme. Prends le temps de vraiment le voir.",
    speech: "Regarde ton aliment. Sa couleur, sa texture, sa forme. Prends le temps de vraiment le voir.",
  },
  PHASE_MOUTH: {
    duration: 15,
    color: "#ec4899",
    icon: <IconMouth size={38} color="#ec4899" strokeWidth={1.4} />,
    title: "Porte à la bouche",
    instruction: "Approche l'aliment lentement. Sens son arôme. Dépose-le sur ta langue sans encore croquer.",
    speech: "Approche l'aliment lentement. Sens son arôme. Dépose-le sur ta langue.",
  },
  PHASE_CHEW: {
    duration: 20,
    color: "#8b5cf6",
    icon: <IconSpiral size={38} color="#8b5cf6" strokeWidth={1.4} />,
    title: "Mâche doucement",
    instruction: "Mâche lentement. Laisse les saveurs se révéler. Sens chaque texture changer sous tes dents.",
    speech: "Mâche lentement. Laisse les saveurs se révéler. Sens chaque texture changer sous tes dents.",
  },
  PHASE_SWALLOW: {
    duration: 10,
    color: "#06b6d4",
    icon: <IconDroplet size={38} color="#06b6d4" strokeWidth={1.4} />,
    title: "Avale consciemment",
    instruction: "Avale doucement. Ressens le trajet dans ta gorge. Pose ton aliment si tu en as encore.",
    speech: "Avale doucement. Ressens le trajet dans ta gorge.",
  },
};

const PHASE_ORDER: PhaseKey[] = [
  "PHASE_LOOK",
  "PHASE_MOUTH",
  "PHASE_CHEW",
  "PHASE_SWALLOW",
];

// ─── SVG gauge constants ──────────────────────────────────────────────────────
const GAUGE_R = 52;
const GAUGE_CIRC = 2 * Math.PI * GAUGE_R;

// ─── CountdownCircle sub-component ───────────────────────────────────────────
// value/total: ratio determines how much arc is shown
// countdown: value goes duration→0, arc depletes
// fill (chew): value goes 0→100, arc fills
function CountdownCircle({
  value,
  total,
  color,
}: {
  value: number;
  total: number;
  color: string;
}) {
  const progress = Math.max(0, Math.min(1, value / total));
  // offset=0 → full arc; offset=CIRC → empty arc
  const offset = GAUGE_CIRC * (1 - progress);
  const sz = GAUGE_R * 2 + 20;
  return (
    <svg
      width={sz}
      height={sz}
      viewBox={`0 0 ${sz} ${sz}`}
      style={{ transform: "rotate(-90deg)" }}
    >
      {/* Track */}
      <circle
        cx={GAUGE_R + 10}
        cy={GAUGE_R + 10}
        r={GAUGE_R}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={4}
      />
      {/* Arc */}
      <circle
        cx={GAUGE_R + 10}
        cy={GAUGE_R + 10}
        r={GAUGE_R}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={GAUGE_CIRC}
        strokeDashoffset={offset}
        style={{
          transition: "stroke-dashoffset 0.9s linear",
          filter: `drop-shadow(0 0 8px ${color}88)`,
        }}
      />
    </svg>
  );
}


function getIntroText(sosContext: string, firstName: string): string {
  const name = firstName ? `, ${firstName}` : "";
  if (sosContext.includes("fringale"))
    return `Cette envie de manger${name} est une invitation. On va la traverser lentement, en pleine conscience, une bouchée à la fois.`;
  if (sosContext.includes("stress") || sosContext.includes("anxiété"))
    return `Manger lentement${name} met ton corps en mode repos. Chaque bouchée devient une ancre dans le moment présent.`;
  if (sosContext.includes("culpabilité"))
    return `Tu mérites de manger${name} sans jugement. Cet exercice reconnecte plaisir et présence, sans règle ni interdit.`;
  return `Manger en pleine conscience${name}, c'est offrir à ton corps une vraie pause. On va prendre le temps ensemble, une bouchée à la fois.`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MangerExercise({
  sosContext,
  firstName,
  onCompleted,
  onClose,
}: Props) {
  const { speakTherapeutic, cancelSpeech, unlockAudio } = useTherapeuticVoice();

  const [stage, setStage] = useState<Stage>("INTRO");
  const [timeLeft, setTimeLeft] = useState(0);
  const [chewProgress, setChewProgress] = useState(0); // 0–100
  const [evalShowOptions, setEvalShowOptions] = useState(false);

  const onCompletedRef = useRef(onCompleted);
  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  // ── Global cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelSpeech();
      if (typeof navigator !== "undefined") navigator.vibrate?.(0);
    };
  }, [cancelSpeech]);

  // ── INTRO: play TTS after short delay ───────────────────────────────────────
  useEffect(() => {
    if (stage !== "INTRO") return;
    const introText = getIntroText(sosContext, firstName);
    const t = setTimeout(() => speakTherapeutic(introText, { rate: 0.80 }), 500);
    return () => {
      clearTimeout(t);
      cancelSpeech();
    };
  }, [stage, sosContext, firstName]);

  // ── ALIMENT_CHECK: prompt TTS ────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "ALIMENT_CHECK") return;
    const t = setTimeout(() => {
      speakTherapeutic("Prends ton aliment dans les mains. Regarde-le un instant.", { rate: 0.80 });
    }, 300);
    return () => {
      clearTimeout(t);
      cancelSpeech();
    };
  }, [stage]);

  // ── PHASE_LOOK: countdown 10 s ───────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "PHASE_LOOK") return;
    const cfg = PHASE_CONFIG.PHASE_LOOK;
    setTimeLeft(cfg.duration);
    setChewProgress(0);
    const tSpeech = setTimeout(() => speakTherapeutic(cfg.speech, { rate: 0.82 }), 200);

    let tick = cfg.duration;
    const iv = setInterval(() => {
      tick--;
      setTimeLeft(tick);
      if (tick <= 0) {
        clearInterval(iv);
        setStage("PHASE_MOUTH");
      }
    }, 1000);

    return () => {
      clearTimeout(tSpeech);
      clearInterval(iv);
      cancelSpeech();
    };
  }, [stage]);

  // ── PHASE_MOUTH: countdown 15 s + 60 bpm haptic ──────────────────────────────
  useEffect(() => {
    if (stage !== "PHASE_MOUTH") return;
    const cfg = PHASE_CONFIG.PHASE_MOUTH;
    setTimeLeft(cfg.duration);
    const tSpeech = setTimeout(() => speakTherapeutic(cfg.speech, { rate: 0.82 }), 200);

    let tick = cfg.duration;
    const ivCountdown = setInterval(() => {
      tick--;
      setTimeLeft(tick);
      if (tick <= 0) {
        clearInterval(ivCountdown);
        setStage("PHASE_CHEW");
      }
    }, 1000);

    // 60 bpm = one pulse per second
    const ivHaptic = setInterval(() => {
      navigator.vibrate?.(30);
    }, 1000);

    return () => {
      clearTimeout(tSpeech);
      clearInterval(ivCountdown);
      clearInterval(ivHaptic);
      navigator.vibrate?.(0);
      cancelSpeech();
    };
  }, [stage]);

  // ── PHASE_CHEW: filling gauge over 20 s ──────────────────────────────────────
  useEffect(() => {
    if (stage !== "PHASE_CHEW") return;
    const cfg = PHASE_CONFIG.PHASE_CHEW;
    setChewProgress(0);
    const tSpeech = setTimeout(() => speakTherapeutic(cfg.speech, { rate: 0.82 }), 200);

    const TICK_MS = 80;
    const totalTicks = Math.round((cfg.duration * 1000) / TICK_MS); // 250
    let ticks = 0;
    const iv = setInterval(() => {
      ticks++;
      const p = Math.min(100, (ticks / totalTicks) * 100);
      setChewProgress(p);
      // Subtle double-tap haptic every ~500 ms to mimic chewing rhythm
      if (ticks % 6 === 0) {
        navigator.vibrate?.([12, 25, 12]);
      }
      if (ticks >= totalTicks) {
        clearInterval(iv);
        setStage("PHASE_SWALLOW");
      }
    }, TICK_MS);

    return () => {
      clearTimeout(tSpeech);
      clearInterval(iv);
      navigator.vibrate?.(0);
      cancelSpeech();
    };
  }, [stage]);

  // ── PHASE_SWALLOW: countdown 10 s ────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "PHASE_SWALLOW") return;
    const cfg = PHASE_CONFIG.PHASE_SWALLOW;
    setTimeLeft(cfg.duration);
    const tSpeech = setTimeout(() => speakTherapeutic(cfg.speech, { rate: 0.82 }), 200);

    let tick = cfg.duration;
    const iv = setInterval(() => {
      tick--;
      setTimeLeft(tick);
      if (tick <= 0) {
        clearInterval(iv);
        setStage("EVALUATION");
      }
    }, 1000);

    return () => {
      clearTimeout(tSpeech);
      clearInterval(iv);
      cancelSpeech();
    };
  }, [stage]);

  // ── EVALUATION: reset sub-options, TTS ──────────────────────────────────────
  useEffect(() => {
    if (stage !== "EVALUATION") return;
    setEvalShowOptions(false);
    const t = setTimeout(() => {
      speakTherapeutic("Comment te sens-tu maintenant ?", { rate: 0.82 });
    }, 400);
    return () => {
      clearTimeout(t);
      cancelSpeech();
    };
  }, [stage]);

  // ── COMPLETED: TTS + auto-dismiss ────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "COMPLETED") return;
    speakTherapeutic("Très bien. Tu as pris soin de toi.", { rate: 0.82, volume: 0.7 });
    const t = setTimeout(() => {
      onCompletedRef.current();
    }, 2800);
    return () => {
      clearTimeout(t);
      cancelSpeech();
    };
  }, [stage]);

  // ── Callbacks ─────────────────────────────────────────────────────────────────
  const handleAlimentReady = useCallback(() => {
    unlockAudio();
    setStage("PHASE_LOOK");
  }, [unlockAudio]);

  const handleEvalDone = useCallback(() => {
    setStage("COMPLETED");
  }, []);

  const handleEvalAgain = useCallback(() => {
    setEvalShowOptions(true);
  }, []);

  const handleRelaunch = useCallback(() => {
    // Skip ALIMENT_CHECK on repeat cycles, go straight to PHASE_LOOK
    setStage("PHASE_LOOK");
  }, []);

  const handleForceComplete = useCallback(() => {
    setStage("COMPLETED");
  }, []);

  const handleClose = useCallback(() => {
    cancelSpeech();
    if (typeof navigator !== "undefined") navigator.vibrate?.(0);
    onClose();
  }, [onClose, cancelSpeech]);

  // ── Derived values ────────────────────────────────────────────────────────────
  const isTimedPhase =
    stage === "PHASE_LOOK" ||
    stage === "PHASE_MOUTH" ||
    stage === "PHASE_CHEW" ||
    stage === "PHASE_SWALLOW";
  const currentPhaseKey = isTimedPhase ? (stage as PhaseKey) : null;
  const phaseCfg = currentPhaseKey ? PHASE_CONFIG[currentPhaseKey] : null;
  const phaseIndex = currentPhaseKey ? PHASE_ORDER.indexOf(currentPhaseKey) : -1;

  const introText = getIntroText(sosContext, firstName);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#060a08",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes manger-fadein {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes manger-pulse {
          0%, 100% { transform: scale(1);    opacity: 0.85; }
          50%       { transform: scale(1.07); opacity: 1; }
        }
        @keyframes manger-glow-ring {
          0%   { box-shadow: 0 0 0 0   rgba(16,185,129,0.4); }
          70%  { box-shadow: 0 0 0 20px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0   rgba(16,185,129,0); }
        }
        .mg-btn {
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          font-family: inherit;
        }
        .mg-btn:hover  { opacity: 0.82; transform: translateY(-1px); }
        .mg-btn:active { transform: scale(0.97); }
      `}</style>

      {/* ── Close button ── */}
      {stage !== "COMPLETED" && (
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.09)",
            color: "rgba(255,255,255,0.4)",
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
      )}

      {/* ══ INTRO ══ */}
      {stage === "INTRO" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
            maxWidth: 380,
            width: "100%",
            animation: "manger-fadein 0.6s ease",
          }}
        >
          <IconForkKnife size={52} color="#10b981" strokeWidth={1.3} style={{ filter: "drop-shadow(0 0 10px rgba(16,185,129,0.35))" }} />
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "rgba(255,255,255,0.9)",
                marginBottom: 14,
                letterSpacing: "-0.4px",
              }}
            >
              Manger en pleine conscience
            </div>
            <div
              style={{
                fontSize: 15,
                color: "rgba(255,255,255,0.58)",
                lineHeight: 1.65,
              }}
            >
              {introText}
            </div>
          </div>
          <button
            className="mg-btn"
            onClick={() => setStage("ALIMENT_CHECK")}
            style={{
              background: "rgba(16,185,129,0.11)",
              border: "1px solid rgba(16,185,129,0.32)",
              borderRadius: 16,
              padding: "14px 36px",
              color: "#10b981",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.2px",
            }}
          >
            Je suis prêt·e →
          </button>
        </div>
      )}

      {/* ══ ALIMENT_CHECK ══ */}
      {stage === "ALIMENT_CHECK" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 28,
            maxWidth: 360,
            width: "100%",
            animation: "manger-fadein 0.5s ease",
          }}
        >
          <IconForkKnife size={48} color="rgba(255,255,255,0.55)" strokeWidth={1.3} />
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "rgba(255,255,255,0.9)",
                marginBottom: 12,
              }}
            >
              Prépare-toi
            </div>
            <div
              style={{
                fontSize: 15,
                color: "rgba(255,255,255,0.58)",
                lineHeight: 1.65,
              }}
            >
              Prends ton aliment dans les mains. Regarde-le un instant. Pose tout le reste.
            </div>
          </div>
          <button
            className="mg-btn"
            onClick={handleAlimentReady}
            style={{
              background: "rgba(16,185,129,0.11)",
              border: "1px solid rgba(16,185,129,0.32)",
              borderRadius: 16,
              padding: "14px 36px",
              color: "#10b981",
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            Je commence →
          </button>
        </div>
      )}

      {/* ══ TIMED PHASES ══ */}
      {isTimedPhase && phaseCfg && currentPhaseKey && (
        <div
          key={stage}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            maxWidth: 360,
            width: "100%",
            animation: "manger-fadein 0.45s ease",
          }}
        >
          {/* Phase progress dots */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {PHASE_ORDER.map((pk, i) => (
              <div
                key={pk}
                style={{
                  width: i === phaseIndex ? 26 : 8,
                  height: 8,
                  borderRadius: 4,
                  background:
                    i < phaseIndex
                      ? "rgba(255,255,255,0.25)"
                      : i === phaseIndex
                      ? phaseCfg.color
                      : "rgba(255,255,255,0.1)",
                  transition: "all 0.4s ease",
                  boxShadow: i === phaseIndex ? `0 0 8px ${phaseCfg.color}88` : "none",
                }}
              />
            ))}
          </div>

          {/* Gauge circle with emoji */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CountdownCircle
              value={stage === "PHASE_CHEW" ? chewProgress : timeLeft}
              total={stage === "PHASE_CHEW" ? 100 : phaseCfg.duration}
              color={phaseCfg.color}
            />
            <div
              style={{
                position: "absolute",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "manger-pulse 2.2s ease-in-out infinite",
              }}
            >
              {phaseCfg.icon}
            </div>
          </div>

          {/* Phase title & instruction */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1.6px",
                color: phaseCfg.color,
                marginBottom: 8,
                opacity: 0.9,
              }}
            >
              {phaseCfg.title}
            </div>
            <div
              style={{
                fontSize: 15,
                color: "rgba(255,255,255,0.72)",
                lineHeight: 1.65,
                maxWidth: 300,
              }}
            >
              {phaseCfg.instruction}
            </div>
          </div>

          {/* Timer / progress label */}
          <div
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.30)",
              letterSpacing: "0.5px",
            }}
          >
            {stage === "PHASE_CHEW"
              ? `${Math.round(chewProgress)} %`
              : `${timeLeft} s`}
          </div>
        </div>
      )}

      {/* ══ EVALUATION ══ */}
      {stage === "EVALUATION" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            maxWidth: 360,
            width: "100%",
            animation: "manger-fadein 0.5s ease",
          }}
        >
          <IconCheckRing size={48} color="#10b981" strokeWidth={1.3} style={{ filter: "drop-shadow(0 0 8px rgba(16,185,129,0.4))" }} />
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "rgba(255,255,255,0.9)",
                marginBottom: 10,
              }}
            >
              Comment te sens-tu ?
            </div>
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.48)",
                lineHeight: 1.6,
              }}
            >
              Prends un moment pour observer ce qui s'est passé en toi.
            </div>
          </div>

          {!evalShowOptions ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                width: "100%",
              }}
            >
              <button
                className="mg-btn"
                onClick={handleEvalDone}
                style={{
                  background: "rgba(16,185,129,0.10)",
                  border: "1px solid rgba(16,185,129,0.28)",
                  borderRadius: 14,
                  padding: "15px 24px",
                  color: "#10b981",
                  fontSize: 15,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                La crise est passée
              </button>
              <button
                className="mg-btn"
                onClick={handleEvalAgain}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 14,
                  padding: "15px 24px",
                  color: "rgba(255,255,255,0.55)",
                  fontSize: 15,
                  fontWeight: 500,
                  textAlign: "center",
                }}
              >
                L'envie est encore là
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                width: "100%",
                animation: "manger-fadein 0.4s ease",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.38)",
                  textAlign: "center",
                  marginBottom: 4,
                }}
              >
                Que veux-tu faire ?
              </div>
              <button
                className="mg-btn"
                onClick={handleRelaunch}
                style={{
                  background: "rgba(139,92,246,0.10)",
                  border: "1px solid rgba(139,92,246,0.28)",
                  borderRadius: 14,
                  padding: "15px 24px",
                  color: "#a78bfa",
                  fontSize: 15,
                  fontWeight: 600,
                  textAlign: "center",
                }}
              >
                <IconRefresh size={16} color="#a78bfa" strokeWidth={1.5} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
                Relancer le cycle
              </button>
              <button
                className="mg-btn"
                onClick={handleForceComplete}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: "15px 24px",
                  color: "rgba(255,255,255,0.42)",
                  fontSize: 14,
                  fontWeight: 500,
                  textAlign: "center",
                }}
              >
                Terminer quand même →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ COMPLETED ══ */}
      {stage === "COMPLETED" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            animation: "manger-fadein 0.6s ease",
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "manger-glow-ring 1.6s ease infinite",
            }}
          >
            <IconCheckRing size={76} color="#10b981" strokeWidth={1.2} style={{ filter: "drop-shadow(0 0 14px rgba(16,185,129,0.55))" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#10b981",
                marginBottom: 8,
              }}
            >
              Bien joué{firstName ? `, ${firstName}` : ""}
            </div>
            <div
              style={{
                fontSize: 15,
                color: "rgba(255,255,255,0.52)",
                lineHeight: 1.6,
              }}
            >
              Tu as pris soin de toi avec bienveillance.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
