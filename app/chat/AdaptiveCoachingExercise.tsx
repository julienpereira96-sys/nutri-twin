"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { IconSparkle, IconSprout, IconCheckRing, IconX } from "./SosIcons";
import { useTherapeuticVoice } from "@/hooks/useTherapeuticVoice";
import { makeBoundaryHandler, scheduleWordTimers } from "@/lib/therapeuticVoice";

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage = "INTRO" | "CHAT_STEP" | "COMMITMENT" | "COMPLETED";

type ChatMessage = {
  role: "coach" | "user";
  text: string;
};

type Props = {
  sosContext: string;
  firstName: string;
  onCompleted: () => void;
  onClose: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const WORD_MS = 390;

// ─── Karaoke word highlight ───────────────────────────────────────────────────
function useKaraoke(text: string, active: boolean) {
  const [highlightWord, setHighlightWord] = useState(-1);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setHighlightWord(-1);

    if (!active || !text) return;

    const words = text.split(" ");
    words.forEach((_, i) => {
      const t = setTimeout(() => setHighlightWord(i), i * WORD_MS);
      timersRef.current.push(t);
    });

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [text, active]);

  // Expose state setter + timer cancel so the boundary handler can take over
  const cancelTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // Reschedule timers using actual audio duration (Google TTS path)
  const rescheduleWithDuration = useCallback((durationMs: number) => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const words = text.split(" ");
    const msPerWord = durationMs / words.length;
    words.forEach((_, i) => {
      const t = setTimeout(() => setHighlightWord(i), i * msPerWord);
      timersRef.current.push(t);
    });
  }, [text]);

  return { highlightWord, setHighlightWord, cancelTimers, rescheduleWithDuration };
}

// ─── Typing indicator dots ────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "10px 14px",
        background: "rgba(255,255,255,0.07)",
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        width: "fit-content",
      }}
    >
      <style>{`
        @keyframes ac-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.6)",
            display: "inline-block",
            animation: `ac-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Intro speech text ────────────────────────────────────────────────────────
const INTRO_SPEECH =
  "Ensemble, je vais te proposer un tout petit pas — une action Kaizen que tu peux faire aujourd'hui, là où tu es. Rien de grand, rien d'écrasant. Juste un geste doux pour prendre soin de toi.";

// ─── Commitment card ──────────────────────────────────────────────────────────
function CommitmentCard({
  objective,
  firstName,
  onCommit,
  committed,
}: {
  objective: string;
  firstName: string;
  onCommit: () => void;
  committed: boolean;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(145deg, rgba(168,85,247,0.14) 0%, rgba(99,102,241,0.10) 100%)",
        border: "1px solid rgba(168,85,247,0.30)",
        borderRadius: 20,
        padding: "24px 22px",
        maxWidth: 360,
        width: "100%",
      }}
    >
      <p
        style={{
          color: "rgba(255,255,255,0.45)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          margin: "0 0 10px",
        }}
      >
        Ton micro-objectif du jour
      </p>
      <p
        style={{
          color: "white",
          fontSize: 17,
          lineHeight: 1.65,
          margin: "0 0 20px",
          fontWeight: 500,
        }}
      >
        {objective}
      </p>

      {!committed ? (
        <button
          onClick={onCommit}
          style={{
            background: "linear-gradient(135deg, #a855f7, #6366f1)",
            border: "none",
            borderRadius: 50,
            padding: "13px 28px",
            color: "white",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            width: "100%",
            letterSpacing: "0.01em",
            boxShadow: "0 4px 18px rgba(168,85,247,0.40)",
          }}
        >
          <IconSparkle size={14} color="white" strokeWidth={1.5} style={{ display: "inline-block", verticalAlign: "middle", marginRight: 6 }} />
          Je m&apos;y engage
        </button>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "#a855f7",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          <IconCheckRing size={20} color="#a855f7" strokeWidth={1.5} /> Engagement enregistré, {firstName}
        </div>
      )}
    </div>
  );
}

// ─── CSS ───────────────────────────────────────────────────────────────────────
const AC_STYLE = `
@keyframes ac-slide-up {
  0%   { opacity: 0; transform: translateY(18px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes ac-complete-pop {
  0%   { transform: scale(0.7); opacity: 0; }
  60%  { transform: scale(1.08); }
  100% { transform: scale(1);   opacity: 1; }
}
@keyframes ac-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
`;

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdaptiveCoachingExercise({
  sosContext,
  firstName,
  onCompleted,
  onClose,
}: Props) {
  const { speakTherapeutic, cancelSpeech, unlockAudio } = useTherapeuticVoice();

  const [stage, setStage]             = useState<Stage>("INTRO");
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping]       = useState(false);
  const [objective, setObjective]     = useState<string>("");
  const [committed, setCommitted]     = useState(false);
  const [introActive, setIntroActive] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  // ─── Auto-scroll chat ─────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ─── Cleanup TTS ──────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelSpeech();
    };
  }, [cancelSpeech]);

  // ─── Karaoke for intro message ────────────────────────────────────────────
  const { highlightWord, setHighlightWord: setKaraokeWord, cancelTimers: cancelKaraokeTimers, rescheduleWithDuration: rescheduleKaraokeWithDuration } = useKaraoke(INTRO_SPEECH, introActive);

  // ─── Start CHAT_STEP: show greeting + fetch objective ─────────────────────
  const startChat = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    setStage("CHAT_STEP");

    // Greeting message
    const greeting = `Bonjour ${firstName} ! Laisse-moi analyser ta situation pour te proposer quelque chose d'adapté…`;
    setMessages([{ role: "coach", text: greeting }]);
    setIsTyping(true);

    try {
      const res = await fetch("/api/adaptive-coaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", sosContext }),
      });

      const data = (await res.json()) as { objective?: string; error?: string };
      const obj = data.objective ?? "Prends une grande inspiration et offre-toi un moment de douceur dès maintenant.";

      setIsTyping(false);
      setObjective(obj);

      // Add coach message with the objective preview
      const coachMsg = `Voici ce que je te propose pour aujourd'hui :`;
      setMessages((prev) => [...prev, { role: "coach", text: coachMsg }]);

      setTimeout(() => {
        speakTherapeutic(obj, { rate: 0.80 });
        setStage("COMMITMENT");
      }, 600);
    } catch {
      setIsTyping(false);
      const fallback = "Prends un moment pour boire un grand verre d'eau en pleine conscience — ça, tu peux le faire maintenant.";
      setObjective(fallback);
      setMessages((prev) => [
        ...prev,
        { role: "coach", text: "Voici ce que je te propose pour aujourd'hui :" },
      ]);
      setTimeout(() => {
        speakTherapeutic(fallback, { rate: 0.80 });
        setStage("COMMITMENT");
      }, 600);
    }
  }, [firstName, sosContext, speakTherapeutic]);

  // ─── Commit handler ────────────────────────────────────────────────────────
  const handleCommit = useCallback(async () => {
    setCommitted(true);
    navigator.vibrate?.(30);
    speakTherapeutic(`C'est noté ${firstName}. Ce petit geste compte vraiment. Prends soin de toi.`);

    // Best-effort fire-and-forget
    fetch("/api/adaptive-coaching", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "commit", objective }),
    }).catch(() => {});

    setTimeout(() => {
      setStage("COMPLETED");
      setTimeout(onCompleted, 3500);
    }, 2200);
  }, [firstName, objective, onCompleted, speakTherapeutic]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#09050f",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflowY: "auto",
      }}
    >
      <style>{AC_STYLE}</style>

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

      {/* ── INTRO ────────────────────────────────────────────────────────── */}
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
            <IconSparkle size={64} color="#a855f7" strokeWidth={1.3} style={{ filter: "drop-shadow(0 0 12px rgba(168,85,247,0.45))" }} />
          </div>
          <h1 style={{ color: "white", fontSize: 26, fontWeight: 700, margin: 0 }}>
            Coaching Adaptatif
          </h1>

          {/* Karaoke intro */}
          <p
            style={{
              maxWidth: 340,
              lineHeight: 1.7,
              fontSize: 16,
              margin: 0,
            }}
          >
            {INTRO_SPEECH.split(" ").map((word, i) => (
              <span
                key={i}
                style={{
                  color:
                    highlightWord === i
                      ? "white"
                      : highlightWord > i
                      ? "rgba(255,255,255,0.55)"
                      : "rgba(255,255,255,0.30)",
                  transition: "color 0.2s ease",
                  marginRight: 4,
                  fontWeight: highlightWord === i ? 600 : 400,
                }}
              >
                {word}
              </span>
            ))}
          </p>

          <button
            onClick={() => {
              unlockAudio();
              setIntroActive(true); // starts timer fallback immediately
              speakTherapeutic(INTRO_SPEECH, {
                skipPrep: true,
                rate: 0.82,
                onBoundary: makeBoundaryHandler(
                  INTRO_SPEECH.split(" "),
                  setKaraokeWord,
                  cancelKaraokeTimers,
                ),
                onDurationReady: rescheduleKaraokeWithDuration,
              });
              // After intro speech (~10s), proceed
              const wordCount = INTRO_SPEECH.split(" ").length;
              setTimeout(() => {
                startChat();
              }, wordCount * WORD_MS + 1200);
            }}
            style={{
              background: "linear-gradient(135deg, #a855f7, #6366f1)",
              border: "none",
              borderRadius: 50,
              padding: "16px 48px",
              color: "white",
              fontSize: 17,
              fontWeight: 700,
              cursor: "pointer",
              marginTop: 8,
              boxShadow: "0 4px 20px rgba(168,85,247,0.40)",
            }}
          >
            Personnalise mon coaching →
          </button>
        </div>
      )}

      {/* ── CHAT_STEP ────────────────────────────────────────────────────── */}
      {(stage === "CHAT_STEP" || stage === "COMMITMENT") && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "56px 20px 24px",
            gap: 16,
            maxWidth: 480,
            width: "100%",
            margin: "0 auto",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              paddingBottom: 12,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #a855f7, #6366f1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconSparkle size={16} color="white" strokeWidth={1.5} />
            </div>
            <div>
              <p style={{ color: "white", fontSize: 14, fontWeight: 600, margin: 0 }}>
                Ton Coach Adaptatif
              </p>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, margin: 0 }}>
                Personnalisé pour toi
              </p>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  animation: "ac-slide-up 0.4s ease both",
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    background:
                      msg.role === "user"
                        ? "rgba(168,85,247,0.25)"
                        : "rgba(255,255,255,0.07)",
                    border:
                      msg.role === "user"
                        ? "1px solid rgba(168,85,247,0.3)"
                        : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    borderBottomLeftRadius: msg.role === "coach" ? 4 : 16,
                    borderBottomRightRadius: msg.role === "user" ? 4 : 16,
                    padding: "10px 14px",
                    maxWidth: 300,
                    color: "rgba(255,255,255,0.85)",
                    fontSize: 15,
                    lineHeight: 1.55,
                  }}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {isTyping && (
              <div style={{ animation: "ac-slide-up 0.3s ease both" }}>
                <TypingIndicator />
              </div>
            )}

            {/* Commitment card */}
            {stage === "COMMITMENT" && objective && (
              <div
                style={{
                  marginTop: 8,
                  animation: "ac-slide-up 0.5s ease 0.2s both",
                }}
              >
                <CommitmentCard
                  objective={objective}
                  firstName={firstName}
                  onCommit={handleCommit}
                  committed={committed}
                />
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>
      )}

      {/* ── COMPLETED ────────────────────────────────────────────────────── */}
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
            animation: "ac-complete-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconSprout size={76} color="#a855f7" strokeWidth={1.2} style={{ filter: "drop-shadow(0 0 12px rgba(168,85,247,0.5))" }} />
          </div>
          <h2 style={{ color: "white", fontSize: 26, fontWeight: 700, margin: 0 }}>
            Engagement pris
          </h2>
          <p
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 15,
              maxWidth: 300,
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Chaque petit pas compte. Ce geste que tu t&apos;es engagé·e à faire est déjà une victoire.
          </p>
          <div
            style={{
              background: "rgba(168,85,247,0.12)",
              border: "1px solid rgba(168,85,247,0.25)",
              borderRadius: 16,
              padding: "14px 20px",
              maxWidth: 320,
            }}
          >
            <p
              style={{
                color: "rgba(255,255,255,0.75)",
                fontSize: 14,
                margin: 0,
                lineHeight: 1.6,
                fontStyle: "italic",
              }}
            >
              &ldquo;{objective}&rdquo;
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
