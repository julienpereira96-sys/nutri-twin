"use client";

/**
 * PwaInstallPrompt — Carte de bienvenue inline invitant le patient à installer NutriTwin en PWA.
 *
 * Rendu inline dans l'écran d'accueil (!hasMessages), pas de position:fixed.
 * Comportement :
 *   - Si l'app tourne déjà en standalone → null immédiat
 *   - Si l'user a fermé il y a moins de 14 jours → null
 *   - iOS  : 3 étapes corrigées (⋯ → Partager → Sur l'écran d'accueil)
 *   - Android : beforeinstallprompt → bouton d'installation natif en un clic
 *   - Desktop (unknown) → null
 */

import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = "ios" | "android" | "unknown";

/** Événement natif Chrome/Android — non typé dans lib.dom.d.ts */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "nutritwin_pwa_prompt_dismissed";
// Suppression permanente — si l'utilisateur a refusé, on ne le re-sollicite jamais.
// (On utilise quand même un TTL symbolique de 10 ans pour rester compatible avec
//  la logique Date.now() existante, sans casser localStorage sur un éventuel reset.)
const DISMISS_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000; // ≈ permanent

const ACCENT       = "#10b981";
const ACCENT_BORDER = "rgba(16,185,129,0.22)";
const TEXT_PRIMARY = "rgba(255,255,255,0.92)";
const TEXT_MUTED   = "rgba(255,255,255,0.42)";
const TEXT_SEC     = "rgba(255,255,255,0.65)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAlreadyStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(navigator as Navigator & { standalone?: boolean }).standalone
  );
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return Date.now() - parseInt(raw, 10) < DISMISS_TTL_MS;
  } catch { return false; }
}

function saveDismissal(): void {
  try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "unknown";
}

// ─── Icônes SVG ──────────────────────────────────────────────────────────────

function IconClose({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** ··· trois points horizontaux (menu Safari) */
function IconDots({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <circle cx="5"  cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

/** Flèche partage iOS */
function IconShare({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6L12 2l4 4" />
      <line x1="12" y1="2" x2="12" y2="15" />
      <path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8" />
    </svg>
  );
}

/** Maison / écran d'accueil */
function IconHome({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

/** Téléchargement / installer Android */
function IconDownload({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

/** Smartphone avec rayons */
function IconApp({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth={2} />
    </svg>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PwaInstallPrompt() {
  const [visible,   setVisible]   = useState(false);
  const [platform,  setPlatform]  = useState<Platform>("unknown");
  const [dismissed, setDismissed] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isAlreadyStandalone() || wasDismissedRecently()) return;

    const plat = detectPlatform();
    if (plat === "unknown") return;      // Desktop → on n'affiche rien

    setPlatform(plat);

    if (plat === "ios") {
      setVisible(true);
      return;
    }

    if (plat === "android") {
      const handler = (e: Event) => {
        e.preventDefault();
        deferredRef.current = e as BeforeInstallPromptEvent;
        setVisible(true);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  const dismiss = () => {
    saveDismissal();
    setDismissed(true);
  };

  const handleAndroidInstall = async () => {
    const deferred = deferredRef.current;
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferredRef.current = null;
    if (outcome === "accepted") saveDismissal();
    setDismissed(true);
  };

  if (!visible || dismissed) return null;

  // ── Étapes iOS ──
  const iosSteps = [
    {
      icon: <IconDots size={17} color={ACCENT} />,
      label: (
        <>
          Appuie sur <span style={{ fontWeight: 700, color: TEXT_PRIMARY }}>···</span> en bas à droite dans Safari
        </>
      ),
    },
    {
      icon: <IconShare size={17} color={ACCENT} />,
      label: (
        <>
          Appuie sur <span style={{ fontWeight: 600, color: ACCENT }}>Partager</span>
        </>
      ),
    },
    {
      icon: <IconHome size={16} color={ACCENT} />,
      label: (
        <>
          Sélectionne{" "}
          <span style={{ fontWeight: 600, color: ACCENT }}>Sur l&apos;écran d&apos;accueil</span>
          <br />
          <span style={{ fontSize: 11, color: TEXT_MUTED }}>
            Si tu ne le vois pas, appuie d&apos;abord sur « En voir plus »
          </span>
        </>
      ),
    },
  ];

  return (
    <>
      <style>{`
        @keyframes pwa-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pwa-card { animation: pwa-fade-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
      `}</style>

      <div
        className="pwa-card"
        style={{
          marginTop: 32,
          width: "100%",
          maxWidth: 480,
          background: "rgba(16,185,129,0.03)",
          border: `1px solid ${ACCENT_BORDER}`,
          borderRadius: 20,
          padding: "18px 18px 14px",
          textAlign: "left",
        }}
        role="complementary"
        aria-label="Installer NutriTwin sur l'écran d'accueil"
      >
        {/* ── En-tête ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconApp size={20} color={ACCENT} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: "-0.01em" }}>
              Une expérience plus fluide
            </p>
            <p style={{ margin: 0, fontSize: 11.5, color: TEXT_MUTED, lineHeight: 1.4 }}>
              Ajoute NutriTwin à ton écran d&apos;accueil
            </p>
          </div>
          <button
            onClick={dismiss}
            aria-label="Fermer"
            style={{
              flexShrink: 0, background: "none", border: "none",
              padding: 6, cursor: "pointer", color: TEXT_MUTED, lineHeight: 0,
            }}
          >
            <IconClose size={13} color={TEXT_MUTED} />
          </button>
        </div>

        {/* ── Description ── */}
        <p style={{
          margin: "0 0 16px",
          fontSize: 13,
          color: TEXT_SEC,
          lineHeight: 1.65,
        }}>
          En installant l&apos;application, tu accèdes à tes exercices en un seul geste depuis ton
          écran d&apos;accueil — sans passer par un navigateur, même en pleine crise.
        </p>

        {/* ── Corps iOS : 3 étapes ── */}
        {platform === "ios" && (
          <div style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            padding: "13px 14px 12px",
            marginBottom: 14,
          }}>
            <p style={{
              margin: "0 0 12px",
              fontSize: 11,
              color: TEXT_MUTED,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}>
              3 étapes dans Safari
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {iosSteps.map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  {/* Numéro */}
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: ACCENT,
                  }}>
                    {i + 1}
                  </div>
                  {/* Icône */}
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.14)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginTop: 2,
                  }}>
                    {step.icon}
                  </div>
                  {/* Texte */}
                  <p style={{ margin: 0, fontSize: 13, color: TEXT_SEC, lineHeight: 1.5 }}>
                    {step.label}
                  </p>
                </div>
              ))}
            </div>

            <p style={{
              margin: "14px 0 0",
              fontSize: 11,
              color: TEXT_MUTED,
              fontStyle: "italic",
              lineHeight: 1.5,
            }}>
              Sur iOS, Apple ne permet pas d&apos;automatiser cette installation — ces 3 étapes
              sont incontournables. Ça prend 10 secondes&nbsp;!
            </p>
          </div>
        )}

        {/* ── Corps Android : bouton natif ── */}
        {platform === "android" && (
          <button
            onClick={handleAndroidInstall}
            style={{
              width: "100%",
              padding: "12px 18px",
              borderRadius: 12,
              border: `1px solid ${ACCENT_BORDER}`,
              background: "rgba(16,185,129,0.1)",
              color: ACCENT,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginBottom: 12,
              letterSpacing: "-0.01em",
            }}
          >
            <IconDownload size={16} color={ACCENT} />
            Installer NutriTwin
          </button>
        )}

        {/* ── Pied ── */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={dismiss}
            style={{
              background: "none", border: "none", padding: "4px 8px",
              cursor: "pointer", fontSize: 12, color: TEXT_MUTED, letterSpacing: "0.01em",
            }}
          >
            Continuer dans le navigateur
          </button>
        </div>
      </div>
    </>
  );
}
