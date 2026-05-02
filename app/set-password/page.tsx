"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
  }, []);

  const handleSubmit = async () => {
    if (!password || password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setError("Minimum 8 caractères.");
      return;
    }
    setLoading(true);
    setError("");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push("/chat");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "white",
        borderRadius: 20,
        padding: 32,
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.06)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 28,
            background: "linear-gradient(135deg, #6ee7b7, #10b981)",
            display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 26,
            margin: "0 auto 16px",
            boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
          }}>🌿</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
            Bienvenue sur NutriTwin
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b" }}>
            Créez votre mot de passe pour accéder à votre espace
          </p>
        </div>

        {!ready ? (
          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            Vérification de votre invitation...
          </p>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "block" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Mot de passe
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  style={{
                    display: "block", width: "100%", marginTop: 6,
                    height: 48, borderRadius: 12,
                    border: "1.5px solid #e2e8f0",
                    padding: "0 16px", fontSize: 15, outline: "none",
                    background: "#f8fafc", color: "#0f172a",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#10b981"}
                  onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                />
              </label>
              <label style={{ display: "block" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Confirmer le mot de passe
                </span>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Répétez votre mot de passe"
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
                  style={{
                    display: "block", width: "100%", marginTop: 6,
                    height: 48, borderRadius: 12,
                    border: "1.5px solid #e2e8f0",
                    padding: "0 16px", fontSize: 15, outline: "none",
                    background: "#f8fafc", color: "#0f172a",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#10b981"}
                  onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                />
              </label>
            </div>

            {error && (
              <p style={{ margin: "12px 0 0", fontSize: 13, color: "#ef4444" }}>{error}</p>
            )}

            <button
              onClick={() => void handleSubmit()}
              disabled={loading || !password || !confirm}
              style={{
                width: "100%", height: 48, marginTop: 20,
                borderRadius: 24,
                background: loading || !password || !confirm
                  ? "#e2e8f0"
                  : "linear-gradient(135deg, #34d399, #10b981)",
                border: "none",
                color: loading || !password || !confirm ? "#94a3b8" : "white",
                fontSize: 15, fontWeight: 600,
                cursor: loading || !password || !confirm ? "not-allowed" : "pointer",
                boxShadow: loading || !password || !confirm
                  ? "none" : "0 4px 14px rgba(16,185,129,0.35)",
                transition: "all 0.2s",
              }}
            >
              {loading ? "Création..." : "Accéder à mon espace"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
