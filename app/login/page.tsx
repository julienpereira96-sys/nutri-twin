
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "session_expired") setSessionExpired(true);
  }, []);
  

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) {
        if (signInError.message.includes("Invalid login credentials") || signInError.message.includes("invalid_credentials") || signInError.code === "invalid_credentials") {
          setError("Email ou mot de passe incorrect. Vérifiez vos informations.");
        } else if (signInError.message.includes("Email not confirmed") || signInError.message.includes("email_not_confirmed")) {
          setError("__unconfirmed__");
        } else {
          setError(signInError.message);
        }
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      const { data: practitioner } = await supabase.from("practitioners").select("plan").eq("user_id", user?.id).single();
      if (!practitioner?.plan) {
        router.push(`/checkout?plan=pro`);
      } else {
        router.push("/dashboard");
      }
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
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), { redirectTo: `${window.location.origin}/reset-password` });
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
          <div className="relative mx-auto mb-3 w-fit">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-lg" />
            <div style={{ position: "relative", width: 75, height: 75, margin: "0 auto" }}>
  <div style={{ width: 75, height: 75, borderRadius: "50%", background: "transparent", border: "2px solid rgba(16,185,129,0.6)", boxShadow: "0 0 16px rgba(16,185,129,0.3), 0 0 32px rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, animation: "pulse-ring 2s ease-in-out infinite" }}>🌿</div>
</div>
          </div>
          <h1 className="text-[22px] tracking-tight text-white">Mon espace Nutri<strong className="font-black" style={{ color: "#10b981" }}>Twin</strong></h1>
          <p className="mt-2 text-base text-zinc-400">Connectez-vous pour accéder <br /> à votre espace praticien</p>
        </div>

        {sessionExpired && (
  <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#f59e0b", textAlign: "center" }}>
    Votre session a expiré après 30 jours d'inactivité. Reconnectez-vous pour accéder à votre cabinet. 🔒
  </div>
)}
        <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-[#121212] p-6 sm:p-8">
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Email</span>
              <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
                placeholder="vous@cabinet.fr" />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Mot de passe</span>
              <div className="relative mt-2">
                <input type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Votre mot de passe"
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

          {error && error !== "__unconfirmed__" && (
          <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
            <p className="text-sm text-red-400" role="alert">{error}</p>
          </div>
        )}
        {error === "__unconfirmed__" && (
          <div className="mt-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
            <p className="text-sm text-amber-400">Un compte existe déjà mais n'est pas encore vérifié.</p>
            <button onClick={async () => {
              const supabase = createSupabaseBrowserClient();
              await supabase.auth.resend({ type: "signup", email: email.trim() });
              router.push(`/verify-otp?email=${encodeURIComponent(email.trim())}&plan=pro`);
            }} className="mt-2 text-sm font-semibold underline cursor-pointer" style={{ color: "#f59e0b" }}>
              Recevoir mon code de vérification →
            </button>
          </div>
        )}

          <button type="submit" disabled={loading}
            className="mt-6 w-full rounded-xl bg-[#10b981] py-3 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(16,185,129,0.5), 0 8px 30px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; } }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0) scale(1)"; }}>
            {loading ? "Connexion..." : "Se connecter →"}
          </button>

          <button type="button" onClick={() => setShowForgotModal(true)}
            className="mt-3 w-full text-center text-sm text-zinc-500 hover:text-[#10b981] transition cursor-pointer">
            Mot de passe oublié ?
          </button>

          <p className="mt-6 text-center text-sm text-zinc-400">
            Pas encore de compte ?{" "}
            <Link href="/#tarifs" className="font-medium text-[#34d399] hover:underline">
              S'inscrire
            </Link>
          </p>
        </form>
      </div>

      {showForgotModal && (
        <div onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>Réinitialiser le mot de passe</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Entrez votre email pour recevoir un lien</p>
              </div>
              <button onClick={closeModal} style={{ background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            {resetSent ? (
              <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: "20px", textAlign: "center" }}>
                <p style={{ fontSize: 28, marginBottom: 10 }}>✅</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "white" }}>Email envoyé !</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>Vérifiez votre boîte mail à <strong style={{ color: "#10b981" }}>{forgotEmail}</strong></p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#4b5563" }}>Pensez à vérifier vos spams.</p>
                <button onClick={closeModal} style={{ marginTop: 16, height: 40, borderRadius: 20, padding: "0 20px", background: "#10b981", border: "none", color: "black", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Fermer</button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Adresse email</p>
                  <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") void handleForgotPassword(); }}
                    placeholder="vous@cabinet.fr" autoFocus
                    style={{ width: "100%", height: 48, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 16px", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                    onFocus={e => e.target.style.borderColor = "#10b981"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                </div>
                {resetError && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#f87171" }}>{resetError}</p>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={closeModal} style={{ flex: 1, height: 44, borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>Annuler</button>
                  <button onClick={() => void handleForgotPassword()} disabled={resetLoading}
                    style={{ flex: 2, height: 44, borderRadius: 10, background: resetLoading ? "rgba(255,255,255,0.05)" : "#10b981", border: "none", color: resetLoading ? "#64748b" : "black", fontSize: 14, fontWeight: 600, cursor: resetLoading ? "not-allowed" : "pointer" }}>
                    {resetLoading ? "Envoi en cours..." : "Envoyer le lien →"}
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
