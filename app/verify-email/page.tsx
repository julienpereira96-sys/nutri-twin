"use client";

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
          ✉️
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: "white", margin: "0 0 12px" }}>
          Confirmez votre email
        </h1>

        <p style={{ fontSize: 16, color: "#10b981", fontWeight: 600, margin: "0 0 24px" }}>
          Paiement confirmé ! 🎉
        </p>

        <p style={{ fontSize: 15, color: "#e2e8f0", lineHeight: 1.7, margin: "0 0 8px" }}>
          Un email de confirmation vous a été envoyé.
        </p>
        <p style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.7, margin: "0 0 32px" }}>
          Cliquez sur le lien dans cet email pour accéder à votre espace et configurer votre jumeau numérique.
        </p>

        <div style={{
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: 16, padding: "24px",
          marginBottom: 24,
        }}>
          <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>
            📬 Vérifiez votre boîte mail
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
            L'email peut prendre quelques minutes à arriver.
            Pensez à vérifier vos spams.
          </p>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, padding: "20px 24px",
        }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "#64748b" }}>
            Vous n'avez pas reçu l'email ?
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Contactez-nous à{" "}
            <span style={{ color: "#10b981" }}>hello@nutri-twin.com</span>
          </p>
        </div>

        <p style={{ marginTop: 24, fontSize: 13, color: "#475569" }}>
          Une fois confirmé, vous serez automatiquement redirigé vers votre espace.
        </p>
      </div>
    </div>
  );
}
