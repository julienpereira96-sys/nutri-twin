"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState, Suspense } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const specialties = [
  "Nutritionniste",
  "Diététicien / Diététicienne",
  "Médecin Nutritionniste",
  "Endocrinologue / Diabétologue",
  "Naturopathe",
  "Coach Nutrition / Conseiller",
  "Psychologue (TCA)",
];

function SignupForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") ?? "pro";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [specialtyOther, setSpecialtyOther] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleSpecialty = (s: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    const allSpecialties = showOther && specialtyOther.trim()
      ? [...selectedSpecialties, specialtyOther.trim()]
      : selectedSpecialties;

    if (allSpecialties.length === 0) {
      setError("Veuillez sélectionner au moins une spécialité.");
      return;
    }

    setLoading(true);
    const finalSpecialty = allSpecialties.join(", ");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            specialty: finalSpecialty,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.user) {
        await fetch("/api/create-practitioner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: data.user.id,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            specialty: finalSpecialty,
            email: email.trim(),
          }),
        });

        const res = await fetch("/api/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, userId: data.user.id }),
        });
        const checkoutData = await res.json() as { url: string };
        if (checkoutData.url) window.location.href = checkoutData.url;
      }
    } catch {
      setError("Une erreur est survenue. Réessayez plus tard.");
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10b981]/20">
            <span className="text-2xl">🍃</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">NutriTwin</h1>
          <p className="mt-2 text-sm text-zinc-400">Créez votre compte praticien</p>
          {plan && (
            <p className="mt-1 text-xs font-semibold" style={{ color: "#10b981" }}>
              Plan {plan.charAt(0).toUpperCase() + plan.slice(1)} sélectionné
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-[#121212] p-6 sm:p-8">
          <div className="space-y-4">

            {/* Prénom / Nom */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-zinc-300">Prénom</span>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
                  placeholder="Ilona"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-zinc-300">Nom</span>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
                  placeholder="Dupont"
                />
              </label>
            </div>

            {/* Spécialités */}
            <div>
              <span className="text-sm font-medium text-zinc-300">Spécialité(s)</span>
              <p className="mt-1 text-xs text-zinc-500">Vous pouvez en sélectionner plusieurs</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {specialties.map((s) => {
                  const isSelected = selectedSpecialties.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSpecialty(s)}
                      className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                      style={{
                        background: isSelected ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                        borderColor: isSelected ? "#10b981" : "rgba(255,255,255,0.12)",
                        color: isSelected ? "#10b981" : "#a1a1aa",
                      }}
                    >
                      {isSelected ? "✓ " : ""}{s}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowOther((prev) => !prev)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                  style={{
                    background: showOther ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                    borderColor: showOther ? "#10b981" : "rgba(255,255,255,0.12)",
                    color: showOther ? "#10b981" : "#a1a1aa",
                  }}
                >
                  {showOther ? "✓ " : ""}Autre
                </button>
              </div>
              {showOther && (
                <input
                  type="text"
                  value={specialtyOther}
                  onChange={(e) => setSpecialtyOther(e.target.value)}
                  placeholder="Précisez votre spécialité..."
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
                />
              )}
            </div>

            {/* Email */}
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

            {/* Mot de passe */}
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Mot de passe</span>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  className="w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 pr-12 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>

            {/* Confirmer mot de passe */}
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Confirmer le mot de passe</span>
              <div className="relative mt-2">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez votre mot de passe"
                  className="w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 pr-12 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition"
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>
          </div>

          {error ? (
            <p className="mt-4 text-sm text-red-400" role="alert">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-full bg-[#10b981] py-3 text-sm font-semibold text-black transition hover:bg-[#34d399] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Création du compte..." : "Créer mon compte →"}
          </button>

          <p className="mt-4 text-center text-xs text-zinc-500">
            Vous serez redirigé vers notre page de paiement sécurisée
          </p>

          <p className="mt-4 text-center text-sm text-zinc-400">
            Déjà un compte ?{" "}
            <Link href="/login" className="font-medium text-[#34d399] hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-zinc-400">Chargement...</p>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
