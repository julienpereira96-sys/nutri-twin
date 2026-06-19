"use client";

/**
 * SOSExerciseVisual — Poussière de Magnétium v2
 * Accès : /sos-demo
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { buildWordSVG } from "./letterPaths";

// ─── Timings ──────────────────────────────────────────────────────────────────
const INSPIRE_MS   = 4000;
const EXPIRE_MS    = 6000;

// ─── Paramètres ───────────────────────────────────────────────────────────────
const ORB_R       = 108;
const N_PTS       = 100;   // points le long du path
const N_PARTICLES = 300;

// ─── Physique ─────────────────────────────────────────────────────────────────
const G               = 90;    // attraction inspire
const INSPIRE_FRIC    = 0.91;
const SPRING_K        = 0.006; // ressort expire (dispersif)
const SPRING_FRIC     = 0.92;

// ─── Couleurs ─────────────────────────────────────────────────────────────────
const LET_COLORS = ["#06b6d4", "#818cf8", "#f472b6", "#fbbf24", "#34d399"];

// Les paths SVG sont maintenant issus de letterPaths.ts (buildWordSVG)

// ─── Classe Particle ──────────────────────────────────────────────────────────
type PState = "free" | "attracting" | "settling" | "fading";

class Particle {
  x: number; y: number;
  vx: number; vy: number;
  baseAlpha: number;
  alpha: number;
  color: string;
  size: number;
  letterIdx: number;   // 0-4 : lettre assignée
  targetX: number;
  targetY: number;
  revealTime: number;  // ms après début expire avant activation du ressort
  state: PState;

  constructor(w: number, h: number, idx: number, nLet: number, nPerLetter: number) {
    this.x         = Math.random() * w;
    this.y         = Math.random() * h;
    this.vx        = (Math.random() - 0.5) * 0.5;
    this.vy        = (Math.random() - 0.5) * 0.5;
    this.baseAlpha = 0.12 + Math.random() * 0.22;
    this.alpha     = this.baseAlpha;
    this.letterIdx = Math.min(Math.floor(idx / nPerLetter), nLet - 1);
    this.color     = LET_COLORS[this.letterIdx % LET_COLORS.length];
    this.size      = 0.6 + Math.random() * 1.0;
    this.targetX    = 0;
    this.targetY    = 0;
    this.revealTime = 0;
    this.state      = "free";
  }

  respawn(w: number, h: number) {
    this.x     = Math.random() * w;
    this.y     = Math.random() * h;
    this.vx    = (Math.random() - 0.5) * 0.5;
    this.vy    = (Math.random() - 0.5) * 0.5;
    this.alpha = this.baseAlpha;
    this.state = "free";
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode    = "orb" | "exercise";
type ExPhase = "inspire" | "expire" | "reveal" | null;

// ─────────────────────────────────────────────────────────────────────────────
export default function SOSExerciseVisual({
  firstName = "Marie",
  word      = "CALME",
}: {
  firstName?: string;
  word?:      string;
}) {
  const svgLayout   = useMemo(() => buildWordSVG(word.toUpperCase()), [word]);
  const N_LET       = svgLayout.paths.length;
  const N_PER_LETTER = Math.max(1, N_PARTICLES / N_LET);

  const [mode,       setMode]       = useState<Mode>("orb");
  const [speaking,   setSpeaking]   = useState(false);
  const [exPhase,    setExPhase]    = useState<ExPhase>(null);
  const [curLetter,  setCurLetter]  = useState(0);
  const [litLetters, setLitLetters] = useState<boolean[]>(Array(N_LET).fill(false));
  const [orbScale,   setOrbScale]   = useState(1.0);
  const [timeLeft,   setTimeLeft]   = useState(0);

  const waveCanvasRef     = useRef<HTMLCanvasElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef            = useRef<SVGSVGElement>(null);
  const letPathRefs       = useRef<(SVGPathElement | null)[]>([]);
  const timers            = useRef<ReturnType<typeof setTimeout>[]>([]);

  const speakingRef   = useRef(false);
  const modeRef       = useRef<Mode>("orb");
  const exPhaseRef    = useRef<ExPhase>(null);
  const curLetterRef  = useRef(0);
  const letPtsRef     = useRef<[number, number][]>([]);
  const waveTimeRef   = useRef(0);
  const particlesRef  = useRef<Particle[]>([]);
  const revealAlphaRef  = useRef(1.0);
  const expireStartRef  = useRef(0);
  const inspireStartRef = useRef(0);

  speakingRef.current  = speaking;
  modeRef.current      = mode;
  exPhaseRef.current   = exPhase;
  curLetterRef.current = curLetter;

  // ── Wave canvas (orb mode) ─────────────────────────────────────────────────
  useEffect(() => {
    const c = waveCanvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const S   = ORB_R * 2;
    c.width = S * dpr; c.height = S * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    let raf: number;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, S, S);
      if (modeRef.current !== "orb") return;
      waveTimeRef.current += 0.014;
      const t   = waveTimeRef.current;
      const spk = speakingRef.current;

      // 3 couches de vague remplies, de l'arrière vers l'avant
      const layers = spk
        ? [[13, 2.8, 0, 0.28], [8, 2.0, Math.PI * 0.65, 0.16], [5, 1.4, Math.PI * 1.35, 0.09]]
        : [[ 3, 1.7, 0, 0.18], [2, 1.3, Math.PI * 0.65, 0.11], [1.2, 1.0, Math.PI * 1.35, 0.06]];

      const yBase = S * 0.76;

      for (let w = 2; w >= 0; w--) {
        const [amp, freq, ph, alpha] = layers[w];
        ctx.beginPath();
        for (let x = 0; x <= S; x += 1.5) {
          const y = yBase + amp * Math.sin(freq * (x / S) * Math.PI * 4 + t * 3 + ph);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        // Ferme vers le bas → effet "rempli"
        ctx.lineTo(S, S);
        ctx.lineTo(0, S);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, yBase - amp, 0, S);
        grad.addColorStop(0, `rgba(6,182,212,${alpha})`);
        grad.addColorStop(1, `rgba(6,182,212,0.02)`);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const ep = exPhaseRef.current;
      if (ep === "inspire") {
        setTimeLeft(Math.max(0, Math.ceil((INSPIRE_MS - (Date.now() - inspireStartRef.current)) / 1000)));
      } else if (ep === "expire") {
        setTimeLeft(Math.max(0, Math.ceil((EXPIRE_MS - (Date.now() - expireStartRef.current)) / 1000)));
      } else {
        setTimeLeft(0);
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  // ── Particle canvas ────────────────────────────────────────────────────────
  useEffect(() => {
    const c = particleCanvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    let W = window.innerWidth, H = window.innerHeight;
    const ctx = c.getContext("2d")!;

    const init = () => {
      c.width = W * dpr; c.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    init();

    particlesRef.current = Array.from({ length: N_PARTICLES }, (_, i) => new Particle(W, H, i, N_LET, N_PER_LETTER));

    const onResize = () => { W = window.innerWidth; H = window.innerHeight; init(); };
    window.addEventListener("resize", onResize);

    let raf: number;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);

      const ep    = exPhaseRef.current;
      const li    = curLetterRef.current;
      const parts = particlesRef.current;

      // Reveal : décrémente alpha global
      if (ep === "reveal") {
        revealAlphaRef.current = Math.max(0, revealAlphaRef.current - 0.004);
      }

      // ── Physique ──────────────────────────────────────────────────────
      for (const p of parts) {
        if (p.state === "fading") {
          p.alpha = Math.max(0, p.alpha - 0.006);
          p.vx *= 0.98; p.vy *= 0.98;
          p.x += p.vx; p.y += p.vy;
          continue;
        }

        if (p.state === "attracting") {
          // Attraction vers le centre — sans orbital, sans oscillation
          const dx   = W / 2 - p.x;
          const dy   = H / 2 - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 6) {
            // Amortissement fort au cœur — stoppe le rebond gauche/droite
            p.vx *= 0.60; p.vy *= 0.60;
          } else {
            // Force plafonnée : évite le survol du centre
            const f    = Math.min(G / dist, 2.6);
            const fric = dist < 40 ? 0.76 : INSPIRE_FRIC;
            p.vx += (dx / dist) * f;
            p.vy += (dy / dist) * f;
            p.vx *= fric; p.vy *= fric;
          }
          p.alpha = Math.min(0.72, p.alpha + 0.008);

        } else if (p.state === "settling") {
          const elapsed = Date.now() - expireStartRef.current;
          if (elapsed >= p.revealTime) {
            // Ressort dispersif — actif selon revealTime (formation progressive)
            p.vx += (p.targetX - p.x) * SPRING_K;
            p.vy += (p.targetY - p.y) * SPRING_K;
            p.vx *= SPRING_FRIC;
            p.vy *= SPRING_FRIC;
            p.alpha = Math.min(0.95, p.alpha + 0.016);
          } else {
            // En attente — dérive légère près du centre
            p.vx *= 0.97; p.vy *= 0.97;
            p.alpha = Math.min(0.50, p.alpha + 0.005);
          }

        } else {
          // Dérive libre (apesanteur)
          p.vx += (Math.random() - 0.5) * 0.02;
          p.vy += (Math.random() - 0.5) * 0.02;
          p.vx *= 0.98; p.vy *= 0.98;
          p.alpha = p.baseAlpha;
        }

        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      }

      // ── Rendu — 1 batch par lettre/couleur ────────────────────────────
      const isReveal = ep === "reveal";

      for (let col = 0; col < N_LET; col++) {
        // Alpha du groupe selon l'état de la lettre
        let batchAlpha: number;
        if (isReveal) {
          batchAlpha = revealAlphaRef.current * 0.92;
        } else if (col < li) {
          batchAlpha = 0.82;  // lettre formée, stable
        } else if (col === li) {
          batchAlpha = ep === "inspire" ? 0.60 : 0.90;
        } else {
          batchAlpha = 0.22;  // lettre future, discrète
        }

        if (batchAlpha < 0.01) continue;

        ctx.beginPath();
        for (const p of parts) {
          if (p.letterIdx !== col) continue;
          ctx.moveTo(p.x + p.size, p.y);
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        ctx.fillStyle   = LET_COLORS[col];
        ctx.globalAlpha = batchAlpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── Point focal central (inspire uniquement) ───────────────────────
      if (ep === "inspire") {
        const col = LET_COLORS[li];
        const cx = W / 2, cy = H / 2;

        ctx.globalAlpha = 0.06;
        ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();

        ctx.globalAlpha = 0.20;
        ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();

        ctx.globalAlpha = 0.65;
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#e0f2fe"; ctx.fill();

        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff"; ctx.fill();

        ctx.globalAlpha = 1;
      }
    };

    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  // ── Calcul des points d'une lettre ────────────────────────────────────────
  const computeLetterPts = useCallback((li: number) => {
    const pathEl = letPathRefs.current[li];
    if (!pathEl) return;
    const ctm = pathEl.getScreenCTM();
    if (!ctm) return;
    const len = pathEl.getTotalLength();
    letPtsRef.current = Array.from({ length: N_PTS }, (_, i) => {
      const local  = pathEl.getPointAtLength((i / (N_PTS - 1)) * len);
      const screen = local.matrixTransform(ctm);
      return [screen.x, screen.y] as [number, number];
    });
  }, []);

  // ── Assignation des cibles pour l'expiration ──────────────────────────────
  const assignTargets = useCallback((li: number) => {
    const pts = letPtsRef.current;
    if (!pts.length) return;
    const group = particlesRef.current.filter(p => p.letterIdx === li);
    const n     = group.length;
    group.forEach((p, i) => {
      const idx  = Math.min(Math.round((i / Math.max(1, n - 1)) * (N_PTS - 1)), N_PTS - 1);
      // Léger offset organique
      p.targetX    = pts[idx][0] + (Math.random() - 0.5) * 4;
      p.targetY    = pts[idx][1] + (Math.random() - 0.5) * 4;
      // Stagger progressif : la lettre se trace du début à la fin
      // Particule 0 → t=0, particule 59 → t=62% de EXPIRE_MS
      p.revealTime = (i / n) * EXPIRE_MS * 0.62;
      p.state      = "settling";
    });
  }, []);

  // ── Timers ────────────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  const push = (fn: () => void, ms: number) =>
    timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => clearAll(), [clearAll]);

  // ── Machine à états lettre ────────────────────────────────────────────────
  const startLetterRef = useRef<(li: number) => void>(() => {});

  const startLetter = useCallback((li: number) => {
    setCurLetter(li);
    curLetterRef.current = li;

    // Activer l'attraction pour cette lettre
    for (const p of particlesRef.current) {
      if (p.letterIdx === li) p.state = "attracting";
    }

    // Inspire
    inspireStartRef.current = Date.now();
    setExPhase("inspire");
    exPhaseRef.current = "inspire";
    setOrbScale(1.08);

    // → Expire
    push(() => {
      computeLetterPts(li);
      assignTargets(li);
      expireStartRef.current = Date.now();
      setExPhase("expire");
      exPhaseRef.current = "expire";
      setOrbScale(0.90);
    }, INSPIRE_MS);

    // → Suite
    push(() => {
      if (li + 1 < N_LET) {
        startLetterRef.current(li + 1);
      } else {
        // Révélation finale
        setExPhase("reveal");
        exPhaseRef.current = "reveal";
        setOrbScale(1.0);
        revealAlphaRef.current = 1.0;
        // SVG s'illumine, particules s'estompent
        push(() => {
          setLitLetters(Array(N_LET).fill(true));
          for (const p of particlesRef.current) p.state = "fading";
        }, 700);
      }
    }, INSPIRE_MS + EXPIRE_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computeLetterPts, assignTargets]);

  startLetterRef.current = startLetter;

  const startExercise = useCallback(() => {
    clearAll();
    setSpeaking(false);
    setMode("exercise");      modeRef.current    = "exercise";
    setExPhase(null);         exPhaseRef.current = null;
    setLitLetters(Array(N_LET).fill(false));
    letPtsRef.current    = [];
    revealAlphaRef.current = 1.0;

    const W = window.innerWidth, H = window.innerHeight;
    for (const p of particlesRef.current) p.respawn(W, H);

    push(() => startLetterRef.current(0), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearAll]);

  const simulateSpeak = useCallback(() => {
    clearAll();
    setMode("orb");    modeRef.current    = "orb";
    setExPhase(null);  exPhaseRef.current = null;
    setSpeaking(true); setOrbScale(1.0);
    push(() => setSpeaking(false), 5000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearAll]);

  const reset = useCallback(() => {
    clearAll();
    setMode("orb");    modeRef.current    = "orb";
    setExPhase(null);  exPhaseRef.current = null;
    setSpeaking(false);
    setLitLetters(Array(N_LET).fill(false));
    setOrbScale(1.0);
    revealAlphaRef.current = 1.0;
    const W = window.innerWidth, H = window.innerHeight;
    for (const p of particlesRef.current) p.respawn(W, H);
  }, [clearAll]);

  const borderAlpha = speaking ? "0.42" : "0.20";
  const glowAlpha   = speaking ? "0.18" : "0.07";
  const glowSize    = speaking ? "28px"  : "14px";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "radial-gradient(ellipse at 50% 44%, #0f172a 0%, #0b0f0d 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden",
    }}>

      {/* ── Barre de test ─────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", gap: 6, padding: "9px 14px",
        background: "rgba(0,0,0,0.65)",
        opacity: 0.12, transition: "opacity 0.25s", zIndex: 30,
      }}
        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.opacity = "1")}
        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.opacity = "0.12")}
      >
        {([
          ["Repos",       reset],
          ["IA parle 5s", simulateSpeak],
          ["→ Exercice",  startExercise],
          ["Reset",       reset],
        ] as [string, () => void][]).map(([lbl, fn]) => (
          <button key={lbl} onClick={fn} style={{
            padding: "4px 11px", borderRadius: 5, fontSize: 11,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#94a3b8", cursor: "pointer", fontFamily: "inherit",
          }}>{lbl}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.18)", alignSelf: "center" }}>
          {mode} · {exPhase ?? "—"} · L{mode === "exercise" ? curLetter + 1 : "-"}/{N_LET}
        </span>
      </div>

      {/* ── Canvas particules ─────────────────────────────────────────────── */}
      <canvas ref={particleCanvasRef} style={{
        position: "absolute", inset: 0,
        width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 2,
      }} />

      {/* ── SVG — toujours monté, sans ghost, révélation finale seulement ── */}
      <svg ref={svgRef}
        viewBox={`0 0 ${svgLayout.totalWidth} ${svgLayout.height}`}
        style={{
          position: "absolute",
          width: `min(88vw, ${Math.max(240, svgLayout.totalWidth)}px)`,
          height: "auto",
          left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 3, overflow: "visible",
          pointerEvents: "none",
        }}
        aria-hidden
      >
        {svgLayout.paths.map((d, i) => {
          const color = LET_COLORS[i % LET_COLORS.length];
          const lit   = litLetters[i] ?? false;
          return (
            <g key={i} transform={`translate(${svgLayout.xOffsets[i]}, 0)`}>
              {lit && (
                <path
                  d={d} fill="none"
                  stroke={color} strokeWidth="6"
                  strokeLinecap="round" strokeLinejoin="round"
                  opacity={0.16}
                  style={{ filter: "blur(5px)", transition: `opacity 1s ease ${i * 0.22}s` }}
                />
              )}
              <path
                d={d} fill="none"
                stroke={color} strokeWidth="2.4"
                strokeLinecap="round" strokeLinejoin="round"
                opacity={lit ? 0.92 : 0}
                style={{
                  transition: `opacity 0.9s ease ${i * 0.22}s`,
                  filter: lit ? `drop-shadow(0 0 9px ${color})` : "none",
                }}
                ref={el => { letPathRefs.current[i] = el; }}
              />
            </g>
          );
        })}
      </svg>

      {/* ── Orbe (caché pendant l'exercice) ──────────────────────────────── */}
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 28,
        position: "relative", zIndex: 4,
        opacity: mode === "exercise" ? 0 : 1,
        pointerEvents: mode === "exercise" ? "none" : "auto",
        transition: "opacity 0.8s ease",
      }}>
        <div style={{
          width: ORB_R * 2, height: ORB_R * 2,
          borderRadius: "50%",
          position: "relative", overflow: "hidden",
          background: "rgba(255,255,255,0.045)",
          backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          border: `1.5px solid rgba(6,182,212,${borderAlpha})`,
          boxShadow: [
            `0 0 ${glowSize} rgba(6,182,212,${glowAlpha})`,
            "inset 0 1px 0 rgba(255,255,255,0.07)",
          ].join(", "),
          transform: `scale(${orbScale})`,
          transition: "transform 5s cubic-bezier(0.4,0,0.2,1), border-color 0.9s, box-shadow 0.9s",
          animation: speaking ? "sv-speak 2.2s ease-in-out infinite" : "none",
        }}>
          <div style={{
            position: "absolute", top: "12%", left: "16%",
            width: "30%", height: "10%", borderRadius: 999,
            background: "rgba(255,255,255,0.055)", pointerEvents: "none",
          }} />
          <canvas ref={waveCanvasRef} style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%", pointerEvents: "none",
            opacity: mode === "orb" ? 1 : 0,
            transition: "opacity 0.8s ease",
          }} />
        </div>
        <p style={{
          color: "rgba(255,255,255,0.22)", fontSize: 11,
          letterSpacing: "0.20em", fontWeight: 300, textTransform: "uppercase",
          userSelect: "none",
          opacity: mode === "orb" ? 1 : 0,
          transition: "opacity 0.5s ease",
        }}>{firstName}</p>
      </div>

      {/* ── Label de phase ────────────────────────────────────────────────── */}
      {mode === "exercise" && exPhase && exPhase !== "reveal" && (
        <div style={{
          position: "absolute", bottom: 52, left: 0, right: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 8,
          userSelect: "none", zIndex: 5,
        }}>
          <p style={{
            color: exPhase === "inspire"
              ? `${LET_COLORS[curLetter]}99`
              : `${LET_COLORS[curLetter]}77`,
            fontSize: 11, letterSpacing: "0.28em",
            fontWeight: 300, textTransform: "uppercase",
            margin: 0, animation: "sv-fade 0.5s ease",
          }}>
            {exPhase === "inspire" ? "Inspire" : "Expire"}
          </p>
          <p style={{
            color: `${LET_COLORS[curLetter]}55`,
            fontSize: 13, fontWeight: 300,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.04em",
            margin: 0,
          }}>
            {timeLeft}
          </p>
        </div>
      )}

      <style>{`
        @keyframes sv-fade { from { opacity: 0; } to { opacity: 1; } }

        @keyframes sv-speak {
          0%,100% { box-shadow: 0 0 14px rgba(6,182,212,0.08), inset 0 1px 0 rgba(255,255,255,0.07); }
          50%      { box-shadow: 0 0 32px rgba(6,182,212,0.22), 0 0 56px rgba(139,92,246,0.08),
                                 inset 0 1px 0 rgba(255,255,255,0.09); }
        }

        /* Blob au repos — respiration lente, à peine perceptible */
        @keyframes sv-blob-rest {
          0%,100% { border-radius: 58% 42% 54% 46% / 52% 48% 58% 42%; }
          33%     { border-radius: 50% 50% 42% 58% / 46% 54% 50% 50%; }
          66%     { border-radius: 46% 54% 58% 42% / 58% 42% 46% 54%; }
        }

        /* Blob en train de parler — plus vif, plus expressif */
        @keyframes sv-blob-speak {
          0%,100% { border-radius: 62% 38% 46% 54% / 60% 44% 56% 40%; }
          25%     { border-radius: 40% 60% 56% 44% / 48% 60% 40% 52%; }
          50%     { border-radius: 54% 46% 38% 62% / 44% 56% 52% 48%; }
          75%     { border-radius: 48% 52% 62% 38% / 56% 40% 60% 44%; }
        }
      `}</style>
    </div>
  );
}
