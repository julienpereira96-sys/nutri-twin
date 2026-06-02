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
  "Poisson", "Viande rouge", "Poulet", "Dinde", "Œufs", "Tofu", "Légumineuses", "Fruits de mer", "Abats", "Charcuterie",
  "Brocoli", "Épinards", "Courgette", "Tomate", "Avocat", "Champignons", "Betterave", "Céleri", "Chou", "Carottes", "Poivron", "Aubergine", "Artichaut",
  "Pâtes", "Riz", "Pain", "Quinoa", "Pomme de terre", "Patate douce",
  "Fromage", "Yaourt", "Lait", "Beurre",
  "Fruits", "Chocolat", "Noix", "Graines",
];

const EQUIPEMENT = [
  { id: "four", label: "Four" },
  { id: "plaques", label: "Plaques de cuisson" },
  { id: "micro_ondes", label: "Micro-ondes uniquement" },
  { id: "cuiseur_vapeur", label: "Cuiseur vapeur" },
  { id: "blender", label: "Blender / mixeur" },
  { id: "airfryer", label: "Air fryer" },
];

const SOMMEIL = [
  { id: "moins6", label: "Moins de 6h" },
  { id: "6_7", label: "6 à 7h" },
  { id: "7_8", label: "7 à 8h" },
  { id: "plus8", label: "Plus de 8h" },
];

const DIGESTIF = [
  { id: "ballonnements", label: "Ballonnements fréquents" },
  { id: "transit_lent", label: "Transit lent" },
  { id: "transit_rapide", label: "Transit rapide" },
  { id: "reflux", label: "Reflux / brûlures" },
  { id: "aucun", label: "Aucun inconfort" },
];

const LS_KEY = "patient_onboarding";

export default function PatientOnboardingPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editMode, setEditMode] = useState(false);

  // Étape 1
  const [confirmAge, setConfirmAge] = useState("");
  const [confirmSexe, setConfirmSexe] = useState("");
  const [confirmTaille, setConfirmTaille] = useState("");
  const [confirmPoids, setConfirmPoids] = useState("");
  const [confirmPathologies, setConfirmPathologies] = useState("");
  const [confirmAllergies, setConfirmAllergies] = useState("");
  const [confirmTraitements, setConfirmTraitements] = useState("");
  const [confirmNiveauActivite, setConfirmNiveauActivite] = useState("");
  const [confirmRegime, setConfirmRegime] = useState("");

  // Étape 2
  const [objectif, setObjectif] = useState("");
  const [objectifCustom, setObjectifCustom] = useState("");
  const [mood, setMood] = useState("");
  const [moodCustom, setMoodCustom] = useState("");
  const [defi, setDefi] = useState("");
  const [defiCustom, setDefiCustom] = useState("");

  // Étape 3
  const [equipement, setEquipement] = useState<string[]>([]);
  const [tempsCuisine, setTempsCuisine] = useState("");
  const [budget, setBudget] = useState("");
  const [repasSautes, setRepasSautes] = useState<string[]>([]);
  const [sommeil, setSommeil] = useState("");
  const [digestif, setDigestif] = useState<string[]>([]);

  // Étape 4
  const [alimentsAimes, setAlimentsAimes] = useState<string[]>([]);
  const [alimentsDetestes, setAlimentsDetestes] = useState<string[]>([]);
  const [alimentCustom, setAlimentCustom] = useState("");

  const totalSteps = 4;

  // Restaurer depuis localStorage au montage, puis compléter avec les données Supabase
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/patient-login"); return; }

      // 1. Essayer de restaurer depuis localStorage en priorité
      try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved) {
          const p = JSON.parse(saved) as Record<string, unknown>;
          if (typeof p.step === "number") setStep(p.step);
          if (typeof p.confirmAge === "string") setConfirmAge(p.confirmAge);
          if (typeof p.confirmSexe === "string") setConfirmSexe(p.confirmSexe);
          if (typeof p.confirmTaille === "string") setConfirmTaille(p.confirmTaille);
          if (typeof p.confirmPoids === "string") setConfirmPoids(p.confirmPoids);
          if (typeof p.confirmPathologies === "string") setConfirmPathologies(p.confirmPathologies);
          if (typeof p.confirmAllergies === "string") setConfirmAllergies(p.confirmAllergies);
          if (typeof p.confirmTraitements === "string") setConfirmTraitements(p.confirmTraitements);
          if (typeof p.confirmNiveauActivite === "string") setConfirmNiveauActivite(p.confirmNiveauActivite);
          if (typeof p.confirmRegime === "string") setConfirmRegime(p.confirmRegime);
          if (typeof p.objectif === "string") setObjectif(p.objectif);
          if (typeof p.objectifCustom === "string") setObjectifCustom(p.objectifCustom);
          if (typeof p.mood === "string") setMood(p.mood);
          if (typeof p.moodCustom === "string") setMoodCustom(p.moodCustom);
          if (typeof p.defi === "string") setDefi(p.defi);
          if (typeof p.defiCustom === "string") setDefiCustom(p.defiCustom);
          if (Array.isArray(p.equipement)) setEquipement(p.equipement as string[]);
          if (typeof p.tempsCuisine === "string") setTempsCuisine(p.tempsCuisine);
          if (typeof p.budget === "string") setBudget(p.budget);
          if (Array.isArray(p.repasSautes)) setRepasSautes(p.repasSautes as string[]);
          if (typeof p.sommeil === "string") setSommeil(p.sommeil);
          if (Array.isArray(p.digestif)) setDigestif(p.digestif as string[]);
          if (Array.isArray(p.alimentsAimes)) setAlimentsAimes(p.alimentsAimes as string[]);
          if (Array.isArray(p.alimentsDetestes)) setAlimentsDetestes(p.alimentsDetestes as string[]);
          return; // localStorage prime sur les données Supabase
        }
      } catch { /* ignore */ }

      // 2. Pas de localStorage - charger les données pré-remplies par le praticien via API
      const res = await fetch("/api/get-patient-profile");
      if (res.ok) {
        const { patient } = await res.json() as { patient: { age?: number; sexe?: string; taille?: number; poids?: number; pathologies?: string; allergies?: string; traitements?: string; niveau_activite?: string; regime_specifique?: string } | null };
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
      }
    });
  }, []);

  // Sauvegarder dans localStorage à chaque changement de state
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        step,
        confirmAge, confirmSexe, confirmTaille, confirmPoids,
        confirmPathologies, confirmAllergies, confirmTraitements,
        confirmNiveauActivite, confirmRegime,
        objectif, objectifCustom, mood, moodCustom, defi, defiCustom,
        equipement, tempsCuisine, budget, repasSautes, sommeil, digestif,
        alimentsAimes, alimentsDetestes,
      }));
    } catch { /* ignore quota errors */ }
  }, [
    step, confirmAge, confirmSexe, confirmTaille, confirmPoids,
    confirmPathologies, confirmAllergies, confirmTraitements,
    confirmNiveauActivite, confirmRegime,
    objectif, objectifCustom, mood, moodCustom, defi, defiCustom,
    equipement, tempsCuisine, budget, repasSautes, sommeil, digestif,
    alimentsAimes, alimentsDetestes,
  ]);

  const toggleMultiple = (value: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(value) ? list.filter(x => x !== value) : [...list, value]);
  };

  const toggleAliment = (aliment: string, type: "aime" | "deteste") => {
    if (type === "aime") {
      setAlimentsDetestes(prev => prev.filter(a => a !== aliment));
      setAlimentsAimes(prev => prev.includes(aliment) ? prev.filter(a => a !== aliment) : [...prev, aliment]);
    } else {
      setAlimentsAimes(prev => prev.filter(a => a !== aliment));
      setAlimentsDetestes(prev => prev.includes(aliment) ? prev.filter(a => a !== aliment) : [...prev, aliment]);
    }
  };

  const addAlimentCustom = () => {
    if (!alimentCustom.trim()) return;
    setAlimentsAimes(prev => [...prev, alimentCustom.trim()]);
    setAlimentCustom("");
  };

  const saveAndContinue = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/patient-login"); return; }

      const finalObjectif = objectif === "autre" ? objectifCustom : objectif;
      const finalMood = mood === "autre" ? moodCustom : mood;
      const finalDefi = defi === "autre" ? defiCustom : defi;

      const { error } = await supabase.from("patients").update({
        age: confirmAge ? parseInt(confirmAge) : null,
        sexe: confirmSexe || null,
        taille: confirmTaille ? parseInt(confirmTaille) : null,
        poids: confirmPoids ? parseFloat(confirmPoids) : null,
        pathologies: confirmPathologies || null,
        allergies: confirmAllergies || null,
        traitements: confirmTraitements || null,
        niveau_activite: confirmNiveauActivite || null,
        regime_specifique: confirmRegime || null,
        objective: finalObjectif || null,
        motivation: finalMood || null,
        defi: finalDefi || null,
        aliments_aimes: alimentsAimes.join(", ") || null,
        aliments_detestes: alimentsDetestes.join(", ") || null,
        notes: [
          equipement.length > 0 ? `Équipement: ${equipement.join(", ")}` : "",
          tempsCuisine ? `Temps cuisine: ${tempsCuisine}` : "",
          budget ? `Budget: ${budget}` : "",
          repasSautes.length > 0 ? `Repas sautés: ${repasSautes.join(", ")}` : "",
          sommeil ? `Sommeil: ${sommeil}` : "",
          digestif.length > 0 ? `Digestif: ${digestif.join(", ")}` : "",
        ].filter(Boolean).join(" | ") || null,
        onboarding_completed: true,
        onboarding_status: "completed",
      }).eq("user_id", user.id);

      if (error) throw new Error(error.message);

      // Succès - nettoyer le localStorage et rediriger
      try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
      router.push("/chat");
    } catch {
      setSaveError("Une erreur est survenue lors de la sauvegarde. Veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 44, borderRadius: 12,
    border: "1.5px solid rgba(255,255,255,0.1)",
    background: "#1a1a1a", color: "white",
    padding: "0 14px", fontSize: 14, outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%", height: 44, borderRadius: 12,
    border: "1.5px solid rgba(255,255,255,0.1)",
    background: "#1a1a1a", color: "white",
    padding: "0 14px", fontSize: 14, outline: "none",
    boxSizing: "border-box",
  };

  const cardBtn = (active: boolean): React.CSSProperties => ({
    borderRadius: 12,
    border: `2px solid ${active ? "#10b981" : "rgba(255,255,255,0.08)"}`,
    background: active ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)",
    padding: "12px",
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.15s",
    width: "100%",
  });

  const badges = [
    { label: "Âge", value: confirmAge ? `${confirmAge} ans` : null },
    { label: "Sexe", value: confirmSexe || null },
    { label: "Taille", value: confirmTaille ? `${confirmTaille} cm` : null },
    { label: "Poids", value: confirmPoids ? `${confirmPoids} kg` : null },
    { label: "Activité", value: confirmNiveauActivite || null },
    { label: "Régime", value: confirmRegime || null },
    { label: "Pathologies", value: confirmPathologies || null },
    { label: "Allergies", value: confirmAllergies || null },
    { label: "Traitements", value: confirmTraitements || null },
  ].filter(b => b.value);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'Inter', -apple-system, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 16px" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(16,185,129,0.15)", filter: "blur(12px)" }} />
            <div style={{ position: "relative", width: 72, height: 72, borderRadius: "50%", border: "2px solid rgba(16,185,129,0.5)", boxShadow: "0 0 20px rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🌿</div>
          </div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "white" }}>
            Configurons votre <strong style={{ color: "#10b981" }}>espace</strong>
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
            Quelques questions pour personnaliser au mieux votre expérience
          </p>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? "#10b981" : "rgba(255,255,255,0.08)", transition: "background 0.4s" }} />
          ))}
        </div>
        <p style={{ textAlign: "right", margin: "0 0 20px", fontSize: 12, color: "#4b5563" }}>Étape {step} sur {totalSteps}</p>

        {/* ═══ ÉTAPE 1 - Confirmation ═══ */}
        {step === 1 && (
          <div style={{ background: "#111111", borderRadius: 20, padding: 24, border: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>Étape 1 - Santé</p>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>Vos informations de santé</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Votre praticien a pré-rempli ces données. Vérifiez qu'elles sont correctes.</p>

            {!editMode ? (
              <>
                {badges.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                    {badges.map(badge => (
                      <div key={badge.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "6px 14px", display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{badge.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{badge.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <p style={{ margin: 0, fontSize: 13, color: "#fbbf24", lineHeight: 1.5 }}>Aucune donnée pré-remplie. Cliquez sur "Modifier mes données" pour les renseigner.</p>
                  </div>
                )}

                <button onClick={() => setEditMode(true)}
                  style={{ width: "100%", height: 40, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Modifier mes données
                </button>
              </>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                  {[
                    { label: "Âge", value: confirmAge, onChange: setConfirmAge, placeholder: "Ex: 34" },
                    { label: "Taille (cm)", value: confirmTaille, onChange: setConfirmTaille, placeholder: "Ex: 168" },
                    { label: "Poids (kg)", value: confirmPoids, onChange: setConfirmPoids, placeholder: "Ex: 72" },
                  ].map(f => (
                    <div key={f.label}>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{f.label}</p>
                      <input type="number" value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder}
                        style={inputStyle}
                        onFocus={e => e.target.style.borderColor = "#10b981"}
                        onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Sexe</p>
                    <select value={confirmSexe} onChange={e => setConfirmSexe(e.target.value)} style={{ ...selectStyle, color: confirmSexe ? "white" : "#64748b" }}>
                      <option value="">-</option>
                      <option value="Femme">Femme</option>
                      <option value="Homme">Homme</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Activité</p>
                    <select value={confirmNiveauActivite} onChange={e => setConfirmNiveauActivite(e.target.value)} style={{ ...selectStyle, color: confirmNiveauActivite ? "white" : "#64748b" }}>
                      <option value="">-</option>
                      <option value="Sédentaire">Sédentaire</option>
                      <option value="Légère">Légère</option>
                      <option value="Modérée">Modérée</option>
                      <option value="Intense">Intense</option>
                      <option value="Athlète">Athlète</option>
                    </select>
                  </div>
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Régime</p>
                    <select value={confirmRegime} onChange={e => setConfirmRegime(e.target.value)} style={{ ...selectStyle, color: confirmRegime ? "white" : "#64748b" }}>
                      <option value="">-</option>
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

                {[
                  { label: "Pathologies", value: confirmPathologies, onChange: setConfirmPathologies, placeholder: "Ex: Diabète type 2" },
                  { label: "Allergies & intolérances", value: confirmAllergies, onChange: setConfirmAllergies, placeholder: "Ex: Gluten, lactose" },
                  { label: "Traitements en cours", value: confirmTraitements, onChange: setConfirmTraitements, placeholder: "Ex: Metformine 500mg" },
                ].map(f => (
                  <div key={f.label} style={{ marginBottom: 10 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{f.label}</p>
                    <input type="text" value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder}
                      style={inputStyle}
                      onFocus={e => e.target.style.borderColor = "#10b981"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                  </div>
                ))}

                <button onClick={() => setEditMode(false)}
                  style={{ width: "100%", height: 40, borderRadius: 12, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", cursor: "pointer", fontSize: 13, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Valider mes modifications
                </button>
              </>
            )}

            <button onClick={() => setStep(2)}
              style={{ width: "100%", height: 48, borderRadius: 12, background: "#10b981", border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer", transition: "opacity 0.2s, transform 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}>
              Confirmer et continuer →
            </button>
          </div>
        )}

        {/* ═══ ÉTAPE 2 - Objectif + Mood + Défi ═══ */}
        {step === 2 && (
          <div style={{ background: "#111111", borderRadius: 20, padding: 24, border: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>Étape 2 - Direction</p>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>Parlez-nous de vous</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Ces infos aident votre jumeau à adapter ses conseils.</p>

            {/* Objectif */}
            <div style={{ marginBottom: 22 }}>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "white" }}>Quel est votre objectif principal ?</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {OBJECTIFS.map(o => (
                  <button key={o.id} onClick={() => setObjectif(o.id)} style={cardBtn(objectif === o.id)}>
                    <span style={{ fontSize: 20 }}>{o.emoji}</span>
                    <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: "white" }}>{o.label}</p>
                  </button>
                ))}
                <button onClick={() => setObjectif("autre")} style={cardBtn(objectif === "autre")}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white" }}>Autre...</p>
                </button>
              </div>
              {objectif === "autre" && (
                <input type="text" value={objectifCustom} onChange={e => setObjectifCustom(e.target.value)}
                  placeholder="Décrivez votre objectif..." style={{ ...inputStyle, marginTop: 8 }}
                  onFocus={e => e.target.style.borderColor = "#10b981"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              )}
            </div>

            {/* Mood */}
            <div style={{ marginBottom: 22 }}>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "white" }}>Comment vous sentez-vous face au changement ?</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {MOODS.map(m => (
                  <button key={m.id} onClick={() => setMood(m.id)} style={{ ...cardBtn(mood === m.id), display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 22 }}>{m.emoji}</span>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "white" }}>{m.label}</p>
                  </button>
                ))}
                <button onClick={() => setMood("autre")} style={cardBtn(mood === "autre")}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white" }}>Autre...</p>
                </button>
              </div>
              {mood === "autre" && (
                <input type="text" value={moodCustom} onChange={e => setMoodCustom(e.target.value)}
                  placeholder="Décrivez comment vous vous sentez..." style={{ ...inputStyle, marginTop: 8 }}
                  onFocus={e => e.target.style.borderColor = "#10b981"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              )}
            </div>

            {/* Défi */}
            <div style={{ marginBottom: 22 }}>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "white" }}>Quel est votre plus gros défi ?</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {DEFIS.map(d => (
                  <button key={d.id} onClick={() => setDefi(d.id)} style={cardBtn(defi === d.id)}>
                    <span style={{ fontSize: 20 }}>{d.emoji}</span>
                    <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: "white" }}>{d.label}</p>
                  </button>
                ))}
                <button onClick={() => setDefi("autre")} style={cardBtn(defi === "autre")}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white" }}>Autre...</p>
                </button>
              </div>
              {defi === "autre" && (
                <input type="text" value={defiCustom} onChange={e => setDefiCustom(e.target.value)}
                  placeholder="Décrivez votre défi..." style={{ ...inputStyle, marginTop: 8 }}
                  onFocus={e => e.target.style.borderColor = "#10b981"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, height: 48, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>← Retour</button>
              <button onClick={() => setStep(3)} disabled={!objectif || !mood || !defi || (objectif === "autre" && !objectifCustom.trim()) || (mood === "autre" && !moodCustom.trim()) || (defi === "autre" && !defiCustom.trim())}
                style={{ flex: 2, height: 48, borderRadius: 12, background: (!objectif || !mood || !defi) ? "rgba(255,255,255,0.05)" : "#10b981", border: "none", color: (!objectif || !mood || !defi) ? "#64748b" : "black", fontSize: 15, fontWeight: 600, cursor: (!objectif || !mood || !defi) ? "not-allowed" : "pointer", transition: "opacity 0.2s, transform 0.15s" }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}>
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ═══ ÉTAPE 3 - Quotidien ═══ */}
        {step === 3 && (
          <div style={{ background: "#111111", borderRadius: 20, padding: 24, border: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>Étape 3 - Quotidien</p>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>Votre mode de vie</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Pour des conseils vraiment adaptés à votre réalité.</p>

            {/* Équipement */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "white" }}>Votre équipement cuisine</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {EQUIPEMENT.map(e => (
                  <button key={e.id} onClick={() => toggleMultiple(e.id, equipement, setEquipement)} style={cardBtn(equipement.includes(e.id))}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white" }}>{e.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Temps cuisine */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "white" }}>Temps disponible pour cuisiner le soir</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {["< 15 min", "15-30 min", "30-45 min", "45+ min"].map(t => (
                  <button key={t} onClick={() => setTempsCuisine(t)} style={cardBtn(tempsCuisine === t)}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "white", textAlign: "center" }}>{t}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "white" }}>Votre rapport au budget courses</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[{ id: "eco", label: "Économique" }, { id: "standard", label: "Standard" }, { id: "premium", label: "Premium" }].map(b => (
                  <button key={b.id} onClick={() => setBudget(b.id)} style={cardBtn(budget === b.id)}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white", textAlign: "center" }}>{b.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Repas sautés */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "white" }}>Sautez-vous souvent des repas ?</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {["Petit-déjeuner", "Déjeuner", "Dîner", "Jamais"].map(r => (
                  <button key={r} onClick={() => toggleMultiple(r, repasSautes, setRepasSautes)} style={cardBtn(repasSautes.includes(r))}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "white", textAlign: "center" }}>{r}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Sommeil */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "white" }}>Combien d'heures dormez-vous en moyenne ?</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {SOMMEIL.map(s => (
                  <button key={s.id} onClick={() => setSommeil(s.id)} style={cardBtn(sommeil === s.id)}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "white", textAlign: "center" }}>{s.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Digestif */}
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "white" }}>Inconforts digestifs</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {DIGESTIF.map(d => (
                  <button key={d.id} onClick={() => toggleMultiple(d.id, digestif, setDigestif)} style={cardBtn(digestif.includes(d.id))}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white" }}>{d.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, height: 48, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>← Retour</button>
              <button onClick={() => setStep(4)} style={{ flex: 2, height: 48, borderRadius: 12, background: "#10b981", border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer", transition: "opacity 0.2s, transform 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}>
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ═══ ÉTAPE 4 - Aliments ═══ */}
        {step === 4 && (
          <div style={{ background: "#111111", borderRadius: 20, padding: 24, border: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>Étape 4 - Plaisir</p>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>Vos préférences alimentaires</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Cliquez une fois pour ❤️ aimer, deux fois pour ❌ ne pas aimer.</p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {ALIMENTS.map(aliment => {
                const aime = alimentsAimes.includes(aliment);
                const deteste = alimentsDetestes.includes(aliment);
                return (
                  <button key={aliment} onClick={() => {
                    if (!aime && !deteste) toggleAliment(aliment, "aime");
                    else if (aime) toggleAliment(aliment, "deteste");
                    else toggleAliment(aliment, "aime");
                  }} style={{ borderRadius: 20, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", border: `1px solid ${aime ? "rgba(16,185,129,0.4)" : deteste ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`, background: aime ? "rgba(16,185,129,0.1)" : deteste ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.03)", color: aime ? "#10b981" : deteste ? "#f87171" : "#94a3b8", transition: "all 0.15s" }}>
                    {aime ? "❤️ " : deteste ? "❌ " : ""}{aliment}
                  </button>
                );
              })}
            </div>

            {/* Ajouter un aliment */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input type="text" value={alimentCustom} onChange={e => setAlimentCustom(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addAlimentCustom(); }}
                placeholder="Ajouter un aliment..."
                style={{ ...inputStyle, flex: 1 }}
                onFocus={e => e.target.style.borderColor = "#10b981"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              <button onClick={addAlimentCustom} style={{ height: 44, padding: "0 16px", borderRadius: 12, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Ajouter</button>
            </div>

            {/* Récap */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {alimentsAimes.length > 0 && (
                <div style={{ flex: 1, background: "rgba(16,185,129,0.06)", borderRadius: 12, border: "1px solid rgba(16,185,129,0.15)", padding: "10px 12px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#10b981" }}>J'aime ❤️</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{alimentsAimes.join(", ")}</p>
                </div>
              )}
              {alimentsDetestes.length > 0 && (
                <div style={{ flex: 1, background: "rgba(239,68,68,0.06)", borderRadius: 12, border: "1px solid rgba(239,68,68,0.15)", padding: "10px 12px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#f87171" }}>Je n'aime pas ❌</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>{alimentsDetestes.join(", ")}</p>
                </div>
              )}
            </div>

            {saveError && (
              <div style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <p style={{ margin: 0, fontSize: 13, color: "#f87171" }}>{saveError}</p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(3)} style={{ flex: 1, height: 48, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>← Retour</button>
              <button onClick={() => void saveAndContinue()} disabled={saving}
                style={{ flex: 2, height: 48, borderRadius: 12, background: saving ? "rgba(255,255,255,0.05)" : "#10b981", border: "none", color: saving ? "#64748b" : "black", fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", transition: "opacity 0.2s, transform 0.15s" }}
                onMouseEnter={e => { if (!saving) { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}>
                {saving ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTopColor: "black", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Sauvegarde...</span> : "Accéder à mon espace →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


