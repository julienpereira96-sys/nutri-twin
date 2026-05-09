"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const OBJECTIFS = [
  { id: "poids", label: "Perdre du poids", emoji: "⚖️" },
  { id: "energie", label: "Avoir plus d'énergie", emoji: "⚡" },
  { id: "digestion", label: "Améliorer ma digestion", emoji: "🌿" },
  { id: "muscle", label: "Prendre du muscle", emoji: "💪" },
  { id: "pathologie", label: "Gérer une pathologie", emoji: "🏥" },
  { id: "equilibre", label: "Manger plus équilibré", emoji: "🥗" },
];

const MOODS = [
  { id: "abloc", label: "À bloc !", emoji: "🔥" },
  { id: "optimiste", label: "Optimiste", emoji: "😊" },
  { id: "anxieux", label: "Un peu anxieux", emoji: "😰" },
  { id: "perdu", label: "Complètement perdu", emoji: "😕" },
  { id: "fatigue", label: "Fatigué mais motivé", emoji: "😴" },
];

const DEFIS = [
  { id: "temps", label: "Manque de temps", emoji: "⏰" },
  { id: "sucre", label: "Fringales de sucre", emoji: "🍫" },
  { id: "restaurant", label: "Repas au restaurant", emoji: "🍽️" },
  { id: "motivation", label: "Manque de motivation", emoji: "😔" },
  { id: "cuisine", label: "Je ne sais pas cuisiner", emoji: "👨‍🍳" },
  { id: "stress", label: "Manger sous le stress", emoji: "😤" },
];

const ALIMENTS = [
  "Poisson", "Brocoli", "Abats", "Champignons", "Épinards",
  "Tofu", "Avocat", "Betterave", "Céleri", "Chou",
  "Pâtes", "Chocolat", "Fromage", "Fruits", "Viande rouge",
  "Œufs", "Légumineuses", "Riz", "Pain", "Yaourt",
];

export default function PatientOnboardingPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Étape 1 — Confirmation infos praticien
  const [confirmAge, setConfirmAge] = useState("");
  const [confirmSexe, setConfirmSexe] = useState("");
  const [confirmTaille, setConfirmTaille] = useState("");
  const [confirmPoids, setConfirmPoids] = useState("");
  const [confirmPathologies, setConfirmPathologies] = useState("");
  const [confirmAllergies, setConfirmAllergies] = useState("");
  const [confirmTraitements, setConfirmTraitements] = useState("");
  const [confirmNiveauActivite, setConfirmNiveauActivite] = useState("");
  const [confirmRegime, setConfirmRegime] = useState("");

  // Étape 2 — Questions patient
  const [objectif, setObjectif] = useState("");
  const [mood, setMood] = useState("");
  const [defi, setDefi] = useState("");
  const [alimentsAimes, setAlimentsAimes] = useState<string[]>([]);
  const [alimentsDetestes, setAlimentsDetestes] = useState<string[]>([]);

  const totalSteps = 3;

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/patient-login");
        return;
      }

      const { data: patient } = await supabase
        .from("patients")
        .select("age, sexe, taille, poids, pathologies, allergies, traitements, niveau_activite, regime_specifique")
        .eq("user_id", data.user.id)
        .single();

      if (patient) {
        setConfirmAge(patient.age ? String(patient.age) : "");
        setConfirmSexe(patient.sexe ?? "");
        setConfirmTaille(patient.taille ? String(patient.taille) : "");
        setConfirmPoids(patient.poids ? String(patient.poids) : "");
        setConfirmPathologies(patient.pathologies ?? "");
        setConfirmAllergies(patient.allergies ?? "");
        setConfirmTraitements(patient.traitements ?? "");
        setConfirmNiveauActivite(patient.niveau_activite ?? "");
        setConfirmRegime(patient.regime_specifique ?? "");
      }
    });
  }, []);

  const toggleAliment = (aliment: string, type: "aime" | "deteste") => {
    if (type === "aime") {
      setAlimentsDetestes((prev) => prev.filter((a) => a !== aliment));
      setAlimentsAimes((prev) =>
        prev.includes(aliment) ? prev.filter((a) => a !== aliment) : [...prev, aliment]
      );
    } else {
      setAlimentsAimes((prev) => prev.filter((a) => a !== aliment));
      setAlimentsDetestes((prev) =>
        prev.includes(aliment) ? prev.filter((a) => a !== aliment) : [...prev, aliment]
      );
    }
  };

  const saveAndContinue = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("patients").update({
      age: confirmAge ? parseInt(confirmAge) : null,
      sexe: confirmSexe || null,
      taille: confirmTaille ? parseInt(confirmTaille) : null,
      poids: confirmPoids ? parseFloat(confirmPoids) : null,
      pathologies: confirmPathologies || null,
      allergies: confirmAllergies || null,
      traitements: confirmTraitements || null,
      niveau_activite: confirmNiveauActivite || null,
      regime_specifique: confirmRegime || null,
      objective: objectif || null,
      motivation: mood || null,
      defi: defi || null,
      aliments_aimes: alimentsAimes.join(", ") || null,
      aliments_detestes: alimentsDetestes.join(", ") || null,
      onboarding_completed: true,
    }).eq("user_id", user.id);

    setSaving(false);
    router.push("/chat");
  };

  const inputStyle = {
    width: "100%", height: 44, borderRadius: 10,
    border: "1.5px solid rgba(255,255,255,0.1)",
    background: "#1a1a1a", color: "white",
    padding: "0 14px", fontSize: 14, outline: "none",
    boxSizing: "border-box" as const,
  };

  const selectStyle = {
    width: "100%", height: 44, borderRadius: 10,
    border: "1.5px solid rgba(255,255,255,0.1)",
    background: "#1a1a1a", color: "white",
    padding: "0 14px", fontSize: 14, outline: "none",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍃</div>
          <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800, color: "white" }}>
            Bienvenue sur NutriTwin
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: "#64748b" }}>
            Quelques questions pour personnaliser votre expérience
          </p>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < step ? "#10b981" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
          ))}
        </div>

        {/* ÉTAPE 1 — Confirmation infos */}
        {step === 1 && (
          <div style={{ background: "#111111", borderRadius: 20, padding: 28, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>
              Vos informations de santé
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#64748b" }}>
              Votre praticien a pré-rempli ces informations. Vérifiez et corrigez si nécessaire.
            </p>

            {/* Âge, taille, poids */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Âge</p>
                <input type="number" value={confirmAge} onChange={(e) => setConfirmAge(e.target.value)} placeholder="Ex: 34" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = "#10b981"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              </div>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Taille (cm)</p>
                <input type="number" value={confirmTaille} onChange={(e) => setConfirmTaille(e.target.value)} placeholder="Ex: 168" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = "#10b981"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              </div>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Poids (kg)</p>
                <input type="number" value={confirmPoids} onChange={(e) => setConfirmPoids(e.target.value)} placeholder="Ex: 72" style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = "#10b981"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              </div>
            </div>

            {/* Sexe, activité, régime */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Sexe</p>
                <select value={confirmSexe} onChange={(e) => setConfirmSexe(e.target.value)} style={{ ...selectStyle, color: confirmSexe ? "white" : "#64748b" }}>
                  <option value="">—</option>
                  <option value="Femme">Femme</option>
                  <option value="Homme">Homme</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Activité physique</p>
                <select value={confirmNiveauActivite} onChange={(e) => setConfirmNiveauActivite(e.target.value)} style={{ ...selectStyle, color: confirmNiveauActivite ? "white" : "#64748b" }}>
                  <option value="">—</option>
                  <option value="Sédentaire">Sédentaire</option>
                  <option value="Légère (1-2x/sem)">Légère</option>
                  <option value="Modérée (3-4x/sem)">Modérée</option>
                  <option value="Intense (5x+/sem)">Intense</option>
                  <option value="Athlète">Athlète</option>
                </select>
              </div>
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Régime</p>
                <select value={confirmRegime} onChange={(e) => setConfirmRegime(e.target.value)} style={{ ...selectStyle, color: confirmRegime ? "white" : "#64748b" }}>
                  <option value="">—</option>
                  <option value="Omnivore">Omnivore</option>
                  <option value="Végétarien">Végétarien</option>
                  <option value="Végétalien">Végétalien</option>
                  <option value="Vegan">Vegan</option>
                  <option value="Sans gluten">Sans gluten</option>
                  <option value="Sans lactose">Sans lactose</option>
                  <option value="Halal">Halal</option>
                  <option value="Casher">Casher</option>
                  <option value="Cétogène">Cétogène</option>
                  <option value="Méditerranéen">Méditerranéen</option>
                </select>
              </div>
            </div>

            {/* Pathologies, allergies, traitements */}
            {[
              { label: "Pathologies", value: confirmPathologies, onChange: setConfirmPathologies, placeholder: "Ex: Diabète type 2" },
              { label: "Allergies & intolérances", value: confirmAllergies, onChange: setConfirmAllergies, placeholder: "Ex: Gluten, lactose" },
              { label: "Traitements en cours", value: confirmTraitements, onChange: setConfirmTraitements, placeholder: "Ex: Metformine 500mg" },
            ].map(({ label, value, onChange, placeholder }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = "#10b981"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              </div>
            ))}

            <button onClick={() => setStep(2)} style={{ width: "100%", height: 48, borderRadius: 24, background: "#10b981", border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 8 }}>
              Confirmer et continuer →
            </button>
          </div>
        )}

        {/* ÉTAPE 2 — Objectif + Mood + Défi */}
        {step === 2 && (
          <div style={{ background: "#111111", borderRadius: 20, padding: 28, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>Parlez-nous de vous</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#64748b" }}>Ces infos aident votre jumeau à adapter ses conseils.</p>

            {/* Objectif */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "white" }}>Quel est votre objectif principal ?</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {OBJECTIFS.map((o) => (
                  <button key={o.id} onClick={() => setObjectif(o.id)} style={{ borderRadius: 12, border: `2px solid ${objectif === o.id ? "#10b981" : "rgba(255,255,255,0.1)"}`, background: objectif === o.id ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)", padding: "12px", textAlign: "left", cursor: "pointer" }}>
                    <span style={{ fontSize: 20 }}>{o.emoji}</span>
                    <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: "white" }}>{o.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "white" }}>Comment vous sentez-vous face au changement ?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {MOODS.map((m) => (
                  <button key={m.id} onClick={() => setMood(m.id)} style={{ borderRadius: 12, border: `2px solid ${mood === m.id ? "#10b981" : "rgba(255,255,255,0.1)"}`, background: mood === m.id ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)", padding: "12px 16px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22 }}>{m.emoji}</span>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "white" }}>{m.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Défi */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "white" }}>Quel est votre plus gros défi ?</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {DEFIS.map((d) => (
                  <button key={d.id} onClick={() => setDefi(d.id)} style={{ borderRadius: 12, border: `2px solid ${defi === d.id ? "#10b981" : "rgba(255,255,255,0.1)"}`, background: defi === d.id ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)", padding: "12px", textAlign: "left", cursor: "pointer" }}>
                    <span style={{ fontSize: 20 }}>{d.emoji}</span>
                    <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: "white" }}>{d.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, height: 48, borderRadius: 24, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>← Retour</button>
              <button onClick={() => setStep(3)} disabled={!objectif || !mood || !defi} style={{ flex: 2, height: 48, borderRadius: 24, background: !objectif || !mood || !defi ? "rgba(255,255,255,0.05)" : "#10b981", border: "none", color: !objectif || !mood || !defi ? "#64748b" : "black", fontSize: 15, fontWeight: 600, cursor: !objectif || !mood || !defi ? "not-allowed" : "pointer" }}>
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 — Préférences alimentaires */}
        {step === 3 && (
          <div style={{ background: "#111111", borderRadius: 20, padding: 28, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>Vos préférences alimentaires</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#64748b" }}>Cliquez une fois pour ❤️ aimer, deux fois pour ❌ ne pas aimer.</p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {ALIMENTS.map((aliment) => {
                const aime = alimentsAimes.includes(aliment);
                const deteste = alimentsDetestes.includes(aliment);
                return (
                  <button key={aliment} onClick={() => {
                    if (!aime && !deteste) toggleAliment(aliment, "aime");
                    else if (aime) toggleAliment(aliment, "deteste");
                    else toggleAliment(aliment, "aime");
                  }} style={{ borderRadius: 20, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none", background: aime ? "rgba(16,185,129,0.2)" : deteste ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.05)", color: aime ? "#10b981" : deteste ? "#f87171" : "#94a3b8", transition: "all 0.2s" }}>
                    {aime ? "❤️ " : deteste ? "❌ " : ""}{aliment}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {alimentsAimes.length > 0 && (
                <div style={{ flex: 1, background: "rgba(16,185,129,0.08)", borderRadius: 10, border: "1px solid rgba(16,185,129,0.2)", padding: "10px 12px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#10b981" }}>J'aime ❤️</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>{alimentsAimes.join(", ")}</p>
                </div>
              )}
              {alimentsDetestes.length > 0 && (
                <div style={{ flex: 1, background: "rgba(239,68,68,0.08)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.2)", padding: "10px 12px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#f87171" }}>Je n'aime pas ❌</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>{alimentsDetestes.join(", ")}</p>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, height: 48, borderRadius: 24, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>← Retour</button>
              <button onClick={() => void saveAndContinue()} disabled={saving} style={{ flex: 2, height: 48, borderRadius: 24, background: saving ? "rgba(255,255,255,0.05)" : "#10b981", border: "none", color: saving ? "#64748b" : "black", fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Sauvegarde..." : "Accéder à mon espace →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
