"use client";

/**
 * ParticleCanvas.tsx — v2
 *
 * Moteur de particules revu pour un effet visible sur mobile :
 *  - N_PARTICLES = 700 (vs 300 avant) → ~116 par lettre pour un mot de 6 lettres
 *  - Tailles 1.5–4px (vs 0.6–1.7px avant)
 *  - Attraction inspire : G=250, cap 5.5 px/frame → rush visible vers le centre
 *  - Formation expire  : SPRING_K=0.025, stagger max 25% de EXPIRE_MS → lettres nettes en <2s
 *  - Fond initialisé en noir avant le premier RAF → plus de flash blanc
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
const N_PARTICLES  = 700;
const N_PTS        = 120;    // points de chemin par lettre (plus dense = meilleur rendu)
const G            = 250;    // gravité d'attraction inspire (était 90)
const G_CAP        = 5.5;    // vitesse max par frame inspire (était 2.6)
const INSPIRE_FRIC = 0.87;   // friction inspire (était 0.91 → trop fort)
const SPRING_K     = 0.025;  // ressort expire (était 0.006 → trop faible)
const SPRING_FRIC  = 0.85;   // friction expire (était 0.92)
const STAGGER_MAX  = 0.25;   // stagger max = 25% de EXPIRE_MS (était 62%)

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
    this.vx         = (Math.random() - 0.5) * 0.8;
    this.vy         = (Math.random() - 0.5) * 0.8;
    // Alpha de base plus élevé pour des particules plus visibles
    this.baseAlpha  = 0.18 + Math.random() * 0.28;
    this.alpha      = this.baseAlpha;
    this.letterIdx  = Math.min(Math.floor(idx / nPer), nLet - 1);
    this.color      = colors[this.letterIdx % colors.length];
    // Tailles plus grandes : 1.5 à 4px (était 0.6–1.7px)
    this.size       = 1.5 + Math.random() * 2.5;
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
  /** Phase de révélation finale */
  isReveal: boolean;
  /** Quelles lettres SVG illuminer (longueur = word.length) */
  litLetters: boolean[];
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
  isReveal,
  litLetters,
  EXPIRE_MS,
}: ParticleCanvasProps) {

  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const svgRef         = useRef<SVGSVGElement>(null);
  const pathRefs       = useRef<(SVGPathElement | null)[]>([]);

  // Références mutables pour la boucle RAF (évite les stale closures)
  const particlesRef    = useRef<Particle[]>([]);
  const letPtsRef       = useRef<[number, number][]>([]);
  const revealFadeRef   = useRef(1.0);
  const expireStartRef  = useRef<number>(0);

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

  // ── Calcul des points-cibles depuis le SVG ──────────────────────────────────
  const computeLetterPts = useCallback((li: number) => {
    const pathEl = pathRefs.current[li];
    if (!pathEl) return;
    const ctm = pathEl.getScreenCTM();
    if (!ctm) return;
    const len = pathEl.getTotalLength();
    if (len === 0) return;
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
      p.targetX      = pts[ptIdx][0] + (Math.random() - 0.5) * 2;
      p.targetY      = pts[ptIdx][1] + (Math.random() - 0.5) * 2;
      // Stagger MAX = 25% de EXPIRE_MS (était 62%) → tous les points se forment en <1.4s
      p.revealTime   = (i / Math.max(1, n)) * expMs * STAGGER_MAX;
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
    // Double RAF pour être sûr que le SVG est bien rendu dans le DOM
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
      // Fond immédiatement noir pour éviter le flash blanc initial
      ctx.fillStyle = "rgb(6,8,16)";
      ctx.fillRect(0, 0, W, H);
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
        revealFadeRef.current = Math.max(0, revealFadeRef.current - 0.005);
      }

      // ── Physique ─────────────────────────────────────────────────────────
      const cx = W / 2, cy = H / 2;

      for (const p of parts) {
        switch (p.state) {

          case "fading": {
            p.alpha = Math.max(0, p.alpha - 0.008);
            p.vx   *= 0.98; p.vy *= 0.98;
            break;
          }

          case "attracting": {
            const dx   = cx - p.x;
            const dy   = cy - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 8) {
              p.vx *= 0.55; p.vy *= 0.55;
            } else {
              // Force plus forte et cap relevé pour un rush visible
              const f    = Math.min(G / dist, G_CAP);
              const fric = dist < 60 ? 0.72 : INSPIRE_FRIC;
              p.vx += (dx / dist) * f;
              p.vy += (dy / dist) * f;
              p.vx *= fric; p.vy *= fric;
            }
            p.alpha = Math.min(0.88, p.alpha + 0.012);
            break;
          }

          case "settling": {
            const elapsed = Date.now() - expireStartRef.current;
            if (elapsed >= p.revealTime) {
              // Spring fort vers la cible
              p.vx  += (p.targetX - p.x) * SPRING_K;
              p.vy  += (p.targetY - p.y) * SPRING_K;
              p.vx  *= SPRING_FRIC; p.vy *= SPRING_FRIC;
              p.alpha = Math.min(1.0, p.alpha + 0.025);
            } else {
              // Légère dérive avant d'être capturé
              p.vx *= 0.96; p.vy *= 0.96;
              p.alpha = Math.min(0.55, p.alpha + 0.008);
            }
            break;
          }

          default: {
            // free — dérive légère
            p.vx += (Math.random() - 0.5) * 0.025;
            p.vy += (Math.random() - 0.5) * 0.025;
            p.vx *= 0.97; p.vy *= 0.97;
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
          batchAlpha = revealFadeRef.current * 0.95;
        } else if (!w) {
          batchAlpha = 0.30; // ambiant — un peu plus visible qu'avant (0.22)
        } else if (col < li) {
          batchAlpha = 0.85; // lettre déjà formée
        } else if (col === li) {
          batchAlpha = bp === "inspire" ? 0.65 : 0.95;
        } else {
          batchAlpha = 0.22; // lettre future (fond)
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

      // ── Point focal au centre pendant inspire ─────────────────────────────
      if (w && bp === "inspire" && !rev) {
        const col = cols[li % cols.length];

        // Halo large et doux
        ctx.globalAlpha = 0.08;
        ctx.beginPath(); ctx.arc(cx, cy, 44, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();

        // Halo intermédiaire
        ctx.globalAlpha = 0.28;
        ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fillStyle = col; ctx.fill();

        // Point central lumineux
        ctx.globalAlpha = 0.80;
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#e0f2fe"; ctx.fill();

        // Noyau blanc pur
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff"; ctx.fill();

        ctx.globalAlpha = 1;
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
          background:    "rgb(6,8,16)", // fond immédiat avant le premier RAF
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
