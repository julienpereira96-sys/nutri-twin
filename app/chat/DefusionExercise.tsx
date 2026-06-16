"use client";

/**
 * DefusionExercise — Défusion cognitive ACT (Niveau 1)
 *
 * Principe ACT : on ne débat pas avec la pensée, on change son statut.
 * La pensée devient un objet graphique (nuage) que le patient repousse physiquement.
 * Boucle max 3 nuages pour éviter la rumination.
 *
 * State machine :
 *   intro_live    → Gemini Live capture la phrase de crise à l'oral (stub Phase 1)
 *   cloud_display → La phrase matérialisée en nuage, consigne orale de swipe
 *   swiping       → Patient swipe le nuage vers le haut (drag-Y framer-motion)
 *   checkpoint    → Gemini demande si autre pensée ou si ça s'allège
 *   cloture       → Conclusion + injection chat + alerte victoire
 *
 * Phase 1 : coquille visuelle + state machine + gestes locaux + panneau simulation.
 * Phase 2 (à venir) : brancher les stubs Gemini Live WebSocket.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
} from "framer-motion";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BG_DEEP      = "#06030f";
const VIOLET       = "#8b5cf6";
const VIOLET_DIM   = "rgba(139,92,246,0.12)";
const VIOLET_GLOW  = "rgba(139,92,246,0.45)";
const VIOLET_BORD  = "rgba(139,92,246,0.30)";
const VIOLET_SOFT  = "rgba(139,92,246,0.18)";
const INDIGO       = "#6366f1";
const CLOUD_BG     = "rgba(88,40,180,0.22)";
const CLOUD_BORD   = "rgba(139,92,246,0.38)";
const TEXT_PRIMARY = "rgba(255,255,255,0.90)";
const TEXT_MUTED   = "rgba(255,255,255,0.40)";
const TEXT_FADED   = "rgba(255,255,255,0.18)";

const MAX_CLOUDS      = 3;
const EJECT_THRESHOLD = -280; // px : au-delà, le nuage est évacué

// ─── Types ─────────────────────────────────────────────────────────────────────
type Status =
  | "intro_live"
  | "cloud_display"
  | "swiping"
  | "checkpoint"
  | "cloture";

export interface DefusionExerciseProps {
  patientId: string;
  practitionerId: string;
  firstName: string;
  sosContext?: string;
  onTransitionToChat: (evacuatedThoughts: string[], closing: string) => void;
  onClose: () => void;
}

// ─── Composant Nuage ──────────────────────────────────────────────────────────
interface CloudProps {
  phrase: string;
  cloudIndex: number;
  onEjected: () => void;
}

function Cloud({ phrase, cloudIndex, onEjected }: CloudProps) {
  const y       = useMotionValue(0);
  const ejected = useRef(false);

  const scale   = useTransform(y, [0, EJECT_THRESHOLD], [1, 0.18]);
  const opacity = useTransform(y, [0, EJECT_THRESHOLD * 0.75], [1, 0]);
  const blurVal = useTransform(y, [0, EJECT_THRESHOLD], [0, 14]);
  const filter  = useTransform(blurVal, (v) => `blur(${v}px)`);
  const borderColor = useTransform(
    y,
    [0, EJECT_THRESHOLD * 0.5],
    [CLOUD_BORD, "rgba(103,232,249,0.55)"]
  );

  const handleDragEnd = useCallback(
    (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (ejected.current) return;
      if (y.get() < EJECT_THRESHOLD || info.velocity.y < -600) {
        ejected.current = true;
        void animate(y, -window.innerHeight, {
          duration: 0.32,
          ease: "easeOut",
        }).then(() => onEjected());
      } else {
        void animate(y, 0, { type: "spring", stiffness: 220, damping: 22 });
      }
    },
    [y, onEjected]
  );

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: -window.innerHeight * 0.88, bottom: 60 }}
      dragElastic={0.14}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      style={{
        y,
        scale,
        opacity,
        filter,
        borderColor,
        maxWidth: 340,
        width: "calc(100vw - 64px)",
        padding: "28px 30px",
        borderRadius: "52% 48% 44% 56% / 40% 44% 56% 60%",
        background: CLOUD_BG,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1.5px solid",
        boxShadow: `0 0 60px ${VIOLET_GLOW}, 0 0 120px rgba(139,92,246,0.10), inset 0 0 40px rgba(139,92,246,0.06)`,
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
      }}
      whileDrag={{ cursor: "grabbing" }}
    >
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1.6,
        color: "rgba(139,92,246,0.55)",
        textTransform: "uppercase",
      }}>
        Pensée {cloudIndex} / {MAX_CLOUDS}
      </span>

      <p style={{
        margin: 0,
        fontSize: 17,
        lineHeight: 1.65,
        color: TEXT_PRIMARY,
        textAlign: "center",
        fontStyle: "italic",
        fontWeight: 400,
      }}>
        « {phrase} »
      </p>

      <motion.span
        style={{ fontSize: 12, color: TEXT_MUTED }}
        animate={{ opacity: [0.7, 0.25, 0.7] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
      >
        ↑ Glisse vers le haut pour libérer
      </motion.span>
    </motion.div>
  );
}

// ─── Waveform violet ──────────────────────────────────────────────────────────
function VioletWave({ active }: { active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, height: 36 }}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <motion.div
          key={i}
          style={{ width: 3, borderRadius: 2, background: VIOLET }}
          animate={active
            ? { height: ["6px", `${12 + Math.sin(i * 0.9) * 14}px`, "6px"], opacity: [0.5, 0.85, 0.5] }
            : { height: "4px", opacity: 0.2 }
          }
          transition={active
            ? { repeat: Infinity, duration: 0.9 + i * 0.08, ease: "easeInOut", delay: i * 0.1 }
            : {}
          }
        />
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function DefusionExercise({
  patientId: _patientId,
  practitionerId: _practitionerId,
  firstName,
  sosContext: _sosContext = "",
  onTransitionToChat,
  onClose,
}: DefusionExerciseProps) {
  const [status, setStatus]             = useState<Status>("intro_live");
  const [currentPhrase, setCurrentPhrase] = useState("");
  const [cloudKey, setCloudKey]         = useState(0);
  const [cloudCount, setCloudCount]     = useState(0);
  const [evacuated, setEvacuated]       = useState<string[]>([]);
  const [waveActive, setWaveActive]     = useState(true);
  const [simInput, setSimInput]         = useState("");
  const [showSimPanel, setShowSimPanel] = useState(true);

  const onTransitionRef = useRef(onTransitionToChat);
  useEffect(() => { onTransitionRef.current = onTransitionToChat; }, [onTransitionToChat]);

  // ── Simulation : créer un nuage ─────────────────────────────────────────────
  const handleSimCreate = useCallback(() => {
    const phrase = simInput.trim();
    if (phrase.length < 3) return;
    setCurrentPhrase(phrase);
    setShowSimPanel(false);
    setWaveActive(false);
    setCloudKey((k) => k + 1);
    setStatus("cloud_display");
    setTimeout(() => setStatus("swiping"), 700);
  }, [simInput]);

  // ── Nuage éjecté ────────────────────────────────────────────────────────────
  const handleCloudEjected = useCallback(() => {
    setEvacuated((prev) => {
      const next = [...prev, currentPhrase];
      if (cloudCount + 1 >= MAX_CLOUDS) {
        setTimeout(() => setStatus("cloture"), 400);
      } else {
        setShowSimPanel(false);
        setTimeout(() => {
          setStatus("checkpoint");
          setWaveActive(true);
        }, 400);
      }
      return next;
    });
    setCloudCount((c) => c + 1);
  }, [currentPhrase, cloudCount]);

  // ── Checkpoint : nouvelle pensée ────────────────────────────────────────────
  const handleCheckpointNew = useCallback(() => {
    setSimInput("");
    setShowSimPanel(true);
    setWaveActive(false);
    setStatus("intro_live");
  }, []);

  // ── Checkpoint : on arrête ───────────────────────────────────────────────────
  const handleCheckpointStop = useCallback(() => {
    setWaveActive(false);
    setStatus("cloture");
  }, []);

  // ── Clôture → injection chat ─────────────────────────────────────────────────
  const handleTransition = useCallback(() => {
    const closing = evacuated.length > 0
      ? `Tu viens d'observer ${evacuated.length} pensée${evacuated.length > 1 ? "s" : ""} sans te laisser emporter. Ce sont des mots, pas des faits. Tu gardes le contrôle.`
      : "Tu viens de prendre de la distance avec ce qui t'oppressait. Ce sont des mots, pas des faits.";
    onTransitionRef.current(evacuated, closing);
  }, [evacuated]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 200,
      background: BG_DEEP,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes nebula-pulse {
          0%, 100% { transform: scale(1);    opacity: 0.18; }
          50%       { transform: scale(1.12); opacity: 0.26; }
        }
      `}</style>

      {/* ── Fond nébuleuse ────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: "-15%", left: "-10%",
          width: "55vw", height: "55vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(109,40,217,0.22) 0%, transparent 70%)",
          animation: "nebula-pulse 6s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "-15%", right: "-10%",
          width: "50vw", height: "50vw", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(79,70,229,0.18) 0%, transparent 70%)",
          animation: "nebula-pulse 8s ease-in-out infinite 1s",
        }} />
      </div>

      {/* ── Close ─────────────────────────────────────────────────────────── */}
      {status !== "cloture" && (
        <button onClick={onClose} aria-label="Fermer" style={{
          position: "absolute", top: 20, right: 20,
          width: 34, height: 34, borderRadius: "50%",
          background: VIOLET_DIM, border: `1px solid ${VIOLET_BORD}`,
          color: TEXT_MUTED, fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 10,
        }}>×</button>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          INTRO / CHECKPOINT + panneau simulation
      ═══════════════════════════════════════════════════════════════════════ */}
      {(status === "intro_live" || (status === "checkpoint" && showSimPanel)) && (
        <motion.div
          key="sim-panel"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 28, padding: "0 28px", width: "100%", maxWidth: 440,
            position: "relative", zIndex: 1,
          }}
        >
          <VioletWave active={waveActive} />

          <p style={{ margin: 0, fontSize: 14, color: TEXT_MUTED, letterSpacing: 0.4, textAlign: "center" }}>
            {status === "intro_live"
              ? `${firstName}, quelle est la phrase exacte qui prend toute la place dans ta tête ?`
              : "Le nuage est passé. Une autre pensée bloque encore ?"}
          </p>

          {/* Panneau simulation */}
          <div style={{
            width: "100%", background: VIOLET_DIM,
            border: `1px solid ${VIOLET_BORD}`, borderRadius: 18,
            padding: "20px 20px 16px", display: "flex", flexDirection: "column", gap: 14,
          }}>
            <p style={{
              margin: 0, fontSize: 11, fontWeight: 700,
              letterSpacing: 1.4, color: "rgba(139,92,246,0.6)", textTransform: "uppercase",
            }}>
              Simulation Phase 1 — phrase de crise
            </p>
            <textarea
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              placeholder={`Ex : "Je vais craquer ce soir, c'est sûr"`}
              rows={2}
              style={{
                width: "100%", background: "rgba(0,0,0,0.3)",
                border: `1.5px solid ${VIOLET_BORD}`, borderRadius: 12,
                padding: "12px 14px", color: TEXT_PRIMARY, fontSize: 15,
                resize: "none", outline: "none", fontFamily: "inherit",
                caretColor: VIOLET, boxSizing: "border-box",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSimCreate(); }
              }}
            />
            <button
              onClick={handleSimCreate}
              disabled={simInput.trim().length < 3}
              style={{
                padding: "12px 24px", borderRadius: 12, border: "none",
                background: simInput.trim().length >= 3
                  ? `linear-gradient(135deg, ${VIOLET}, ${INDIGO})`
                  : "rgba(255,255,255,0.04)",
                color: simInput.trim().length >= 3 ? "#fff" : TEXT_FADED,
                fontSize: 14, fontWeight: 700,
                cursor: simInput.trim().length >= 3 ? "pointer" : "default",
                transition: "all 0.2s",
              }}
            >
              Matérialiser le nuage →
            </button>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CHECKPOINT — choix (sans saisie)
      ═══════════════════════════════════════════════════════════════════════ */}
      {status === "checkpoint" && !showSimPanel && (
        <motion.div
          key="checkpoint"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 22, padding: "0 28px", width: "100%", maxWidth: 380,
            position: "relative", zIndex: 1,
          }}
        >
          <VioletWave active={true} />

          <p style={{ margin: 0, fontSize: 16, color: TEXT_PRIMARY, textAlign: "center", lineHeight: 1.7 }}>
            Le nuage est passé.
          </p>
          <p style={{ margin: 0, fontSize: 14, color: TEXT_MUTED, textAlign: "center", lineHeight: 1.65 }}>
            Est-ce qu'il y a une autre pensée qui bloque,<br />
            ou est-ce que ça commence à s'alléger ?
          </p>

          <div style={{ display: "flex", gap: 12, width: "100%", flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={handleCheckpointNew} style={{
              flex: "1 1 140px", padding: "13px 18px", borderRadius: 14,
              background: VIOLET_SOFT, border: `1.5px solid ${VIOLET_BORD}`,
              color: TEXT_PRIMARY, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
              Oui, une autre pensée
            </button>
            <button onClick={handleCheckpointStop} style={{
              flex: "1 1 140px", padding: "13px 18px", borderRadius: 14,
              background: `linear-gradient(135deg, ${VIOLET}, ${INDIGO})`,
              border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>
              Ça s'allège ✓
            </button>
          </div>

          {evacuated.length > 0 && (
            <div style={{
              width: "100%", padding: "14px 18px", borderRadius: 12,
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, color: TEXT_FADED, letterSpacing: 1.2, textTransform: "uppercase" }}>
                Nuages évacués
              </p>
              {evacuated.map((t, i) => (
                <p key={i} style={{ margin: "4px 0", fontSize: 13, color: TEXT_MUTED, fontStyle: "italic" }}>
                  « {t} »
                </p>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CLOUD_DISPLAY / SWIPING
      ═══════════════════════════════════════════════════════════════════════ */}
      {(status === "cloud_display" || status === "swiping") && (
        <div style={{
          position: "relative", zIndex: 2,
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {/* Hint contextuel */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: status === "swiping" ? 0.5 : 0 }}
            transition={{ delay: 0.6 }}
            style={{
              position: "absolute", top: "11%", margin: 0,
              fontSize: 13, color: TEXT_FADED, textAlign: "center", letterSpacing: 0.3,
            }}
          >
            Ce ne sont que des mots.
          </motion.p>

          <motion.div
            key={`cloud-${cloudKey}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 18 }}
          >
            <Cloud
              key={cloudKey}
              phrase={currentPhrase}
              cloudIndex={cloudCount + 1}
              onEjected={handleCloudEjected}
            />
          </motion.div>

          {/* Nuages restants */}
          {cloudCount < MAX_CLOUDS - 1 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.28 }}
              transition={{ delay: 1.4 }}
              style={{
                position: "absolute", bottom: "9%", margin: 0,
                fontSize: 12, color: TEXT_FADED, textAlign: "center",
              }}
            >
              {MAX_CLOUDS - cloudCount - 1} nuage{MAX_CLOUDS - cloudCount - 1 > 1 ? "s" : ""} encore possible{MAX_CLOUDS - cloudCount - 1 > 1 ? "s" : ""}
            </motion.p>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          CLOTURE
      ═══════════════════════════════════════════════════════════════════════ */}
      {status === "cloture" && (
        <motion.div
          key="cloture"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 24, padding: "0 28px", width: "100%", maxWidth: 420,
            position: "relative", zIndex: 1, textAlign: "center",
          }}
        >
          {/* Icône victoire */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
            style={{
              width: 60, height: 60, borderRadius: "50%",
              background: VIOLET_DIM, border: `2px solid ${VIOLET_BORD}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 32px ${VIOLET_GLOW}`,
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
              stroke={VIOLET} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </motion.div>

          {/* Liste des pensées évacuées */}
          {evacuated.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                width: "100%", background: VIOLET_DIM,
                border: `1px solid ${VIOLET_BORD}`, borderRadius: 16,
                padding: "16px 20px", textAlign: "left",
              }}
            >
              <p style={{
                margin: "0 0 10px", fontSize: 11, fontWeight: 700,
                letterSpacing: 1.3, color: "rgba(139,92,246,0.6)", textTransform: "uppercase",
              }}>
                Pensées observées et libérées
              </p>
              {evacuated.map((t, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.13 }}
                  style={{ margin: "5px 0", fontSize: 14, color: TEXT_MUTED, fontStyle: "italic", lineHeight: 1.55 }}
                >
                  « {t} »
                </motion.p>
              ))}
            </motion.div>
          )}

          {/* Message clôture */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: TEXT_PRIMARY }}
          >
            {evacuated.length > 0
              ? `Tu viens d'observer ${evacuated.length} pensée${evacuated.length > 1 ? "s" : ""} sans te laisser emporter. Ce sont des mots, pas des faits. Tu gardes le contrôle.`
              : "Tu viens de prendre de la distance avec ce qui t'oppressait. Ce sont des mots, pas des faits."}
          </motion.p>

          <motion.button
            onClick={handleTransition}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            style={{
              padding: "14px 36px", borderRadius: 16, border: "none",
              background: `linear-gradient(135deg, ${VIOLET}, ${INDIGO})`,
              color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
              boxShadow: `0 4px 24px ${VIOLET_GLOW}`,
            }}
          >
            Continuer avec mon Jumeau →
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
