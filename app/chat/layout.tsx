// Static splash — server-rendered HTML, visible instantly before React hydrates
export default function ChatLayout({ children }: { children: React.ReactNode }) {

  return (
    <>
      <style>{`
        @keyframes ss-pulse { 0%, 100% { box-shadow: 0 0 18px rgba(16,185,129,0.35), 0 0 36px rgba(16,185,129,0.12); } 50% { box-shadow: 0 0 28px rgba(16,185,129,0.6), 0 0 52px rgba(16,185,129,0.22); } }
        #static-splash-inner { animation: ss-pulse 2s ease-in-out infinite; }
      `}</style>

      {/* Splash statique — rendu serveur, visible dès le premier octet HTML */}
      <div
        id="static-splash"
        style={{
          position: "fixed", inset: 0, zIndex: 400,
          background: "#0b0f0d",
          display: "flex", alignItems: "center", justifyContent: "center",
          // La transition est utilisée par page.tsx pour faire disparaître
          // le splash via JS (opacity → 0) sans jamais monter un doublon React
          transition: "opacity 0.45s ease",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, transform: "translateY(-24px)" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Halo radial externe */}
            <div style={{ position: "absolute", top: -28, left: -28, right: -28, bottom: -28, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.16), transparent 60%)", pointerEvents: "none" }} />
            {/* Cercle pulsant + logo */}
            <div id="static-splash-inner" style={{ width: 88, height: 88, borderRadius: "50%", background: "transparent", border: "2px solid rgba(16,185,129,0.6)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <img src="/logo.png" alt="NutriTwin" style={{ width: 88, height: 88, padding: "16px", objectFit: "contain", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 24, letterSpacing: "-0.03em", color: "rgba(255,255,255,0.9)", fontWeight: 400 }}>
              Nutri<strong style={{ fontWeight: 800, color: "#10b981" }}>Twin</strong>
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
              Votre compagnon de suivi
            </span>
          </div>
        </div>
      </div>

      {children}
    </>
  );
}
