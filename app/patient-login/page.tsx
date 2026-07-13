"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function PatientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "session_expired") setSessionExpired(true);
    if (params.get("reason") === "set_password_done") {
      setSessionExpired(false);
      setError("Votre mot de passe a bien été créé. Connectez-vous pour accéder à votre espace.");
    }
  }, []);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) {
        if (signInError.message.includes("Invalid login credentials") || signInError.message.includes("invalid_credentials") || signInError.code === "invalid_credentials") {
          // Vérifier si le compte existe mais n'a pas de mot de passe défini
          const checkRes = await fetch("/api/check-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim() }),
          });
          const checkData = await checkRes.json() as { exists?: boolean; isConfirmed?: boolean };
          if (checkData.exists && !checkData.isConfirmed) {
            setError("Vous n'avez pas encore activé votre compte. Consultez l'email d'invitation envoyé par votre praticien.");
          } else {
            setError("Email ou mot de passe incorrect. Vérifiez vos informations.");
          }
        } else if (signInError.message.includes("Email not confirmed") || signInError.message.includes("email_not_confirmed")) {
          setError("Vous n'avez pas encore activé votre compte. Consultez l'email d'invitation envoyé par votre praticien.");
        } else {
          setError("Une erreur est survenue. Veuillez réessayer.");
        }
        return;
      }
      router.push("/chat");
    } catch {
      setError("Une erreur est survenue. Réessayez plus tard.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) { setResetError("Entrez votre adresse email."); return; }
    setResetError("");
    setResetLoading(true);
    const res = await fetch("/api/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail.trim() }),
    });
    const data = await res.json() as { exists?: boolean };
    if (!data.exists) {
      setResetError("Aucun compte trouvé avec cette adresse email.");
      setResetLoading(false);
      return;
    }
    await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: forgotEmail.trim(),
        redirectTo: `${window.location.origin}/auth/callback?next=/set-password`,
      }),
    });
    setResetSent(true);
    setResetLoading(false); 
  };

  const closeModal = () => {
    setShowForgotModal(false);
    setForgotEmail("");
    setResetSent(false);
    setResetError("");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">

      <div className="mb-8 text-center">
          <div className="relative mx-auto mb-4 w-fit">
            <div className="absolute inset-0 rounded-full bg-emerald-500/8 blur-2xl" style={{ transform: "scale(1.4)" }} />
            <div style={{ position: "relative", width: 96, height: 96, borderRadius: "50%", border: "2px solid rgba(16,185,129,0.6)", boxShadow: "0 0 20px rgba(16,185,129,0.35), 0 0 40px rgba(16,185,129,0.12)", overflow: "hidden" }}>
              <img src="/logo.png" alt="NutriTwin" style={{ width: 96, height: 96, padding: "18px", objectFit: "contain", boxSizing: "border-box" }} />
            </div>
          </div>
          <h1 className="text-[22px] tracking-tight text-white">Mon espace Nutri<strong className="font-black" style={{ color: "#10b981" }}>Twin</strong></h1>
          <p className="mt-2 text-base text-zinc-400">Connectez-vous pour accéder <br /> à votre compagnon de suivi</p>
        </div>

        {sessionExpired && (
        <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400 text-center">
              Votre session a expiré.<br />Reconnectez-vous pour accéder à votre espace.
        </div>
      )}

        <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-[#121212] p-6 sm:p-8">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Email</span>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="votre@email.fr"
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25" />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Mot de passe</span>
              <div className="relative mt-2">
                <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Votre mot de passe"
                  className="w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 pr-12 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition">
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="mt-6 w-full rounded-xl py-3 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)", border: "none", boxShadow: "0 4px 24px rgba(16,185,129,0.25)", transition: "all 0.25s ease" }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(16,185,129,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            {loading ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />Connexion</span> : "Accéder à mon espace"}
          </button>

          <button type="button" onClick={() => setShowForgotModal(true)}
            className="mt-3 w-full text-center text-sm text-zinc-500 hover:text-[#10b981] transition cursor-pointer">
            Mot de passe oublié ?
          </button>

          <p className="mt-6 text-center text-xs text-zinc-500">
            Vous avez reçu un email d'invitation de votre praticien ? Consultez-le pour créer votre compte.
          </p>
        </form>
      </div>

      {/* Modale mot de passe oublié */}
      {showForgotModal && (
        <div onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              {!resetSent && (
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>Réinitialiser le mot de passe</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Entrez votre email pour recevoir un lien</p>
                </div>
              )}
              {resetSent && <div />}
              <button onClick={closeModal} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#94a3b8", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: "auto" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#e2e8f0"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#94a3b8"; }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {resetSent ? (
              <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: "20px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2px solid rgba(16,185,129,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "white" }}>Email envoyé !</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>Vérifiez votre boîte mail à <strong style={{ color: "#10b981" }}>{forgotEmail}</strong></p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#4b5563" }}>Pensez à vérifier vos spams.</p>
                <button onClick={closeModal}
                  style={{ marginTop: 16, height: 40, borderRadius: 20, padding: "0 20px", background: "linear-gradient(135deg, #10b981, #059669)", border: "none", color: "black", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 24px rgba(16,185,129,0.25)", transition: "all 0.25s ease" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(16,185,129,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}>Fermer</button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Adresse email</p>
                  <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void handleForgotPassword(); }}
                    placeholder="votre@email.fr" autoFocus
                    style={{ width: "100%", height: 48, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 16px", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                    onFocus={e => e.target.style.borderColor = "#10b981"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                </div>
                {resetError && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#f87171" }}>{resetError}</p>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={closeModal} style={{ flex: 1, height: 44, borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>Annuler</button>
                  <button onClick={() => void handleForgotPassword()} disabled={resetLoading}
                    style={{ flex: 2, height: 44, borderRadius: 10, background: resetLoading ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #10b981, #059669)", border: "none", color: resetLoading ? "#64748b" : "black", fontSize: 14, fontWeight: 600, cursor: resetLoading ? "not-allowed" : "pointer", boxShadow: resetLoading ? "none" : "0 4px 24px rgba(16,185,129,0.25)", transition: "all 0.25s ease" }}
                    onMouseEnter={e => { if (!resetLoading) { e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                    onMouseLeave={e => { if (!resetLoading) { e.currentTarget.style.boxShadow = "0 4px 24px rgba(16,185,129,0.25)"; e.currentTarget.style.transform = "translateY(0)"; } }}>
                    {resetLoading ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />Envoi en cours</span> : "Envoyer le lien"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


