"use client";

/**
 * MicConsentOverlay — Écran de consentement microphone.
 *
 * Affiché UNE SEULE FOIS (si micStatus === "prompt") avant le premier exercice
 * qui nécessite le microphone. Après que l'utilisateur ait accordé la permission,
 * le navigateur s'en souvient → cet écran ne réapparaîtra jamais.
 *
 * Positionné au z-index 299 (sous les exercices qui sont à 300).
 */

interface Props {
  /** Nom de l'exercice qui attend (ex: "L'exercice SOS") */
  exerciseName?: string;
  /** true si l'utilisateur a déjà refusé le dialog natif → instructions réglages */
  denied?: boolean;
  /** Appelé quand l'utilisateur clique "Commencer" */
  onStart: () => void;
  /** Appelé si l'utilisateur referme sans démarrer */
  onClose: () => void;
}

// Tokens design identiques aux exercices
const BG         = "#060810";
const ACCENT     = "#00e5b4";
const ACCENT_DIM = "rgba(0,229,180,0.08)";
const ACCENT_BRD = "rgba(0,229,180,0.20)";
const TEXT_PRI   = "rgba(255,255,255,0.90)";
const TEXT_SEC   = "rgba(255,255,255,0.55)";
const TEXT_MUT   = "rgba(255,255,255,0.32)";

function MicIcon({ size = 52 }: { size?: number }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Halo */}
      <circle cx="24" cy="24" r="23" stroke={ACCENT} strokeOpacity="0.12" strokeWidth="1.5" />
      {/* Corps du micro */}
      <rect x="17" y="9" width="14" height="20" rx="7" fill={ACCENT} fillOpacity="0.15" stroke={ACCENT} strokeWidth="1.5" />
      {/* Arc */}
      <path d="M11 26c0 7.18 5.82 13 13 13s13-5.82 13-13" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round"/>
      {/* Tige */}
      <line x1="24" y1="39" x2="24" y2="44" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" />
      {/* Pied */}
      <line x1="18" y1="44" x2="30" y2="44" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" />
      {/* Lignes intérieures micro */}
      <line x1="20" y1="19" x2="28" y2="19" stroke={ACCENT} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.6" />
      <line x1="20" y1="23" x2="28" y2="23" stroke={ACCENT} strokeWidth="1" strokeLinecap="round" strokeOpacity="0.6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function MicConsentOverlay({ exerciseName = "Cet exercice", denied = false, onStart, onClose }: Props) {
  return (
    <>
      <style>{`
        @keyframes mic-fade {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mic-consent-inner { animation: mic-fade 0.45s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,229,180,0); }
          50% { box-shadow: 0 0 0 14px rgba(0,229,180,0.08); }
        }
        .mic-icon-wrap { animation: mic-pulse 2.4s ease-in-out infinite; }
      `}</style>

      <div
        style={{
          position: "fixed", inset: 0, zIndex: 299,
          background: BG,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "32px 28px",
        }}
      >
        {/* Bouton fermer */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{
            position: "absolute", top: 18, right: 18,
            width: 38, height: 38, borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: TEXT_MUT, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <CloseIcon />
        </button>

        {/* Contenu centré */}
        <div
          className="mic-consent-inner"
          style={{
            maxWidth: 340,
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 0,
            textAlign: "center",
          }}
        >
          {/* Icône micro */}
          <div
            className="mic-icon-wrap"
            style={{
              width: 88, height: 88,
              borderRadius: "50%",
              background: "rgba(0,229,180,0.05)",
              border: "1px solid rgba(0,229,180,0.14)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 32,
            }}
          >
            <MicIcon size={52} />
          </div>

          {/* Titre */}
          <h2 style={{
            margin: "0 0 14px",
            fontSize: 22,
            fontWeight: 600,
            color: TEXT_PRI,
            letterSpacing: "-0.02em",
            lineHeight: 1.3,
          }}>
            {denied ? "Microphone bloqué" : "Active ton microphone"}
          </h2>

          {/* Corps — deux variantes selon l'état */}
          {denied ? (
            <>
              <p style={{ margin: "0 0 12px", fontSize: 15, color: TEXT_SEC, lineHeight: 1.7 }}>
                Tu as refusé l&apos;accès au microphone. Pour profiter pleinement de{" "}
                <span style={{ color: TEXT_PRI }}>{exerciseName}</span>, tu peux le réactiver
                directement dans les réglages de ton navigateur.
              </p>
              {/* Instructions iOS */}
              <div style={{
                width: "100%",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 14,
                padding: "14px 16px",
                marginBottom: 28,
                textAlign: "left",
              }}>
                <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: TEXT_MUT, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Sur iOS Safari
                </p>
                {[
                  "Réglages › Safari › Microphone",
                  "Trouve nutri-twin.vercel.app",
                  "Passe de « Refuser » à « Autoriser »",
                ].map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 2 ? 8 : 0 }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(0,229,180,0.1)", border: "1px solid rgba(0,229,180,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: ACCENT, flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 13, color: TEXT_SEC }}>{step}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 12px", fontSize: 15, color: TEXT_SEC, lineHeight: 1.7 }}>
                {exerciseName} t&apos;accompagne en temps réel grâce à ta voix. Quand ton navigateur
                te demande l&apos;accès, appuie sur{" "}
                <span style={{ color: TEXT_PRI, fontWeight: 600 }}>Autoriser</span>
                {" "}: l&apos;expérience sera bien plus riche.
              </p>
              <p style={{ margin: "0 0 36px", fontSize: 13, color: TEXT_MUT, lineHeight: 1.6 }}>
                Ton micro n&apos;est actif qu&apos;pendant l&apos;exercice. Aucune donnée audio n&apos;est stockée.
              </p>
            </>
          )}

          {/* CTA principal */}
          <button
            onClick={denied ? onClose : onStart}
            style={{
              width: "100%",
              padding: "15px 24px",
              borderRadius: 16,
              background: ACCENT_DIM,
              border: `1.5px solid ${ACCENT_BRD}`,
              color: ACCENT,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "0.02em",
              cursor: "pointer",
              marginBottom: 14,
              transition: "background 0.2s, border-color 0.2s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(0,229,180,0.14)";
              e.currentTarget.style.borderColor = "rgba(0,229,180,0.40)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = ACCENT_DIM;
              e.currentTarget.style.borderColor = ACCENT_BRD;
            }}
          >
            {denied ? "Fermer" : "Commencer l'exercice"}
          </button>

          {/* Lien skip — seulement si pas en mode denied */}
          {!denied && (
            <button
              onClick={onClose}
              style={{
                background: "none", border: "none",
                padding: "6px 8px",
                cursor: "pointer",
                fontSize: 13,
                color: TEXT_MUT,
              }}
            >
              Pas maintenant
            </button>
          )}
        </div>
      </div>
    </>
  );
}
