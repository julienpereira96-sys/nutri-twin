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
      <div style={{ textAlign: "center", maxWidth: 520, width: "100%" }}>

        {/* Icône succès */}
        <div style={{
          width: 72, height: 72, borderRadius: 36,
          background: "linear-gradient(135deg, #6ee7b7, #10b981)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, margin: "0 auto 12px",
          boxShadow: "0 8px 30px rgba(16,185,129,0.4)",
        }}>
          ✓
        </div>

        {/* Paiement confirmé — gros et proche de la coche */}
        <p style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 800, color: "#10b981" }}>
          Paiement confirmé
        </p>

        {/* Titre calibrage — centré avec emoji à gauche des deux lignes */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 28 }}>
          <span style={{ fontSize: 28 }}>🧬</span>
          <div style={{ textAlign: "left" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "white", lineHeight: 1.2 }}>
              Calibrage de votre<br />Jumeau Numérique
            </h1>
          </div>
        </div>

        {/* Bloc conseil */}
        <div style={{
          background: "rgba(16,185,129,0.05)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: 20,
          padding: "28px",
          marginBottom: 20,
          textAlign: "center",
        }}>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#94a3b8", lineHeight: 1.8, textAlign: "center" }}>
            Le succès de votre jumeau repose sur la profondeur de son empreinte. Prenez ce moment pour poser les fondations de votre double numérique.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}>
            {[
              { label: "Immersion totale", desc: "Accordez-vous 15 minutes de calme pour une fidélité maximale." },
              { label: "Rigueur scientifique", desc: "Répondez avec la précision que vous exigeriez d'un confrère." },
              { label: "Nuances", desc: "Plus vos réponses sont détaillées, plus votre jumeau capture votre expertise unique." },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                  background: "rgba(16,185,129,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: "#10b981", fontWeight: 700, marginTop: 2,
                }}>✓</div>
                <p style={{ margin: 0, fontSize: 14, color: "#d1d5db", lineHeight: 1.6 }}>
                  <strong style={{ color: "white" }}>{item.label}</strong> — {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bouton en dehors de l'encadré */}
        <style>{`
          @keyframes scanLine {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .calibrage-btn {
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 54px;
            border-radius: 14px;
            background: linear-gradient(135deg, #34d399, #10b981);
            color: black;
            font-weight: 700;
            font-size: 15px;
            text-decoration: none;
            box-shadow: 0 0 20px rgba(16,185,129,0.4), 0 0 40px rgba(16,185,129,0.15);
            transition: box-shadow 0.3s ease, transform 0.2s ease;
            border: none;
            cursor: pointer;
          }
          .calibrage-btn:hover {
            box-shadow: 0 0 30px rgba(16,185,129,0.6), 0 0 60px rgba(16,185,129,0.25);
            transform: translateY(-1px);
          }
          .calibrage-btn:active {
            transform: scale(0.98);
          }
          .calibrage-btn::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 40%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
            animation: scanLine 2.5s ease-in-out infinite;
          }
        `}</style>

        <Link href="/onboarding" className="calibrage-btn">
          Initialiser le calibrage →
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
