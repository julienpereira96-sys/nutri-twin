"use client";

const emerald = "#10b981";

type Feature = { text: string; included: boolean; exclusive: boolean };

const PLANS: { name: string; price: string; badge?: string; description: string; features: Feature[]; plan: string; featured: boolean; footnoteMark?: string }[] = [
  {
    name: "Essentiel",
    price: "89€",
    description: "Pour démarrer et accompagner vos patients prioritaires.",
    features: [
      { text: "Jusqu'à 10 patients suivis en simultané", included: true, exclusive: false },
      { text: "Votre Jumeau personnalisé (calqué sur votre approche et vos consignes)", included: true, exclusive: false },
      { text: "Analyse en temps réel (détection des comportements et alertes de crises)", included: true, exclusive: false },
      { text: "Préparation automatisée de vos consultations et bilans", included: true, exclusive: false },
      { text: "Espace de stockage sécurisé pour vos protocoles et documents", included: true, exclusive: false },
      { text: "Vision IA : Analyse de photos (repas, étiquettes, bilans…)", included: false, exclusive: true },
      { text: "Mémoire clinique long terme (synthèse permanente de tout le parcours)", included: false, exclusive: true },
    ],
    plan: "essentiel",
    featured: false,
  },
  {
    name: "Professionnel",
    price: "199€",
    badge: "Recommandé",
    description: "Idéal pour les praticiens indépendants qui gèrent un suivi actif au quotidien.",
    features: [
      { text: "Jusqu'à 25 patients suivis en simultané", included: true, exclusive: false },
      { text: "Votre Jumeau personnalisé (calqué sur votre approche et vos consignes)", included: true, exclusive: false },
      { text: "Analyse en temps réel (détection des comportements et alertes de crises)", included: true, exclusive: false },
      { text: "Préparation automatisée de vos consultations et bilans", included: true, exclusive: false },
      { text: "Espace de stockage sécurisé pour vos protocoles et documents", included: true, exclusive: false },
      { text: "Vision IA : Analyse de photos envoyées par vos patients (repas, étiquettes, bilans…)", included: true, exclusive: true },
      { text: "Mémoire clinique long terme (synthèse permanente de tout le parcours)", included: true, exclusive: true },
      { text: "Plafond d'échanges quotidien étendu par patient (3)", included: true, exclusive: true },
    ],
    plan: "pro",
    featured: true,
  },
  {
    name: "Cabinet",
    price: "499€",
    description: "Pour les cabinets multi-praticiens et centres de santé.",
    features: [
      { text: "Jusqu'à 80 patients suivis en simultané (2)", included: true, exclusive: false },
      { text: "Jumeau personnalisé (calqué sur l'approche et les consignes de chaque praticien)", included: true, exclusive: false },
      { text: "Analyse en temps réel (détection des comportements et alertes de crises)", included: true, exclusive: false },
      { text: "Préparation automatisée de vos consultations et bilans", included: true, exclusive: false },
      { text: "Espace de stockage sécurisé pour vos protocoles et documents", included: true, exclusive: false },
      { text: "Vision IA : Analyse de photos envoyées par vos patients (repas, étiquettes, bilans…)", included: true, exclusive: true },
      { text: "Mémoire clinique long terme (synthèse permanente de tout le parcours)", included: true, exclusive: true },
      { text: "Plafond d'échanges quotidien étendu par patient (3)", included: true, exclusive: true },
      { text: "Espace collaboratif : possibilité de transférer ou de partager un dossier entre confrères", included: true, exclusive: true },
    ],
    plan: "cabinet",
    featured: false,
    footnoteMark: "1",
  },
];

function PricingCard({ name, price, badge, description, features, plan, featured, footnoteMark }: {
  name: string; price: string; badge?: string; description: string;
  features: { text: string; included: boolean; exclusive: boolean }[]; plan: string; featured: boolean; footnoteMark?: string;
}) {
  return (
    <div
      className="relative flex flex-col rounded-2xl p-6 sm:p-8 transition-all duration-300"
      style={{
        background: featured ? "linear-gradient(180deg, rgba(16,185,129,0.07), #080808)" : "#0d0d0d",
        border: featured ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(255,255,255,0.08)",
        boxShadow: featured ? "0 20px 40px rgba(16,185,129,0.05)" : "none",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.border = `1px solid ${featured ? "rgba(16,185,129,0.8)" : "rgba(255,255,255,0.35)"}`;
        e.currentTarget.style.boxShadow = featured
          ? "0 0 0 1px rgba(16,185,129,0.3), 0 30px 80px rgba(16,185,129,0.25), 0 0 40px rgba(16,185,129,0.1) inset"
          : "0 0 0 1px rgba(255,255,255,0.15), 0 30px 60px rgba(255,255,255,0.08)";
        e.currentTarget.style.transform = "translateY(-6px) scale(1.01)";
        e.currentTarget.style.background = featured
          ? "linear-gradient(180deg, rgba(16,185,129,0.12), #080808)"
          : "linear-gradient(180deg, rgba(255,255,255,0.04), #0d0d0d)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.border = featured ? "1px solid rgba(16,185,129,0.30)" : "1px solid rgba(255,255,255,0.08)";
        e.currentTarget.style.boxShadow = featured ? "0 20px 40px rgba(16,185,129,0.05)" : "none";
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        e.currentTarget.style.background = featured ? "linear-gradient(180deg, rgba(16,185,129,0.07), #080808)" : "#0d0d0d";
      }}
    >
      {featured && (
        <>
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="rounded-full px-3 py-1 text-[11px] font-semibold text-black" style={{ backgroundColor: emerald }}>{badge}</span>
          </div>
        </>
      )}

      <p className="mb-1 text-[14px] font-bold text-white">{name}</p>
      <div className="mb-3 flex items-baseline gap-1">
        <span className="text-[42px] font-black tracking-tight text-white">{price}</span>
        {footnoteMark && <sup className="text-[13px] font-normal text-zinc-500 ml-0.5">({footnoteMark})</sup>}
        <span className="text-[12px] text-zinc-600">/mois</span>
      </div>
      <p className="mb-5 text-[12px] leading-relaxed text-zinc-500">{description}</p>

      <ul className="mb-6 flex flex-1 flex-col gap-2.5" style={{ padding: 0, listStyle: "none" }}>
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            {f.included ? (
              <svg className="mt-0.5 size-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="mt-0.5 size-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className={`text-[12px] leading-snug ${!f.included ? "text-zinc-700" : i < 5 ? "text-zinc-200" : "text-zinc-500"}`}>
              {f.text.split(/(\([123]\))/).map((part, j) =>
                /^\([123]\)$/.test(part) ? <sup key={j} style={{ fontSize: "0.75em" }}>{part}</sup> : part
              )}
            </span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => window.location.assign(`/checkout?plan=${plan}`)}
        className="inline-flex h-[50px] w-full items-center justify-center rounded-xl text-[13px] font-semibold transition active:scale-95 mt-2 cursor-pointer"
        style={featured
          ? { backgroundColor: emerald, color: "black", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }
          : { border: "1.5px solid rgba(255,255,255,0.12)", color: "#d1d5db", background: "rgba(255,255,255,0.03)" }
        }
        onMouseEnter={e => {
          e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
          e.currentTarget.style.boxShadow = featured
            ? "0 0 0 1px rgba(16,185,129,0.5), 0 8px 30px rgba(16,185,129,0.4)"
            : "0 0 0 1px rgba(255,255,255,0.2), 0 8px 20px rgba(255,255,255,0.05)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "translateY(0) scale(1)";
          e.currentTarget.style.boxShadow = featured ? "0 4px 14px rgba(16,185,129,0.3)" : "none";
        }}
      >
        Choisir ce plan
      </button>
    </div>
  );
}

export default function ChoosePlanPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>

      {/* Header */}
      <div style={{ marginBottom: 36, textAlign: "center" }}>
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
            overflow: "hidden",
          }}>
            <img src="/logo.png" alt="NutriTwin" style={{ width: 72, height: 72, padding: "14px", objectFit: "contain", boxSizing: "border-box" }} />
          </div>
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.2)",
          borderRadius: 999, padding: "5px 14px", marginBottom: 16,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={emerald} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: emerald }}>Votre compte est créé</span>
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "white", lineHeight: 1.3 }}>
          Choisissez votre abonnement
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "#71717a", lineHeight: 1.6 }}>
          Sélectionnez la formule adaptée à votre pratique.
        </p>
      </div>

      {/* Plans */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
        width: "100%",
        maxWidth: 1100,
      }}>
        {PLANS.map(p => (
          <PricingCard key={p.plan} {...p} />
        ))}
      </div>

      <div style={{ marginTop: 24, maxWidth: 768, width: "100%", margin: "24px auto 0", display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: "#52525b" }}><sup>(1)</sup> Le plan Cabinet inclut 3 comptes praticiens indépendants. Chaque praticien supplémentaire est facturé 149&nbsp;€/mois et ouvre 25 patients additionnels.</p>
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: "#52525b" }}><sup>(2)</sup> 80 patients inclus pour les 3 praticiens du plan Cabinet. Chaque praticien supplémentaire bénéficie de 25 patients additionnels.</p>
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: "#52525b" }}><sup>(3)</sup> Gestion des volumes et sécurité : l&apos;enveloppe de messages est fixée à 30 messages/jour sur le plan Essentiel et élargie à 100 messages/jour sur les plans Professionnel et Cabinet afin de garantir la stabilité technique de la plateforme et de maintenir un cadre d&apos;échange structuré pour le patient. Conformément à la réglementation, toutes vos données cliniques sont chiffrées, hébergées sur des serveurs sécurisés en Europe, et ne sont jamais utilisées pour entraîner des modèles d&apos;IA publics.</p>
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: "#52525b", textAlign: "center" }}>
        Sans engagement · Résiliable à tout moment · Paiement sécurisé
      </p>
    </div>
  );
}
