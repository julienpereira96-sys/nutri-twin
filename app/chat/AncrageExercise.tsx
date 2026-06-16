"use client";

/**
 * AncrageExercise — Technique sensorielle 5-4-3-2-1 (Niveau 1)
 *
 * Objectif clinique : stopper dissociation / angoisse aiguë / obsession TCA
 * en forçant le système cognitif à scanner l'environnement réel via les 5 sens,
 * saturant la mémoire de travail pour éteindre la rumination.
 *
 * State machine :
 *   intro      → cadrage vocal Gemini Live (2.5s auto Phase 1)
 *   sight_5    → 5 choses vues
 *   touch_4    → 4 sensations tactiles
 *   hearing_3  → 3 sons identifiés
 *   smell_2    → 2 odeurs perçues
 *   taste_1    → 1 saveur ressentie
 *   cloture    → validation + feedback + injection chat
 *
 * Sécurité :
 *   VAD 6s     → auto-avance si silence (Phase 2 : Gemini déblocage vocal)
 *   Hard stop  → 3 minutes maximum
 *   Haptic     → micro-vibration à chaque étape validée
 *
 * Phase 1 : coquille locale. Bouton simulation "Étape suivante".
 * Phase 2 : brancher Gemini Live WebSocket.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Design tokens — Terre / Ocre ─────────────────────────────────────────────
const BG_DEEP      = "#080501";                    // noir chaud
const OCHRE        = "#d4a255";                    // ocre doré
const OCHRE_DIM    = "rgba(212,162,85,0.11)";
const OCHRE_GLOW   = "rgba(212,162,85,0.42)";
const OCHRE_BORD   = "rgba(212,162,85,0.28)";
const OCHRE_SOFT   = "rgba(212,162,85,0.18)";
const EARTH        = "rgba(180,120,50,0.55)";      // terre plus sombre
const TEXT_WARM    = "rgba(255,248,230,0.88)";     // blanc chaud
const TEXT_MUTED   = "rgba(255,248,230,0.36)";
const TEXT_FADED   = "rgba(255,248,230,0.16)";

// ─── Timing ───────────────────────────────────────────────────────────────────
const VAD_TIMEOUT  = 6;    // secondes avant auto-avance si silence
const HARD_STOP_MS = 180_000; // 3 minutes

// ─── State machine ─────────────────────────────────────────────────────────────
type SenseStatus =
  | "intro"
  | "sight_5"
  | "touch_4"
  | "hearing_3"
  | "smell_2"
  | "taste_1"
  | "cloture";

const SENSE_ORDER: SenseStatus[] = [
  "intro", "sight_5", "touch_4", "hearing_3", "smell_2", "taste_1", "cloture",
];

// ─── Config par sens ──────────────────────────────────────────────────────────
interface SenseConfig {
  count: number;
  label: string;       // affiché dans le panneau simulation seulement
  consigne: string;    // ce que Gemini dirait (Phase 2)
  icon: React.ReactNode;
}

// ─── SVG Icons inline ─────────────────────────────────────────────────────────
function IconEye({ size = 36, color = OCHRE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function IconHand({ size = 36, color = OCHRE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
    </svg>
  );
}

function IconEar({ size = 36, color = OCHRE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 0 1-7 0"/>
      <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 0 0 4 0 2 2 0 0 0-4 0"/>
    </svg>
  );
}

function IconWind({ size = 36, color = OCHRE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
    </svg>
  );
}

function IconDroplet({ size = 36, color = OCHRE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
    </svg>
  );
}

const SENSE_CONFIG: Record<Exclude<SenseStatus, "intro" | "cloture">, SenseConfig> = {
  sight_5: {
    count: 5,
    label: "5 choses que tu vois",
    consigne: "Cite-moi à haute voix 5 objets que tu vois autour de toi en ce moment.",
    icon: <IconEye />,
  },
  touch_4: {
    count: 4,
    label: "4 sensations que tu ressens",
    consigne: "Sens ton corps. Nomme 4 sensations physiques ou textures que tu ressens là tout de suite.",
    icon: <IconHand />,
  },
  hearing_3: {
    count: 3,
    label: "3 sons que tu entends",
    consigne: "Ferme les yeux. Dis-moi 3 sons distincts que tu entends en arrière-plan.",
    icon: <IconEar />,
  },
  smell_2: {
    count: 2,
    label: "2 odeurs que tu perçois",
    consigne: "Prends une inspiration. Nomme 2 odeurs que tu perçois ou que tu peux imaginer autour de toi.",
    icon: <IconWind />,
  },
  taste_1: {
    count: 1,
    label: "1 saveur sur ta langue",
    consigne: "Enfin, concentre-toi sur ta bouche. Dis-moi 1 saveur que tu as sur la langue en ce moment.",
    icon: <IconDroplet />,
  },
};

// Ordre des sens actifs (sans intro/cloture)
const ACTIVE_SENSES: Exclude<SenseStatus, "intro" | "cloture">[] = [
  "sight_5", "touch_4", "hearing_3", "smell_2", "taste_1",
];

// ─── Indicateur géométrique 5-4-3-2-1 ────────────────────────────────────────
function GeoIndicator({ completedCount }: { completedCount: number }) {
  const nodes = [5, 4, 3, 2, 1];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {nodes.map((n, i) => {
        const done    = i < completedCount;
        const current = i === completedCount;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center" }}>
            {/* Segment de liaison */}
            {i > 0 && (
              <div style={{
                width: 28,
                height: 2,
                background: done ? OCHRE : "rgba(255,248,230,0.08)",
                transition: "background 0.5s ease",
              }} />
            )}
            {/* Nœud */}
            <motion.div
              animate={done
                ? { boxShadow: [`0 0 0px ${OCHRE_GLOW}`, `0 0 14px ${OCHRE_GLOW}`, `0 0 6px ${OCHRE_GLOW}`] }
                : { boxShadow: "0 0 0px rgba(0,0,0,0)" }
              }
              transition={{ repeat: done ? Infinity : 0, duration: 2.5, ease: "easeInOut" }}
              style={{
                width: current ? 48 : 40,
                height: current ? 48 : 40,
                borderRadius: "50%",
                background: done
                  ? OCHRE_SOFT
                  : current
                  ? OCHRE_DIM
                  : "rgba(255,255,255,0.03)",
                border: `2px solid ${done ? OCHRE : current ? OCHRE_BORD : "rgba(255,255,255,0.07)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.4s ease",
              }}
            >
              {done ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
                  stroke={OCHRE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 8 3.5 3.5 6.5-7" />
                </svg>
              ) : (
                <span style={{
                  fontSize: current ? 18 : 15,
                  fontWeight: 700,
                  color: current ? OCHRE : TEXT_FADED,
                  transition: "all 0.3s ease",
                }}>
                  {n}
                </span>
              )}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Onde ocre (bas d'écran) ─────────────────────────────────────────────────
function OchreWave({ active }: { active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, height: 40 }}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const baseH = 4 + Math.sin(i * 0.7) * 2;
        const peakH = 10 + Math.sin(i * 1.1) * 14;
        return (
          <motion.div
            key={i}
            style={{ width: 3.5, borderRadius: 2, background: OCHRE }}
            animate={active
              ? { height: [`${baseH}px`, `${peakH}px`, `${baseH}px`], opacity: [0.35, 0.8, 0.35] }
              : { height: "4px", opacity: 0.15 }
            }
            transition={active
              ? { repeat: Infinity, duration: 1.0 + i * 0.09, ease: "easeInOut", delay: i * 0.11 }
              : { duration: 0.4 }
            }
          />
        );
      })}
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────
export interface AncrageExerciseProps {
  patientId?: string;
  practitionerId?: string;
  firstName: string;
  sosContext?: string;
  onTransitionToChat?: (summary: string, closing: string) => void;
  // Compat ancien : onCompleted (utilisé par page.tsx v1)
  onCompleted?: () => void;
  onClose: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AncrageExercise({
  firstName,
  sosContext: _sosContext = "",
  onTransitionToChat,
  onCompleted,
  onClose,
}: AncrageExerciseProps) {
  const [status, setStatus]         = useState<SenseStatus>("intro");
  const [completedCount, setCompletedCount] = useState(0); // nb de sens complétés (0–5)
  const [vadSecs, setVadSecs]       = useState(VAD_TIMEOUT);
  const [waveActive, setWaveActive] = useState(true);

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const vadRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const hardStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTransRef  = useRef(onTransitionToChat);
  const onCompRef   = useRef(onCompleted);
  useEffect(() => { onTransRef.current = onTransitionToChat; }, [onTransitionToChat]);
  useEffect(() => { onCompRef.current = onCompleted; }, [onCompleted]);

  // ─── Index du sens courant ─────────────────────────────────────────────────
  const currentSenseIdx = ACTIVE_SENSES.indexOf(
    status as Exclude<SenseStatus, "intro" | "cloture">
  ); // -1 si intro/cloture

  // ─── Cleanup ───────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (vadRef.current)      clearInterval(vadRef.current);
    if (hardStopRef.current) clearTimeout(hardStopRef.current);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ─── Hard stop 3min ────────────────────────────────────────────────────────
  useEffect(() => {
    hardStopRef.current = setTimeout(() => {
      cleanup();
      setStatus("cloture");
      setWaveActive(false);
    }, HARD_STOP_MS);
    return () => { if (hardStopRef.current) clearTimeout(hardStopRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Démarrer VAD pour un sens ────────────────────────────────────────────
  const startVad = useCallback(() => {
    if (vadRef.current) clearInterval(vadRef.current);
    setVadSecs(VAD_TIMEOUT);
    let rem = VAD_TIMEOUT;
    vadRef.current = setInterval(() => {
      rem -= 1;
      setVadSecs(rem);
      if (rem <= 0) {
        clearInterval(vadRef.current!);
        validateCurrentSense(); // auto-avance sur silence
      }
    }, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Avancer au sens suivant ──────────────────────────────────────────────
  const validateCurrentSense = useCallback(() => {
    if (vadRef.current) clearInterval(vadRef.current);

    // Haptic confirmation
    navigator.vibrate?.([25, 30, 50]);

    setCompletedCount((prev) => {
      const next = prev + 1;
      if (next >= ACTIVE_SENSES.length) {
        // Tous les sens validés → cloture
        setTimeout(() => {
          setStatus("cloture");
          setWaveActive(true); // onde active pour la validation finale
        }, 300);
      } else {
        // Sens suivant
        const nextSense = ACTIVE_SENSES[next];
        setTimeout(() => {
          setStatus(nextSense);
          setWaveActive(false);
          setTimeout(() => startVad(), 600);
        }, 300);
      }
      return next;
    });
  }, [startVad]);

  // ─── INTRO → premier sens auto ────────────────────────────────────────────
  useEffect(() => {
    if (status !== "intro") return;
    setWaveActive(true);
    const t = setTimeout(() => {
      setStatus("sight_5");
      setWaveActive(false);
      setTimeout(() => startVad(), 500);
    }, 2600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ─── Clôture → injection chat ─────────────────────────────────────────────
  const handleTransition = useCallback(() => {
    cleanup();
    const summary = `🪨 *Exercice d'ancrage 5-4-3-2-1 complété — ${completedCount} sens explorés.*`;
    const closing = `Magnifique ${firstName}. Ton esprit est de retour dans la pièce. Tu viens de traverser une vague difficile et tu es encore là, pleinement présent·e.`;
    if (onTransRef.current) {
      onTransRef.current(summary, closing);
    } else {
      onCompRef.current?.();
    }
  }, [cleanup, completedCount, firstName]);

  // ─── Sens courant config ──────────────────────────────────────────────────
  const senseKey = status !== "intro" && status !== "cloture"
    ? status as Exclude<SenseStatus, "intro" | "cloture">
    : null;
  const senseConf = senseKey ? SENSE_CONFIG[senseKey] : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 200,
      background: BG_DEEP,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes earth-pulse {
          0%, 100% { opacity: 0.10; transform: scale(1); }
          50%       { opacity: 0.20; transform: scale(1.07); }
        }
      `}</style>

      {/* ── Halo de fond terre ────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute",
          top: "-20%", left: "50%", transform: "translateX(-50%)",
          width: "90vw", height: "90vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(180,110,30,0.20) 0%, transparent 65%)",
          animation: "earth-pulse 7s ease-in-out infinite",
        }} />
      </div>

      {/* ── Close ─────────────────────────────────────────────────────────── */}
      {status !== "cloture" && (
        <button onClick={onClose} aria-label="Fermer" style={{
          position: "absolute", top: 20, right: 20,
          width: 34, height: 34, borderRadius: "50%",
          background: OCHRE_DIM, border: `1px solid ${OCHRE_BORD}`,
          color: TEXT_MUTED, fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10,
        }}>×</button>
      )}

      {/* ── Indicateur géométrique (haut) ─────────────────────────────────── */}
      <div style={{
        paddingTop: 52,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        zIndex: 1,
      }}>
        <GeoIndicator completedCount={completedCount} />
        {status !== "intro" && status !== "cloture" && (
          <p style={{
            margin: 0,
            fontSize: 10,
            color: TEXT_FADED,
            letterSpacing: 1.3,
            textTransform: "uppercase",
          }}>
            {SENSE_ORDER.indexOf(status) - 1} / 5 sens explorés
          </p>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Contenu central
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">

        {/* ── INTRO ─────────────────────────────────────────────────────── */}
        {status === "intro" && (
          <motion.div key="intro"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, zIndex: 1 }}
          >
            <motion.div
              animate={{ scale: [1, 1.06, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              style={{
                width: 68, height: 68, borderRadius: "50%",
                background: OCHRE_DIM, border: `1.5px solid ${OCHRE_BORD}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 28px ${OCHRE_GLOW}`,
              }}
            >
              {/* Icône ancre */}
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                stroke={OCHRE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="3"/>
                <line x1="12" y1="8" x2="12" y2="22"/>
                <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
              </svg>
            </motion.div>
            <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED, letterSpacing: 0.4 }}>
              Ton Jumeau prend la parole…
            </p>
            {/* Bypass simulation */}
            <button
              onClick={() => {
                setStatus("sight_5");
                setWaveActive(false);
                setTimeout(() => startVad(), 400);
              }}
              style={{
                marginTop: 8, padding: "9px 22px", borderRadius: 12,
                background: "transparent", border: `1px solid ${OCHRE_BORD}`,
                color: TEXT_MUTED, fontSize: 12, cursor: "pointer",
              }}
            >
              Passer l'intro →
            </button>
          </motion.div>
        )}

        {/* ── SENS ACTIF ────────────────────────────────────────────────── */}
        {senseConf && (
          <motion.div key={status}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 28,
              zIndex: 1,
              width: "100%",
              maxWidth: 360,
              padding: "0 28px",
            }}
          >
            {/* Grande icône du sens */}
            <motion.div
              animate={{
                boxShadow: [
                  `0 0 0px ${OCHRE_GLOW}`,
                  `0 0 32px ${OCHRE_GLOW}`,
                  `0 0 12px ${OCHRE_GLOW}`,
                ],
              }}
              transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: OCHRE_DIM,
                border: `1.5px solid ${OCHRE_BORD}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {senseConf.icon}
            </motion.div>

            {/* Compteur du sens (grand chiffre) */}
            <div style={{ textAlign: "center" }}>
              <motion.p
                key={`count-${status}`}
                initial={{ scale: 1.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  margin: "0 0 4px",
                  fontSize: 56,
                  fontWeight: 700,
                  color: OCHRE,
                  lineHeight: 1,
                  textShadow: `0 0 24px ${OCHRE_GLOW}`,
                }}
              >
                {senseConf.count}
              </motion.p>
              <p style={{ margin: 0, fontSize: 12, color: TEXT_FADED, letterSpacing: 1.2, textTransform: "uppercase" }}>
                {senseConf.label}
              </p>
            </div>

            {/* Indicateur micro + VAD */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: OCHRE_DIM, border: `1.5px solid ${OCHRE_BORD}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={OCHRE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                </svg>
              </motion.div>

              {/* VAD barre de progression */}
              <div style={{ width: 120, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)" }}>
                <motion.div
                  style={{
                    height: "100%",
                    borderRadius: 2,
                    background: vadSecs <= 2 ? "#ef4444" : OCHRE,
                    width: `${(vadSecs / VAD_TIMEOUT) * 100}%`,
                    transition: "width 0.9s linear, background 0.3s ease",
                  }}
                />
              </div>
              <p style={{ margin: 0, fontSize: 11, color: TEXT_FADED }}>
                {vadSecs > 0 ? `avance auto dans ${vadSecs}s` : "passage automatique…"}
              </p>
            </div>

            {/* ── Panneau simulation Phase 1 ───────────────────────────── */}
            <div style={{
              width: "100%",
              background: OCHRE_DIM,
              border: `1px solid ${OCHRE_BORD}`,
              borderRadius: 16,
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              <p style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.3,
                color: `rgba(212,162,85,0.55)`,
                textTransform: "uppercase",
              }}>
                Simulation Phase 1 — consigne IA
              </p>
              <p style={{
                margin: 0,
                fontSize: 13,
                color: TEXT_MUTED,
                fontStyle: "italic",
                lineHeight: 1.6,
              }}>
                « {senseConf.consigne} »
              </p>
              <button
                onClick={validateCurrentSense}
                style={{
                  padding: "11px 20px",
                  borderRadius: 12,
                  background: `linear-gradient(135deg, #b45309, ${OCHRE})`,
                  border: "none",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: 0.3,
                }}
              >
                {currentSenseIdx < ACTIVE_SENSES.length - 1
                  ? `Étape suivante — ${SENSE_CONFIG[ACTIVE_SENSES[currentSenseIdx + 1]]?.label ?? ""} →`
                  : "Valider et clôturer ✓"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── CLOTURE ───────────────────────────────────────────────────── */}
        {status === "cloture" && (
          <motion.div key="cloture"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
              zIndex: 1,
              textAlign: "center",
              padding: "0 28px",
              maxWidth: 380,
              width: "100%",
            }}
          >
            {/* Badge victoire */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
              style={{
                width: 64, height: 64, borderRadius: "50%",
                background: OCHRE_SOFT, border: `2px solid ${OCHRE_BORD}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 32px ${OCHRE_GLOW}`,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke={OCHRE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>

            {/* Résumé des sens */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                width: "100%",
                background: OCHRE_DIM,
                border: `1px solid ${OCHRE_BORD}`,
                borderRadius: 16,
                padding: "16px 20px",
              }}
            >
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, letterSpacing: 1.3, color: `rgba(212,162,85,0.6)`, textTransform: "uppercase" }}>
                Ancrage complété
              </p>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
                {ACTIVE_SENSES.slice(0, completedCount).map((s, i) => {
                  const conf = SENSE_CONFIG[s];
                  return (
                    <motion.div
                      key={s}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 + i * 0.1 }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: OCHRE_SOFT, border: `1px solid ${OCHRE_BORD}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {/* Mini icon */}
                        <div style={{ transform: "scale(0.6)" }}>{conf.icon}</div>
                      </div>
                      <span style={{ fontSize: 10, color: TEXT_MUTED }}>{conf.count}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: TEXT_WARM }}
            >
              Magnifique {firstName}. Ton esprit est de retour dans la pièce.
            </motion.p>

            <motion.button
              onClick={handleTransition}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              style={{
                padding: "14px 36px", borderRadius: 16, border: "none",
                background: `linear-gradient(135deg, #92400e, ${OCHRE})`,
                color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
                boxShadow: `0 4px 24px ${OCHRE_GLOW}`,
              }}
            >
              Continuer avec mon Jumeau →
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Onde ocre (bas d'écran) ───────────────────────────────────────── */}
      <div style={{
        paddingBottom: 34,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        zIndex: 1,
      }}>
        <OchreWave active={waveActive} />
        {status !== "cloture" && (
          <p style={{
            margin: 0,
            fontSize: 10,
            color: TEXT_FADED,
            letterSpacing: 1.1,
            textTransform: "uppercase",
          }}>
            {status === "intro" ? "Ton Jumeau prend la parole" : "Jumeau · Présent"}
          </p>
        )}
      </div>
    </div>
  );
}
