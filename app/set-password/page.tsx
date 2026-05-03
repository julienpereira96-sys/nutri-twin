"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 20, height: 20 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 20, height: 20 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
    if (!firstName.trim() || !lastName.trim()) {
      setError("Veuillez renseigner votre prénom et nom.");
      return;
    }
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

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await fetch("/api/create-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: user.email,
        }),
      });
    }

    router.push("/chat");
  };

  const inputStyle = {
    display: "block", width: "100%", marginTop: 6,
    height: 48, borderRadius: 12,
    border: "1.5px solid #e2e8f0",
    padding: "0 44px 0 16px", fontSize: 15, outline: "none",
    background: "#f8fafc", color: "#0f172a",
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s",
  };

  const eyeButtonStyle = {
    position: "absolute" as const,
    right: 12, top: "50%", transform: "translateY(-50%)",
    background: "none", border: "none", cursor: "pointer",
    color: "#94a3b8", padding: 0, display: "flex",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#f8fafc",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        background: "white", borderRadius: 20, padding: 32,
        width: "100%", maxWidth: 420,
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.06)",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 28,
            background: "linear-gradient(135deg, #6ee7b7, #10b981)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, margin: "0 auto 16px",
            boxShadow: "0 4px 14px rgba(16,185,129,0.3)",
          }}>🌿</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
            Bienvenue sur NutriTwin
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b" }}>
            Quelques informations pour personnaliser votre espace
          </p>
        </div>

        {!ready ? (
          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
            Vérification de votre invitation...
          </p>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Prénom</span>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ilona"
                    style={{ ...inputStyle, padding: "0 16px" }}
                    onFocus={(e) => e.target.style.borderColor = "#10b981"}
                    onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                  />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Nom</span>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dupont"
                    style={{ ...inputStyle, padding: "0 16px" }}
                    onFocus={(e) => e.target.style.borderColor = "#10b981"}
                    onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                  />
                </label>
              </div>

              <label style={{ display: "block" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Mot de passe</span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = "#10b981"}
                    onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={eyeButtonStyle}>
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </label>

              <label style={{ display: "block" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Confirmer le mot de passe</span>
                <div style={{ position: "relative" }}>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Répétez votre mot de passe"
                    onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = "#10b981"}
                    onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={eyeButtonStyle}>
                    {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </label>
            </div>

            {error && (
              <p style={{ margin: "12px 0 0", fontSize: 13, color: "#ef4444" }}>{error}</p>
            )}

            <button
              onClick={() => void handleSubmit()}
              disabled={loading || !password || !confirm || !firstName || !lastName}
              style={{
                width: "100%", height: 48, marginTop: 20,
                borderRadius: 24,
                background: loading || !password || !confirm || !firstName || !lastName
                  ? "#e2e8f0"
                  : "linear-gradient(135deg, #34d399, #10b981)",
                border: "none",
                color: loading || !password || !confirm || !firstName || !lastName ? "#94a3b8" : "white",
                fontSize: 15, fontWeight: 600,
                cursor: loading || !password || !confirm || !firstName || !lastName ? "not-allowed" : "pointer",
                boxShadow: loading || !password || !confirm || !firstName || !lastName
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
