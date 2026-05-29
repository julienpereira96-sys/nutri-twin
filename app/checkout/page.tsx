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
    description: "Plan Pro au prix Essentiel - garanti à vie.",
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
  },
  rules: {
    ".Input": {
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "none",
      backgroundColor: "#161616",
      color: "#ffffff",
    },
    ".Input:focus": {
      border: `1px solid ${emerald}`,
      boxShadow: `0 0 0 2px ${emerald}25`,
    },
    ".Input::placeholder": {
      color: "#4b5563",
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
              name: user?.user_metadata?.first_name
                ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}`
                : user?.email ?? "",
              phone: "",
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

<div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
  <p className="text-[12px] text-zinc-500 text-center leading-relaxed">
    En démarrant votre essai, vous autorisez NutriTwin à débiter votre carte à l'issue de la période d'essai.{" "}
    <strong className="text-white">Annulable à tout moment.</strong>
  </p>
</div>


      {error && (
        <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-400">
          {error}
        </div>
      )}

<button
  onClick={handleSubmit}
  disabled={loading || !stripe}
  className="mt-6 w-full h-[52px] rounded-xl text-[15px] font-semibold text-black transition active:scale-95 disabled:opacity-50 cursor-pointer"
  style={{ backgroundColor: emerald }}
  onMouseEnter={(e) => {
    if (!loading && stripe) {
      e.currentTarget.style.boxShadow = "0 0 0 1px rgba(16,185,129,0.5), 0 8px 30px rgba(16,185,129,0.4)";
      e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
    }
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.transform = "translateY(0) scale(1)";
  }}
>

        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
            Traitement en cours
          </span>
        ) : (
          "Commencer mon essai gratuit"
        )}
      </button>

      <p className="mt-4 text-[12px] text-zinc-500 text-center leading-relaxed">
        En confirmant, vous acceptez nos{" "}
        <Link href="/cgu" className="underline hover:text-zinc-500 transition">CGU</Link>
        {" "}et notre{" "}
        <Link href="/confidentialite" className="underline hover:text-zinc-500 transition">politique de confidentialité</Link>.
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
    setClientSecret("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("practitioners").update({ pending_plan: plan }).eq("user_id", user?.id ?? "");
      if (!user) {
        setError("Vous devez être connecté pour accéder au paiement.");
        return;
      }

      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.error?.includes("No such customer")) {
          setError("Session expirée. Veuillez vous reconnecter.");
        } else {
          setError(data.error || "Erreur lors du chargement du paiement.");
        }
        return;
      }

      const data = await res.json();
      setClientSecret(data.clientSecret);
    } catch {
      setError("Une erreur est survenue.");
    }
  }, [plan]);

  useEffect(() => {
    setClientSecret("");
    fetchClientSecret();
  }, [plan, fetchClientSecret]);

  return (
    <div className="min-h-screen bg-[#070707] text-white">
            <header className="border-b border-white/[0.04] bg-[#070707]/80 backdrop-blur-2xl px-4 sm:px-6 py-4 sticky top-0 z-50">
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
              <svg className="size-3 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              <span className="text-[11px] font-medium text-emerald-500">Paiement sécurisé SSL</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        <div className="mb-10">
        <h1 className="text-[24px] sm:text-[32px] font-black text-white">Finalisez votre abonnement</h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">
          <div className="lg:sticky lg:top-24">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: planData.color }}>
              Récapitulatif de votre commande
            </p>

            <div className={`rounded-xl border px-4 py-3.5 mb-4 ${plan === "fondateur" ? "border-amber-500/20 bg-amber-500/[0.05]" : "border-emerald-500/20 bg-emerald-500/[0.05]"}`}>
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
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-[22px] sm:text-[26px] font-black text-white">{planData.name}</h2>
                    {planData.badge && (
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-black" style={{ backgroundColor: planData.color }}>
                        {planData.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px]" style={{ color: plan === "pro" ? emerald : "#6b7280" }}>{planData.description}</p>
                </div>
                <div className="sm:text-right shrink-0 sm:ml-4">
                  <p className="text-[32px] sm:text-[38px] font-black text-white leading-none">{planData.price}</p>
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

            <button
              onClick={() => {
                document.cookie = "changing_plan=true; path=/; max-age=60";
                window.location.assign("/#tarifs");
              }}
              className="text-[11px] text-zinc-600 hover:text-zinc-400 transition cursor-pointer"
            >
              ← Changer de plan
            </button>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-6" style={{ color: emerald }}>
              Informations de paiement
            </p>

            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-8 text-center">
                <div className="flex justify-center mb-3">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <p className="text-[14px] font-semibold text-white mb-1">Une erreur est survenue</p>
                <p className="text-[13px] text-red-400 mb-4">{error}</p>
                <Link href="/login" className="inline-flex items-center justify-center rounded-xl px-6 py-2.5 text-[13px] font-semibold text-black transition" style={{ backgroundColor: emerald, boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>
                  Se connecter
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
