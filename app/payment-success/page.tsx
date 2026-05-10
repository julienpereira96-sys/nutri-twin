"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = () => {
      window.history.pushState(null, "", window.location.href);
    };
    return () => {
      window.onpopstate = null;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = "/onboarding";
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
      <div style={{ textAlign: "center", maxWidth: 520 }}>

        {/* Icône succès */}
        <div style={{
          width: 80, height: 80, borderRadius: 40,
          background: "linear-gradient(135deg, #6ee7b7, #10b981)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, margin: "0 auto 24px",
          boxShadow: "0 8px 30px rgba(16,185,129,0.4)",
        }}>
          ✓
        </div>

        {/* Titre */}
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "white", margin: "0 0 8px" }}>
          Paiement confirmé !
        </h1>
        <p style={{ fontSize: 15, color: "#10b981", fontWeight: 600, margin: "0 0 32px" }}>
          14 jours gratuits — aucun débit aujourd'hui
        </p>

        {/* Bloc conseil */}
        <div style={{
          background: "rgba(16,185,129,0.05)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: 20,
          padding: "24px 28px",
          marginBottom: 28,
          textAlign: "left",
        }}>
          <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "white" }}>
            🧬 Votre jumeau sera aussi précis que vos réponses
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "#94a3b8", lineHeight: 1.7 }}>
            Vous allez configurer votre jumeau numérique. C'est l'étape la plus importante — prenez le temps de bien le faire.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "Prévoyez 15 à 20 minutes sans interruption",
              "Répondez comme si vous parliez à un confrère",
              "Plus vous êtes précis, plus votre jumeau vous ressemble vraiment",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 10, flexShrink: 0,
                  background: "rgba(16,185,129,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "#10b981", fontWeight: 700, marginTop: 1,
                }}>✓</div>
                <p style={{ margin: 0, fontSize: 14, color: "#d1d5db", lineHeight: 1.5 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Countdown */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16,
          padding: "16px 24px",
          marginBottom: 24,
        }}>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Redirection automatique dans <strong style={{ color: "#10b981" }}>{countdown}s</strong>
          </p>
        </div>

        {/* Bouton */}
        <Link
          href="/onboarding"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 52,
            borderRadius: 26,
            background: "linear-gradient(135deg, #34d399, #10b981)",
            color: "black",
            fontWeight: 700,
            fontSize: 15,
            padding: "0 32px",
            textDecoration: "none",
            boxShadow: "0 4px 16px rgba(16,185,129,0.4)",
          }}
        >
          Créer mon jumeau numérique →
        </Link>
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
