"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { IconBodyScan, IconHeadZone, IconChestZone, IconBellyZone } from "./SosIcons";

// ─── Design tokens ────────────────────────────────────────────────────────────
const ACCENT = "#10b981";
const ACCENT_DIM = "rgba(16,185,129,0.10)";
const ACCENT_BORDER = "rgba(16,185,129,0.28)";
const TEXT_PRIMARY = "rgba(255,255,255,0.88)";
const TEXT_SECONDARY = "rgba(255,255,255,0.45)";
const TEXT_MUTED = "rgba(255,255,255,0.22)";

// ─── Types ────────────────────────────────────────────────────────────────────
export type BodyScanStage =
  | "INTRO"
  | "SCAN_HEAD"
  | "SCAN_CHEST"
  | "SCAN_STOMACH"
  | "VERDICT_LOADING"
  | "VERDICT_DISPLAY"
  | "COMPLETED";

type ZoneState = "pending" | "active" | "done";
type BodyZone = "head" | "chest" | "stomach";

export interface BodyScanExerciseProps {
  sosContext: string;
  firstName: string;
  onCompleted: () => void;
  onClose: () => void;
}

// ─── Zone metadata ────────────────────────────────────────────────────────────
const ZONE_META: Record<BodyZone, { label: string; sub: string; speech: string }> = {
  head: {
    label: "Charge mentale",
    sub: "Anxiété · Pensées · Agitation",
    speech:
      "Concentre-toi sur ta tête. Ressens le niveau d'anxiété, les pensées qui s'emballent. Appuie sur la zone et note de 1 à 10.",
  },
  chest: {
    label: "Poids émotionnel",
    sub: "Oppression · Émotion · Tension",
    speech:
      "Descends vers ta poitrine. Ressens la pression, le poids émotionnel ou la tension intérieure. Note de 1 à 10.",
  },
  stomach: {
    label: "Faim physique",
    sub: "Gargouillements · Tiraillements · Faim",
    speech:
      "Sens maintenant ton estomac. Y a-t-il des gargouillements, des tiraillements, une vraie faim physique ? Note de 1 à 10.",
  },
};

const STAGE_TO_ZONE: Partial<Record<BodyScanStage, BodyZone>> = {
  SCAN_HEAD: "head",
  SCAN_CHEST: "chest",
  SCAN_STOMACH: "stomach",
};

const ZONE_ORDER: BodyZone[] = ["head", "chest", "stomach"];
const STAGE_ORDER: BodyScanStage[] = [
  "SCAN_HEAD",
  "SCAN_CHEST",
  "SCAN_STOMACH",
];

// ─── Contextual intro texts ────────────────────────────────────────────────────
function getIntroText(ctx: string, name: string): string {
  const c = ctx.toLowerCase();
  if (c.includes("stress") || c.includes("anxiété") || c.includes("angoiss"))
    return `${name}, il est souvent difficile de distinguer la faim émotionnelle de la vraie faim quand le stress monte. Ce scanner corporel va t'aider à écouter ton corps avec clarté.`;
  if (c.includes("fringale") || c.includes("faim") || c.includes("envie"))
    return `${name}, cette envie mérite d'être écoutée sans jugement. On va scanner ensemble tes sensations pour comprendre d'où elle vient vraiment — tête, cœur ou estomac.`;
  if (c.includes("culpabilité") || c.includes("coupable") || c.includes("craqué"))
    return `${name}, avant de te juger, écoute ton corps. Ce scanner t'aidera à comprendre ce qui s'est passé biologiquement et émotionnellement — sans jugement.`;
  return `${name}, ton corps te parle. Ce scanner de 30 secondes va t'aider à distinguer la faim physique des besoins émotionnels pour que tu puisses répondre justement.`;
}

// ─── Speech helpers ───────────────────────────────────────────────────────────
function frVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "fr-FR") ??
    voices.find((v) => v.lang.startsWith("fr")) ??
    null
  );
}

function speakNow(
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
  const v = frVoice();
  if (v) u.voice = v;
  if (opts?.onEnd) u.onend = opts.onEnd;
  window.speechSynthesis.speak(u);
}

// ─── Client-side fallback verdict ─────────────────────────────────────────────
function localFallback(head: number, chest: number, stomach: number): string {
  if (stomach >= 6 && head <= 4 && chest <= 4)
    return "Ton estomac envoie des signaux clairs de vraie faim. C'est le bon moment de manger quelque chose de nourrissant.";
  if ((head >= 6 || chest >= 6) && stomach < 5)
    return "Ta fringale semble surtout émotionnelle en ce moment. Prends trois respirations et explore ce dont tu as vraiment besoin.";
  return "Signal mixte. Bois un grand verre d'eau et observe comment tu te sens dans cinq minutes.";
}

// ─── TactileSlider — pointer-events unifiés (mouse + touch) ──────────────────
interface TactileSliderProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}

function TactileSlider({ value, onChange, min = 1, max = 10 }: TactileSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const valueFromPointer = (clientX: number): number => {
    if (!trackRef.current) return value;
    const { left, width } = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - left) / width));
    return Math.round(ratio * (max - min) + min);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const v = valueFromPointer(e.clientX);
    if (v !== value) { onChange(v); if (typeof navigator !== "undefined") navigator.vibrate?.(10); }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const v = valueFromPointer(e.clientX);
    if (v !== value) { onChange(v); if (typeof navigator !== "undefined") navigator.vibrate?.(8); }
  };

  const handlePointerUp = () => { dragging.current = false; };

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ width: "100%", userSelect: "none" }}>
      {/* Scale labels */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: TEXT_MUTED }}>1 — Absent</span>
        <span style={{ fontSize: 11, color: TEXT_MUTED }}>10 — Intense</span>
      </div>

      {/* Track container */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: "relative",
          height: 52,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          touchAction: "none",
        }}
      >
        {/* Track background */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: 6,
            background: "rgba(255,255,255,0.07)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          {/* Filled portion */}
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: ACCENT,
              borderRadius: 3,
              transition: "width 0.06s linear",
            }}
          />
        </div>

        {/* Tick marks */}
        {Array.from({ length: max - min + 1 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${(i / (max - min)) * 100}%`,
              top: "calc(50% + 16px)",
              transform: "translateX(-50%)",
              width: 1,
              height: i % 5 === 0 ? 7 : 4,
              background: "rgba(255,255,255,0.14)",
            }}
          />
        ))}

        {/* Thumb */}
        <div
          style={{
            position: "absolute",
            left: `calc(${pct}% - 24px)`,
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: ACCENT,
            boxShadow: `0 0 16px ${ACCENT}66`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 17,
            fontWeight: 800,
            color: "#000",
            transition: "left 0.06s linear",
            pointerEvents: "none",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

// ─── Body SVG silhouette ──────────────────────────────────────────────────────
interface BodySVGProps {
  headState: ZoneState;
  chestState: ZoneState;
  stomachState: ZoneState;
  headScore: number;
  chestScore: number;
  stomachScore: number;
  onZoneClick: (zone: BodyZone) => void;
}

function BodySVG({
  headState, chestState, stomachState,
  headScore, chestScore, stomachScore,
  onZoneClick,
}: BodySVGProps) {
  const fillFor = (s: ZoneState) =>
    s === "active" ? "rgba(16,185,129,0.16)"
    : s === "done"  ? "rgba(16,185,129,0.07)"
    : "rgba(255,255,255,0.02)";

  const strokeFor = (s: ZoneState) =>
    s === "active" ? ACCENT
    : s === "done"  ? "rgba(16,185,129,0.42)"
    : "rgba(255,255,255,0.12)";

  const glow = (s: ZoneState) =>
    s === "active" ? `drop-shadow(0 0 6px ${ACCENT}88)` : "none";

  const zoneStyle = (s: ZoneState): React.CSSProperties => ({
    cursor: s === "active" ? "pointer" : "default",
    filter: glow(s),
    transition: "filter 0.4s ease",
    animation: s === "active" ? "body-zone-pulse 1.9s ease-in-out infinite" : "none",
  });

  const scoreLabel = (score: number, state: ZoneState) =>
    state === "done" ? (
      <text
        textAnchor="middle"
        fontSize="8.5"
        fontWeight={700}
        fill={ACCENT}
        style={{ pointerEvents: "none" }}
      >
        {score}/10
      </text>
    ) : null;

  return (
    <svg
      viewBox="0 0 100 175"
      width={130}
      height={190}
      style={{ overflow: "visible", flexShrink: 0 }}
    >
      {/* ── HEAD ── */}
      <g onClick={() => onZoneClick("head")} style={zoneStyle(headState)}>
        <ellipse
          cx={50} cy={20} rx={14} ry={16}
          fill={fillFor(headState)}
          stroke={strokeFor(headState)}
          strokeWidth={1.6}
        />
        {headState === "done"
          ? <text x={50} y={24} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={ACCENT} style={{ pointerEvents: "none" }}>{headScore}/10</text>
          : null}
      </g>

      {/* Neck */}
      <path
        d="M 44 36 L 44 44 M 56 36 L 56 44"
        stroke="rgba(255,255,255,0.10)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      {/* ── CHEST ── */}
      <g onClick={() => onZoneClick("chest")} style={zoneStyle(chestState)}>
        <path
          d="M 26 44 Q 18 50 16 62 L 14 104 L 86 104 L 84 62 Q 82 50 74 44 Q 64 38 56 44 L 44 44 Q 36 38 26 44 Z"
          fill={fillFor(chestState)}
          stroke={strokeFor(chestState)}
          strokeWidth={1.6}
        />
        {chestState === "done"
          ? <text x={50} y={76} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={ACCENT} style={{ pointerEvents: "none" }}>{chestScore}/10</text>
          : null}
      </g>

      {/* ── STOMACH ── */}
      <g onClick={() => onZoneClick("stomach")} style={zoneStyle(stomachState)}>
        <path
          d="M 14 104 L 20 162 Q 36 168 50 168 Q 64 168 80 162 L 86 104 Z"
          fill={fillFor(stomachState)}
          stroke={strokeFor(stomachState)}
          strokeWidth={1.6}
        />
        {stomachState === "done"
          ? <text x={50} y={140} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={ACCENT} style={{ pointerEvents: "none" }}>{stomachScore}/10</text>
          : null}
      </g>

      {/* Arms */}
      <path
        d="M 16 62 L 6 106 M 84 62 L 94 106"
        stroke="rgba(255,255,255,0.09)"
        strokeWidth={1.5}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BodyScanExercise({
  sosContext,
  firstName,
  onCompleted,
  onClose,
}: BodyScanExerciseProps) {
  const [stage, setStage] = useState<BodyScanStage>("INTRO");

  // INTRO karaoke
  const introText = getIntroText(sosContext, firstName);
  const introWords = introText.split(" ");
  const [wordIdx, setWordIdx] = useState(-1);
  const [introReady, setIntroReady] = useState(false);

  // Zone scores
  const [headScore, setHeadScore]       = useState(5);
  const [chestScore, setChestScore]     = useState(5);
  const [stomachScore, setStomachScore] = useState(5);

  // Slider visibility (opens when user taps active zone)
  const [sliderOpen, setSliderOpen] = useState(false);

  // Verdict
  const [verdictText, setVerdictText] = useState("");

  // Refs
  const wordTimersRef  = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onCompletedRef = useRef(onCompleted);
  useEffect(() => { onCompletedRef.current = onCompleted; }, [onCompleted]);

  // ─── Full cleanup ──────────────────────────────────────────────────────────
  const cleanupAll = useCallback(() => {
    wordTimersRef.current.forEach(clearTimeout);
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => () => cleanupAll(), [cleanupAll]);

  // ─── Reset slider on stage change ─────────────────────────────────────────
  useEffect(() => { setSliderOpen(false); }, [stage]);

  // ─── INTRO: karaoke + TTS ─────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== "INTRO") return;
    const boot = setTimeout(() => {
      wordTimersRef.current = introWords.map((_, i) =>
        setTimeout(() => setWordIdx(i), i * 420)
      );
      const done = setTimeout(() => {
        setWordIdx(-1);
        setIntroReady(true);
      }, introWords.length * 420 + 400);
      wordTimersRef.current.push(done);
      speakNow(introText, { rate: 0.82, volume: 0.8 });
    }, 350);
    return () => {
      clearTimeout(boot);
      wordTimersRef.current.forEach(clearTimeout);
      wordTimersRef.current = [];
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // ─── Stage transition + speech ────────────────────────────────────────────
  const goTo = useCallback((next: BodyScanStage) => {
    setStage(next);
    const zone = STAGE_TO_ZONE[next];
    if (zone) {
      setTimeout(
        () => speakNow(ZONE_META[zone].speech, { rate: 0.82, volume: 0.75 }),
        300
      );
    }
  }, []);

  // ─── Zone state helper ────────────────────────────────────────────────────
  const zoneStateFor = useCallback((zone: BodyZone): ZoneState => {
    if (["VERDICT_LOADING", "VERDICT_DISPLAY", "COMPLETED"].includes(stage))
      return "done";
    if (stage === "INTRO") return "pending";

    const currentZone = STAGE_TO_ZONE[stage];
    if (!currentZone) return "pending";

    const ci = ZONE_ORDER.indexOf(currentZone);
    const zi = ZONE_ORDER.indexOf(zone);
    if (zi < ci) return "done";
    if (zi === ci) return "active";
    return "pending";
  }, [stage]);

  // ─── Zone click → open slider ─────────────────────────────────────────────
  const handleZoneClick = useCallback((zone: BodyZone) => {
    const expectedStage = `SCAN_${zone.toUpperCase()}` as BodyScanStage;
    if (stage !== expectedStage || sliderOpen) return;
    if (typeof navigator !== "undefined") navigator.vibrate?.(40);
    setSliderOpen(true);
  }, [stage, sliderOpen]);

  // ─── Fetch verdict from backend ───────────────────────────────────────────
  const fetchVerdict = useCallback(
    async (head: number, chest: number, stomach: number) => {
      try {
        const res = await fetch("/api/body-scan-verdict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ headScore: head, chestScore: chest, stomachScore: stomach }),
        });
        const data = (await res.json()) as { verdict?: string };
        const v = data.verdict?.trim() || localFallback(head, chest, stomach);
        setVerdictText(v);
        setStage("VERDICT_DISPLAY");
        setTimeout(() => speakNow(v, { rate: 0.82, volume: 0.8 }), 600);
      } catch {
        const v = localFallback(head, chest, stomach);
        setVerdictText(v);
        setStage("VERDICT_DISPLAY");
        setTimeout(() => speakNow(v, { rate: 0.82, volume: 0.8 }), 600);
      }
    },
    []
  );

  // ─── Validate current zone score ──────────────────────────────────────────
  const handleValidate = useCallback(() => {
    if (stage === "SCAN_HEAD")    { goTo("SCAN_CHEST");   return; }
    if (stage === "SCAN_CHEST")   { goTo("SCAN_STOMACH"); return; }
    if (stage === "SCAN_STOMACH") {
      setStage("VERDICT_LOADING");
      void fetchVerdict(headScore, chestScore, stomachScore);
    }
  }, [stage, headScore, chestScore, stomachScore, goTo, fetchVerdict]);

  // ─── Active zone helpers ──────────────────────────────────────────────────
  const activeZone   = STAGE_TO_ZONE[stage] ?? null;
  const currentScore = activeZone === "head" ? headScore : activeZone === "chest" ? chestScore : stomachScore;
  const setCurrentScore = useCallback((v: number) => {
    if (activeZone === "head")    setHeadScore(v);
    else if (activeZone === "chest")   setChestScore(v);
    else if (activeZone === "stomach") setStomachScore(v);
  }, [activeZone]);

  // ─── Progress dots (1–3 for the 3 scan zones) ─────────────────────────────
  const stageIdx = STAGE_ORDER.indexOf(stage as BodyScanStage); // -1 for non-scan stages

  // ─── Derived states ───────────────────────────────────────────────────────
  const isScanStage = stage === "SCAN_HEAD" || stage === "SCAN_CHEST" || stage === "SCAN_STOMACH";

  // ─── Render ───────────────────────────────────────────────────────────────
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
        padding: "24px 20px",
        overflowY: "auto",
      }}
    >
      {/* ── Close ─────────────────────────────────────────────────────────── */}
      <button
        onClick={() => { cleanupAll(); onClose(); }}
        aria-label="Fermer"
        style={{
          position: "absolute", top: 20, right: 20,
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: TEXT_MUTED, fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >×</button>

      {/* ── Progress dots (visible during scan stages) ────────────────────── */}
      {isScanStage && (
        <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8 }}>
          {[0, 1, 2].map((n) => (
            <div key={n} style={{
              width: 6, height: 6, borderRadius: "50%",
              background:
                n < stageIdx  ? ACCENT
                : n === stageIdx ? "rgba(16,185,129,0.55)"
                : "rgba(255,255,255,0.12)",
              transition: "background 0.35s ease",
            }} />
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          INTRO
      ══════════════════════════════════════════════════════════════════════ */}
      {stage === "INTRO" && (
        <div style={{ maxWidth: 380, textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 28px", boxShadow: `0 0 18px rgba(16,185,129,0.18)`,
          }}>
            <IconBodyScan size={26} color={ACCENT} strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: 17, lineHeight: 1.78, color: TEXT_PRIMARY, margin: "0 0 36px", fontWeight: 400 }}>
            {introWords.map((w, i) => (
              <span key={i} style={{
                color: i === wordIdx ? ACCENT : TEXT_PRIMARY,
                textShadow: i === wordIdx ? `0 0 12px ${ACCENT}88` : "none",
                transition: "color 0.15s, text-shadow 0.15s",
              }}>{w} </span>
            ))}
          </p>
          {introReady && (
            <button
              onClick={() => goTo("SCAN_HEAD")}
              style={{
                padding: "14px 36px", borderRadius: 14,
                background: ACCENT, border: "none",
                color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer",
                animation: "fadeUp 0.4s ease",
              }}
            >
              Scanner mon corps →
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SCAN STAGES (HEAD / CHEST / STOMACH)
      ══════════════════════════════════════════════════════════════════════ */}
      {isScanStage && activeZone && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
          width: "100%",
          maxWidth: 380,
          position: "relative",
          zIndex: 1,
        }}>
          {/* Zone title */}
          <p style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 16, letterSpacing: 0.5, textTransform: "uppercase" }}>
            {sliderOpen ? ZONE_META[activeZone].label : "Appuie sur la zone qui clignote"}
          </p>

          {/* Body SVG */}
          <BodySVG
            headState={zoneStateFor("head")}
            chestState={zoneStateFor("chest")}
            stomachState={zoneStateFor("stomach")}
            headScore={headScore}
            chestScore={chestScore}
            stomachScore={stomachScore}
            onZoneClick={handleZoneClick}
          />

          {/* Hint arrow pointing to active zone when slider not open */}
          {!sliderOpen && (
            <p style={{ marginTop: 14, fontSize: 13, color: ACCENT, fontWeight: 500, animation: "pulse-hint 1.6s ease-in-out infinite" }}>
              ↑ Appuie sur la zone en surbrillance
            </p>
          )}

          {/* ── Slider card ──────────────────────────────────────────────── */}
          {sliderOpen && (
            <div style={{
              marginTop: 20,
              width: "100%",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 18,
              padding: "18px 16px 14px",
              animation: "slideUp 0.3s ease",
            }}>
              <p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 14, textAlign: "center", letterSpacing: 0.3 }}>
                {ZONE_META[activeZone].sub}
              </p>

              <TactileSlider
                value={currentScore}
                onChange={setCurrentScore}
              />

              <button
                onClick={handleValidate}
                style={{
                  marginTop: 20,
                  width: "100%", height: 46,
                  borderRadius: 12,
                  background: ACCENT, border: "none",
                  color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
              >
                {stage === "SCAN_STOMACH" ? "Analyser →" : "Suivant →"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VERDICT_LOADING
      ══════════════════════════════════════════════════════════════════════ */}
      {stage === "VERDICT_LOADING" && (
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          {/* Body SVG — all zones done */}
          <div style={{ opacity: 0.55, marginBottom: 28 }}>
            <BodySVG
              headState="done" chestState="done" stomachState="done"
              headScore={headScore} chestScore={chestScore} stomachScore={stomachScore}
              onZoneClick={() => {}}
            />
          </div>
          {/* Spinner */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, border: `2.5px solid rgba(16,185,129,0.2)`, borderTopColor: ACCENT, borderRadius: "50%", animation: "spin-verdict 0.9s linear infinite" }} />
            <p style={{ fontSize: 14, color: TEXT_SECONDARY }}>Analyse de tes sensations…</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VERDICT_DISPLAY
      ══════════════════════════════════════════════════════════════════════ */}
      {stage === "VERDICT_DISPLAY" && (
        <div style={{ textAlign: "center", position: "relative", zIndex: 1, maxWidth: 380, animation: "fadeUp 0.5s ease" }}>
          {/* Score summary */}
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginBottom: 28 }}>
            {(["head", "chest", "stomach"] as BodyZone[]).map((z) => {
              const score = z === "head" ? headScore : z === "chest" ? chestScore : stomachScore;
              const ZoneIcon = z === "head" ? IconHeadZone : z === "chest" ? IconChestZone : IconBellyZone;
              return (
                <div key={z} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "10px 14px", borderRadius: 12,
                  background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`,
                }}>
                  <ZoneIcon size={20} color={ACCENT} strokeWidth={1.5} />
                  <span style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>{score}</span>
                  <span style={{ fontSize: 10, color: TEXT_MUTED }}>/ 10</span>
                </div>
              );
            })}
          </div>

          {/* Verdict text */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: "18px 20px",
            marginBottom: 24,
          }}>
            <p style={{ margin: 0, fontSize: 16, color: TEXT_PRIMARY, lineHeight: 1.75, fontWeight: 400 }}>
              {verdictText}
            </p>
          </div>

          <button
            onClick={() => onCompletedRef.current()}
            style={{
              width: "100%", height: 48, borderRadius: 12,
              background: ACCENT, border: "none",
              color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer",
            }}
          >
            Terminer →
          </button>
        </div>
      )}

      {/* ── Keyframes ──────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes body-zone-pulse {
          0%, 100% { opacity: 0.75; }
          50%       { opacity: 1;    }
        }
        @keyframes pulse-hint {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1;   }
        }
        @keyframes spin-verdict {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
