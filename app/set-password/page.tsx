"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
  </svg>
);

export default function SetPasswordPage() {
  const router = useRouter();
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [acceptCGU, setAcceptCGU] = useState(false);
  const [acceptData, setAcceptData] = useState(false);

  useEffect(() => {
    // Détecter immédiatement un token expiré/invalide via le hash Supabase
    const hash = window.location.hash;
    if (hash.includes("error=access_denied") || hash.includes("otp_expired") || hash.includes("error_code=")) {
      setReady(false);
      setError("__expired__");
      return;
    }

    // Client SSR (createBrowserClient) : stocke la session dans les cookies
    // afin que le middleware Next.js puisse lire la session après navigation.
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabaseRef.current = supabase;

    const timeout = setTimeout(() => {
      setReady(false);
      setError("__expired__");
    }, 20000);

    const handleReady = () => { clearTimeout(timeout); setReady(true); };

    // Flow PKCE : ?code= dans les query params
    const urlCode = new URLSearchParams(window.location.search).get("code");
    if (urlCode) {
      supabase.auth.exchangeCodeForSession(urlCode)
        .then(({ error }) => { if (!error) handleReady(); })
        .catch(() => {});
    }

    // Flow implicite (fallback) : #access_token= dans le hash
    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data: { session }, error }) => {
          if (session && !error) handleReady();
        })
        .catch(() => {});
    }

    // Fallback : vérifier si une session cookie existe déjà
    // (INITIAL_SESSION peut firer avant que onAuthStateChange soit enregistré)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { clearTimeout(timeout); setReady(true); }
    }).catch(() => {});

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (session) {
          clearTimeout(timeout);
          setReady(true);
        }
      }
    });

    return () => clearTimeout(timeout);
  }, []);

  const handleSubmit = async () => {
    if (!password || password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    if (password.length < 8) { setError("Minimum 8 caractères."); return; }
    if (!acceptCGU) { setError("Vous devez accepter les CGU et la politique de confidentialité."); return; }
    if (!acceptData) { setError("Vous devez consentir au traitement de vos données nutritionnelles."); return; }

    setLoading(true); setError("");

    const supabase = supabaseRef.current;
    if (!supabase) { setError("Session expirée. Contactez votre praticien."); setLoading(false); return; }

    // Vérifier que la session magic link est toujours active
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) { setError("Session expirée. Contactez votre praticien."); setLoading(false); return; }

    // Mettre à jour le mot de passe directement via la session magic link
    // (évite le 401 : pas besoin de l'API /set-patient-password qui lit les cookies SSR)
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("Une erreur est survenue. Veuillez réessayer.");
      setLoading(false);
      return;
    }

    // Sauvegarder le consentement RGPD et passer onboarding_status à "password_set"
    // (débloque l'accès à /patient-onboarding via le middleware)
    const rgpdRes = await fetch("/api/confirm-patient-rgpd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUser.id, email: currentUser.email }),
    });
    if (!rgpdRes.ok) {
      setError("Une erreur est survenue lors de la validation. Veuillez réessayer.");
      setLoading(false);
      return;
    }

    // Se reconnecter avec le nouveau mot de passe pour initialiser la session cookie (SSR)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentUser.email!,
      password,
    });
    if (signInError) {
      window.location.href = "/patient-login?reason=set_password_done";
      return;
    }
    window.location.replace("/patient-onboarding");
  };

  const isDisabled = loading || !password || !confirm || !acceptCGU || !acceptData;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-3 w-fit">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-lg" />
            <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto" }}>
              <div style={{ width: 96, height: 96, borderRadius: "50%", background: "transparent", border: "2px solid rgba(16,185,129,0.6)", boxShadow: "0 0 20px rgba(16,185,129,0.35), 0 0 40px rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse-ring 2s ease-in-out infinite" }}>
                <img src="/logo.png" alt="" style={{ width: 68, height: 68, objectFit: "contain" }} />
              </div>
            </div>
          </div>
          <h1 className="text-[22px] tracking-tight text-white mt-3">Bienvenue sur Nutri<strong className="font-black" style={{ color: "#10b981" }}>Twin</strong></h1>
          <p className="mt-2 text-base text-zinc-400">Créez votre espace personnel</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121212] p-6 sm:p-8">
          {error === "__expired__" ? (
            <div className="py-8 text-center">
              <p style={{ fontSize: 44, marginBottom: 12, lineHeight: 1 }}>⏱</p>
              <p className="text-sm font-semibold text-white mb-2">Lien expiré</p>
              <p className="text-sm text-zinc-400 mb-6">Ce lien d'invitation n'est plus valide. Contactez votre praticien pour en recevoir un nouveau.</p>
            </div>
          ) : !ready ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />
              <p className="text-sm text-zinc-400">Vérification de votre invitation...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-zinc-300">Mot de passe</span>
                <div className="relative mt-2">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 caractères"
                    className="w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 pr-12 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition">
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-zinc-300">Confirmer le mot de passe</span>
                <div className="relative mt-2">
                  <input type={showConfirm ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Répétez votre mot de passe"
                    onKeyDown={e => { if (e.key === "Enter") void handleSubmit(); }}
                    className="w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 pr-12 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25" />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition">
                    {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </label>
              <div className="space-y-3 pt-2">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={acceptCGU} onChange={e => setAcceptCGU(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#10b981]" />
                  <span className="text-xs leading-relaxed text-zinc-400">
                    J'accepte les <a href="/cgu" target="_blank" className="text-[#10b981] hover:underline">CGU</a> et la <a href="/confidentialite" target="_blank" className="text-[#10b981] hover:underline">Politique de Confidentialité</a> *
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={acceptData} onChange={e => setAcceptData(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#10b981]" />
                  <span className="text-xs leading-relaxed text-zinc-400">Je consens au traitement de mes données nutritionnelles pour mon accompagnement personnalisé. *</span>
                </label>
                <p className="text-[11px] text-zinc-200">* Champs obligatoires</p>
              </div>
              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
              <button onClick={() => void handleSubmit()} disabled={isDisabled}
                className="mt-2 w-full rounded-xl py-3 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)", border: "none", boxShadow: "0 4px 24px rgba(16,185,129,0.25)", transition: "all 0.25s ease" }}
                onMouseEnter={e => { if (!isDisabled) { e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(16,185,129,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                {loading ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />Création en cours</span> : "Accéder à mon espace"}
              </button>
              <p className="mt-2 text-center text-xs text-zinc-500 whitespace-nowrap">Chiffrement de bout en bout · Données traitées en Europe (RGPD)</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
