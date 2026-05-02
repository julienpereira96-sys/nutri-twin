"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "pro";
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = "/signup";
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const planNames: Record<string, string> = {
    essentiel: "Essentiel",
    pro: "Pro",
    cabinet: "Cabinet",
  };

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
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 40,
          background: "linear-gradient(135deg, #6ee7b7, #10b981)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, margin: "0 auto 24px",
          boxShadow: "0 8px 30px rgba(16,185,129,0.4)",
        }}>
          ✓
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "white", margin: "0 0 12px" }}>
          Paiement confirmé !
        </h1>
        <p style={{ fontSize: 16, color: "#10b981", fontWeight: 600, margin: "0 0 8px" }}>
          Plan {planNames[plan] ?? "Pro"} — 14 jours gratuits
        </p>
        <p style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.7, margin: "0 0 32px" }}>
          Bienvenue dans NutriTwin ! Vous allez maintenant créer votre compte
          et configurer votre jumeau numérique.
        </p>
        <div style={{
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: 16,
          padding: "20px 24px",
          marginBottom: 32,
        }}>
          <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
            Redirection automatique dans
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 48, fontWeight: 700, color: "#10b981" }}>
            {countdown}
          </p>
        </div>
        <Link
          href="/signup"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 52,
            borderRadius: 26,
            background: "linear-gradient(135deg, #34d399, #10b981)",
            color: "black",
            fontWeight: 600,
            fontSize: 15,
            padding: "0 32px",
            textDecoration: "none",
            boxShadow: "0 4px 16px rgba(16,185,129,0.4)",
          }}
        >
          Créer mon compte maintenant →
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
