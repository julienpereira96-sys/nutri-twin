"use client";

const emerald = "#10b981";

const PLANS = [
  {
    name: "Essentiel",
    price: "149€",
    description: "Pour démarrer et accompagner vos patients prioritaires.",
    features: [
      "Jusqu'à 10 patients",
      "1 praticien",
      "Jumeau configuré sur 31 questions",
      "Chat patient 24h/24",
      "Journal de bord patient",
      "Dashboard praticien",
      "Support par email",
    ],
    plan: "essentiel",
    featured: false,
  },
  {
    name: "Professionnel",
    price: "249€",
    badge: "Recommandé",
    description: "Le jumeau le plus fidèle à votre expertise.",
    features: [
      "Jusqu'à 100 patients",
      "1 praticien",
      "Jumeau configuré sur 31 questions",
      "Upload documents & protocoles",
      "Fidélité maximale du jumeau",
      "Rapport IA mensuel par patient",
      "Journal de bord patient",
      "Support prioritaire",
    ],
    plan: "pro",
    featured: true,
  },
  {
    name: "Cabinet",
    price: "499€",
    description: "Pour les cabinets multi-praticiens.",
    features: [
      "Patients illimités",
      "3 praticiens inclus",
      "Upload documents illimité",
      "Rapport IA mensuel par patient",
      "Journal de bord patient",
      "+99€/praticien supplémentaire",
      "Support dédié",
    ],
    plan: "cabinet",
    featured: false,
  },
];

function PricingCard({ name, price, badge, description, features, plan, featured }: {
  name: string; price: string; badge?: string; description: string;
  features: string[]; plan: string; featured: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        borderRadius: 20,
        padding: "28px 24px",
        background: featured ? "linear-gradient(180deg, rgba(16,185,129,0.07), #080808)" : "#0d0d0d",
        border: featured ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(255,255,255,0.08)",
        boxShadow: featured ? "0 20px 40px rgba(16,185,129,0.05)" : "none",
        transition: "all 0.3s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.border = `1px solid ${featured ? "rgba(16,185,129,0.8)" : "rgba(255,255,255,0.35)"}`;
        e.currentTarget.style.transform = "translateY(-6px) scale(1.01)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.border = featured ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(255,255,255,0.08)";
        e.currentTarget.style.transform = "translateY(0) scale(1)";
      }}
    >
      {featured && badge && (
        <div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
          <span style={{ borderRadius: 999, padding: "4px 14px", fontSize: 11, fontWeight: 700, color: "black", background: emerald }}>
            {badge}
          </span>
        </div>
      )}

      <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "white" }}>{name}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 10 }}>
        <span style={{ fontSize: 40, fontWeight: 900, color: "white", letterSpacing: "-1px" }}>{price}</span>
        <span style={{ fontSize: 12, color: "#52525b" }}>/mois</span>
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 12, color: "#71717a", lineHeight: 1.6 }}>{description}</p>

      <ul style={{ margin: "0 0 24px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <svg style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1, color: emerald }} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <span style={{ fontSize: 12, lineHeight: 1.5, color: i < 3 ? "#e4e4e7" : "#52525b" }}>{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => window.location.assign(`/checkout?plan=${plan}`)}
        style={{
          height: 50,
          width: "100%",
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s",
          ...(featured
            ? { background: emerald, color: "black", border: "none", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }
            : { background: "rgba(255,255,255,0.03)", color: "#d1d5db", border: "1.5px solid rgba(255,255,255,0.12)" }
          ),
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0) scale(1)"; }}
      >
        Choisir ce plan →
      </button>
    </div>
  );
}

export default function ChoosePlanPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#070707",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>

      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, margin: "0 auto 16px", borderRadius: "50%", background: "linear-gradient(135deg, #6ee7b7, #10b981)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>🌿</div>
        <h1 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 700, color: "white" }}>
          Nutri<strong style={{ color: emerald }}>Twin</strong>
        </h1>
      </div>

      {/* Bannière contexte */}
      <div style={{
        maxWidth: 560,
        width: "100%",
        marginBottom: 40,
        background: "rgba(16,185,129,0.06)",
        border: "1px solid rgba(16,185,129,0.2)",
        borderRadius: 16,
        padding: "18px 24px",
        textAlign: "center",
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "white" }}>
          ✅ Votre compte est créé
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
          Il ne vous reste qu&apos;une étape — choisissez votre abonnement pour accéder à votre jumeau numérique.
        </p>
      </div>

      {/* Plans */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 20,
        width: "100%",
        maxWidth: 900,
      }}>
        {PLANS.map(p => (
          <PricingCard key={p.plan} {...p} />
        ))}
      </div>

      <p style={{ marginTop: 32, fontSize: 12, color: "#374151", textAlign: "center" }}>
        Sans engagement · Résiliable à tout moment · Paiement sécurisé par Stripe
      </p>
    </div>
  );
}
