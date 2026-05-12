"use client";

import Link from "next/link";
import { Suspense } from "react";

function PaymentSuccessContent() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 500, width: "100%" }}>

        {/* Encadré unique */}
        <div style={{
          background: "rgba(16,185,129,0.05)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: 24,
          overflow: "hidden",
        }}>

          {/* Header dégradé */}
          <div style={{
            background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))",
            padding: "32px 28px 28px",
            borderBottom: "1px solid rgba(16,185,129,0.1)",
            textAlign: "center",
          }}>
            {/* Icône coche */}
            <div style={{
              width: 72, height: 72, borderRadius: 36,
              background: "linear-gradient(135deg, #6ee7b7, #10b981)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: "0 8px 30px rgba(16,185,129,0.4)",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 500, color: "#6ee7b7", letterSpacing: "0.05em" }}>
              Abonnement activé
            </p>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#10b981" }}>
              Paiement confirmé
            </h2>
          </div>

          {/* Corps */}
          <div style={{ padding: "28px" }}>

            {/* Prochaine étape */}
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#4b5563", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Prochaine étape
              </p>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "white", lineHeight: 1.3 }}>
                 La configuration de votre<br />Jumeau Numérique
              </h3>
            </div>

            {/* Phrase mise en avant */}
<div style={{
  background: "rgba(16,185,129,0.08)",
  border: "1px solid rgba(16,185,129,0.25)",
  borderRadius: 14,
  padding: "14px 18px",
  marginBottom: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
}}>
  <span style={{
    width: 8, height: 8, borderRadius: "50%",
    background: "#10b981", flexShrink: 0,
    boxShadow: "0 0 0 0 rgba(16,185,129,0.4)",
    animation: "pulse 2s infinite",
  }} />
  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#10b981", lineHeight: 1.7, textAlign: "center"}}>
    Vos réponses permettront à l'IA de reproduire votre manière de penser, conseiller et décider.
  </p>
</div>

<style>{`
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
    70% { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
    100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
  }
`}</style>


            {/* 3 points */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 50 }}>
              {[
                { emoji: "⏱️", label: "Temps estimé", desc: "15 minutes suffisent pour calibrer votre jumeau." },
                { emoji: "🎯", label: "Répondez naturellement", desc: "Comme si vous parliez à un confrère de confiance." },
                { emoji: "🧬", label: "Plus vous êtes précis", desc: "Meilleur sera le résultat final." },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15,
                  }}>{item.emoji}</div>
                  <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6, textAlign: "left" }}>
                    <strong style={{ color: "white" }}>{item.label}</strong> — {item.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Bouton */}
            <Link
              href="/onboarding"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: 52,
                borderRadius: 12,
                background: "linear-gradient(135deg, #34d399, #10b981)",
                color: "black",
                fontWeight: 700,
                fontSize: 15,
                textDecoration: "none",
                cursor: "pointer",
                transition: "all 0.2s",
                boxSizing: "border-box",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 0 0 1px rgba(16,185,129,0.5), 0 8px 30px rgba(16,185,129,0.4)";
                e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0) scale(1)";
              }}
            >
              Commencer la programmation →
            </Link>

          </div>
        </div>

      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh", background: "#0a0a0a",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <p style={{ color: "#10b981", fontSize: 16 }}>Chargement...</p>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
