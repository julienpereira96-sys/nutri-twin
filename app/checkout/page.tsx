"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
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
    features: ["Jusqu'à 10 patients", "1 praticien", "Jumeau configuré sur 31 questions", "Chat patient 24h/24", "Dashboard praticien", "Support par email"],
    color: emerald,
  },
  pro: {
    name: "Professionnel",
    price: "249€",
    badge: "Recommandé",
    description: "Le jumeau le plus fidèle à votre expertise.",
    features: ["Jusqu'à 50 patients", "1 praticien", "Jumeau configuré sur 31 questions", "Upload documents & protocoles", "Fidélité maximale du jumeau", "Rapport IA mensuel par patient", "Support prioritaire"],
    color: emerald,
  },
  cabinet: {
    name: "Cabinet",
    price: "499€",
    description: "Pour les cabinets multi-praticiens.",
    features: ["Jusqu'à 150 patients", "3 praticiens inclus", "Upload documents illimité", "Rapport IA mensuel par patient", "+99€/praticien supplémentaire", "Support dédié"],
    color: emerald,
  },
  fondateur: {
    name: "Fondateur",
    price: "149€",
    badge: "Offre limitée",
    description: "Plan Pro au prix Essentiel — garanti à vie.",
    features: ["Jusqu'à 50 patients", "1 praticien", "Upload documents & protocoles", "Rapport IA mensuel par patient", "Accès prioritaire aux nouvelles features", "Influence sur la roadmap"],
    color: amber,
  },
};

const stripeAppearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: emerald,
    colorBackground: "#0d0d0d",
    colorText: "#ffffff",
    colorDanger: "#ef4444",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    borderRadius: "12px",
    colorInputBackground: "#161616",
    colorInputText: "#ffffff",
    colorInputPlaceholder: "#4b5563",
    colorInputBorder: "rgba(255,255,255,0.1)",
  },
  rules: {
    ".Input": {
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "none",
      backgroundColor: "#161616",
    },
    ".Input:focus": {
      border: `1px solid ${emerald}`,
      boxShadow: `0 0 0 2px ${emerald}25`,
    },
    ".Label": {
      color: "#9ca3af",
      fontSize: "13px",
      fontWeight: "500",
    },
    ".Tab": {
      border: "1px solid rgba(255,255,255,0.08)",
      backgroundColor: "#111111",
    },
    ".Tab:hover": {
      backgroundColor: "#161616",
    },
    ".Tab--selected": {
      border: `1px solid ${emerald}40`,
      backgroundColor: `${emerald}10`,
    },
    ".Block": {
      backgroundColor: "#0d0d0d",
      border: "1px solid rgba(255,255,255,0.06)",
    },
  },
};

function PaymentForm({ plan }: { plan: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
const { data: { user } } = await supabase.auth.getUser();

const { error: submitError, setupIntent } = await stripe.confirmSetup({
  elements,
  confirmParams: {
    return_url: window.location.href,
    payment_method_data: {
      billing_details: {
        email: user?.email ?? "",
      },
    },
  },
  redirect: "if_required",
});


      if (submitError) {
        setError(submitError.message || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      if (setupIntent?.payment_method) {
        const res = await fetch("/api/create-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentMethodId: setupIntent.payment_method,
            plan,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Erreur lors de la création de l'abonnement.");
          setLoading(false);
          return;
        }

        router.push(`/payment-success?plan=${plan}`);
      }
    } catch {
      setError("Une erreur est survenue.");
      setLoading(false);
    }
  };

  return (
    <div>
      <PaymentElement options={{
        layout: "accordion",
        fields: {
          billingDetails: {
            email: "never",
            phone: "never",
            name: "never",
          },
        },
        wallets: {
          applePay: "auto",
          googlePay: "auto",
        },
      }} />
      {error && (
        <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-400">
          {error}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={loading || !stripe}
        className="mt-6 w-full h-[52px] rounded-xl text-[15px] font-semibold text-black transition active:scale-95 disabled:opacity-50"
        style={{ backgroundColor: emerald }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
            Traitement en cours...
          </span>
        ) : (
          "Commencer mon essai gratuit →"
        )}
      </button>
      <p className="mt-3 text-[11px] text-zinc-600 text-center">
        Aucun débit pendant 14 jours · Annulable à tout moment
      </p>
    </div>
  );
}

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
      setClientSecret(data.clientSecret);
    } catch {
      setError("Une erreur est survenue.");
    }
  }, [plan]);

  useEffect(() => {
    fetchClientSecret();
  }, [fetchClientSecret]);

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <header className="border-b border-white/[0.04] bg-[#070707]/80 backdrop-blur-2xl px-6 py-4 sticky top-0 z-50">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md" />
              <img src="/logo.svg" alt="NutriTwin" className="h-7 w-auto relative" />
            </div>
            <span className="text-[15px] tracking-tight">Nutri<strong className="font-black" style={{ color: emerald }}>Twin</strong></span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-1.5">
              <svg className="size-3 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <span className="text-[11px] font-medium text-emerald-400">Paiement sécurisé SSL</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-10">
          <h1 className="text-[32px] font-black text-white">Finalisez votre abonnement</h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div className="lg:sticky lg:top-24">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: planData.color }}>
              Récapitulatif de votre commande
            </p>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3.5 mb-4">
              <div className="flex items-center gap-3">
                <span className="text-[18px]">🎁</span>
                <div>
                  <p className="text-[13px] font-semibold text-white">14 jours gratuits</p>
                  <p className="text-[11px] text-zinc-500">Aucun débit pendant l'essai · Annulable à tout moment</p>
                </div>
              </div>
            </div>

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
                  <p className="text-[13px]" style={{ color: plan === "pro" ? emerald : "#6b7280" }}>{planData.description}</p>
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

            <Link
              href="/#tarifs"
              onClick={() => sessionStorage.setItem("from_checkout", "true")}
              className="text-[11px] text-zinc-600 hover:text-zinc-400 transition"
            >
              ← Changer de plan
            </Link>
          </div>

          <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-6" style={{ color: emerald }}>
  Informations de paiement
</p>


            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-8 text-center">
                <p className="text-[22px] mb-3">⚠️</p>
                <p className="text-[14px] font-semibold text-white mb-1">Une erreur est survenue</p>
                <p className="text-[13px] text-red-400 mb-4">{error}</p>
                <Link href="/login" className="inline-flex items-center justify-center rounded-full px-5 py-2 text-[12px] font-semibold text-black transition" style={{ backgroundColor: emerald }}>
                  Se connecter →
                </Link>
              </div>
            ) : clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
                <PaymentForm plan={plan} />
              </Elements>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d0d] flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-emerald-500" />
                  <p className="text-[12px] text-zinc-600">Chargement du paiement...</p>
                </div>
              </div>
            )}

            <p className="mt-4 text-[10px] text-zinc-700 text-center leading-relaxed">
              En confirmant votre abonnement, vous acceptez nos{" "}
              <Link href="/cgu" className="underline hover:text-zinc-500 transition">CGU</Link>
              {" "}et notre{" "}
              <Link href="/confidentialite" className="underline hover:text-zinc-500 transition">politique de confidentialité</Link>.
              Votre abonnement se renouvelle automatiquement chaque mois.
            </p>
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
