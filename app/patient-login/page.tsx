"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function PatientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push("/chat");
    } catch {
      setError("Une erreur est survenue. Reessayez plus tard.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
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
            Mon espace nutrition
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#64748b" }}>
            Connectez-vous pour accéder à votre compagnon de suivi
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.fr"
              style={{
                display: "block", width: "100%", marginTop: 6,
                height: 48, borderRadius: 12,
                border: "1.5px solid #e2e8f0",
                padding: "0 16px", fontSize: 15, outline: "none",
                background: "#f8fafc", color: "#0f172a",
                boxSizing: "border-box", transition: "border-color 0.2s",
              }}
              onFocus={(e) => e.target.style.borderColor = "#10b981"}
              onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
            />
          </label>

          <label style={{ display: "block" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Mot de passe</span>
            <div style={{ position: "relative", marginTop: 6 }}>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                style={{
                  display: "block", width: "100%",
                  height: 48, borderRadius: 12,
                  border: "1.5px solid #e2e8f0",
                  padding: "0 44px 0 16px", fontSize: 15, outline: "none",
                  background: "#f8fafc", color: "#0f172a",
                  boxSizing: "border-box", transition: "border-color 0.2s",
                }}
                onFocus={(e) => e.target.style.borderColor = "#10b981"}
                onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute", right: 12, top: "50%",
                  transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "#94a3b8", padding: 0, display: "flex",
                }}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 20, height: 20 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: 20, height: 20 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "#ef4444" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", height: 48, marginTop: 8,
              borderRadius: 24,
              background: loading ? "#e2e8f0" : "linear-gradient(135deg, #34d399, #10b981)",
              border: "none",
              color: loading ? "#94a3b8" : "white",
              fontSize: 15, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 4px 14px rgba(16,185,129,0.35)",
              transition: "all 0.2s",
            }}
          >
            {loading ? "Connexion..." : "Accéder à mon espace"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#94a3b8" }}>
          Vous avez reçu un email d'invitation de votre praticien ?
          Consultez-le pour créer votre compte.
        </p>
      </div>
    </div>
  );
}
