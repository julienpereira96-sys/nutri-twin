"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
const emerald = "#10b981";

type PackInfo = {
  plan: string;
  pack: {
    size: number;
    amount: number;
    label: string;
    maxPacks: number;
    currentPacks: number;
    canBuy: boolean;
  } | null;
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

// ─── Payment form ────────────────────────────────────────────────────────────

function PackPaymentForm({ packInfo }: { packInfo: PackInfo }) {
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
        const res = await fetch("/api/billing/confirm-pack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethodId: setupIntent.payment_method }),
        });

        const data = await res.json() as { success?: boolean; error?: string };

        if (!res.ok || !data.success) {
          setError(data.error || "Erreur lors de l'activation du pack.");
          setLoading(false);
          return;
        }

        const pack = packInfo.pack;
        if (!pack) { router.push("/dashboard"); return; }
        router.push(`/pack-success?size=${pack.size}&plan=${packInfo.plan}&amount=${pack.amount}`);
      }
    } catch {
      setError("Une erreur est survenue.");
      setLoading(false);
    }
  };

  const pack = packInfo.pack;
  const planLabel = packInfo.plan === "essentiel" ? "Essentiel" : "Professionnel";

  return (
    <div>
      <PaymentElement
        options={{
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
        }}
      />

      <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-[12px] text-zinc-500 text-center leading-relaxed">
          En confirmant, vous autorisez NutriTwin à débiter <strong className="text-white">{pack?.amount ?? 0}€/mois</strong> pour votre pack {planLabel}.{" "}
          <strong className="text-white">Résiliable à tout moment.</strong>
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={() => void handleSubmit()}
        disabled={loading || !stripe}
        className="mt-6 w-full h-[52px] rounded-xl text-[15px] font-semibold text-black transition active:scale-95 disabled:opacity-50 cursor-pointer"
        style={{
          background: "linear-gradient(135deg, #10b981, #059669)",
          border: "none",
          boxShadow: "0 4px 24px rgba(16,185,129,0.25)",
          transition: "all 0.25s ease",
        }}
        onMouseEnter={(e) => {
          if (!loading && stripe) {
            e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.4)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 4px 24px rgba(16,185,129,0.25)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
            Traitement en cours
          </span>
        ) : (
          "Confirmer le paiement"
        )}
      </button>

      <p className="mt-4 text-[12px] text-zinc-500 text-center leading-relaxed">
        En confirmant, vous acceptez nos{" "}
        <Link href="/cgu" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-400 transition">
          CGU
        </Link>{" "}
        et notre{" "}
        <Link href="/confidentialite" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-400 transition">
          politique de confidentialité
        </Link>
        .
      </p>
    </div>
  );
}

// ─── Main form ───────────────────────────────────────────────────────────────

function CheckoutPackForm() {
  const router = useRouter();
  const [clientSecret, setClientSecret] = useState("");
  const [packInfo, setPackInfo] = useState<PackInfo | null>(null);
  const [error, setError] = useState("");

  const planFeatures: Record<string, string[]> = {
    essentiel: [
      "5 patients supplémentaires",
      "Accès immédiat après paiement",
      "Même qualité de suivi IA",
      "Résiliable à tout moment",
    ],
    pro: [
      "10 patients supplémentaires",
      "Accès immédiat après paiement",
      "Même qualité de suivi IA",
      "Résiliable à tout moment",
    ],
  };

  const fetchData = useCallback(async () => {
    try {
      // Récupérer les infos du pack
      const packRes = await fetch("/api/billing/purchase-pack");
      if (!packRes.ok) {
        const d = await packRes.json() as { error?: string };
        setError(d.error || "Impossible de charger les informations du pack.");
        return;
      }
      const packData = await packRes.json() as PackInfo;

      if (!packData.pack) {
        setError("Aucun pack disponible pour votre plan actuel.");
        return;
      }

      if (!packData.pack.canBuy) {
        setError(
          `Vous avez atteint le maximum de ${packData.pack.maxPacks} pack${packData.pack.maxPacks > 1 ? "s" : ""} pour votre plan. Passez au plan supérieur pour accueillir davantage de patients.`
        );
        return;
      }

      setPackInfo(packData);

      // Créer le SetupIntent
      const siRes = await fetch("/api/billing/create-pack-setup-intent", {
        method: "POST",
      });
      if (!siRes.ok) {
        const d = await siRes.json() as { error?: string };
        setError(d.error || "Erreur lors du chargement du paiement.");
        return;
      }
      const siData = await siRes.json() as { clientSecret: string };
      setClientSecret(siData.clientSecret);
    } catch {
      setError("Une erreur est survenue.");
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const pack = packInfo?.pack;
  const plan = packInfo?.plan ?? "pro";
  const planLabel = plan === "essentiel" ? "Essentiel" : "Professionnel";
  const features = planFeatures[plan] ?? planFeatures.pro;

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.04] bg-[#070707]/80 backdrop-blur-2xl px-4 sm:px-6 py-4 sticky top-0 z-50">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div style={{ position: "relative", flexShrink: 0, width: 34, height: 34 }}>
              <div style={{ position: "absolute", inset: -8, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.2), transparent 70%)", pointerEvents: "none" }} />
              <div style={{ width: 34, height: 34, borderRadius: "50%", border: "1.5px solid rgba(16,185,129,0.6)", display: "flex", alignItems: "center", justifyContent: "center", background: "#070707", position: "relative" }}>
                <img src="/logo.png" alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
              </div>
            </div>
            <span className="text-[20px] tracking-tight" style={{ fontFamily: "var(--font-jakarta), sans-serif" }}>
              Nutri<strong className="font-black" style={{ color: emerald }}>Twin</strong>
            </span>
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
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">
          {/* Left — pack summary */}
          <div className="lg:sticky lg:top-24">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: emerald }}>
              Récapitulatif de votre commande
            </p>

            <div className="mb-6">
              <h1 className="text-[24px] sm:text-[28px] font-black text-white">Ajouter un pack patients</h1>
              <p className="mt-1 text-[13px] text-zinc-500">Étendez votre capacité d'accueil sans changer de plan.</p>
            </div>

            {pack && (
              <>
                <div
                  className="rounded-2xl border p-8 mb-5"
                  style={{
                    borderColor: `${emerald}30`,
                    background: `${emerald}06`,
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-3">
                    <div>
                      <h2 className="text-[22px] sm:text-[26px] font-black text-white mb-1">
                        Pack {pack.label}
                      </h2>
                      <p className="text-[13px]" style={{ color: emerald }}>
                        Plan {planLabel}
                      </p>
                    </div>
                    <div className="sm:text-right shrink-0 sm:ml-4">
                      <p className="text-[32px] sm:text-[38px] font-black text-white leading-none">
                        {pack.amount}€
                      </p>
                      <p className="text-[11px] text-zinc-600 mt-1">/mois</p>
                    </div>
                  </div>

                  <div className="h-px w-full bg-white/[0.06] mb-5" />

                  <ul className="space-y-3">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <div
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${emerald}20` }}
                        >
                          <svg
                            className="size-3 shrink-0"
                            style={{ color: emerald }}
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={3}
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        </div>
                        <span className="text-[13px] text-zinc-200">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <button
              onClick={() => router.push("/dashboard")}
              className="text-[11px] text-zinc-600 hover:text-zinc-400 transition cursor-pointer"
            >
              ← Retour au dashboard
            </button>
          </div>

          {/* Right — payment */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-6" style={{ color: emerald }}>
              Informations de paiement
            </p>

            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] p-8 text-center">
                <div className="flex justify-center mb-3">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f87171"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <p className="text-[14px] font-semibold text-white mb-1">Impossible de charger le paiement</p>
                <p className="text-[13px] text-red-400 mb-4">{error}</p>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="inline-flex items-center justify-center rounded-xl px-6 py-2.5 text-[13px] font-semibold text-black transition cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    border: "none",
                    boxShadow: "0 4px 24px rgba(16,185,129,0.25)",
                  }}
                >
                  Retour au dashboard
                </button>
              </div>
            ) : clientSecret && packInfo ? (
              <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
                <PackPaymentForm packInfo={packInfo} />
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

export default function CheckoutPackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070707] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-emerald-500" />
        </div>
      }
    >
      <CheckoutPackForm />
    </Suspense>
  );
}
