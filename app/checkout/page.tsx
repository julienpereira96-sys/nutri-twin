"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
const emerald = "#10b981";
const amber = "#f59e0b";

const PLANS: Record<string, {
  name: string;
  price: string;
  description: string;
  features: string[];
  badge?: string;
  color: string;
}> = {
  essentiel: {
    name: "Essentiel",
    price: "149€",
    description: "Pour démarrer et accompagner vos patients prioritaires.",
    features: [
      "Jusqu'à 10 patients",
      "1 praticien",
      "Jumeau configuré sur 31 questions",
      "Chat patient 24h/24",
      "Dashboard praticien",
      "Support par email",
    ],
    color: emerald,
  },
  pro: {
    name: "Professionnel",
    price: "249€",
    badge: "Recommandé",
    description: "Le jumeau le plus fidèle à votre expertise.",
    features: [
      "Jusqu'à 50 patients",
      "1 praticien",
      "Jumeau configuré sur 31 questions",
      "Upload documents & protocoles",
      "Fidélité maximale du jumeau",
      "Rapport IA mensuel par patient",
      "Support prioritaire",
    ],
    color: emerald,
  },
  cabinet: {
    name: "Cabinet",
    price: "499€",
    description: "Pour les cabinets multi-praticiens.",
    features: [
      "Jusqu'à 150 patients",
      "3 praticiens inclus",
      "Upload documents illimité",
      "Rapport IA mensuel par patient",
      "+99€/praticien supplémentaire",
      "Support dédié",
    ],
    color: emerald,
  },
  fondateur: {
    name: "Fondateur",
    price: "149€",
    badge: "Offre limitée",
    description: "Plan Pro au prix Essentiel — garanti à vie.",
    features: [
      "Jusqu'à 50 patients",
      "1 praticien",
      "Upload documents & protocoles",
      "Rapport IA mensuel par patient",
      "Accès prioritaire aux nouvelles features",
      "Influence sur la roadmap",
    ],
    color: amber,
  },
};

function CheckoutForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "pro";
  const planData = PLANS[plan] || PLANS.pro;
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");

  const fetchClientSecret = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError("Vous devez être connecté pour accéder au paiement.");
        return;
      }

      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, userId: user.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erreur lors du chargement du paiement.");
        return;
      }

      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Erreur lors du chargement du paiement.");
      }
    } catch {
      setError("Une erreur est survenue.");
    }
  }, [plan]);

  useEffect(() => {
    fetchClientSecret();
  }, [fetchClientSecret]);

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.04] bg-[#070707]/80 backdrop-blur-2xl px-6 py-4 sticky top-0 z-50">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/20">
              <span className="text-sm">🍃</span>
            </div>
            <span className="text-[15px] tracking-tight">Nutri<strong>Twin</strong></span>
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-zinc-400">Paiement sécurisé</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid lg:grid-cols-2 gap-16 items-start">

          {/* Gauche — sticky */}
          <div className="lg:sticky lg:top-24">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-6" style={{ color: planData.color }}>
              Votre plan sélectionné
            </p>

            {/* Carte plan */}
            <div className="rounded-2xl border p-8 mb-5" style={{
              borderColor: `${planData.color}30`,
              background: `${planData.color}06`,
            }}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-[26px] font-black text-white">{planData.name}</h2>
                    {planData.badge && (
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-black" style={{ backgroundColor: planData.color }}>
                        {planData.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-zinc-500">{planData.description}</p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-[38px] font-black text-white leading-none">{planData.price}</p>
                  <p className="text-[11px] text-zinc-600 mt-1">/mois</p>
                </div>
              </div>

              <div className="h-px w-full bg-white/[0.06] mb-5" />

              <ul className="space-y-3">
                {planData.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${planData.color}20` }}>
                      <svg className="size-3 shrink-0" style={{ color: planData.color }} fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                    <span className="text-[13px] text-zinc-200">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Trial */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3.5 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-[18px]">🎁</span>
                <div>
                  <p className="text-[13px] font-semibold text-white">14 jours gratuits</p>
                  <p className="text-[11px] text-zinc-500">Aucun débit pendant l'essai · Annulable à tout moment</p>
                </div>
              </div>
            </div>

            <Link href="/#tarifs" className="text-[11px] text-zinc-600 hover:text-zinc-400 transition">
              ← Changer de plan
            </Link>
          </div>

          {/* Droite — Stripe */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-6 text-zinc-500">
              Informations de paiement
            </p>

            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-8 text-center">
                <p className="text-[13px] text-red-400">{error}</p>
                <Link href="/login" className="mt-4 inline-block text-[12px] text-zinc-500 hover:text-white transition">
                  → Se connecter
                </Link>
              </div>
            ) : clientSecret ? (
              <div className="rounded-2xl overflow-hidden border border-white/[0.06]">
                <EmbeddedCheckoutProvider
                  stripe={stripePromise}
                  options={{ clientSecret }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-emerald-500" />
                  <p className="text-[12px] text-zinc-600">Chargement du paiement...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#070707] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-emerald-500" />
      </div>
    }>
      <CheckoutForm />
    </Suspense>
  );
}
