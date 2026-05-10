"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
  
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
  
      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          setError("Email ou mot de passe incorrect. Vérifiez vos informations.");
        } else {
          setError(signInError.message);
        }
        return;
      }
      
  
      const { data: { user } } = await supabase.auth.getUser();
      const { data: practitioner } = await supabase
        .from("practitioners")
        .select("plan")
        .eq("user_id", user?.id)
        .single();
  
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
    if (!email.trim()) {
      setError("Entrez votre email pour réinitialiser votre mot de passe.");
      return;
    }
    setError("");
    setResetLoading(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetSent(true);
    setResetLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
  <div className="relative mx-auto mb-3 w-fit">
    <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-lg" />
    <img src="/logo.svg" alt="NutriTwin" className="h-14 w-auto relative mx-auto" />
  </div>
  <h1 className="text-[22px] tracking-tight text-white">Nutri<strong className="font-black" style={{ color: "#10b981" }}>Twin</strong></h1>
  <p className="mt-2 text-sm text-zinc-400">Connexion praticien</p>
</div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-[#121212] p-6 sm:p-8"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
                placeholder="vous@cabinet.fr"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Mot de passe</span>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  className="w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 pr-12 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition"
                >
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
            <p className="mt-4 text-sm text-red-400" role="alert">{error}</p>
          )}

          {resetSent && (
            <div className="mt-4 rounded-xl border border-[#10b981]/20 bg-[#10b981]/08 px-4 py-3">
              <p className="text-sm text-[#10b981]">
                ✅ Un email de réinitialisation a été envoyé à {email}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-full bg-[#10b981] py-3 text-sm font-semibold text-black transition hover:bg-[#34d399] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          <button
            type="button"
            onClick={() => void handleForgotPassword()}
            disabled={resetLoading}
            className="mt-3 w-full text-center text-sm text-zinc-500 hover:text-[#10b981] transition underline cursor-pointer disabled:opacity-50"
          >
            {resetLoading ? "Envoi en cours..." : "Mot de passe oublié ?"}
          </button>

          <p className="mt-6 text-center text-sm text-zinc-400">
            Pas encore de compte ?{" "}
            <Link href="/signup" className="font-medium text-[#34d399] hover:underline">
              S'inscrire
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
