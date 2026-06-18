"use client";

/**
 * SOSExerciseVisual — Prototype UI isolé (sans réseau)
 * Tester via /sos-demo ou importer directement.
 *
 * Barre de test (haut de l'écran, hover pour révéler) :
 *   Repos · IA parle · Cycle 5-4-5 · Reset
 */

import { useState, useRef, useCallback, useEffect, MutableRefObject } from "react";

// ─── Timings ──────────────────────────────────────────────────────────────────
const INSPIRE_MS    = 5000;
const HOLD_MS       = 4000;
const EXPIRE_MS     = 5000;

// ─── Particules ───────────────────────────────────────────────────────────────
const MAX_PARTICLES = 32;
const ORB_R         = 108; // rayon de l'orb en px CSS

// Palette : cyan · sky · teal · violet clair · violet
const PALETTE: [number, number, number][] = [
  [6,   182, 212],
  [56,  189, 248],
  [45,  212, 191],
  [167, 139, 250],
  [139, 92,  246],
];

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number;           // rayon core
  life: number;        // 1 → 0
  decay: number;       // par frame
  rgb: [number, number, number];
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode        = "orb" | "breath";
type BreathPhase = "idle" | "inspire" | "hold" | "expire";

// ─── Hook canvas particules ───────────────────────────────────────────────────
function useParticleCanvas(
  speakingRef: MutableRefObject<boolean>,
  modeRef: MutableRefObject<Mode>,
) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const particles  = useRef<Particle[]>([]);
  const frameCount = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.offsetWidth  || window.innerWidth;
    const H   = canvas.offsetHeight || window.innerHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // Centre de l'écran = centre de l'orb
    const cx = W / 2;
    const cy = H / 2;

    const spawnParticle = () => {
      if (particles.current.length >= MAX_PARTICLES) return;
      const angle  = Math.random() * Math.PI * 2;
      const sr     = ORB_R + 2 + Math.random() * 8;          // spawn juste après le bord
      const speed  = 0.22 + Math.random() * 0.52;
      // légère dérive tangentielle pour un effet plus naturel
      const drift  = (Math.random() - 0.5) * 0.30;
      const tanX   = -Math.sin(angle);
      const tanY   =  Math.cos(angle);

      particles.current.push({
        x: cx + Math.cos(angle) * sr,
        y: cy + Math.sin(angle) * sr,
        vx: Math.cos(angle) * speed + tanX * drift,
        vy: Math.sin(angle) * speed + tanY * drift,
        r: 0.8 + Math.random() * 1.4,
        life: 1.0,
        decay: 0.0055 + Math.random() * 0.0065,
        rgb: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      });
    };

    let rafId: number;

    const draw = () => {
      rafId = requestAnimationFrame(draw);
      frameCount.current++;
      ctx.clearRect(0, 0, W, H);

      // Hors mode orb → vider les particules et ne rien dessiner
      if (modeRef.current !== "orb") {
        particles.current = [];
        return;
      }

      // Spawn : 1 particule tous les 2 frames quand l'IA parle
      if (speakingRef.current && frameCount.current % 2 === 0) {
        spawnParticle();
      }

      // Update + draw
      const alive: Particle[] = [];
      for (const p of particles.current) {
        p.x    += p.vx;
        p.y    += p.vy;
        p.life -= p.decay;
        if (p.life <= 0.01) continue;
        alive.push(p);

        const [r, g, b] = p.rgb;
        const a = p.life;

        // Halo doux (pas de shadowBlur — trop cher mobile)
        ctx.globalAlpha = a * 0.11;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();

        // Halo intermédiaire
        ctx.globalAlpha = a * 0.28;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();

        // Cœur brillant (blanc chaud au centre)
        ctx.globalAlpha = a * 0.88;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${Math.min(255, r + 60)},${Math.min(255, g + 40)},${Math.min(255, b + 20)})`;
        ctx.fill();
      }

      particles.current = alive;
      ctx.globalAlpha = 1;
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // loop unique, lit les refs à chaque frame

  return canvasRef;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function SOSExerciseVisual({
  firstName = "Marie",
  testWord  = "CALME",
}: {
  firstName?: string;
  testWord?:  string;
}) {
  const [mode,        setMode]        = useState<Mode>("orb");
  const [speaking,    setSpeaking]    = useState(false);
  const [breathPhase, setBreathPhase] = useState<BreathPhase>("idle");
  const [breathLabel, setBreathLabel] = useState("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Refs pour la boucle canvas (évite de recréer la loop à chaque state change)
  const speakingRef = useRef(false);
  const modeRef     = useRef<Mode>("orb");
  speakingRef.current = speaking;
  modeRef.current     = mode;

  const canvasRef = useParticleCanvas(speakingRef, modeRef);

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => () => clearAll(), [clearAll]);

  const push = (fn: () => void, ms: number) =>
    timers.current.push(setTimeout(fn, ms));

  // ── Actions de test ──────────────────────────────────────────────────────────
  const runCycle = useCallback(() => {
    clearAll();
    setSpeaking(false);
    setMode("breath");
    setBreathPhase("idle");
    setBreathLabel("");

    // Léger délai : laisse React peindre l'orb à scale(1) avant la transition CSS
    push(() => { setBreathPhase("inspire"); setBreathLabel("Inspire"); }, 80);
    push(() => { setBreathPhase("hold");    setBreathLabel("Retiens"); }, 80 + INSPIRE_MS);
    push(() => { setBreathPhase("expire");  setBreathLabel("Expire");  }, 80 + INSPIRE_MS + HOLD_MS);
    push(() => { setBreathPhase("idle");    setBreathLabel("");         }, 80 + INSPIRE_MS + HOLD_MS + EXPIRE_MS);
  }, [clearAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const simulateSpeak = useCallback(() => {
    clearAll();
    setMode("orb");
    setBreathPhase("idle");
    setSpeaking(true);
    push(() => setSpeaking(false), 5000);
  }, [clearAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    clearAll();
    setMode("orb");
    setSpeaking(false);
    setBreathPhase("idle");
    setBreathLabel("");
  }, [clearAll]);

  // ── Valeurs CSS de l'orb ─────────────────────────────────────────────────────
  const expanded    = breathPhase === "inspire" || breathPhase === "hold";
  const targetScale = expanded ? 1.30 : 1.0;

  // Transition uniquement pendant inspire/expire — hold : gelé (animation box-shadow seule)
  const orbTransition =
    breathPhase === "inspire"
      ? `transform ${INSPIRE_MS}ms cubic-bezier(0.4,0,0.2,1)`
      : breathPhase === "expire"
      ? `transform ${EXPIRE_MS}ms cubic-bezier(0.4,0,0.2,1)`
      : "none";

  const borderAlpha  = speaking ? "0.42" : "0.20";
  const glowSpread   = speaking ? "28px"  : "14px";
  const glowAlpha    = speaking ? "0.18"  : "0.07";

  const labelColor =
    breathPhase === "inspire" ? "rgba(6,182,212,0.82)"
    : breathPhase === "hold"  ? "rgba(139,92,246,0.64)"
    : breathPhase === "expire" ? "rgba(6,182,212,0.44)"
    : "transparent";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "radial-gradient(ellipse at 50% 44%, #0f172a 0%, #0b0f0d 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden",
    }}>

      {/* ── Barre de test (hover pour révéler) ───────────────────────────── */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          display: "flex", gap: 6, padding: "9px 14px",
          background: "rgba(0,0,0,0.65)",
          opacity: 0.12,
          transition: "opacity 0.25s",
          zIndex: 30,
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.opacity = "1")}
        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.opacity = "0.12")}
      >
        {([
          ["Repos",         reset],
          ["IA parle 5s",   simulateSpeak],
          ["Cycle 5-4-5",   runCycle],
          ["Reset",         reset],
        ] as [string, () => void][]).map(([lbl, fn]) => (
          <button key={lbl} onClick={fn} style={{
            padding: "4px 11px", borderRadius: 5, fontSize: 11,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#94a3b8", cursor: "pointer", fontFamily: "inherit",
          }}>{lbl}</button>
        ))}
        <span style={{
          marginLeft: "auto", fontSize: 10,
          color: "rgba(255,255,255,0.20)",
          alignSelf: "center", fontFamily: "monospace",
        }}>
          SOSExerciseVisual · prototype
        </span>
      </div>

      {/* ── Canvas particules — plein écran, pointer-events none ──────────── */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* ── Orbe + contenu ───────────────────────────────────────────────── */}
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 30,
        position: "relative", zIndex: 2,
      }}>

        {/* L'orbe de verre */}
        <div style={{
          width:        ORB_R * 2,
          height:       ORB_R * 2,
          borderRadius: "50%",
          position:     "relative",

          // Fond verre
          background:           "rgba(255,255,255,0.045)",
          backdropFilter:       "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",

          // Contour néon cyan
          border: `1.5px solid rgba(6,182,212,${borderAlpha})`,
          boxShadow: [
            `0 0 ${glowSpread} rgba(6,182,212,${glowAlpha})`,
            "0 0 1px rgba(6,182,212,0.06)",
            "inset 0 1px 0 rgba(255,255,255,0.07)",
          ].join(", "),

          // Transitions
          transition: [
            orbTransition,
            "border-color 0.9s ease",
            "box-shadow 0.9s ease",
          ].filter(Boolean).join(", "),
          transform: mode === "breath" ? `scale(${targetScale})` : "scale(1)",

          // Micro-pulsation pendant la rétention (box-shadow uniquement)
          animation:
            breathPhase === "hold"
              ? "sv-hold 3s ease-in-out infinite"
              : speaking
              ? "sv-speak 2.2s ease-in-out infinite"
              : "none",

          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {/* Reflet spéculaire */}
          <div style={{
            position: "absolute",
            top: "12%", left: "16%",
            width: "30%", height: "11%",
            borderRadius: 999,
            background: "rgba(255,255,255,0.055)",
            pointerEvents: "none",
          }} />

          {/* Mot d'ancrage (mode respiration) */}
          {mode === "breath" && (
            <span style={{
              color: "#f1f5f9",
              fontSize: "clamp(20px, 5.8vw, 32px)",
              fontWeight: 200,
              letterSpacing: "0.28em",
              paddingLeft: "0.28em",
              textShadow: [
                "0 0 12px rgba(6,182,212,0.52)",
                "0 0 28px rgba(6,182,212,0.22)",
              ].join(", "),
              userSelect: "none",
              animation: "sv-fade 0.5s ease",
            }}>
              {testWord}
            </span>
          )}
        </div>

        {/* Prénom sous l'orbe (mode orb) */}
        {mode === "orb" && (
          <p style={{
            color: "rgba(255,255,255,0.24)",
            fontSize: 11,
            letterSpacing: "0.20em",
            fontWeight: 300,
            textTransform: "uppercase",
            userSelect: "none",
          }}>
            {firstName}
          </p>
        )}

        {/* Label de phase respiratoire (mode breath) */}
        {mode === "breath" && (
          <p style={{
            color: labelColor,
            fontSize: 12,
            letterSpacing: "0.24em",
            fontWeight: 300,
            textTransform: "uppercase",
            transition: "color 1.2s ease",
            minHeight: 18,
            userSelect: "none",
          }}>
            {breathLabel}
          </p>
        )}
      </div>

      {/* ── Keyframes ─────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes sv-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        /* Pulsation box-shadow quand IA parle (transform intact) */
        @keyframes sv-speak {
          0%, 100% { box-shadow:
            0 0 14px rgba(6,182,212,0.08),
            0 0 1px rgba(6,182,212,0.06),
            inset 0 1px 0 rgba(255,255,255,0.07); }
          50% { box-shadow:
            0 0 32px rgba(6,182,212,0.22),
            0 0 56px rgba(139,92,246,0.08),
            inset 0 1px 0 rgba(255,255,255,0.09); }
        }
        /* Micro-pulsation rétention — plus douce */
        @keyframes sv-hold {
          0%, 100% { box-shadow:
            0 0 28px rgba(6,182,212,0.08),
            inset 0 1px 0 rgba(255,255,255,0.07); }
          50% { box-shadow:
            0 0 48px rgba(6,182,212,0.16),
            0 0 80px rgba(139,92,246,0.06),
            inset 0 1px 0 rgba(255,255,255,0.10); }
        }
      `}</style>
    </div>
  );
}
