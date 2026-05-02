"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        setError(signInError.message);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Une erreur est survenue. Reessayez plus tard.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10b981]/20">
            <span className="text-2xl">🍃</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">NutriTwin</h1>
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
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
              />
            </label>
          </div>

          {error ? (
            <p className="mt-4 text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-full bg-[#10b981] py-3 text-sm font-semibold text-black transition hover:bg-[#34d399] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          <p className="mt-6 text-center text-sm text-zinc-400">
            Pas encore de compte ?{" "}
            <Link href="/signup" className="font-medium text-[#34d399] hover:underline">
              Sinscrire
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
