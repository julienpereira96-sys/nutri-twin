"use client";

/**
 * MindfulEating — Pleine conscience alimentaire (Niveau 1)
 *
 * Rituel de prévention contre l'engouffrement compulsif.
 * 100% vocal en production (Gemini Live WebSocket) — Phase 1 = coquille locale.
 *
 * State machine :
 *   intro             → consigne rituelle d'entrée (3s)
 *   chewing           → timer 20s, haptic à 20s, puis bascule listening
 *   listening         → micro ouvert (simulé), VAD timeout 5s si silence
 *   branch_emotional  → faim émotionnelle détectée, réassurance + pause respi
 *   branch_biological → faim biologique validée, ancrage sur saveurs
 *   cloture           → clôture + log dashboard victoire / modérée / sévère
 *
 * Sécurité :
 *   - VAD timeout 5s si silence au micro
 *   - Hard stop 4min global
 *   - Max 4 bouchées / cycles
 *
 * Phase 1 : zéro audio IA. Timers locaux + boutons simulation.
 * Phase 2 : brancher Gemini Live WebSocket.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BG_DEEP       = "#020b05";                    // noir-vert très sombre
const MINT          = "#34d399";                    // vert menthe doux
const MINT_DIM      = "rgba(52,211,153,0.10)";
const MINT_GLOW     = "rgba(52,211,153,0.40)";
const MINT_BORD     = "rgba(52,211,153,0.28)";
const MINT_SOFT     = "rgba(52,211,153,0.16)";
const ORANGE        = "#fb923c";                    // branche émotionnelle
const ORANGE_DIM    = "rgba(251,146,60,0.12)";
const ORANGE_BORD   = "rgba(251,146,60,0.30)";
const TEXT_PRIMARY  = "rgba(255,255,255,0.88)";
const TEXT_MUTED    = "rgba(255,255,255,0.38)";
const TEXT_FADED    = "rgba(255,255,255,0.16)";

const MAX_BITES   = 4;
const CHEW_SECS   = 20;   // secondes de mastication
const VAD_TIMEOUT = 5;    // secondes silence avant auto-avance
const HARD_STOP   = 240;  // 4 minutes en secondes

// ─── Types ─────────────────────────────────────────────────────────────────────
type Status =
  | "intro"
  | "chewing"
  | "listening"
  | "branch_emotional"
  | "branch_biological"
  | "cloture";

type ExitMode = "victory" | "moderate" | "severe";
type Branch   = "emotional" | "biological";

export interface MindfulEatingProps {
  patientId: string;
  practitionerId: string;
  firstName: string;
  sosContext?: string;
  onTransitionToChat: (summary: string, exitMode: ExitMode) => void;
  onClose: () => void;
}

// ─── Onde verte miniature (bas d'écran) ───────────────────────────────────────
function MintWave({ active, intensity = 1 }: { active: boolean; intensity?: number }) {
  const bars = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, height: 44 }}>
      {bars.map((i) => {
        const baseH = 4 + Math.sin(i * 0.7) * 3;
        const peakH = (10 + Math.sin(i * 1.1) * 14) * intensity;
        return (
          <motion.div
            key={i}
            style={{ width: 3.5, borderRadius: 2, background: MINT }}
            animate={active
              ? { height: [`${baseH}px`, `${peakH}px`, `${baseH}px`], opacity: [0.4, 0.85, 0.4] }
              : { height: "4px", opacity: 0.18 }
            }
            transition={active
              ? { repeat: Infinity, duration: 1.1 + i * 0.09, ease: "easeInOut", delay: i * 0.12 }
              : { duration: 0.4 }
            }
          />
        );
      })}
    </div>
  );
}

// ─── Arc de progression bouchées ──────────────────────────────────────────────
function BiteArc({ bite, max }: { bite: number; max: number }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: i < bite
              ? MINT
              : i === bite
              ? "rgba(52,211,153,0.40)"
              : "rgba(255,255,255,0.08)",
            transition: "background 0.5s ease",
            boxShadow: i < bite ? `0 0 8px ${MINT_GLOW}` : "none",
          }}
        />
      ))}
    </div>
  );
}

// ─── Anneau timer mastication ──────────────────────────────────────────────────
function ChewRing({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const r      = 54;
  const circ   = 2 * Math.PI * r;
  const pct    = secondsLeft / total;
  const offset = circ * (1 - pct);

  return (
    <svg width={128} height={128} viewBox="0 0 128 128">
      {/* Glow */}
      <circle cx={64} cy={64} r={r + 8}
        fill="none" stroke={MINT_GLOW} strokeWidth={6} opacity={0.12} />
      {/* Track */}
      <circle cx={64} cy={64} r={r}
        fill="none" stroke="rgba(52,211,153,0.10)" strokeWidth={4} />
      {/* Progress */}
      <circle cx={64} cy={64} r={r}
        fill="none"
        stroke={secondsLeft <= 5 ? "#fbbf24" : MINT}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={String(circ)}
        strokeDashoffset={offset}
        transform="rotate(-90 64 64)"
        style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.4s ease" }}
      />
      {/* Secondes restantes */}
      <text x={64} y={72} textAnchor="middle"
        fill={secondsLeft <= 5 ? "#fbbf24" : TEXT_MUTED}
        fontSize={28} fontWeight={600}
        style={{ transition: "fill 0.3s" }}>
        {secondsLeft}
      </text>
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function MindfulEating({
  patientId: _patientId,
  practitionerId: _practitionerId,
  firstName,
  sosContext: _sosContext = "",
  onTransitionToChat,
  onClose,
}: MindfulEatingProps) {
  const [status, setStatus]           = useState<Status>("intro");
  const [biteCount, setBiteCount]     = useState(0);       // bouchées complétées
  const [chewSecs, setChewSecs]       = useState(CHEW_SECS);
  const [vadSecs, setVadSecs]         = useState(VAD_TIMEOUT);
  const [detectedBranch, setDetectedBranch] = useState<Branch | null>(null);
  const [exitMode, setExitMode]       = useState<ExitMode>("victory");
  const [waveActive, setWaveActive]   = useState(true);
  const [positiveExits, setPositiveExits] = useState(0); // nb de réponses biologiques
  const [canAdvance, setCanAdvance]       = useState(false); // chewing timer terminé, patient contrôle

  // ─── Refs ──────────────────────────────────────────────────────────────────
  const chewIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const vadIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const hardStopRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalSecsRef     = useRef(0);
  const globalIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTransitionRef  = useRef(onTransitionToChat);
  useEffect(() => { onTransitionRef.current = onTransitionToChat; }, [onTransitionToChat]);

  // ─── Hard stop global (4min) ───────────────────────────────────────────────
  const goToCloture = useCallback((mode: ExitMode) => {
    setExitMode(mode);
    setStatus("cloture");
    setWaveActive(false);
    // Cleanup
    if (chewIntervalRef.current)   clearInterval(chewIntervalRef.current);
    if (vadIntervalRef.current)    clearInterval(vadIntervalRef.current);
    if (hardStopRef.current)       clearTimeout(hardStopRef.current);
    if (globalIntervalRef.current) clearInterval(globalIntervalRef.current);
  }, []);

  useEffect(() => {
    hardStopRef.current = setTimeout(() => {
      goToCloture("severe");
    }, HARD_STOP * 1000);

    // Compteur global pour le hard stop
    globalIntervalRef.current = setInterval(() => {
      totalSecsRef.current += 1;
    }, 1000);

    return () => {
      if (hardStopRef.current)       clearTimeout(hardStopRef.current);
      if (globalIntervalRef.current) clearInterval(globalIntervalRef.current);
    };
  }, [goToCloture]);

  // ─── INTRO → active l'onde, patient démarre quand il est prêt ────────────
  useEffect(() => {
    if (status !== "intro") return;
    setWaveActive(true);
  }, [status]);

  // ─── Démarrer un cycle de mastication ─────────────────────────────────────
  const startChewing = useCallback(() => {
    setStatus("chewing");
    setChewSecs(CHEW_SECS);
    setCanAdvance(false);
    setWaveActive(false);

    let remaining = CHEW_SECS;
    chewIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setChewSecs(remaining);

      // Haptic doux à 10s et vibration finale à 0s
      if (remaining === 10) {
        navigator.vibrate?.([15, 80, 15]);
      }
      if (remaining <= 0) {
        clearInterval(chewIntervalRef.current!);
        chewIntervalRef.current = null;
        // Haptic feutré de fin de cycle — patient peut passer à l'écoute
        navigator.vibrate?.([30, 50, 60]);
        setCanAdvance(true);
      }
    }, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Ouvrir le micro (listening) ──────────────────────────────────────────
  const startListening = useCallback(() => {
    setStatus("listening");
    setVadSecs(VAD_TIMEOUT);
    setWaveActive(true);

    let vadRemaining = VAD_TIMEOUT;
    vadIntervalRef.current = setInterval(() => {
      vadRemaining -= 1;
      setVadSecs(vadRemaining);
      if (vadRemaining <= 0) {
        clearInterval(vadIntervalRef.current!);
        // Silence : avance automatiquement vers branche biologique (défaut sécurisé)
        handleBranch("biological");
      }
    }, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Traitement de branche ────────────────────────────────────────────────
  const handleBranch = useCallback((branch: Branch) => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    setDetectedBranch(branch);
    setStatus(branch === "emotional" ? "branch_emotional" : "branch_biological");
    setWaveActive(false);

    if (branch === "biological") {
      setPositiveExits((p) => p + 1);
    }

    // Après 2.5s sur l'écran de branche → décision : boucle ou clôture
    const timeoutId = setTimeout(() => {
      const newBite = biteCount + 1;
      setBiteCount(newBite);

      // Sortie précoce si 2 réponses biologiques consécutives OU bouchées max
      if (branch === "biological" && positiveExits + 1 >= 2) {
        goToCloture("victory");
      } else if (newBite >= MAX_BITES) {
        // Fin des 4 bouchées
        const mode: ExitMode =
          branch === "biological" ? "victory"
          : positiveExits === 0   ? "severe"
          : "moderate";
        goToCloture(mode);
      } else {
        // Boucle vers prochaine bouchée
        startChewing();
      }
    }, 2500);

    return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biteCount, positiveExits, goToCloture]);

  // ─── Clôture → injection chat ──────────────────────────────────────────────
  const handleTransition = useCallback(() => {
    const modeLabel =
      exitMode === "victory"  ? "Signal positif — repas ancré avec succès" :
      exitMode === "moderate" ? "Stabilisation partielle" :
      "Exercice interrompu — accompagnement recommandé";

    const summary =
      `🌿 *Exercice Pleine Conscience Alimentaire*\n` +
      `${biteCount} bouchée${biteCount > 1 ? "s" : ""} consciente${biteCount > 1 ? "s" : ""} · ${modeLabel}`;

    onTransitionRef.current(summary, exitMode);
  }, [biteCount, exitMode]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => {
    if (chewIntervalRef.current)   clearInterval(chewIntervalRef.current);
    if (vadIntervalRef.current)    clearInterval(vadIntervalRef.current);
    if (hardStopRef.current)       clearTimeout(hardStopRef.current);
    if (globalIntervalRef.current) clearInterval(globalIntervalRef.current);
  }, []);

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
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.12; transform: scale(1); }
          50%       { opacity: 0.22; transform: scale(1.08); }
        }
      `}</style>

      {/* ── Fond halo vert ────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", bottom: "-20%", left: "50%",
          transform: "translateX(-50%)",
          width: "80vw", height: "80vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(52,211,153,0.14) 0%, transparent 70%)",
          animation: "glow-pulse 5s ease-in-out infinite",
        }} />
      </div>

      {/* ── Close ─────────────────────────────────────────────────────────── */}
      {status !== "cloture" && (
        <button onClick={onClose} aria-label="Fermer" style={{
          position: "absolute", top: 20, right: 20,
          width: 34, height: 34, borderRadius: "50%",
          background: MINT_DIM, border: `1px solid ${MINT_BORD}`,
          color: TEXT_MUTED, fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10,
        }}>×</button>
      )}

      {/* ── Progression bouchées (haut) ───────────────────────────────────── */}
      <div style={{
        paddingTop: 52,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        zIndex: 1,
      }}>
        {status !== "intro" && status !== "cloture" && (
          <>
            <BiteArc bite={biteCount} max={MAX_BITES} />
            <p style={{ margin: 0, fontSize: 11, color: TEXT_FADED, letterSpacing: 1.2, textTransform: "uppercase" }}>
              Bouchée {Math.min(biteCount + 1, MAX_BITES)} / {MAX_BITES}
            </p>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Contenu central — AnimatePresence pour transitions fluides
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">

        {/* ── INTRO ─────────────────────────────────────────────────────── */}
        {status === "intro" && (
          <motion.div key="intro"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, zIndex: 1 }}
          >
            {/* Icône assiette */}
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
              style={{
                width: 72, height: 72, borderRadius: "50%",
                background: MINT_DIM, border: `1.5px solid ${MINT_BORD}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 32px ${MINT_GLOW}`,
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke={MINT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l19-9-9 19-2-8-8-2z" />
              </svg>
            </motion.div>

            <p style={{ margin: 0, fontSize: 15, color: TEXT_PRIMARY, lineHeight: 1.7, textAlign: "center", maxWidth: 300 }}>
              Pose ce que tu portes un instant.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED, lineHeight: 1.6, textAlign: "center", maxWidth: 280 }}>
              Installe-toi confortablement, décroises les jambes, relâche les épaules.
            </p>

            <button onClick={() => startChewing()}
              style={{
                marginTop: 12, padding: "13px 32px", borderRadius: 14,
                background: `linear-gradient(135deg, #10b981, #34d399)`,
                border: "none", color: "#fff",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
                boxShadow: `0 4px 20px ${MINT_GLOW}`,
              }}>
              Commencer →
            </button>
          </motion.div>
        )}

        {/* ── CHEWING — anneau 20s ──────────────────────────────────────── */}
        {status === "chewing" && (
          <motion.div key="chewing"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, zIndex: 1 }}
          >
            <ChewRing secondsLeft={chewSecs} total={CHEW_SECS} />

            <p style={{ margin: 0, fontSize: 12, color: TEXT_FADED, letterSpacing: 0.3, textAlign: "center" }}>
              mastique, ressens, observe
            </p>

            {/* Bouton patient-paced — apparaît quand le timer atteint 0 */}
            <AnimatePresence>
              {canAdvance && (
                <motion.button
                  key="advance-btn"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    setCanAdvance(false);
                    startListening();
                  }}
                  style={{
                    marginTop: 12, padding: "13px 32px", borderRadius: 14,
                    background: `linear-gradient(135deg, #10b981, #34d399)`,
                    border: "none", color: "#fff",
                    fontSize: 15, fontWeight: 700, cursor: "pointer",
                    boxShadow: `0 4px 20px ${MINT_GLOW}`,
                  }}
                >
                  Continuer →
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── LISTENING — micro ouvert + VAD countdown ─────────────────── */}
        {status === "listening" && (
          <motion.div key="listening"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, zIndex: 1, width: "100%", maxWidth: 340, padding: "0 28px" }}
          >
            {/* Indicateur micro */}
            <motion.div
              animate={{ boxShadow: [`0 0 0px ${MINT_GLOW}`, `0 0 28px ${MINT_GLOW}`, `0 0 0px ${MINT_GLOW}`] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              style={{
                width: 56, height: 56, borderRadius: "50%",
                background: MINT_SOFT, border: `2px solid ${MINT_BORD}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={MINT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </motion.div>

            {/* VAD countdown */}
            <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED, textAlign: "center" }}>
              {vadSecs > 0 ? `Silence dans ${vadSecs}s…` : "Passage automatique…"}
            </p>

            {/* Panneau simulation Phase 1 */}
            <div style={{
              width: "100%", background: "rgba(52,211,153,0.06)",
              border: `1px solid ${MINT_BORD}`, borderRadius: 16,
              padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10,
            }}>
              <p style={{
                margin: 0, fontSize: 10, fontWeight: 700,
                letterSpacing: 1.3, color: "rgba(52,211,153,0.5)", textTransform: "uppercase",
              }}>
                Simulation — aiguillage IA
              </p>

              {/* Branche A — faim émotionnelle */}
              <button onClick={() => {
                if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
                handleBranch("emotional");
              }} style={{
                padding: "11px 16px", borderRadius: 12, border: `1.5px solid ${ORANGE_BORD}`,
                background: ORANGE_DIM, color: "#fb923c",
                fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left",
              }}>
                🔴 Branche A — Faim émotionnelle
                <span style={{ display: "block", fontSize: 11, color: "rgba(251,146,60,0.6)", marginTop: 3 }}>
                  stress, culpabilité, envie compulsive détectée
                </span>
              </button>

              {/* Branche B — faim biologique */}
              <button onClick={() => {
                if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
                handleBranch("biological");
              }} style={{
                padding: "11px 16px", borderRadius: 12, border: `1.5px solid ${MINT_BORD}`,
                background: MINT_DIM, color: MINT,
                fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left",
              }}>
                🟢 Branche B — Faim biologique
                <span style={{ display: "block", fontSize: 11, color: "rgba(52,211,153,0.55)", marginTop: 3 }}>
                  calme, ancrage, conscience des saveurs
                </span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ── BRANCH EMOTIONAL ─────────────────────────────────────────── */}
        {status === "branch_emotional" && (
          <motion.div key="branch-e"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, zIndex: 1, textAlign: "center", padding: "0 32px" }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: "50%",
              background: ORANGE_DIM, border: `1.5px solid ${ORANGE_BORD}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <p style={{ margin: 0, fontSize: 15, color: TEXT_PRIMARY, lineHeight: 1.7 }}>
              Ton Jumeau entend ce que tu ressens.
            </p>
            <p style={{ margin: 0, fontSize: 14, color: TEXT_MUTED, lineHeight: 1.65 }}>
              Avant la prochaine bouchée — une respiration lente.
            </p>
          </motion.div>
        )}

        {/* ── BRANCH BIOLOGICAL ────────────────────────────────────────── */}
        {status === "branch_biological" && (
          <motion.div key="branch-b"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, zIndex: 1, textAlign: "center", padding: "0 32px" }}
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              style={{
                width: 52, height: 52, borderRadius: "50%",
                background: MINT_DIM, border: `1.5px solid ${MINT_BORD}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 20px ${MINT_GLOW}`,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={MINT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>
            <p style={{ margin: 0, fontSize: 15, color: TEXT_PRIMARY, lineHeight: 1.7 }}>
              Parfait. Ton corps a faim — c'est légitime.
            </p>
            <p style={{ margin: 0, fontSize: 14, color: TEXT_MUTED, lineHeight: 1.65 }}>
              Ancre-toi dans la texture et le goût.
            </p>
          </motion.div>
        )}

        {/* ── CLOTURE ───────────────────────────────────────────────────── */}
        {status === "cloture" && (
          <motion.div key="cloture"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, zIndex: 1, textAlign: "center", padding: "0 28px", maxWidth: 380, width: "100%" }}
          >
            {/* Badge résultat */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
              style={{
                width: 64, height: 64, borderRadius: "50%",
                background: exitMode === "victory" ? MINT_DIM : ORANGE_DIM,
                border: `2px solid ${exitMode === "victory" ? MINT_BORD : ORANGE_BORD}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 32px ${exitMode === "victory" ? MINT_GLOW : "rgba(251,146,60,0.35)"}`,
              }}
            >
              {exitMode === "victory" ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke={MINT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                  stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              )}
            </motion.div>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                width: "100%", background: MINT_DIM,
                border: `1px solid ${MINT_BORD}`, borderRadius: 16,
                padding: "16px 20px",
              }}
            >
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: 1.3, color: "rgba(52,211,153,0.6)", textTransform: "uppercase" }}>
                Résumé de la session
              </p>
              <p style={{ margin: 0, fontSize: 14, color: TEXT_MUTED, lineHeight: 1.65 }}>
                {biteCount} bouchée{biteCount > 1 ? "s" : ""} consciente{biteCount > 1 ? "s" : ""} ·{" "}
                {exitMode === "victory"
                  ? "Signal positif — repas ancré avec succès"
                  : exitMode === "moderate"
                  ? "Stabilisation partielle"
                  : "Session interrompue — suivi recommandé"}
              </p>
            </motion.div>

            {/* Message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
              style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: TEXT_PRIMARY }}
            >
              {exitMode === "victory"
                ? `Magnifique ${firstName}. Tu as posé le calme. Bon appétit.`
                : `${firstName}, tu as fait un effort réel. Ton Jumeau reste là si tu en as besoin.`}
            </motion.p>

            <motion.button
              onClick={handleTransition}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              style={{
                padding: "14px 36px", borderRadius: 16, border: "none",
                background: exitMode === "victory"
                  ? `linear-gradient(135deg, #10b981, #34d399)`
                  : `linear-gradient(135deg, #f97316, #fb923c)`,
                color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
                boxShadow: `0 4px 24px ${exitMode === "victory" ? MINT_GLOW : "rgba(251,146,60,0.35)"}`,
              }}
            >
              Continuer avec mon Jumeau →
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Onde verte (bas d'écran — toujours visible) ───────────────────── */}
      <div style={{
        paddingBottom: 36,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        zIndex: 1,
      }}>
        <MintWave
          active={waveActive}
          intensity={status === "listening" ? 1.4 : 0.85}
        />
        {status !== "cloture" && (
          <p style={{ margin: 0, fontSize: 10, color: TEXT_FADED, letterSpacing: 1.1, textTransform: "uppercase" }}>
            {status === "listening" ? "Ton Jumeau écoute" : "Jumeau Numérique · Présent"}
          </p>
        )}
      </div>
    </div>
  );
}
