"use client";
export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const emerald = "#10b981";

const BASE_CAPACITY: Record<string, number> = {
  essentiel: 10,
  pro: 25,
  cabinet: 80,
};

function PackSuccessContent() {
  const router = useRouter();
  const params = useSearchParams();

  const size = parseInt(params.get("size") ?? "0", 10);
  const plan = params.get("plan") ?? "pro";
  const amount = parseInt(params.get("amount") ?? "0", 10);

  const [navigating, setNavigating] = useState(false);
  const [extraPatients, setExtraPatients] = useState<number | null>(null);

  // Bloquer le retour arrière
  useEffect(() => {
    window.history.pushState(null, "", window.location.pathname);
    const handlePopState = () => window.history.pushState(null, "", window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Récupérer extra_patients pour l'affichage de capacité
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      const { data } = await supabase
        .from("practitioners")
        .select("extra_patients")
        .eq("user_id", user.id)
        .single();
      setExtraPatients(data?.extra_patients ?? 0);
    };
    void load();
  }, [router]);

  const base = BASE_CAPACITY[plan] ?? 25;
  const afterExtra = extraPatients ?? null;
  const capacityBefore = afterExtra !== null ? base + afterExtra - size : null;
  const capacityAfter = afterExtra !== null ? base + afterExtra : null;

  const planLabel = plan === "essentiel" ? "Essentiel" : plan === "pro" ? "Professionnel" : "Cabinet";
  const packLabel = size > 0 ? `Pack +${size} patients` : "Pack patients";

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
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ maxWidth: 460, width: "100%", animation: "fadeUp 0.4s ease" }}>

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
            <span style={{ fontSize: 11, fontWeight: 600, color: emerald, letterSpacing: "0.04em" }}>Pack activé</span>
          </div>

          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "white" }}>
            Paiement confirmé
          </h1>
        </div>

        {/* Card */}
        <div style={{
          background: "#111111",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          padding: "24px",
        }}>
          <p style={{ margin: "0 0 18px", fontSize: 11, fontWeight: 600, color: "#4b5563", letterSpacing: "0.1em", textTransform: "uppercase", textAlign: "center" }}>
            Votre pack
          </p>

          {/* Pack detail */}
          <div style={{
            background: "rgba(16,185,129,0.05)",
            border: "1px solid rgba(16,185,129,0.18)",
            borderRadius: 14,
            padding: "14px 18px",
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: "white" }}>{packLabel}</p>
              <p style={{ margin: 0, fontSize: 12, color: emerald }}>Plan {planLabel}</p>
            </div>
            {amount > 0 && (
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "white", lineHeight: 1 }}>{amount}€</p>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "#52525b" }}>/mois</p>
              </div>
            )}
          </div>

          {/* Capacity row */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 18,
          }}>
            {capacityBefore !== null && capacityAfter !== null ? (
              <>
                <span style={{ fontSize: 13, color: "#52525b" }}>{capacityBefore} patients</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: emerald }}>{capacityAfter} patients</span>
                <span style={{ fontSize: 11, color: "#374151", marginLeft: 2 }}>capacité totale</span>
              </>
            ) : (
              <>
                <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTop: "2px solid rgba(255,255,255,0.4)", animation: "spin 1s linear infinite", display: "inline-block" }} />
                <span style={{ fontSize: 12, color: "#52525b" }}>Calcul de la capacité…</span>
              </>
            )}
          </div>

          {/* Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {[
              {
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                ),
                label: size > 0 ? `${size} nouveaux slots patients` : "Nouveaux slots patients",
                desc: "disponibles dès maintenant dans votre dashboard.",
              },
              {
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                ),
                label: "Facturation mensuelle",
                desc: "ajoutée à votre prochaine échéance. Résiliable à tout moment.",
              },
              {
                icon: (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                ),
                label: "Même qualité de suivi IA",
                desc: "pour tous vos patients, sans configuration supplémentaire.",
              },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{item.icon}</div>
                <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.6, paddingTop: 5 }}>
                  <strong style={{ color: "white" }}>{item.label}</strong> {item.desc}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              if (!navigating) {
                setNavigating(true);
                router.push("/dashboard");
              }
            }}
            disabled={navigating}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "100%", height: 50, borderRadius: 12,
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "black", fontWeight: 700, fontSize: 14,
              cursor: navigating ? "not-allowed" : "pointer",
              border: "none", transition: "all 0.25s ease",
              boxShadow: "0 4px 24px rgba(16,185,129,0.25)",
              opacity: navigating ? 0.7 : 1,
            }}
            onMouseEnter={e => { if (!navigating) { e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(16,185,129,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            {navigating
              ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTop: "2px solid black", animation: "spin 1s linear infinite", display: "inline-block" }} />
                  Chargement
                </span>
              : "Retour au dashboard"
            }
          </button>
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: "#374151", textAlign: "center" }}>
          Paiement sécurisé par Stripe
        </p>
      </div>
    </div>
  );
}

export default function PackSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: emerald, fontSize: 14 }}>Chargement</p>
      </div>
    }>
      <PackSuccessContent />
    </Suspense>
  );
}
