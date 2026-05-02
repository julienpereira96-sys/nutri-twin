"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

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

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
          }),
        });
      }

      router.push("/onboarding");
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
          <p className="mt-2 text-sm text-zinc-400">Inscription praticien</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-[#121212] p-6 sm:p-8"
        >
          <div className="space-y-4">
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

            {/* Spécialités multi-sélection */}
            <div>
              <span className="text-sm font-medium text-zinc-300">
                Spécialité(s)
              </span>
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
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-4 py-3 text-[15px] text-white outline-none transition focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
                placeholder="Minimum 8 caractères"
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
            {loading ? "Création..." : "Créer mon compte"}
          </button>

          <p className="mt-6 text-center text-sm text-zinc-400">
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
