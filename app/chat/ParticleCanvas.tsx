"use client";

/**
 * ParticleCanvas.tsx
 *
 * Composant canvas particules contrôlé par props.
 * Contient aussi le SVG du mot (invisible pendant l'exercice, illuminé à la révélation).
 *
 * Fonctionnement :
 *  • word = null    → particules libres (fond ambiant)
 *  • word = "CALME" → particules assignées aux lettres, réagissent aux phases
 *  • breathPhase = "inspire"  → attraction vers le centre (ORB)
 *  • breathPhase = "expire"   → spring vers les cibles SVG (formation lettre)
 *  • isReveal = true          → fade particules, SVG s'illumine
 */

import { useEffect, useRef, useCallback } from "react";
import { buildWordSVG } from "./letterPaths";

// ─── Constantes physique ──────────────────────────────────────────────────────
const N_PARTICLES     = 300;
const N_PTS           = 100;   // points de chemin par lettre
const G               = 90;    // gravité d'attraction inspire
const INSPIRE_FRIC    = 0.91;
const SPRING_K        = 0.006;
const SPRING_FRIC     = 0.92;
// Point focal inspire : centré horizontalement, juste au-dessus du label Inspire/Expire
// Le label est à bottom:56 + hauteur ~20px → on met le point à ~120px du bas
const FOCAL_BOTTOM_PX = 120;

type PState = "free" | "attracting" | "settling" | "fading";

// ─── Classe Particle ──────────────────────────────────────────────────────────
class Particle {
  x: number; y: number;
  vx: number; vy: number;
  baseAlpha: number; alpha: number;
  color: string; size: number;
  letterIdx: number;
  targetX: number; targetY: number;
  revealTime: number;
  state: PState;

  constructor(
    W: number,
    H: number,
    idx: number,
    nLet: number,
    colors: string[],
  ) {
    const nPer = Math.max(1, Math.floor(N_PARTICLES / nLet));
    this.x          = Math.random() * W;
    this.y          = Math.random() * H;
    this.vx         = (Math.random() - 0.5) * 0.6;
    this.vy         = (Math.random() - 0.5) * 0.6;
    this.baseAlpha  = 0.12 + Math.random() * 0.22;
    this.alpha      = this.baseAlpha;
    this.letterIdx  = Math.min(Math.floor(idx / nPer), nLet - 1);
    this.color      = colors[this.letterIdx % colors.length];
    this.size       = 0.6 + Math.random() * 1.1;
    this.targetX    = 0;
    this.targetY    = 0;
    this.revealTime = 0;
    this.state      = "free";
  }
}

// ─── Props ─────────────────────────────────────────────────────────────────────
export interface ParticleCanvasProps {
  /** Mot en majuscules, ou null en mode ambiant */
  word: string | null;
  /** Couleur par lettre (doit couvrir toutes les lettres du mot) */
  letterColors: string[];
  /** Index de la lettre en cours (0-based) */
  letterIdx: number;
  /** Phase respiratoire courante */
  breathPhase: "inspire" | "expire";
  /** Date.now() au début de la phase expire (pour calcul du stagger) */
  expireStart: number | null;
  /** Date.now() au début de la phase inspire (pour l'anneau) */
  inspireStart: number | null;
  /** Phase de révélation finale */
  isReveal: boolean;
  /** Quelles lettres SVG illuminer (longueur = word.length) */
  litLetters: boolean[];
  /** Durée de l'inspiration en ms (pour l'anneau) */
  INSPIRE_MS: number;
  /** Durée de l'expiration en ms (pour le calcul du stagger) */
  EXPIRE_MS: number;
}

// ─── Composant ─────────────────────────────────────────────────────────────────
export default function ParticleCanvas({
  word,
  letterColors,
  letterIdx,
  breathPhase,
  expireStart,
  inspireStart,
  isReveal,
  litLetters,
  INSPIRE_MS,
  EXPIRE_MS,
}: ParticleCanvasProps) {

  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const svgRef         = useRef<SVGSVGElement>(null);
  const pathRefs       = useRef<(SVGPathElement | null)[]>([]);

  // Références mutable pour la boucle RAF (évite les stale closures)
  const particlesRef    = useRef<Particle[]>([]);
  const letPtsRef       = useRef<[number, number][]>([]);
  const revealFadeRef   = useRef(1.0);
  const expireStartRef      = useRef<number>(0);
  // Refs dédiés à l'anneau (mis à jour immédiatement depuis les props, sans double-RAF)
  const ringInspireStartRef = useRef<number>(0);
  const ringExpireStartRef  = useRef<number>(0);
  const inspireMsRef        = useRef(INSPIRE_MS);

  // Mirrors des props dans des refs (lus dans la boucle RAF)
  const letterIdxRef    = useRef(letterIdx);
  const breathPhaseRef  = useRef<"inspire" | "expire">(breathPhase);
  const isRevealRef     = useRef(isReveal);
  const wordRef         = useRef<string | null>(word);
  const colorsRef       = useRef<string[]>(letterColors);
  const expireMsRef     = useRef(EXPIRE_MS);

  letterIdxRef.current   = letterIdx;
  breathPhaseRef.current = breathPhase;
  isRevealRef.current    = isReveal;
  wordRef.current        = word;
  colorsRef.current      = letterColors;
  expireMsRef.current    = EXPIRE_MS;
  inspireMsRef.current   = INSPIRE_MS;
  // Mise à jour immédiate pour l'anneau (pas de double-RAF nécessaire)
  if (inspireStart != null) ringInspireStartRef.current = inspireStart;
  if (expireStart  != null) ringExpireStartRef.current  = expireStart;

  // ── Calcul des points-cibles depuis le SVG ──────────────────────────────────
  const computeLetterPts = useCallback((li: number) => {
    const pathEl = pathRefs.current[li];
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

  // ── Assigner les cibles spring pour l'expire ────────────────────────────────
  const assignTargets = useCallback((li: number) => {
    const pts   = letPtsRef.current;
    if (!pts.length) return;
    const expMs = expireMsRef.current;
    const group = particlesRef.current.filter(p => p.letterIdx === li);
    const n     = group.length;
    group.forEach((p, i) => {
      const ptIdx    = Math.min(Math.round((i / Math.max(1, n - 1)) * (N_PTS - 1)), N_PTS - 1);
      p.targetX      = pts[ptIdx][0] + (Math.random() - 0.5) * 3;
      p.targetY      = pts[ptIdx][1] + (Math.random() - 0.5) * 3;
      p.revealTime   = (i / Math.max(1, n)) * expMs * 0.62;
      p.state        = "settling";
    });
  }, []);

  // ── Initialisation quand le mot change ─────────────────────────────────────
  useEffect(() => {
    const W    = window.innerWidth;
    const H    = window.innerHeight;
    const nLet = word ? word.length : Math.max(1, letterColors.length);
    revealFadeRef.current = 1.0;
    particlesRef.current  = Array.from({ length: N_PARTICLES }, (_, i) =>
      new Particle(W, H, i, nLet, letterColors),
    );
  }, [word, letterColors]);

  // ── Démarrer l'attraction inspire quand letterIdx change ───────────────────
  useEffect(() => {
    if (!word) return;
    const li = letterIdx;
    for (const p of particlesRef.current) {
      if (p.letterIdx === li) p.state = "attracting";
    }
  }, [letterIdx, word]);

  // ── Démarrer le spring expire ──────────────────────────────────────────────
  useEffect(() => {
    if (!word || breathPhase !== "expire") return;
    const li = letterIdx;
    // Double RAF : le SVG vient d'apparaître dans le DOM quand word passe null→mot.
    // Un seul RAF ne suffit pas pour que le navigateur calcule getScreenCTM().
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        computeLetterPts(li);
        expireStartRef.current = expireStart ?? Date.now();
        assignTargets(li);
      });
    });
  }, [breathPhase, word, letterIdx, expireStart, computeLetterPts, assignTargets]);

  // ── Déclencher la révélation ───────────────────────────────────────────────
  useEffect(() => {
    if (!isReveal) return;
    revealFadeRef.current = 1.0;
    for (const p of particlesRef.current) p.state = "fading";
  }, [isReveal]);

  // ── Boucle RAF principale ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    let W      = window.innerWidth;
    let H      = window.innerHeight;
    const ctx  = canvas.getContext("2d")!;

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width  = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf: number;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);

      const parts = particlesRef.current;
      const w     = wordRef.current;
      const li    = letterIdxRef.current;
      const bp    = breathPhaseRef.current;
      const rev   = isRevealRef.current;
      const cols  = colorsRef.current;
      const nLet  = w ? w.length : Math.max(1, cols.length);

      // Fade global au reveal
      if (rev) {
        revealFadeRef.current = Math.max(0, revealFadeRef.current - 0.004);
      }

      // ── Physique ─────────────────────────────────────────────────────────
      for (const p of parts) {
        switch (p.state) {

          case "fading": {
            p.alpha = Math.max(0, p.alpha - 0.006);
            p.vx   *= 0.98; p.vy *= 0.98;
            break;
          }

          case "attracting": {
            const focalY = H - FOCAL_BOTTOM_PX;
            const dx   = W / 2 - p.x;
            const dy   = focalY - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 6) {
              p.vx *= 0.60; p.vy *= 0.60;
            } else {
              const f    = Math.min(G / dist, 2.6);
              const fric = dist < 40 ? 0.76 : INSPIRE_FRIC;
              p.vx += (dx / dist) * f;
              p.vy += (dy / dist) * f;
              p.vx *= fric; p.vy *= fric;
            }
            p.alpha = Math.min(0.72, p.alpha + 0.008);
            break;
          }

          case "settling": {
            const elapsed = Date.now() - expireStartRef.current;
            if (elapsed >= p.revealTime) {
              p.vx  += (p.targetX - p.x) * SPRING_K;
              p.vy  += (p.targetY - p.y) * SPRING_K;
              p.vx  *= SPRING_FRIC; p.vy *= SPRING_FRIC;
              p.alpha = Math.min(0.95, p.alpha + 0.016);
            } else {
              p.vx *= 0.97; p.vy *= 0.97;
              p.alpha = Math.min(0.50, p.alpha + 0.005);
            }
            break;
          }

          default: {
            // free – dérive légère
            p.vx += (Math.random() - 0.5) * 0.02;
            p.vy += (Math.random() - 0.5) * 0.02;
            p.vx *= 0.98; p.vy *= 0.98;
            p.alpha = p.baseAlpha;
          }
        }

        p.x += p.vx; p.y += p.vy;
        // Wrap screen
        if (p.x < -12) p.x = W + 12; else if (p.x > W + 12) p.x = -12;
        if (p.y < -12) p.y = H + 12; else if (p.y > H + 12) p.y = -12;
      }

      // ── Rendu par groupe couleur (1 fill par lettre) ──────────────────────
      for (let col = 0; col < nLet; col++) {
        const color = cols[col % cols.length];

        // Opacité globale du groupe selon contexte
        let batchAlpha: number;
        if (rev) {
          batchAlpha = revealFadeRef.current * 0.9;
        } else if (!w) {
          batchAlpha = 0.22; // ambiant
        } else if (col < li) {
          batchAlpha = 0.80; // lettre déjà formée
        } else if (col === li) {
          batchAlpha = bp === "inspire" ? 0.55 : 0.90;
        } else {
          batchAlpha = 0.18; // lettre future (fond)
        }

        if (batchAlpha < 0.01) continue;

        ctx.beginPath();
        for (const p of parts) {
          if (p.letterIdx !== col) continue;
          const a = rev ? p.alpha : 1;
          if (a < 0.01) continue;
          ctx.moveTo(p.x + p.size, p.y);
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        ctx.fillStyle   = color;
        ctx.globalAlpha = batchAlpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── Point focal + anneau respiratoire ────────────────────────────────────
      // Visible pendant tout le tracé (inspire ET expire) pour rythmer le souffle.
      // Anneau :
      //   • Inspire → se remplit de 0 à 100% (particules affluent, poumons se remplissent)
      //   • Expire  → se vide de 100 à 0%   (particules forment la lettre, poumons se vident)
      if (w && !rev) {
        const col   = cols[li % cols.length];
        const cx    = W / 2;
        const cy    = H - FOCAL_BOTTOM_PX;
        const RING_R = 28;

        // Fraction de l'anneau selon la phase
        let ringFraction: number;
        if (bp === "inspire") {
          const elapsed = ringInspireStartRef.current > 0
            ? Date.now() - ringInspireStartRef.current : 0;
          ringFraction = Math.min(1, elapsed / inspireMsRef.current);
        } else {
          const elapsed = ringExpireStartRef.current > 0
            ? Date.now() - ringExpireStartRef.current : 0;
          ringFraction = Math.max(0, 1 - elapsed / expireMsRef.current);
        }

        // Arc de progression (toujours dessiné, même à 0 fraction pour l'anneau de fond)
        // Fond de l'anneau — très subtil
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, RING_R, 0, Math.PI * 2);
        ctx.strokeStyle = col;
        ctx.lineWidth   = 2;
        ctx.globalAlpha = 0.10;
        ctx.stroke();

        // Arc rempli — avec glow lumineux (cohérent avec la barre Breathing)
        if (ringFraction > 0.01) {
          const startAngle = -Math.PI / 2;
          const endAngle   = startAngle + 2 * Math.PI * ringFraction;
          ctx.beginPath();
          ctx.arc(cx, cy, RING_R, startAngle, endAngle);
          ctx.strokeStyle  = col;
          ctx.lineWidth    = 2.5;
          ctx.lineCap      = "round";
          ctx.globalAlpha  = 0.50 + ringFraction * 0.35;
          ctx.shadowColor  = col;
          ctx.shadowBlur   = 8;
          ctx.stroke();
          ctx.shadowBlur   = 0; // reset pour ne pas contaminer les autres draw
        }
        ctx.restore();

        // Point central et lueur — uniquement pendant l'inspire
        if (bp === "inspire") {
          ctx.globalAlpha = 0.06;
          ctx.beginPath(); ctx.arc(cx, cy, 32, 0, Math.PI * 2);
          ctx.fillStyle = col; ctx.fill();

          ctx.globalAlpha = 0.22;
          ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2);
          ctx.fillStyle = col; ctx.fill();

          ctx.globalAlpha = 0.70;
          ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#e0f2fe"; ctx.fill();

          ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff"; ctx.fill();

          ctx.globalAlpha = 1;
        }
      }
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []); // lancé une seule fois

  // ── SVG dynamique du mot ──────────────────────────────────────────────────
  const svgLayout = word ? buildWordSVG(word) : null;
  const nLet      = word ? word.length : letterColors.length;

  // Largeur CSS du SVG : s'adapte à la largeur de l'écran
  const svgCssWidth = svgLayout
    ? `min(88vw, ${Math.max(240, svgLayout.totalWidth)}px)`
    : "0";

  return (
    <>
      {/* Canvas des particules — toujours présent */}
      <canvas
        ref={canvasRef}
        style={{
          position:      "fixed",
          inset:         0,
          width:         "100%",
          height:        "100%",
          pointerEvents: "none",
          zIndex:        2,
        }}
      />

      {/* SVG du mot — monté dès que le mot est connu (pour getScreenCTM) */}
      {svgLayout && (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgLayout.totalWidth} ${svgLayout.height}`}
          style={{
            position:      "fixed",
            width:         svgCssWidth,
            height:        "auto",
            left:          "50%",
            top:           "50%",
            transform:     "translate(-50%, -50%)",
            overflow:      "visible",
            pointerEvents: "none",
            zIndex:        3,
          }}
          aria-hidden
        >
          {svgLayout.paths.map((d, i) => {
            const color   = letterColors[i % letterColors.length];
            const lit     = litLetters[i] ?? false;
            const delay   = `${i * 0.22}s`;
            return (
              <g key={i} transform={`translate(${svgLayout.xOffsets[i]}, 0)`}>
                {/* Halo de lueur */}
                {lit && (
                  <path
                    d={d}
                    fill="none"
                    stroke={color}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.18}
                    style={{ filter: `blur(6px)`, transition: `opacity 1s ease ${delay}` }}
                  />
                )}
                {/* Trait principal */}
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={lit ? 0.90 : 0}
                  style={{
                    transition: `opacity 0.9s ease ${delay}`,
                    filter: lit ? `drop-shadow(0 0 8px ${color})` : "none",
                  }}
                  ref={el => { pathRefs.current[i] = el; }}
                />
              </g>
            );
          })}
        </svg>
      )}
    </>
  );
}
