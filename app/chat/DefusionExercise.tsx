"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { IconThoughtBubble, IconBalloon, IconStars, IconBurst, IconCheckRing } from "./SosIcons";

// ─── Types ────────────────────────────────────────────────────────────────────
type Stage =
  | "INTRO"
  | "CAPTURE"
  | "REFRAME_1"
  | "REFRAME_2"
  | "RITUAL_CHOICE"
  | "ANIMATION"
  | "COMPLETED";

type RitualChoice = "balloon" | "space" | null;
type BalloonState  = "idle" | "flying" | "exploded";

type StarData = {
  x: number; y: number;
  size: number; delay: number; duration: number;
};

type Props = {
  sosContext: string;
  firstName: string;
  onCompleted: () => void;
  onClose: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const WORD_MS = 390;
const INFLATE_STEPS = 5;

// ─── TTS helpers ──────────────────────────────────────────────────────────────
function speakNow(text: string, opts: { rate?: number; volume?: number } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang   = "fr-FR";
  utter.rate   = opts.rate   ?? 0.82;
  utter.volume = opts.volume ?? 0.75;
  const fr = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("fr"));
  if (fr) utter.voice = fr;
  window.speechSynthesis.speak(utter);
}

function unlockAudio() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0; u.lang = "fr-FR";
  window.speechSynthesis.speak(u);
}

function getIntroSpeech(firstName: string): string {
  const name = firstName ? `, ${firstName}` : "";
  return `Ta tête te raconte une histoire sombre${name}. On va regarder cette pensée d'un peu plus loin ensemble.`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DefusionExercise({
  // sosContext unused — kept in props for API consistency
  sosContext: _sosContext,
  firstName,
  onCompleted,
  onClose,
}: Props) {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [stage,        setStage]        = useState<Stage>("INTRO");
  const [thoughtText,  setThoughtText]  = useState("");
  const [highlightWord,setHighlightWord]= useState(-1);
  const [ritualChoice, setRitualChoice] = useState<RitualChoice>(null);

  // ── Balloon state ───────────────────────────────────────────────────────────
  const [balloonClicks, setBalloonClicks] = useState(0);
  const [balloonState,  setBalloonState]  = useState<BalloonState>("idle");

  // ── Space state ─────────────────────────────────────────────────────────────
  const [thoughtAway,  setThoughtAway]  = useState(false);
  const [glowVisible,  setGlowVisible]  = useState(false);
  const swipeStartY = useRef<number | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const onCompletedRef = useRef(onCompleted);
  useEffect(() => { onCompletedRef.current = onCompleted; }, [onCompleted]);

  const timerRefs   = useRef<ReturnType<typeof setTimeout>[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Stable starfield (generated once) ──────────────────────────────────────
  const stars = useMemo<StarData[]>(() =>
    Array.from({ length: 90 }, () => ({
      x:        Math.random() * 100,
      y:        Math.random() * 100,
      size:     Math.random() * 1.8  + 0.3,
      delay:    Math.random() * 4,
      duration: Math.random() * 2.5  + 1.5,
    })), []
  );

  // ── Stable balloon gradient (chosen once) ──────────────────────────────────
  const balloonGrad = useMemo(() => {
    const opts = [
      "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
      "linear-gradient(135deg, #a78bfa 0%, #6d28d9 100%)",
      "linear-gradient(135deg, #34d399 0%, #0891b2 100%)",
    ];
    return opts[Math.floor(Math.random() * opts.length)];
  }, []);

  // ── Global unmount cleanup ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      navigator.vibrate?.(0);
      timerRefs.current.forEach(clearTimeout);
    };
  }, []);

  // ── INTRO: word-by-word karaoke ─────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "INTRO") return;
    const text  = getIntroSpeech(firstName);
    const words = text.split(" ");
    const wt = words.map((_, i) =>
      setTimeout(() => setHighlightWord(i), 400 + i * WORD_MS)
    );
    const tts = setTimeout(() => speakNow(text, { rate: 0.80, volume: 0.82 }), 250);
    timerRefs.current = [...wt, tts];
    return () => {
      wt.forEach(clearTimeout); clearTimeout(tts);
      window.speechSynthesis?.cancel(); setHighlightWord(-1);
    };
  }, [stage, firstName]);

  // ── CAPTURE: auto-focus ─────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "CAPTURE") return;
    const t = setTimeout(() => textareaRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [stage]);

  // ── REFRAME_1: TTS ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "REFRAME_1") return;
    const t = setTimeout(() =>
      speakNow(`J'ai la pensée que ${thoughtText}`, { rate: 0.82, volume: 0.75 }),
    400);
    return () => { clearTimeout(t); window.speechSynthesis?.cancel(); };
  }, [stage, thoughtText]);

  // ── REFRAME_2: TTS clinique ──────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "REFRAME_2") return;
    const t = setTimeout(() =>
      speakNow(
        "Vois-tu ? Ce n'est plus une vérité absolue, c'est juste une activité de ton esprit que tu observes.",
        { rate: 0.82, volume: 0.78 }
      ),
    700);
    return () => { clearTimeout(t); window.speechSynthesis?.cancel(); };
  }, [stage]);

  // ── COMPLETED: TTS + auto-dismiss ───────────────────────────────────────────
  useEffect(() => {
    if (stage !== "COMPLETED") return;
    speakNow("Parfait. On laisse cette pensée s'éloigner. On revient au présent.", {
      rate: 0.82, volume: 0.70,
    });
    const t = setTimeout(() => onCompletedRef.current(), 3200);
    return () => { clearTimeout(t); window.speechSynthesis?.cancel(); };
  }, [stage]);

  // ── Balloon click ────────────────────────────────────────────────────────────
  const handleBalloonClick = useCallback(() => {
    if (balloonState !== "idle") return;
    const next = balloonClicks + 1;
    setBalloonClicks(next);
    navigator.vibrate?.(20);
    if (next >= INFLATE_STEPS) {
      setBalloonState("flying");
      const t1 = setTimeout(() => {
        setBalloonState("exploded");
        navigator.vibrate?.(100);
        const t2 = setTimeout(() => setStage("COMPLETED"), 800);
        timerRefs.current.push(t2);
      }, 1500);
      timerRefs.current.push(t1);
    }
  }, [balloonClicks, balloonState]);

  // ── Space: launch thought away ───────────────────────────────────────────────
  const triggerSpaceAway = useCallback(() => {
    if (thoughtAway) return;
    setThoughtAway(true);
    navigator.vibrate?.(200);
    const t1 = setTimeout(() => {
      setGlowVisible(true);
      const t2 = setTimeout(() => setStage("COMPLETED"), 700);
      timerRefs.current.push(t2);
    }, 1800);
    timerRefs.current.push(t1);
  }, [thoughtAway]);

  // ── Space: swipe-up detection ────────────────────────────────────────────────
  const onSpacePtrDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    swipeStartY.current = e.clientY;
  }, []);
  const onSpacePtrMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (swipeStartY.current === null || thoughtAway) return;
    if ((swipeStartY.current - e.clientY) > 60) {
      swipeStartY.current = null;
      triggerSpaceAway();
    }
  }, [thoughtAway, triggerSpaceAway]);
  const onSpacePtrUp = useCallback(() => { swipeStartY.current = null; }, []);

  // ── Choose ritual ────────────────────────────────────────────────────────────
  const handleChooseRitual = useCallback((choice: RitualChoice) => {
    setRitualChoice(choice);
    setBalloonClicks(0); setBalloonState("idle");
    setThoughtAway(false); setGlowVisible(false);
    setStage("ANIMATION");
  }, []);

  const handleClose = useCallback(() => {
    window.speechSynthesis?.cancel();
    navigator.vibrate?.(0);
    timerRefs.current.forEach(clearTimeout);
    onClose();
  }, [onClose]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const canCapture   = thoughtText.trim().length >= 3;
  const introWords   = getIntroSpeech(firstName).split(" ");
  const balloonSize  = 172 + balloonClicks * 22;           // 172 → 260 px
  const textStretch  = 1 + balloonClicks * 0.055;          // 1 → 1.275
  const isSpaceAnim  = stage === "ANIMATION" && ritualChoice === "space";

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: isSpaceAnim ? "#030712" : "#060a08",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: isSpaceAnim ? 0 : "24px 20px",
        overflow: "hidden",
        transition: "background 0.9s ease",
      }}
    >
      {/* ─ keyframes ─────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes df-fadein {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes df-blink {
          0%, 100% { opacity: 0.38; }
          50%       { opacity: 1; }
        }
        @keyframes df-star {
          0%, 100% { opacity: 0.15; }
          50%       { opacity: 1; }
        }
        @keyframes df-slide-prefix {
          from { opacity: 0; transform: translateX(-14px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes df-balloon-fly {
          0%   { transform: translate(0,       0)    scale(1); }
          20%  { transform: translate(20px,  -22vh)  scale(0.82); }
          50%  { transform: translate(-28px, -58vh)  scale(0.52); }
          80%  { transform: translate(14px,  -90vh)  scale(0.26); }
          100% { transform: translate(0,     -115vh) scale(0.05); }
        }
        @keyframes df-balloon-pop {
          0%   { transform: scale(0.05); opacity: 1; }
          45%  { transform: scale(2.6);  opacity: 0.85; }
          100% { transform: scale(4.2);  opacity: 0; }
        }
        @keyframes df-into-space {
          0%   { transform: scale(1)     translateY(0px);   opacity: 1; }
          18%  { transform: scale(1.04)  translateY(-7px);  opacity: 1; }
          100% { transform: scale(0.004) translateY(-65px); opacity: 0; }
        }
        @keyframes df-glow-dot {
          0%   { transform: scale(0.4); opacity: 0.9; box-shadow: 0 0 14px 5px rgba(165,180,252,0.7); }
          50%  { transform: scale(1.6); opacity: 0.5; box-shadow: 0 0 30px 12px rgba(165,180,252,0.3); }
          100% { transform: scale(3);   opacity: 0;   box-shadow: 0 0 0    0   rgba(165,180,252,0); }
        }
        @keyframes df-complete-glow {
          0%   { box-shadow: 0 0 0 0    rgba(16,185,129,0.5); }
          70%  { box-shadow: 0 0 0 20px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0    rgba(16,185,129,0); }
        }
        .df-btn {
          cursor: pointer; font-family: inherit;
          transition: opacity 0.2s, transform 0.15s;
        }
        .df-btn:hover  { opacity: 0.82; transform: translateY(-1px); }
        .df-btn:active { transform: scale(0.97); }
        .df-in { animation: df-fadein 0.44s ease; }
      `}</style>

      {/* ── Close button (hidden during space animation) ── */}
      {stage !== "COMPLETED" && !isSpaceAnim && (
        <button onClick={handleClose} style={CLOSE_BTN_STYLE}>×</button>
      )}

      {/* ══ INTRO ══════════════════════════════════════════════════════════════ */}
      {stage === "INTRO" && (
        <div style={{ ...COL_CENTER, gap: 28, maxWidth: 380, animation: "df-fadein 0.6s ease" }}>
          <IconThoughtBubble size={48} color="#10b981" strokeWidth={1.3} style={{ filter: "drop-shadow(0 0 10px rgba(16,185,129,0.35))" }} />

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 21, fontWeight: 700, color: "rgba(255,255,255,0.9)", marginBottom: 20, letterSpacing: "-0.3px" }}>
              Défusion cognitive
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.78, maxWidth: 330 }}>
              {introWords.map((word, i) => (
                <span key={i} style={{
                  marginRight: "0.28em",
                  color: i === highlightWord ? "rgba(255,255,255,0.95)"
                       : i  < highlightWord  ? "rgba(255,255,255,0.58)"
                       : "rgba(255,255,255,0.32)",
                  fontWeight:  i === highlightWord ? 600 : 400,
                  transition: "color 0.18s ease",
                }}>
                  {word}
                </span>
              ))}
            </div>
          </div>

          <button className="df-btn" onClick={() => { unlockAudio(); setStage("CAPTURE"); }} style={GREEN_CTA}>
            J&apos;y suis →
          </button>
        </div>
      )}

      {/* ══ CAPTURE ════════════════════════════════════════════════════════════ */}
      {stage === "CAPTURE" && (
        <div className="df-in" style={{ ...COL, gap: 20, maxWidth: 420, width: "100%" }}>
          <div>
            <div style={STEP_LABEL}>Étape 1 · Capture</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.88)", lineHeight: 1.45 }}>
              Écris ici la pensée qui te fait du mal en ce moment.
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 6, fontStyle: "italic" }}>
              ex : « Je n&apos;ai aucune volonté »
            </div>
          </div>

          <div style={TEXTAREA_WRAP}>
            <textarea
              ref={textareaRef}
              value={thoughtText}
              onChange={(e) => setThoughtText(e.target.value)}
              placeholder="Ma pensée est…"
              rows={4}
              style={TEXTAREA_STYLE}
            />
            <div style={{ ...CHAR_COUNT, color: canCapture ? "rgba(16,185,129,0.55)" : "rgba(255,255,255,0.18)" }}>
              {thoughtText.trim().length} car.
            </div>
          </div>

          <button
            className="df-btn"
            disabled={!canCapture}
            onClick={() => setStage("REFRAME_1")}
            style={canCapture ? PROCEED_BTN_ON : PROCEED_BTN_OFF}
          >
            Suivant →
          </button>
        </div>
      )}

      {/* ══ REFRAME_1 ══════════════════════════════════════════════════════════ */}
      {stage === "REFRAME_1" && (
        <div key="r1" className="df-in" style={{ ...COL_CENTER, gap: 26, maxWidth: 420, width: "100%" }}>
          <div style={{ ...STEP_LABEL, alignSelf: "flex-start" }}>Étape 2 · Mise à distance</div>

          {/* Reframed sentence */}
          <div style={THOUGHT_CARD}>
            <span style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.88)" }}>
              J&apos;ai la pensée que{" "}
            </span>
            <span style={{ fontSize: 17, fontWeight: 400, color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>
              {thoughtText}
            </span>
          </div>

          <div style={HINT_TEXT}>
            En ajoutant ce préfixe, tu crées de l&apos;espace entre toi et ta pensée.
          </div>

          <button className="df-btn" onClick={() => setStage("REFRAME_2")} style={GREEN_CTA}>
            Encore plus loin →
          </button>
        </div>
      )}

      {/* ══ REFRAME_2 ══════════════════════════════════════════════════════════ */}
      {stage === "REFRAME_2" && (
        <div key="r2" className="df-in" style={{ ...COL_CENTER, gap: 26, maxWidth: 420, width: "100%" }}>
          <div style={{ ...STEP_LABEL, alignSelf: "flex-start" }}>Étape 3 · Recul total</div>

          {/* Layered reframe — new prefix slides in, pushing the rest right */}
          <div style={{ ...THOUGHT_CARD, lineHeight: 1.78, overflow: "hidden" }}>
            <span style={{
              fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.90)",
              animation: "df-slide-prefix 0.55s cubic-bezier(0.22,1,0.36,1) both",
              display: "inline",
            }}>
              Je remarque que{" "}
            </span>
            <span style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.50)" }}>
              j&apos;ai la pensée que{" "}
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 400, color: "rgba(255,255,255,0.26)", fontStyle: "italic" }}>
              {thoughtText}
            </span>
          </div>

          {/* Jumeau insight callout */}
          <div style={{
            background: "rgba(16,185,129,0.06)",
            border: "1px solid rgba(16,185,129,0.18)",
            borderRadius: 12, padding: "14px 18px",
            fontSize: 13.5, color: "rgba(255,255,255,0.58)", lineHeight: 1.65, textAlign: "center",
          }}>
            Vois-tu ? Ce n&apos;est plus une vérité absolue, c&apos;est juste une activité de ton esprit que tu observes.
          </div>

          <button className="df-btn" onClick={() => setStage("RITUAL_CHOICE")} style={GREEN_CTA}>
            Choisir un rituel →
          </button>
        </div>
      )}

      {/* ══ RITUAL_CHOICE ══════════════════════════════════════════════════════ */}
      {stage === "RITUAL_CHOICE" && (
        <div className="df-in" style={{ ...COL_CENTER, gap: 20, maxWidth: 420, width: "100%" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "rgba(255,255,255,0.28)", marginBottom: 8 }}>
              Rituel de détachement
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
              Comment laisser partir cette pensée ?
            </div>
          </div>

          {/* Balloon option */}
          <button className="df-btn" onClick={() => handleChooseRitual("balloon")}
            style={{ ...RITUAL_CARD, background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)" }}>
            <IconBalloon size={36} color="#fdba74" strokeWidth={1.4} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fdba74", marginBottom: 4 }}>
                Le Ballon de baudruche
              </div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.44)", lineHeight: 1.5 }}>
                Gonfle le ballon jusqu&apos;à ce qu&apos;il s&apos;envole et explose.
              </div>
            </div>
          </button>

          {/* Space option */}
          <button className="df-btn" onClick={() => handleChooseRitual("space")}
            style={{ ...RITUAL_CARD, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}>
            <IconStars size={36} color="#a5b4fc" strokeWidth={1.4} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#a5b4fc", marginBottom: 4 }}>
                L&apos;Espace infini
              </div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.44)", lineHeight: 1.5 }}>
                Envoie la pensée se perdre dans le cosmos.
              </div>
            </div>
          </button>
        </div>
      )}

      {/* ══ ANIMATION ══════════════════════════════════════════════════════════ */}
      {stage === "ANIMATION" && (
        <>
          {/* ── 🎈 BALLOON ── */}
          {ritualChoice === "balloon" && (
            <div className="df-in" style={{ ...COL_CENTER, gap: 16, width: "100%" }}>
              {/* Instruction */}
              <div style={{ minHeight: 22, textAlign: "center" }}>
                <span style={{
                  fontSize: 13, color: "rgba(255,255,255,0.45)",
                  animation: balloonState === "idle" ? "df-blink 1.8s ease-in-out infinite" : "none",
                }}>
                  {balloonState === "idle"
                    ? balloonClicks === 0
                      ? "Clique pour gonfler le ballon"
                      : `${INFLATE_STEPS - balloonClicks} clic${INFLATE_STEPS - balloonClicks > 1 ? "s" : ""} restant${INFLATE_STEPS - balloonClicks > 1 ? "s" : ""}…`
                    : balloonState === "flying"
                    ? "S'envole !"
                    : "Disparu !"}
                </span>
              </div>

              {/* Balloon arena */}
              <div style={{ height: 320, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>

                {/* Explosion flash */}
                {balloonState === "exploded" && (
                  <div style={{
                    position: "absolute", width: 180, height: 180, borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(255,200,50,0.95) 0%, rgba(249,115,22,0.5) 45%, transparent 72%)",
                    animation: "df-balloon-pop 0.85s ease-out forwards",
                    pointerEvents: "none",
                  }} />
                )}

                {/* Balloon */}
                {balloonState !== "exploded" && (
                  <div
                    onClick={handleBalloonClick}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      cursor: balloonState === "idle" ? "pointer" : "default",
                      animation: balloonState === "flying"
                        ? "df-balloon-fly 1.5s cubic-bezier(0.4,0,0.7,1) forwards"
                        : "none",
                    }}
                  >
                    {/* Balloon body */}
                    <div style={{
                      width:  balloonSize,
                      height: Math.round(balloonSize * 1.15),
                      borderRadius: "50% 50% 46% 46% / 55% 55% 45% 45%",
                      background: balloonGrad,
                      boxShadow: "inset -10px -10px 24px rgba(0,0,0,0.22), inset 6px 6px 14px rgba(255,255,255,0.32), 0 8px 32px rgba(0,0,0,0.4)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      padding: 16, position: "relative", overflow: "hidden",
                      transition: "all 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                    }}>
                      {/* Shine highlight */}
                      <div style={{
                        position: "absolute", top: "12%", left: "18%",
                        width: "28%", height: "20%", borderRadius: "50%",
                        background: "rgba(255,255,255,0.35)", filter: "blur(4px)",
                        pointerEvents: "none",
                      }} />
                      {/* Thought text inside balloon */}
                      <div style={{
                        fontSize: Math.max(10, 14 - balloonClicks * 0.5),
                        color: "rgba(255,255,255,0.92)",
                        fontWeight: 600, textAlign: "center",
                        textShadow: "0 1px 4px rgba(0,0,0,0.45)",
                        transform: `scaleX(${textStretch})`,
                        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                        lineHeight: 1.3, maxWidth: "86%", wordBreak: "break-word",
                        position: "relative", zIndex: 1,
                      }}>
                        {thoughtText}
                      </div>
                    </div>
                    {/* String */}
                    <div style={{ width: 2, height: 28, background: "rgba(255,255,255,0.38)", marginTop: -2, borderRadius: 1 }} />
                  </div>
                )}
              </div>

              {/* Progress dots */}
              {balloonState === "idle" && (
                <div style={{ display: "flex", gap: 9 }}>
                  {Array.from({ length: INFLATE_STEPS }, (_, i) => (
                    <div key={i} style={{
                      width: 9, height: 9, borderRadius: "50%",
                      background: i < balloonClicks ? "#f97316" : "rgba(255,255,255,0.14)",
                      transition: "background 0.25s, transform 0.25s",
                      transform: i === balloonClicks - 1 ? "scale(1.3)" : "scale(1)",
                    }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 🌌 SPACE ── */}
          {ritualChoice === "space" && (
            <div
              onPointerDown={onSpacePtrDown}
              onPointerMove={onSpacePtrMove}
              onPointerUp={onSpacePtrUp}
              onPointerCancel={onSpacePtrUp}
              style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                overflow: "hidden", touchAction: "none",
                cursor: thoughtAway ? "default" : "grab",
              }}
            >
              {/* Stars */}
              {stars.map((s, i) => (
                <div key={i} aria-hidden style={{
                  position: "absolute",
                  left: `${s.x}%`, top: `${s.y}%`,
                  width: s.size, height: s.size,
                  borderRadius: "50%", background: "white",
                  animation: `df-star ${s.duration}s ${s.delay}s ease-in-out infinite`,
                  pointerEvents: "none",
                }} />
              ))}

              {/* Close button inside space overlay */}
              {!thoughtAway && (
                <button onClick={handleClose} style={{ ...CLOSE_BTN_STYLE, zIndex: 10 }}>×</button>
              )}

              {/* Content */}
              <div style={{ ...COL_CENTER, gap: 28, zIndex: 2 }}>

                {/* Thought bubble — zooms away when triggered */}
                {!glowVisible && (
                  <div style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 16, padding: "18px 24px",
                    maxWidth: 300, textAlign: "center",
                    fontSize: 16, fontStyle: "italic",
                    color: "rgba(255,255,255,0.72)",
                    animation: thoughtAway
                      ? "df-into-space 1.8s cubic-bezier(0.5,0,1,0.4) forwards"
                      : "none",
                    willChange: "transform, opacity",
                  }}>
                    {thoughtText}
                  </div>
                )}

                {/* Glow dot that lingers after thought disappears */}
                {glowVisible && (
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", background: "#a5b4fc",
                    animation: "df-glow-dot 0.85s ease-out forwards",
                  }} />
                )}

                {/* Swipe instruction + fallback button */}
                {!thoughtAway && (
                  <div style={{ ...COL_CENTER, gap: 12 }}>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.38)", animation: "df-blink 2.2s ease-in-out infinite" }}>
                      ↑ Glisse vers le haut pour l&apos;envoyer dans l&apos;espace
                    </div>
                    <button className="df-btn" onClick={triggerSpaceAway} style={{
                      background: "rgba(99,102,241,0.10)", border: "1px solid rgba(99,102,241,0.28)",
                      borderRadius: 14, padding: "10px 22px",
                      color: "#a5b4fc", fontSize: 13, fontWeight: 600,
                    }}>
                      Envoyer →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ COMPLETED ══════════════════════════════════════════════════════════ */}
      {stage === "COMPLETED" && (
        <div style={{ ...COL_CENTER, gap: 24, animation: "df-fadein 0.7s ease" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "df-complete-glow 1.6s ease infinite",
          }}>
            <IconCheckRing size={76} color="#10b981" strokeWidth={1.2} style={{ filter: "drop-shadow(0 0 12px rgba(16,185,129,0.5))" }} />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.3px", marginBottom: 8 }}>
              Tu es l&apos;observateur,
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#10b981", marginBottom: 14 }}>
              pas la pensée.
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.44)", lineHeight: 1.65 }}>
              On laisse cette pensée s&apos;éloigner. On revient au présent.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared style objects ─────────────────────────────────────────────────────
const COL: React.CSSProperties = {
  display: "flex", flexDirection: "column",
};
const COL_CENTER: React.CSSProperties = {
  display: "flex", flexDirection: "column", alignItems: "center",
};
const CLOSE_BTN_STYLE: React.CSSProperties = {
  position: "absolute", top: 20, right: 20,
  width: 36, height: 36, borderRadius: 10,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)",
  color: "rgba(255,255,255,0.4)", fontSize: 18, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const STEP_LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "1.6px", color: "rgba(255,255,255,0.28)", marginBottom: 10,
};
const TEXTAREA_WRAP: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 14, padding: "16px 16px 36px", position: "relative",
};
const TEXTAREA_STYLE: React.CSSProperties = {
  width: "100%", background: "transparent", border: "none", outline: "none",
  color: "rgba(255,255,255,0.85)", fontSize: 15, lineHeight: 1.7,
  resize: "none", fontFamily: "inherit", caretColor: "#10b981", display: "block",
};
const CHAR_COUNT: React.CSSProperties = {
  position: "absolute", bottom: 10, right: 14, fontSize: 11, transition: "color 0.3s",
};
const GREEN_CTA: React.CSSProperties = {
  background: "rgba(16,185,129,0.11)", border: "1px solid rgba(16,185,129,0.32)",
  borderRadius: 16, padding: "14px 36px", color: "#10b981",
  fontSize: 15, fontWeight: 600, letterSpacing: "0.2px",
};
const PROCEED_BTN_ON: React.CSSProperties = {
  background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)",
  borderRadius: 14, padding: "14px 28px", color: "#10b981",
  fontSize: 15, fontWeight: 600, cursor: "pointer", transition: "all 0.25s",
};
const PROCEED_BTN_OFF: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14, padding: "14px 28px", color: "rgba(255,255,255,0.22)",
  fontSize: 15, fontWeight: 600, cursor: "default", transition: "all 0.25s",
};
const THOUGHT_CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16, padding: "24px 22px", width: "100%",
};
const HINT_TEXT: React.CSSProperties = {
  fontSize: 13.5, color: "rgba(255,255,255,0.42)", lineHeight: 1.65,
  textAlign: "center", maxWidth: 320,
};
const RITUAL_CARD: React.CSSProperties = {
  width: "100%", borderRadius: 16, padding: "20px 18px",
  textAlign: "left", display: "flex", alignItems: "center", gap: 16,
};
