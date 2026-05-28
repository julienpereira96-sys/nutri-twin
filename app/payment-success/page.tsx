"use client";

import { Suspense, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const emerald = "#10b981";

function PaymentSuccessContent() {
  const router = useRouter();
  const [planReady, setPlanReady] = useState(false);
  const [webhookTimeout, setWebhookTimeout] = useState(false);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let attempts = 0;
    const maxAttempts = 20;

    const interval = setInterval(async () => {
      attempts++;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { clearInterval(interval); router.push("/"); return; }
      const { data } = await supabase.from("practitioners").select("plan").eq("user_id", user.id).single();
      if (data?.plan) { setPlanReady(true); clearInterval(interval); }
      else if (attempts >= maxAttempts) { clearInterval(interval); setWebhookTimeout(true); }
    }, 2000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: 460, width: "100%" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 20px" }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: "rgba(16,185,129,0.2)", filter: "blur(12px)",
            }} />
            <div style={{
              position: "relative", width: 72, height: 72, borderRadius: "50%",
              background: "transparent",
              border: "2px solid rgba(16,185,129,0.6)",
              boxShadow: "0 0 16px rgba(16,185,129,0.3), 0 0 32px rgba(16,185,129,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
          </div>

          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(16,185,129,0.08)",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 999, padding: "4px 12px", marginBottom: 14,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: emerald, display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: emerald, letterSpacing: "0.04em" }}>Abonnement activé</span>
          </div>

          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "white" }}>
            Paiement confirmé
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "#71717a" }}>
            Votre accès NutriTwin est prêt à être configuré.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "#111111",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: "24px",
        }}>

          {webhookTimeout ? (
            <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 3h14M5 21h14M7 3v4.5a5 5 0 0 0 10 0V3M7 21v-4.5a5 5 0 0 1 10 0V21"/>
                  <path d="M9 10.5c1 .5 2 .75 3 .75s2-.25 3-.75"/>
                </svg>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "white" }}>
                Activation en cours
              </p>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "#71717a", lineHeight: 1.6 }}>
                Votre paiement a bien été reçu. L&apos;activation prend plus de temps que prévu.
                Rafraîchissez dans quelques instants ou contactez{" "}
                <a href="mailto:support@nutritwin.fr" style={{ color: emerald }}>support@nutritwin.fr</a>.
              </p>
              <button
                onClick={() => window.location.reload()}
                style={{ padding: "11px 24px", borderRadius: 10, background: emerald, color: "black", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}
              >
                Rafraîchir la page
              </button>
            </div>
          ) : (
            <>
              <p style={{ margin: "0 0 20px", fontSize: 11, fontWeight: 600, color: "#4b5563", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center" }}>
                Prochaine étape — Configuration du jumeau
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {[
                  {
                    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
                    label: "15 minutes",
                    desc: "suffisent pour calibrer votre jumeau.",
                  },
                  {
                    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
                    label: "Répondez naturellement",
                    desc: "comme si vous parliez à un confrère.",
                  },
                  {
                    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>,
                    label: "Plus vous êtes précis",
                    desc: "meilleur sera le résultat final.",
                  },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                      background: "rgba(16,185,129,0.08)",
                      border: "1px solid rgba(16,185,129,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>{item.icon}</div>
                    <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6 }}>
                      <strong style={{ color: "white" }}>{item.label}</strong> {item.desc}
                    </p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { if (planReady && !navigating) { setNavigating(true); router.push("/onboarding"); } }}
                disabled={!planReady || navigating}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "100%", height: 50, borderRadius: 12,
                  background: planReady ? emerald : "rgba(255,255,255,0.05)",
                  color: planReady ? "black" : "#4b5563",
                  fontWeight: 700, fontSize: 14,
                  cursor: planReady ? "pointer" : "not-allowed",
                  border: "none", transition: "all 0.2s",
                  boxShadow: planReady ? "0 4px 14px rgba(16,185,129,0.25)" : "none",
                }}
                onMouseEnter={e => { if (planReady && !navigating) { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(16,185,129,0.5), 0 8px 30px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-2px) scale(1.01)"; } }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = planReady ? "0 4px 14px rgba(16,185,129,0.25)" : "none"; e.currentTarget.style.transform = "translateY(0) scale(1)"; }}
              >
                {navigating
                  ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTop: "2px solid black", animation: "spin 1s linear infinite", display: "inline-block" }} />Chargement</span>
                  : planReady
                  ? "Commencer la programmation →"
                  : <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)", borderTop: "2px solid rgba(255,255,255,0.6)", animation: "spin 1s linear infinite", display: "inline-block" }} />
                      Finalisation de votre accès
                    </span>
                }
              </button>
            </>
          )}
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: "#374151", textAlign: "center" }}>
          Paiement sécurisé par Stripe
        </p>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: emerald, fontSize: 14 }}>Chargement</p>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
