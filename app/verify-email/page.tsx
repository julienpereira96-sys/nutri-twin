"use client";

import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{
          width: 80, height: 80, borderRadius: 40,
          background: "linear-gradient(135deg, #6ee7b7, #10b981)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, margin: "0 auto 24px",
          boxShadow: "0 8px 30px rgba(16,185,129,0.4)",
        }}>
          ✉
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "white", margin: "0 0 12px" }}>
          Vérifiez votre email
        </h1>
        <p style={{ fontSize: 16, color: "#10b981", fontWeight: 600, margin: "0 0 16px" }}>
          Paiement confirmé ! 🎉
        </p>
        <p style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.7, margin: "0 0 8px" }}>
          Un email de confirmation vous a été envoyé.
        </p>
        <p style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.7, margin: "0 0 32px" }}>
          Cliquez sur le lien pour accéder à votre espace et configurer votre jumeau numérique.
        </p>
        <div style={{
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: 16, padding: "20px 24px", marginBottom: 32,
        }}>
          <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
            Vous n'avez pas reçu l'email ?
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#64748b" }}>
            Vérifiez vos spams ou contactez-nous à{" "}
            <span style={{ color: "#10b981" }}>hello@nutri-twin.com</span>
          </p>
        </div>
        <Link
          href="/onboarding"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            height: 52, borderRadius: 26,
            background: "linear-gradient(135deg, #34d399, #10b981)",
            color: "black", fontWeight: 600, fontSize: 15,
            padding: "0 32px", textDecoration: "none",
            boxShadow: "0 4px 16px rgba(16,185,129,0.4)",
          }}
        >
          Accéder à mon espace →
        </Link>
      </div>
    </div>
  );
}
