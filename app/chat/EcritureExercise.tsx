"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { IconPen, IconFlame, IconScissors, IconCheckRing } from "./SosIcons";
import { useTherapeuticVoice } from "@/hooks/useTherapeuticVoice";
import { makeBoundaryHandler } from "@/lib/therapeuticVoice";

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage =
  | "INTRO"
  | "Q1_EMOTION"
  | "Q2_NEED"
  | "Q3_PARDON"
  | "RITUAL_CHOICE"
  | "RITUAL_ANIMATION"
  | "COMPLETED";

type RitualChoice = "fire" | "shred" | null;

type QKey = "Q1_EMOTION" | "Q2_NEED" | "Q3_PARDON";

type Props = {
  sosContext: string;
  firstName: string;
  onCompleted: () => void;
  onClose: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const WORD_MS = 390;  // ms per word for karaoke pacing
const STRIPS_N = 9;   // vertical shredder strips

const Q_ORDER: QKey[] = ["Q1_EMOTION", "Q2_NEED", "Q3_PARDON"];

type QData = { step: string; question: string; hint: string };

const Q_DATA: Record<QKey, QData> = {
  Q1_EMOTION: {
    step: "1 / 3",
    question: "Qu'est-ce qui pèse le plus lourd dans ta poitrine là, tout de suite ?",
    hint: "Décris ta colère, ta déception, ta honte… sans filtre.",
  },
  Q2_NEED: {
    step: "2 / 3",
    question: "De quoi ton corps ou ton esprit avait cruellement besoin au moment où tu as craqué ?",
    hint: "Du réconfort, du repos, de la sécurité…",
  },
  Q3_PARDON: {
    step: "3 / 3",
    question: "Si ta meilleure amie venait de faire exactement la même chose, que lui dirais-tu pour la consoler ?",
    hint: "Parle-lui avec toute la douceur que tu mérites.",
  },
};

function getIntroSpeech(firstName: string): string {
  const name = firstName ? `, ${firstName}` : "";
  return `Ce qui est fait est fait${name}, aucun jugement ici. Sortons ces pensées de ta tête pour les regarder en face, et les laisser partir.`;
}

// ─── LetterCard ───────────────────────────────────────────────────────────────
function LetterCard({ q1, q2, q3 }: { q1: string; q2: string; q3: string }) {
  return (
    <div
      style={{
        background: "linear-gradient(160deg, #fdf3e3 0%, #f5e6c8 55%, #efd8b0 100%)",
        borderRadius: 10,
        padding: "22px 20px 20px",
        border: "1px solid rgba(180,140,80,0.32)",
        boxShadow: "0 3px 28px rgba(0,0,0,0.38), inset 0 0 50px rgba(180,140,80,0.10)",
        color: "#3d2b1a",
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 13.5,
        lineHeight: 1.72,
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "1.6px",
          color: "#8b6a3e",
          opacity: 0.65,
          marginBottom: 16,
        }}
      >
        Lettre de culpabilité
      </div>

      {/* Q1 */}
      <p style={{ marginBottom: 14 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1.1px",
            color: "#6b4a2a",
            display: "block",
            marginBottom: 4,
          }}
        >
          Ce qui pesait
        </span>
        {q1}
      </p>

      {/* Q2 */}
      <p style={{ marginBottom: 14 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1.1px",
            color: "#6b4a2a",
            display: "block",
            marginBottom: 4,
          }}
        >
          Ce dont j&apos;avais besoin
        </span>
        {q2}
      </p>

      {/* Q3 */}
      <p>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1.1px",
            color: "#6b4a2a",
            display: "block",
            marginBottom: 4,
          }}
        >
          Ce que je me dis
        </span>
        {q3}
      </p>

      {/* Decorative bottom rule */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          borderRadius: "0 0 10px 10px",
          background: "linear-gradient(to right, transparent, rgba(180,140,80,0.3), transparent)",
        }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EcritureExercise({
  sosContext: _sosContext,
  firstName,
  onCompleted,
  onClose,
}: Props) {
  const { speakTherapeutic, cancelSpeech, unlockAudio } = useTherapeuticVoice();

  const [stage, setStage] = useState<Stage>("INTRO");
  const [q1Text, setQ1Text] = useState("");
  const [q2Text, setQ2Text] = useState("");
  const [q3Text, setQ3Text] = useState("");
  const [highlightWord, setHighlightWord] = useState(-1);
  const [ritualChoice, setRitualChoice] = useState<RitualChoice>(null);
  const [burnProgress, setBurnProgress] = useState(0); // 0–100
  const [isBurningActive, setIsBurningActive] = useState(false);
  const [shredTriggered, setShredTriggered] = useState(false);

  const onCompletedRef = useRef(onCompleted);
  useEffect(() => { onCompletedRef.current = onCompleted; }, [onCompleted]);

  const burnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isBurningRef = useRef(false);
  const burnProgressRef = useRef(0);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Global unmount cleanup ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelSpeech();
      if (typeof navigator !== "undefined") navigator.vibrate?.(0);
      timerRefs.current.forEach(clearTimeout);
      if (burnIntervalRef.current) clearInterval(burnIntervalRef.current);
    };
  }, [cancelSpeech]);

  // ── INTRO: karaoke (boundary-driven, timer fallback for iOS) ────────────────
  useEffect(() => {
    if (stage !== "INTRO") return;
    const text  = getIntroSpeech(firstName);
    const words = text.split(" ");
    const wordTimers = words.map((_, i) =>
      setTimeout(() => setHighlightWord(i), 400 + i * WORD_MS)
    );
    const cancelFallback = () => {
      wordTimers.forEach(clearTimeout);
    };
    // skipPrep: true — karaoke timers calibrated to raw text length
    const tts = setTimeout(() => speakTherapeutic(text, {
      skipPrep: true,
      rate: 0.80,
      volume: 0.82,
      onBoundary: makeBoundaryHandler(words, setHighlightWord, cancelFallback),
    }), 250);
    timerRefs.current = [...wordTimers, tts];
    return () => {
      wordTimers.forEach(clearTimeout);
      clearTimeout(tts);
      cancelSpeech();
      setHighlightWord(-1);
    };
  }, [stage, firstName, speakTherapeutic, cancelSpeech]);

  // ── Q stages: auto-focus textarea ───────────────────────────────────────────
  useEffect(() => {
    if (!Q_ORDER.includes(stage as QKey)) return;
    const t = setTimeout(() => textareaRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [stage]);

  // ── COMPLETED: TTS + auto-dismiss ───────────────────────────────────────────
  useEffect(() => {
    if (stage !== "COMPLETED") return;
    speakTherapeutic(
      "Très bien. Ces pensées sont sorties, tu peux avancer maintenant.",
      { rate: 0.82, volume: 0.70 }
    );
    const t = setTimeout(() => onCompletedRef.current(), 3200);
    return () => {
      clearTimeout(t);
      cancelSpeech();
    };
  }, [stage, speakTherapeutic, cancelSpeech]);

  // ── Fire: start burn ─────────────────────────────────────────────────────────
  const startBurn = useCallback(() => {
    if (burnProgressRef.current >= 100) return;
    isBurningRef.current = true;
    setIsBurningActive(true);
    burnIntervalRef.current = setInterval(() => {
      if (!isBurningRef.current) return;
      navigator.vibrate?.(50);
      burnProgressRef.current = Math.min(100, burnProgressRef.current + 2);
      setBurnProgress(burnProgressRef.current);
      if (burnProgressRef.current >= 100) {
        if (burnIntervalRef.current) clearInterval(burnIntervalRef.current);
        isBurningRef.current = false;
        setIsBurningActive(false);
        navigator.vibrate?.(0);
        const t = setTimeout(() => setStage("COMPLETED"), 500);
        timerRefs.current.push(t);
      }
    }, 60); // 50 ticks × 60ms = 3 s to fully burn
  }, []);

  // ── Fire: stop burn ──────────────────────────────────────────────────────────
  const stopBurn = useCallback(() => {
    isBurningRef.current = false;
    setIsBurningActive(false);
    if (burnIntervalRef.current) clearInterval(burnIntervalRef.current);
    navigator.vibrate?.(0);
  }, []);

  // ── Shred: trigger ───────────────────────────────────────────────────────────
  const handleShred = useCallback(() => {
    setShredTriggered(true);
    navigator.vibrate?.([40, 20, 40, 20, 40, 20, 40, 20, 40]);
    const t = setTimeout(() => setStage("COMPLETED"), 1700);
    timerRefs.current.push(t);
  }, []);

  // ── Stage navigation ─────────────────────────────────────────────────────────
  const handleNextFromQ = useCallback((current: Stage) => {
    const map: Partial<Record<Stage, Stage>> = {
      Q1_EMOTION: "Q2_NEED",
      Q2_NEED: "Q3_PARDON",
      Q3_PARDON: "RITUAL_CHOICE",
    };
    const next = map[current];
    if (next) setStage(next);
  }, []);

  const handleChooseRitual = useCallback((choice: RitualChoice) => {
    setRitualChoice(choice);
    setBurnProgress(0);
    burnProgressRef.current = 0;
    setShredTriggered(false);
    setIsBurningActive(false);
    setStage("RITUAL_ANIMATION");
  }, []);

  const handleClose = useCallback(() => {
    cancelSpeech();
    if (typeof navigator !== "undefined") navigator.vibrate?.(0);
    timerRefs.current.forEach(clearTimeout);
    if (burnIntervalRef.current) clearInterval(burnIntervalRef.current);
    onClose();
  }, [onClose, cancelSpeech]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const isQStage = Q_ORDER.includes(stage as QKey);
  const qKey = isQStage ? (stage as QKey) : null;
  const qData: QData | null = qKey ? Q_DATA[qKey] : null;
  const qCurrentIndex = qKey ? Q_ORDER.indexOf(qKey) : -1;

  const currentText =
    stage === "Q1_EMOTION" ? q1Text :
    stage === "Q2_NEED"    ? q2Text :
    q3Text;

  const setCurrentText: (v: string) => void =
    stage === "Q1_EMOTION" ? setQ1Text :
    stage === "Q2_NEED"    ? setQ2Text :
    setQ3Text;

  const canProceed = currentText.trim().length >= 5;

  const introWords = getIntroSpeech(firstName).split(" ");

  // Fire mask: burns from bottom up. At burnProgress=X%, bottom X% is transparent.
  const fireMaskStyle: React.CSSProperties =
    burnProgress > 0
      ? {
          WebkitMaskImage: `linear-gradient(to top, transparent ${Math.max(0, burnProgress - 3)}%, black ${Math.min(100, burnProgress + 3)}%)`,
          maskImage: `linear-gradient(to top, transparent ${Math.max(0, burnProgress - 3)}%, black ${Math.min(100, burnProgress + 3)}%)`,
        }
      : {};

  // ── Render ───────────────────────────────────────────────────────────────────
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
        @keyframes ec-fadein {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ec-blink {
          0%, 100% { opacity: 0.45; }
          50%       { opacity: 1; }
        }
        @keyframes ec-fire-flicker {
          0%, 100% { opacity: 0.75; transform: scaleX(1);    skewX(0deg); }
          25%      { opacity: 1;    transform: scaleX(1.04); skewX(1deg); }
          75%      { opacity: 0.85; transform: scaleX(0.97); skewX(-1deg); }
        }
        @keyframes ec-shred-fall {
          0%   { transform: translateY(0)    scaleX(1);    opacity: 1; }
          30%  { transform: translateY(20px) scaleX(0.92); opacity: 0.95; }
          100% { transform: translateY(150%) scaleX(0.75); opacity: 0.4; }
        }
        @keyframes ec-complete-glow {
          0%   { box-shadow: 0 0 0 0    rgba(16,185,129,0.5); }
          70%  { box-shadow: 0 0 0 20px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0    rgba(16,185,129,0); }
        }
        .ec-btn {
          cursor: pointer;
          font-family: inherit;
          transition: opacity 0.2s, transform 0.15s;
        }
        .ec-btn:hover  { opacity: 0.82; transform: translateY(-1px); }
        .ec-btn:active { transform: scale(0.97); }
        .ec-q-enter { animation: ec-fadein 0.42s ease; }
      `}</style>

      {/* ── Close ── */}
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
            animation: "ec-fadein 0.6s ease",
          }}
        >
          <IconPen size={48} color="#f59e0b" strokeWidth={1.3} style={{ filter: "drop-shadow(0 0 10px rgba(245,158,11,0.35))" }} />

          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 21,
                fontWeight: 700,
                color: "rgba(255,255,255,0.9)",
                marginBottom: 20,
                letterSpacing: "-0.3px",
              }}
            >
              Écriture cathartique
            </div>

            {/* Karaoke words */}
            <div
              style={{
                fontSize: 15,
                lineHeight: 1.78,
                maxWidth: 330,
              }}
            >
              {introWords.map((word, i) => (
                <span
                  key={i}
                  style={{
                    marginRight: "0.28em",
                    color:
                      i === highlightWord
                        ? "rgba(255,255,255,0.95)"
                        : i < highlightWord
                        ? "rgba(255,255,255,0.58)"
                        : "rgba(255,255,255,0.32)",
                    fontWeight: i === highlightWord ? 600 : 400,
                    transition: "color 0.18s ease",
                  }}
                >
                  {word}
                </span>
              ))}
            </div>
          </div>

          <button
            className="ec-btn"
            onClick={() => {
              unlockAudio();
              setStage("Q1_EMOTION");
            }}
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
            J&apos;y suis →
          </button>
        </div>
      )}

      {/* ══ QUESTION STAGES ══ */}
      {isQStage && qData && qKey && (
        <div
          key={stage}
          className="ec-q-enter"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 420,
            width: "100%",
          }}
        >
          {/* Step label + question */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1.6px",
                color: "rgba(255,255,255,0.28)",
                marginBottom: 10,
              }}
            >
              {qData.step}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "rgba(255,255,255,0.88)",
                lineHeight: 1.45,
                letterSpacing: "-0.2px",
              }}
            >
              {qData.question}
            </div>
          </div>

          {/* Notebook textarea */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 14,
              padding: "16px 16px 36px",
              position: "relative",
            }}
          >
            <textarea
              ref={textareaRef}
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value)}
              placeholder={qData.hint}
              rows={5}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "rgba(255,255,255,0.85)",
                fontSize: 15,
                lineHeight: 1.7,
                resize: "none",
                fontFamily: "inherit",
                caretColor: "#10b981",
                display: "block",
              }}
            />
            {/* Char counter */}
            <div
              style={{
                position: "absolute",
                bottom: 10,
                right: 14,
                fontSize: 11,
                color:
                  currentText.trim().length >= 5
                    ? "rgba(16,185,129,0.55)"
                    : "rgba(255,255,255,0.18)",
                transition: "color 0.3s",
              }}
            >
              {currentText.trim().length} car.
            </div>
          </div>

          {/* Progress dots */}
          <div style={{ display: "flex", gap: 7, justifyContent: "center" }}>
            {Q_ORDER.map((k, i) => (
              <div
                key={k}
                style={{
                  width: k === qKey ? 24 : 7,
                  height: 7,
                  borderRadius: 3.5,
                  background:
                    i < qCurrentIndex
                      ? "rgba(16,185,129,0.45)"
                      : k === qKey
                      ? "#10b981"
                      : "rgba(255,255,255,0.12)",
                  boxShadow: k === qKey ? "0 0 7px rgba(16,185,129,0.5)" : "none",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>

          {/* Next / Create button */}
          <button
            className="ec-btn"
            disabled={!canProceed}
            onClick={() => handleNextFromQ(stage)}
            style={{
              background: canProceed
                ? "rgba(16,185,129,0.12)"
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${
                canProceed ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.08)"
              }`,
              borderRadius: 14,
              padding: "14px 28px",
              color: canProceed ? "#10b981" : "rgba(255,255,255,0.22)",
              fontSize: 15,
              fontWeight: 600,
              cursor: canProceed ? "pointer" : "default",
              transition: "all 0.25s",
            }}
          >
            {stage === "Q3_PARDON" ? "Créer la lettre →" : "Suivant →"}
          </button>
        </div>
      )}

      {/* ══ RITUAL_CHOICE ══ */}
      {stage === "RITUAL_CHOICE" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 420,
            width: "100%",
            animation: "ec-fadein 0.5s ease",
            overflowY: "auto",
            maxHeight: "calc(100dvh - 80px)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: "rgba(255,255,255,0.28)",
                marginBottom: 8,
              }}
            >
              Ta lettre de culpabilité
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: "rgba(255,255,255,0.85)",
                marginBottom: 18,
              }}
            >
              Comment veux-tu la détruire ?
            </div>
          </div>

          {/* Letter preview */}
          <LetterCard q1={q1Text} q2={q2Text} q3={q3Text} />

          {/* Ritual choice buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="ec-btn"
              onClick={() => handleChooseRitual("fire")}
              style={{
                flex: 1,
                background: "rgba(239,68,68,0.09)",
                border: "1px solid rgba(239,68,68,0.27)",
                borderRadius: 14,
                padding: "16px 10px",
                color: "#fca5a5",
                fontSize: 15,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              <IconFlame size={16} color="#fca5a5" strokeWidth={1.4} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />
              Brûler
            </button>
            <button
              className="ec-btn"
              onClick={() => handleChooseRitual("shred")}
              style={{
                flex: 1,
                background: "rgba(99,102,241,0.09)",
                border: "1px solid rgba(99,102,241,0.27)",
                borderRadius: 14,
                padding: "16px 10px",
                color: "#a5b4fc",
                fontSize: 15,
                fontWeight: 600,
                textAlign: "center",
              }}
            >
              <IconScissors size={16} color="#a5b4fc" strokeWidth={1.4} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />
              Broyer
            </button>
          </div>
        </div>
      )}

      {/* ══ RITUAL_ANIMATION ══ */}
      {stage === "RITUAL_ANIMATION" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            maxWidth: 420,
            width: "100%",
            animation: "ec-fadein 0.4s ease",
          }}
        >
          {/* ── FIRE ritual ── */}
          {ritualChoice === "fire" && (
            <>
              {/* Instruction */}
              <div style={{ textAlign: "center", minHeight: 22 }}>
                <span
                  style={{
                    fontSize: 13,
                    color: isBurningActive
                      ? "#fca5a5"
                      : "rgba(255,255,255,0.45)",
                    animation: isBurningActive
                      ? "none"
                      : "ec-blink 1.6s ease-in-out infinite",
                    transition: "color 0.25s",
                  }}
                >
                  {burnProgress === 0
                    ? "Maintiens ton doigt appuyé pour brûler"
                    : burnProgress >= 100
                    ? "Consumée…"
                    : `En cours… ${Math.round(burnProgress)} %`}
                </span>
              </div>

              {/* Letter with fire mask + pointer interaction */}
              <div
                style={{
                  position: "relative",
                  cursor: "pointer",
                  WebkitUserSelect: "none",
                  userSelect: "none",
                  touchAction: "none",
                }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  startBurn();
                }}
                onPointerUp={stopBurn}
                onPointerLeave={stopBurn}
                onPointerCancel={stopBurn}
              >
                {/* Masked letter */}
                <div style={{ borderRadius: 10, ...fireMaskStyle }}>
                  <LetterCard q1={q1Text} q2={q2Text} q3={q3Text} />
                </div>

                {/* Fire glow at the burn line */}
                {burnProgress > 0 && burnProgress < 100 && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: -6,
                      right: -6,
                      bottom: `${Math.max(0, burnProgress - 2)}%`,
                      height: 22,
                      background:
                        "linear-gradient(to bottom, rgba(255,120,0,0), rgba(255,120,0,0.75), rgba(255,210,0,0.95), rgba(255,120,0,0.75), rgba(255,50,0,0))",
                      filter: "blur(3px)",
                      pointerEvents: "none",
                      animation: "ec-fire-flicker 0.28s ease-in-out infinite",
                      zIndex: 2,
                    }}
                  />
                )}
              </div>
            </>
          )}

          {/* ── SHRED ritual ── */}
          {ritualChoice === "shred" && (
            <>
              {/* Instruction */}
              <div style={{ textAlign: "center", minHeight: 22 }}>
                <span
                  style={{
                    fontSize: 13,
                    color: shredTriggered
                      ? "#a5b4fc"
                      : "rgba(255,255,255,0.45)",
                    transition: "color 0.2s",
                  }}
                >
                  {shredTriggered
                    ? "Déchiquetage en cours…"
                    : "Prêt à détruire cette lettre ?"}
                </span>
              </div>

              {/* Letter + shred strips overlay */}
              <div style={{ position: "relative" }}>
                {/* Original letter fades out when shredding */}
                <div
                  style={{
                    opacity: shredTriggered ? 0 : 1,
                    transition: "opacity 0.22s ease",
                  }}
                >
                  <LetterCard q1={q1Text} q2={q2Text} q3={q3Text} />
                </div>

                {/* Strips rendered on shred trigger — they animate and fall */}
                {shredTriggered &&
                  Array.from({ length: STRIPS_N }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: `${(i / STRIPS_N) * 100}%`,
                        width: `${100 / STRIPS_N}%`,
                        height: "100%",
                        background:
                          i % 2 === 0 ? "#fdf3e3" : "#efd8b5",
                        borderRight:
                          i < STRIPS_N - 1
                            ? "1px solid rgba(180,140,80,0.2)"
                            : "none",
                        animation: `ec-shred-fall 0.85s ease-in ${i * 0.056}s both`,
                        pointerEvents: "none",
                      }}
                    />
                  ))}
              </div>

              {/* Broyer button — disappears when triggered */}
              {!shredTriggered && (
                <button
                  className="ec-btn"
                  onClick={handleShred}
                  style={{
                    background: "rgba(99,102,241,0.10)",
                    border: "1px solid rgba(99,102,241,0.28)",
                    borderRadius: 14,
                    padding: "14px 28px",
                    color: "#a5b4fc",
                    fontSize: 15,
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  <IconScissors size={16} color="#a5b4fc" strokeWidth={1.4} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />
                  Déchiqueter maintenant
                </button>
              )}
            </>
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
            animation: "ec-fadein 0.7s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "ec-complete-glow 1.6s ease infinite",
            }}
          >
            <IconCheckRing size={76} color="#10b981" strokeWidth={1.2} style={{ filter: "drop-shadow(0 0 12px rgba(16,185,129,0.5))" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 23,
                fontWeight: 700,
                color: "rgba(255,255,255,0.92)",
                letterSpacing: "-0.3px",
                marginBottom: 8,
              }}
            >
              C&apos;est du passé.
            </div>
            <div
              style={{
                fontSize: 21,
                fontWeight: 600,
                color: "#10b981",
                marginBottom: 14,
              }}
            >
              On repart à zéro.
            </div>
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.44)",
                lineHeight: 1.65,
              }}
            >
              Ces pensées sont sorties. Tu peux avancer maintenant.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
