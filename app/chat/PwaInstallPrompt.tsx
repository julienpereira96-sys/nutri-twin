"use client";

/**
 * PwaInstallPrompt — Bottom-sheet discrète invitant le patient à installer NutriTwin en PWA.
 *
 * Comportement :
 *   - Si l'app tourne déjà en standalone → null immédiat
 *   - Si l'user a fermé il y a moins de 14 jours → null
 *   - iOS  : instructions visuelles avec icône de partage native
 *   - Android : écoute beforeinstallprompt, bouton d'installation natif
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
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 jours

// Design tokens identiques à page.tsx
const BG = "#020617";
const ACCENT = "#10b981";
const ACCENT_BORDER = "rgba(16,185,129,0.22)";
const TEXT_PRIMARY = "rgba(255,255,255,0.92)";
const TEXT_MUTED = "rgba(255,255,255,0.45)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAlreadyStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS
    !!(navigator as Navigator & { standalone?: boolean }).standalone
  );
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function saveDismissal(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // localStorage indisponible (mode privé strict) — on ignore
  }
}

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "unknown";
}

// ─── Icônes SVG inline ────────────────────────────────────────────────────────

/** Icône de partage iOS (carré + flèche vers le haut) */
function IconIosShare({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 6L12 2l4 4" />
      <line x1="12" y1="2" x2="12" y2="15" />
      <path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8" />
    </svg>
  );
}

/** Icône maison / écran d'accueil */
function IconHome({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

/** Icône téléchargement / installer */
function IconDownload({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

/** Croix de fermeture */
function IconClose({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** Icône bouclier — accès rapide SOS */
function IconShield({ size = 28, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" opacity="0.7" />
    </svg>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>("unknown");
  const [animOut, setAnimOut] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  // ─ Initialisation
  useEffect(() => {
    // Abandon immédiat si déjà standalone ou déjà fermé récemment
    if (isAlreadyStandalone() || wasDismissedRecently()) return;

    const plat = detectPlatform();
    setPlatform(plat);

    if (plat === "ios") {
      // Sur iOS Safari, pas d'événement natif : on affiche directement
      const timer = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(timer);
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

    // Platform inconnue → on n'affiche rien
  }, []);

  // ─ Fermeture (avec animation)
  const dismiss = (permanent = false) => {
    setAnimOut(true);
    if (permanent) saveDismissal();
    setTimeout(() => setVisible(false), 320);
  };

  // ─ Installation Android
  const handleAndroidInstall = async () => {
    const deferred = deferredRef.current;
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferredRef.current = null;
    if (outcome === "accepted") {
      saveDismissal();
    }
    dismiss(false);
  };

  if (!visible) return null;

  return (
    <>
      {/* ── Styles d'animation ── */}
      <style>{`
        @keyframes pwa-slide-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pwa-slide-down {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(24px); }
        }
        .pwa-sheet {
          animation: pwa-slide-up 0.34s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .pwa-sheet.pwa-out {
          animation: pwa-slide-down 0.28s ease-in forwards;
        }
      `}</style>

      {/* ── Card bottom-sheet ── */}
      <div
        className={`pwa-sheet${animOut ? " pwa-out" : ""}`}
        style={{
          position: "fixed",
          bottom: 80,           // au-dessus de l'input bar
          left: 12,
          right: 12,
          zIndex: 9999,
          background: BG,
          border: `1px solid ${ACCENT_BORDER}`,
          borderRadius: 20,
          padding: "16px 18px 18px",
          boxShadow: "0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(16,185,129,0.06)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
        role="dialog"
        aria-label="Installer NutriTwin sur ton écran d'accueil"
      >
        {/* ── En-tête ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
          {/* Icône bouclier */}
          <div
            style={{
              flexShrink: 0,
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconShield size={26} color={ACCENT} />
          </div>

          {/* Texte */}
          <div style={{ flex: 1, paddingTop: 2 }}>
            <p
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: TEXT_PRIMARY,
                letterSpacing: "-0.01em",
                lineHeight: 1.3,
                marginBottom: 5,
              }}
            >
              Accès instantané SOS
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: TEXT_MUTED,
                lineHeight: 1.5,
              }}
            >
              Ajoute NutriTwin à ton écran d&apos;accueil pour lancer tes exercices
              thérapeutiques immédiatement en cas de crise.
            </p>
          </div>

          {/* Bouton fermer */}
          <button
            onClick={() => dismiss(true)}
            aria-label="Fermer"
            style={{
              flexShrink: 0,
              background: "none",
              border: "none",
              padding: 4,
              cursor: "pointer",
              color: TEXT_MUTED,
              lineHeight: 0,
              marginTop: -2,
            }}
          >
            <IconClose size={16} color={TEXT_MUTED} />
          </button>
        </div>

        {/* ── Corps — iOS ── */}
        {platform === "ios" && (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 14,
            }}
          >
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 12,
                color: TEXT_MUTED,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Comment faire
            </p>

            {/* Étape 1 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IconIosShare size={17} color={ACCENT} />
              </div>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.4 }}>
                Appuie sur l&apos;icône{" "}
                <span style={{ color: ACCENT, fontWeight: 600 }}>Partager</span>{" "}
                en bas de Safari
              </p>
            </div>

            {/* Étape 2 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IconHome size={16} color={ACCENT} />
              </div>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.4 }}>
                Sélectionne{" "}
                <span style={{ color: ACCENT, fontWeight: 600 }}>
                  &laquo;&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;&raquo;
                </span>
              </p>
            </div>
          </div>
        )}

        {/* ── Corps — Android ── */}
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
            <IconDownload size={17} color={ACCENT} />
            Installer l&apos;application
          </button>
        )}

        {/* ── Pied — lien "Plus tard" ── */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            onClick={() => dismiss(true)}
            style={{
              background: "none",
              border: "none",
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: 12,
              color: TEXT_MUTED,
              letterSpacing: "0.01em",
            }}
          >
            Plus tard
          </button>
        </div>
      </div>
    </>
  );
}
