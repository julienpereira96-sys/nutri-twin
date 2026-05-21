
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const emerald = "#10b981";
const amber = "#f59e0b";
const coral = "#f43f5e";

// ═══ DONNÉES DE DÉMO ONBOARDING ═══
const DEMO_PATIENTS = [
  { id: "demo-1", firstName: "Sophie", lastName: "M.", initials: "SM", avatarColor: "#f43f5e", emotional_status: "red", emotional_insight: "Rechute alimentaire ce soir", totalMessages: 34 },
  { id: "demo-2", firstName: "Julie", lastName: "P.", initials: "JP", avatarColor: "#8b5cf6", emotional_status: "orange", emotional_insight: "Fatigue professionnelle", totalMessages: 18 },
  { id: "demo-3", firstName: "Thomas", lastName: "R.", initials: "TR", avatarColor: "#3b82f6", emotional_status: "green", emotional_insight: "Progression constante", totalMessages: 52 },
  { id: "demo-4", firstName: "Marc", lastName: "D.", initials: "MD", avatarColor: "#f59e0b", emotional_status: "green", emotional_insight: "Objectifs atteints", totalMessages: 27 },
];

const DEMO_CONVERSATIONS: { id: string; role: "user" | "assistant"; content: string; created_at: string }[] = [
  { id: "d1", role: "user", content: "Bonsoir, j'ai encore eu une fringale ce soir. Je me sens vraiment nulle 😔", created_at: "2026-05-16T21:03:00" },
  { id: "d2", role: "assistant", content: "Bonsoir Sophie. Un écart ça arrive, et ça ne définit pas votre parcours. Vous aviez mangé quoi ce midi ?", created_at: "2026-05-16T21:03:30" },
  { id: "d3", role: "user", content: "Pas grand chose... un sandwich en vitesse entre deux réunions.", created_at: "2026-05-16T21:04:10" },
  { id: "d4", role: "assistant", content: "Voilà tout s'explique. Ce n'est pas de la faiblesse, c'est de la biologie. Demain on vise un vrai déjeuner avec des protéines. D'accord ?", created_at: "2026-05-16T21:04:45" },
  { id: "d5", role: "user", content: "Oui. Merci, ça me soulage d'avoir quelqu'un à qui écrire 💚", created_at: "2026-05-16T21:05:20" },
];

const ONBOARDING_STEPS = [
  { id: "welcome", icon: "🌿", title: "Bienvenue sur votre dashboard", text: "Votre jumeau numérique est prêt à prendre le relais entre vos séances. Laissez-moi vous montrer vos outils en quelques secondes.", highlight: null, position: "center" as const },
  { id: "patients", icon: "👥", title: "Vos patients", text: "Ici s'affichent vos patients triés par niveau d'urgence émotionnelle. Cliquez sur l'un d'eux pour voir sa conversation en temps réel.", highlight: "patients", position: "sidebar" as const, glowColor: "rgba(16,185,129,0.5)" },
  { id: "radar", icon: "🎯", title: "Le Radar de Résilience", text: "Le Radar trie vos patients par niveau d'urgence émotionnelle. Ne consacrez votre énergie qu'à ceux qui en ont réellement besoin, l'IA s'occupe du reste.", highlight: "radar", position: "top-right" as const, glowColor: "rgba(244,63,94,0.4)" },
  { id: "murmure", icon: "🎙️", title: "Le Murmure", text: "C'est votre ligne directe avec votre jumeau. Une instruction, et il adapte immédiatement son approche avec ce patient.", highlight: "murmure", position: "right" as const, glowColor: "rgba(16,185,129,0.4)" },
  { id: "rapport", icon: "📊", title: "Le Rapport mensuel", text: "Chaque mois, votre jumeau génère un rapport complet pour préparer vos consultations. Un gain de temps considérable.", highlight: "rapport", position: "right" as const, glowColor: "rgba(99,102,241,0.4)" },
  { id: "invite", icon: "✉️", title: "Inviter un patient", text: "Tout est prêt. Envoyez le lien à votre premier patient et votre jumeau prend le relais immédiatement.", highlight: "invite", position: "bottom-left" as const, glowColor: "rgba(16,185,129,0.4)" },
];

type OnboardingStep = typeof ONBOARDING_STEPS[0];

type OnboardingProps = {
  step: number;
  practitionerName: string;
  onNext: () => void;
  onSkip: () => void;
};

const OnboardingTour = ({ step, practitionerName, onNext, onSkip }: OnboardingProps) => {
  const [visible, setVisible] = useState(true);
  const current: OnboardingStep = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;
  const firstName = practitionerName.split(" ")[0];

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, [step]);

  const getBubblePosition = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "fixed",
      width: 320,
      background: "#0a0f0c",
      borderRadius: 20,
      padding: 24,
      border: "1px solid rgba(16,185,129,0.2)",
      boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
      zIndex: 300,
      transition: "opacity 0.25s ease, transform 0.25s ease",
      opacity: visible ? 1 : 0,
    };
    switch (current.position) {
      case "center": return { ...base, top: "50%", left: "50%", transform: visible ? "translate(-50%,-50%)" : "translate(-50%,-48%)" };
      case "sidebar": return { ...base, top: 200, left: 310, transform: visible ? "translateY(0)" : "translateY(8px)" };
      case "top-right": return { ...base, top: 80, right: 24, transform: visible ? "translateY(0)" : "translateY(8px)" };
      case "right": return { ...base, top: "40%", right: 24, transform: visible ? "translateY(-50%)" : "translateY(-48%)" };
      case "bottom-left": return { ...base, bottom: 100, left: 310, transform: visible ? "translateY(0)" : "translateY(8px)" };
      default: return { ...base, top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(1.5px)", pointerEvents: "auto" }} onClick={onSkip} />

      <div style={{ ...getBubblePosition(), pointerEvents: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
            {current.icon}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "white" }}>{current.title}</p>
            {step === 0 && <p style={{ margin: 0, fontSize: 11, color: emerald }}>Bonjour {firstName} 👋</p>}
          </div>
        </div>

        <p style={{ margin: "0 0 18px", fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>{current.text}</p>

        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 2, borderRadius: 1, background: i <= step ? emerald : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSkip}
            style={{ flex: 1, height: 36, borderRadius: 9, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: 12, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "#94a3b8"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#64748b"; }}>
            Passer
          </button>
          <button onClick={onNext}
            style={{ flex: 2, height: 36, borderRadius: 9, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: emerald, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.22)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; }}>
            {isLast ? "C'est parti 🌿" : "Suivant →"}
          </button>
        </div>

        <p style={{ margin: "10px 0 0", fontSize: 11, color: "#374151", textAlign: "center" }}>{step + 1} / {ONBOARDING_STEPS.length}</p>
      </div>

      {/* Lueurs sur les éléments */}
      {current.highlight === "patients" && (
        <div style={{ position: "fixed", top: 120, left: 24, width: 268, height: "calc(100vh - 200px)", borderRadius: 16, boxShadow: `0 0 0 2px ${emerald}, 0 0 24px rgba(16,185,129,0.3)`, pointerEvents: "none", animation: "onboardingPulse 2s ease-in-out infinite" }} />
      )}
      {current.highlight === "radar" && (
        <div style={{ position: "fixed", top: 68, right: 180, height: 36, width: 80, borderRadius: 8, boxShadow: `0 0 0 2px ${coral}, 0 0 16px rgba(244,63,94,0.5)`, pointerEvents: "none", animation: "onboardingPulse 2s ease-in-out infinite" }} />
      )}
      {current.highlight === "murmure" && (
        <div style={{ position: "fixed", top: "calc(40% + 60px)", right: 24, width: 268, height: 80, borderRadius: 10, boxShadow: `0 0 0 2px ${emerald}, 0 0 16px rgba(16,185,129,0.4)`, pointerEvents: "none", animation: "onboardingPulse 2s ease-in-out infinite" }} />
      )}
      {current.highlight === "rapport" && (
        <div style={{ position: "fixed", top: 132, right: 36, height: 32, width: 110, borderRadius: 8, boxShadow: "0 0 0 2px #6366f1, 0 0 16px rgba(99,102,241,0.5)", pointerEvents: "none", animation: "onboardingPulse 2s ease-in-out infinite" }} />
      )}
      {current.highlight === "invite" && (
        <div style={{ position: "fixed", bottom: 24, left: 24, width: 268, height: 54, borderRadius: 12, boxShadow: `0 0 0 2px ${emerald}, 0 0 16px rgba(16,185,129,0.4)`, pointerEvents: "none", animation: "onboardingPulse 2s ease-in-out infinite" }} />
      )}
    </div>
  );
};

// ═══ TYPES ═══
type RealPatient = {
  id: string; firstName: string; lastName: string; initials: string; avatarColor: string; email: string;
  lastMessage: string; lastMessageTime: string; lastMessageRole: string; totalMessages: number;admin_alerts?: { type: string; date: string; seen: boolean; alert_type?: string; murmure?: string }[];
  age?: number; sexe?: string; taille?: number; poids?: number; objective?: string; pathologies?: string;
  allergies?: string; traitements?: string; objectif_clinique?: string; niveau_activite?: string;
  regime_specifique?: string; notes?: string; brief_jumeau?: string; practitioner_instruction?: string;
  emotional_status?: string; emotional_insight?: string; latest_victory?: string; private_notes?: string;
};

type Conversation = { id: string; role: "user" | "assistant"; content: string; created_at: string; };
type ReportPeriod = "week" | "month" | "custom";
type ActiveTab = "patients" | "radar" | "valeur" | "patterns";
type Document = { id: string; file_name: string; file_type: string; created_at: string; };
type MonthlyStats = { messages_geres: number; crises_nocturnes: number; temps_economise_heures: number; taux_retention: number; questions_repetitives_pct: number; };

const AVATAR_COLORS = ["#f43f5e", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#06b6d4", "#f97316"];

function getStatusColor(status?: string) { if (status === "red") return coral; if (status === "orange") return amber; return emerald; }
function getStatusEmoji(status?: string) { if (status === "red") return "🔴"; if (status === "orange") return "🟠"; return "🟢"; }

function LeverAlerteCritique({ alert, patientId, onResolved }: { alert: { type: string; alert_type?: string }; patientId: string; onResolved: () => void }) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const resolve = async () => {
    setLoading(true);
    await supabase.from("patients").update({ emotional_status: "green", admin_alerts: [] }).eq("user_id", patientId);
    await fetch("/api/invalidate-cache", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId }) });
    onResolved();
    setLoading(false);
  };

  return (
    <div style={{ background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8, padding: "10px 12px" }}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", marginBottom: 10 }}>
        <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 2, accentColor: "#f43f5e", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>Je certifie avoir pris contact avec le patient et mis en place les mesures de sécurité nécessaires.</span>
      </label>
      <button onClick={resolve} disabled={!checked || loading}
        style={{ width: "100%", height: 32, borderRadius: 8, background: checked ? "rgba(244,63,94,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${checked ? "rgba(244,63,94,0.3)" : "rgba(255,255,255,0.06)"}`, color: checked ? "#f87171" : "#64748b", fontSize: 11, fontWeight: 600, cursor: checked ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
        {loading ? "..." : "Confirmer et lever l'alerte"}
      </button>
    </div>
  );
}

function LeverAlerteSimple({ alert, patientId, murmureSuggere, onResolved }: { alert: object; patientId: string; murmureSuggere: string; onResolved: (murmure: string) => void }) {
  const [open, setOpen] = useState(false);
  const [murmure, setMurmure] = useState(murmureSuggere);
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const resolve = async () => {
    setLoading(true);
    await supabase.from("patients").update({
      emotional_status: "green",
      admin_alerts: [],
      ...(murmure ? { practitioner_instruction: murmure } : {}),
    }).eq("user_id", patientId);
    onResolved(murmure);
    setLoading(false);
    setOpen(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ height: 28, borderRadius: 8, padding: "0 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.08)", color: amber, transition: "all 0.2s" }}>
      Lever l'alerte →
    </button>
  );

  return (
    <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "10px 12px" }}>
      <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: amber }}>Murmure suggéré par le Jumeau</p>
      <textarea value={murmure} onChange={e => setMurmure(e.target.value)} rows={3}
        style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "white", padding: "8px 10px", fontSize: 11, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.5, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => setOpen(false)} style={{ flex: 1, height: 28, borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b", fontSize: 11, cursor: "pointer" }}>Annuler</button>
        <button onClick={resolve} disabled={loading}
          style={{ flex: 2, height: 28, borderRadius: 8, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: emerald, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
          {loading ? "..." : "Lever et activer le murmure →"}
        </button>
      </div>
    </div>
  );
}


export default function DashboardPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // ═══ ONBOARDING ═══
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingDemoMode, setOnboardingDemoMode] = useState(false);

  // ═══ ÉTATS PRINCIPAUX ═══
  const [activeTab, setActiveTab] = useState<ActiveTab>("patients");
  const [searchQuery, setSearchQuery] = useState("");
  const [discretMode, setDiscretMode] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [savedPin, setSavedPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [practitionerEmail, setPractitionerEmail] = useState("");
  const [practitionerSpecialty, setPractitionerSpecialty] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [showDeletePinModal, setShowDeletePinModal] = useState(false);
  const [deletePinInput, setDeletePinInput] = useState("");
  const [deletePinError, setDeletePinError] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [practitionerPhoto, setPractitionerPhoto] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [reportError, setReportError] = useState("");

  const AVATARS = [
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 3C13 3 4 8 4 15C4 19.4 8.1 23 13 23C17.9 23 22 19.4 22 15C22 8 13 3 13 3Z" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/><path d="M13 23V13" stroke={emerald} strokeWidth="1.4" strokeLinecap="round"/><path d="M13 13C13 13 9 10 9 7" stroke={emerald} strokeWidth="1.4" strokeLinecap="round"/><path d="M13 13C13 13 17 10 17 7" stroke={emerald} strokeWidth="1.4" strokeLinecap="round"/></svg>,
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M3 20L10 8L14 14L17 10L23 20H3Z" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M3 13C5.5 10 8.5 10 11 13C13.5 16 16.5 16 19 13C20.2 11.5 21.5 11 23 11" stroke={emerald} strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>,
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="4" stroke={emerald} strokeWidth="1.4"/><path d="M13 4V6M13 20V22M4 13H6M20 13H22" stroke={emerald} strokeWidth="1.4" strokeLinecap="round"/></svg>,
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 22V12" stroke={emerald} strokeWidth="1.4" strokeLinecap="round"/><path d="M13 16C13 16 8 14 7 9C7 9 12 8 15 12" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 22C13 22 6 17 6 11C6 7.7 9.1 5 13 5C13 5 13 10 13 22Z" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/><path d="M13 22C13 22 20 17 20 11C20 7.7 16.9 5 13 5C13 5 13 10 13 22Z" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 4C13 4 6 12 6 16.5C6 19.5 9.1 22 13 22C16.9 22 20 19.5 20 16.5C20 12 13 4 13 4Z" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M20 14C18.5 17.5 15 20 11 20C6.6 20 3 16.4 3 12C3 7.6 6.6 4 11 4C9.5 6.5 9.5 11.5 13 14C15.5 15.5 18 14.5 20 14Z" stroke={emerald} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  ];

  useEffect(() => {
    window.history.pushState(null, "", window.location.pathname);
    const handlePopState = () => window.history.pushState(null, "", window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const [patients, setPatients] = useState<RealPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showJumeauModal, setShowJumeauModal] = useState(false);
  const [jumeauText, setJumeauText] = useState("");
  const [jumeauTextUploading, setJumeauTextUploading] = useState(false);
  const [showMurmureModal, setShowMurmureModal] = useState(false);
  const [practitionerId, setPractitionerId] = useState<string | null>(null);

  const completeOnboarding = useCallback(async (pid: string) => {
    await supabase.from("practitioners").update({ onboarding_done: true }).eq("user_id", pid);
    setShowOnboarding(false);
    setOnboardingDemoMode(false);
  }, [supabase]);

  const handleOnboardingNext = useCallback(() => {
    if (onboardingStep < ONBOARDING_STEPS.length - 1) {
      setOnboardingStep(s => s + 1);
    } else {
      if (practitionerId) void completeOnboarding(practitionerId);
      else { setShowOnboarding(false); setOnboardingDemoMode(false); }
    }
  }, [onboardingStep, practitionerId, completeOnboarding]);

  const handleOnboardingSkip = useCallback(() => {
    if (practitionerId) void completeOnboarding(practitionerId);
    else { setShowOnboarding(false); setOnboardingDemoMode(false); }
  }, [practitionerId, completeOnboarding]);

  const [loading, setLoading] = useState(true);
  const [practitionerName, setPractitionerName] = useState("");
  const [hasDocuments, setHasDocuments] = useState<boolean | null>(null);
  const [showFidelity, setShowFidelity] = useState(true);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [murmureText, setMurmureText] = useState("");
  const [savingMurmure, setSavingMurmure] = useState(false);
  const [privateNotes, setPrivateNotes] = useState("");
  const [savingPrivateNotes, setSavingPrivateNotes] = useState(false);
  const [privateNotesSaved, setPrivateNotesSaved] = useState(false);
  const [sendingVictory, setSendingVictory] = useState<string | null>(null);
  const [victorySent, setVictorySent] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteAge, setInviteAge] = useState("");
  const [inviteSexe, setInviteSexe] = useState("");
  const [inviteTaille, setInviteTaille] = useState("");
  const [invitePoids, setInvitePoids] = useState("");
  const [invitePathologies, setInvitePathologies] = useState("");
  const [inviteAllergies, setInviteAllergies] = useState("");
  const [inviteTraitements, setInviteTraitements] = useState("");
  const [inviteObjectifClinique, setInviteObjectifClinique] = useState("");
  const [inviteBriefJumeau, setInviteBriefJumeau] = useState("");
  const [inviteNotes, setInviteNotes] = useState("");
  const [inviteNiveauActivite, setInviteNiveauActivite] = useState("");
  const [inviteRegime, setInviteRegime] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState<"protocole" | "patient" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fidelityScore = 
  documents.length === 0 ? 70 : 
  documents.length === 1 ? 85 : 
  documents.length === 2 ? 95 : 100;
  const fidelityColor = 
  documents.length === 0 ? amber : 
  documents.length >= 3 ? emerald : "#06b6d4"; 
  const [editAge, setEditAge] = useState("");
  const [editObjective, setEditObjective] = useState("");
  const [editPathologies, setEditPathologies] = useState("");
  const [editAllergies, setEditAllergies] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("month");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [reportMonth, setReportMonth] = useState(new Date());
  const [patternInsight, setPatternInsight] = useState("");
  const [patternLoading, setPatternLoading] = useState(false);

  useEffect(() => {
    if (inviteSuccess) {
      const timer = setTimeout(() => { setInviteSuccess(false); setShowInviteModal(false); }, 3000);
      return () => clearTimeout(timer);
    }
  }, [inviteSuccess]);

  const loadDocuments = async (pid: string) => {
    setLoadingDocs(true);
    const { data } = await supabase.from("documents").select("id, file_name, file_type, created_at").eq("practitioner_id", pid).order("created_at", { ascending: false });
    const seen = new Set<string>();
    const unique = (data as Document[] ?? []).filter((d) => { if (seen.has(d.file_name)) return false; seen.add(d.file_name); return true; });
    setDocuments(unique);
    setLoadingDocs(false);
  };

  const loadMonthlyStats = async (pid: string) => {
    const month = new Date().toISOString().slice(0, 7);
    const { data } = await supabase.from("stats_mensuelles_praticien").select("*").eq("practitioner_id", pid).eq("month", month).single();
    if (data) { setMonthlyStats(data as MonthlyStats); }
    else {
      const { count: totalMessages } = await supabase.from("conversations").select("*", { count: "exact", head: true }).eq("practitioner_id", pid).gte("created_at", `${month}-01T00:00:00`);
      const { count: nightMessages } = await supabase.from("conversations").select("*", { count: "exact", head: true }).eq("practitioner_id", pid).gte("created_at", `${month}-01T21:00:00`);
      const msgs = totalMessages ?? 0;
      setMonthlyStats({ messages_geres: msgs, crises_nocturnes: nightMessages ?? 0, temps_economise_heures: Math.round(msgs * 0.02 * 10) / 10, taux_retention: 85, questions_repetitives_pct: 72 });
    }
  };

  const loadPatients = async (pid: string) => {
    const { data: relations } = await supabase.from("patient_practitioner").select("patient_id").eq("practitioner_id", pid);
    if (!relations || relations.length === 0) { setLoading(false); return; }
    const patientIds = relations.map((r) => r.patient_id);
    const { data: patientsData } = await supabase.from("patients").select("user_id, first_name, last_name, email, age, sexe, taille, poids, objective, pathologies, allergies, traitements, objectif_clinique, niveau_activite, regime_specifique, notes, brief_jumeau, practitioner_instruction, emotional_status, emotional_insight, latest_victory, private_notes, admin_alerts")
    .in("user_id", patientIds);
    if (!patientsData) { setLoading(false); return; }
    const patientsWithStats = await Promise.all(
      patientsData.map(async (p, i) => {
        const { data: convs } = await supabase.from("conversations").select("role, content, created_at").eq("patient_id", p.user_id).eq("practitioner_id", pid).order("created_at", { ascending: false }).limit(1);
        const lastConv = convs?.[0];
        const { count } = await supabase.from("conversations").select("*", { count: "exact", head: true }).eq("patient_id", p.user_id).eq("practitioner_id", pid);
        const initials = `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase();
        return {
          id: p.user_id, firstName: p.first_name ?? "Patient", lastName: p.last_name ?? "", initials,
          avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length], email: p.email ?? "",
          lastMessage: lastConv?.content ?? "Aucun message pour l'instant",
          lastMessageTime: lastConv?.created_at ? new Date(lastConv.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "",
          lastMessageRole: lastConv?.role ?? "", totalMessages: count ?? 0,
          age: p.age, sexe: p.sexe, taille: p.taille, poids: p.poids, traitements: p.traitements,
          objectif_clinique: p.objectif_clinique, niveau_activite: p.niveau_activite, regime_specifique: p.regime_specifique,
          objective: p.objective, pathologies: p.pathologies, allergies: p.allergies, notes: p.notes,
          brief_jumeau: p.brief_jumeau, practitioner_instruction: p.practitioner_instruction,
          emotional_status: p.emotional_status ?? "green", emotional_insight: p.emotional_insight ?? "",
latest_victory: p.latest_victory ?? "", private_notes: p.private_notes ?? "",
admin_alerts: (p.admin_alerts as { type: string; date: string; seen: boolean }[] | null) ?? [],

        };
      })
    );
    setPatients(patientsWithStats);
    if (patientsWithStats.length > 0) setSelectedPatientId(patientsWithStats[0].id);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const pid = data.user.id;
      setPractitionerId(pid);
      const { data: practitioner } = await supabase.from("practitioners").select("first_name, last_name, email, specialty, discrete_pin, onboarding_done").eq("user_id", pid).single();
      if (practitioner) {
        const p = practitioner as { first_name: string; last_name: string; email?: string; specialty?: string; discrete_pin?: string; onboarding_done?: boolean };
        setPractitionerName(`${p.first_name} ${p.last_name}`);
        setPractitionerEmail(p.email ?? "");
        setPractitionerSpecialty(p.specialty ?? "");
        setSavedPin(p.discrete_pin ?? "");
        if (!p.onboarding_done) {
          setTimeout(() => { setShowOnboarding(true); setOnboardingDemoMode(true); }, 800);
        }
      }
      const { count } = await supabase.from("documents").select("*", { count: "exact", head: true }).eq("practitioner_id", pid);
      setHasDocuments((count ?? 0) > 0);
      if ((count ?? 0) > 0) { const hidden = localStorage.getItem("fidelity_hidden"); if (hidden === "true") setShowFidelity(false); }
      await Promise.all([loadPatients(pid), loadMonthlyStats(pid)]);
    });
  }, []);

  useEffect(() => {
    if (!selectedPatientId || !practitionerId || onboardingDemoMode) return;
    supabase.from("conversations").select("id, role, content, created_at").eq("patient_id", selectedPatientId).eq("practitioner_id", practitionerId).order("created_at", { ascending: true }).then(({ data }) => setConversations((data as Conversation[]) ?? []));
    const patient = patients.find((p) => p.id === selectedPatientId);
    setPrivateNotes(patient?.private_notes ?? "");
    setPrivateNotesSaved(false);
  }, [selectedPatientId, practitionerId, onboardingDemoMode]);

  // En mode démo onboarding, on affiche les conversations fictives
  const displayedConversations = onboardingDemoMode ? DEMO_CONVERSATIONS : conversations;
  const displayedPatients = onboardingDemoMode ? DEMO_PATIENTS as unknown as RealPatient[] : patients;
  const displayedSelectedPatient = onboardingDemoMode
    ? DEMO_PATIENTS.find(p => p.id === (selectedPatientId ?? "demo-1")) as unknown as RealPatient ?? DEMO_PATIENTS[0] as unknown as RealPatient
    : patients.find((p) => p.id === selectedPatientId);

  const filteredPatients = displayedPatients.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const redPatients = displayedPatients.filter((p) => p.emotional_status === "red" || p.emotional_status === "red_critical");
  const orangePatients = displayedPatients.filter((p) => p.emotional_status === "orange");
  const victoryPatients = displayedPatients.filter((p) => p.latest_victory);

  const openMurmureModal = () => {
    const patient = patients.find((p) => p.id === selectedPatientId);
    setMurmureText(patient?.practitioner_instruction ?? "");
    setShowMurmureModal(true);
  };

  const saveMurmure = async () => {
    if (!selectedPatientId) return;
    setSavingMurmure(true);
    await supabase.from("patients").update({ practitioner_instruction: murmureText || null }).eq("user_id", selectedPatientId);
await fetch("/api/invalidate-cache", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId: selectedPatientId }) });
setSavingMurmure(false);
    setShowMurmureModal(false);
  };

  const savePrivateNotes = async () => {
    if (!selectedPatientId) return;
    setSavingPrivateNotes(true);
    await supabase.from("patients").update({ private_notes: privateNotes || null }).eq("user_id", selectedPatientId);
    setPatients((prev) => prev.map((p) => p.id === selectedPatientId ? { ...p, private_notes: privateNotes } : p));
    setSavingPrivateNotes(false); setPrivateNotesSaved(true);
    setTimeout(() => setPrivateNotesSaved(false), 2000);
  };

  const sendVictory = async (patientId: string, victoryText: string) => {
    if (!practitionerId) return;
    setSendingVictory(patientId);
    try {
      await fetch("/api/send-victory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, practitionerId, victoryText }) });
      setPatients((prev) => prev.map((p) => p.id === patientId ? { ...p, latest_victory: "" } : p));
      setVictorySent(patientId);
      setTimeout(() => setVictorySent(null), 3000);
    } catch { /* silencieux */ }
    setSendingVictory(null);
  };

  const generatePatternInsight = async () => {
    if (!selectedPatientId || !practitionerId) return;
    setPatternLoading(true); setPatternInsight("");
    const { data: journalEntries } = await supabase.from("journal_entries").select("date, mood, food_rating, emotions").eq("patient_id", selectedPatientId).order("date", { ascending: false }).limit(30);
    const { data: chatMessages } = await supabase.from("conversations").select("role, content, created_at").eq("patient_id", selectedPatientId).eq("practitioner_id", practitionerId).order("created_at", { ascending: false }).limit(50);
    if (!journalEntries?.length && !chatMessages?.length) { setPatternInsight("Pas encore assez de données pour détecter des patterns."); setPatternLoading(false); return; }
    const journalData = `| Date | Humeur | Alimentation | Émotions |\n| :--- | :--- | :--- | :--- |\n${journalEntries?.map((e) => `| ${e.date} | ${e.mood}/10 | ${e.food_rating}/3 | ${(e.emotions as string[])?.join(", ")} |`).join("\n") ?? ""}`;
    const chatData = chatMessages?.filter((m) => m.role === "user").slice(0, 20).map((m) => m.content.slice(0, 100)).join(" | ") ?? "";
    const prompt = `Tu es un analyste de données nutritionnelles. Analyse ces données d'un patient et détecte des corrélations ou patterns comportementaux.\n\nJournal (30 derniers jours) :\n${journalData}\n\nMessages du patient (extraits) :\n${chatData}\n\nGénère 3 insights sous forme de phrases courtes et percutantes. Sois précis, factuel, médical. 3 insights maximum. Sans markdown.`;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: prompt, practitionerId }) });
      const data = await res.json() as { response?: string };
      setPatternInsight(data.response ?? "Impossible de générer les insights.");
    } catch { setPatternInsight("Erreur lors de l'analyse."); }
    setPatternLoading(false);
  };

  const exportPDF = async () => {
    if (!displayedSelectedPatient || !reportContent) return;
    const res = await fetch("/api/generate-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId: displayedSelectedPatient.id, practitionerId, reportContent, patientName: `${displayedSelectedPatient.firstName} ${displayedSelectedPatient.lastName}`, practitionerName }) });
    const html = await res.text();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `rapport_${displayedSelectedPatient.firstName}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  const openJumeauModal = async () => {
    setShowJumeauModal(true); setUploadedFiles([]); setUploadSuccess([]); setUploadErrors([]); setDocumentType(null);
    if (practitionerId) void loadDocuments(practitionerId);
  };  

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => { const ext = f.name.split(".").pop()?.toLowerCase(); return ["pdf","docx","txt","jpg","jpeg","png","xlsx","csv","mp3","wav","m4a"].includes(ext ?? ""); });
    setUploadedFiles((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => { const blob = new Blob(chunks, { type: "audio/mp3" }); setAudioBlob(blob); stream.getTracks().forEach((t) => t.stop()); };
      mediaRecorderRef.current = mediaRecorder; mediaRecorder.start(); setIsRecording(true); setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
    } catch { alert("Impossible d'accéder au microphone."); }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current); };
  const uploadAudioMemo = () => { if (!audioBlob) return; const file = new File([audioBlob], `memo_vocal_${Date.now()}.mp3`, { type: "audio/mp3" }); setUploadedFiles((prev) => [...prev, file]); setAudioBlob(null); };

  const uploadFiles = async () => {
    if (uploadedFiles.length === 0 || !documentType) return;
    let pid = practitionerId;
    if (!pid) { const { data: { user } } = await supabase.auth.getUser(); pid = user?.id ?? null; }
    if (!pid) return;
    setUploading(true); setUploadErrors([]); setUploadSuccess([]);
    for (const file of uploadedFiles) {
      const formData = new FormData(); formData.append("file", file); formData.append("practitionerId", pid); formData.append("documentType", documentType);
      try {
        const res = await fetch("/api/upload-document", { method: "POST", body: formData });
        const data = await res.json() as { success?: boolean; error?: string };
        if (res.ok && data.success) setUploadSuccess((prev) => [...prev, file.name]);
        else setUploadErrors((prev) => [...prev, `${file.name} : ${data.error ?? "Erreur"}`]);
      } catch { setUploadErrors((prev) => [...prev, `${file.name} : Erreur réseau`]); }
    }
    setUploading(false); setUploadedFiles([]); setDocumentType(null); setHasDocuments(true);
    await loadDocuments(pid);
  };

  const deleteDocument = async (docId: string, fileName: string) => {
    if (!practitionerId) return;
    await supabase.from("documents").delete().eq("practitioner_id", practitionerId).eq("file_name", fileName);
    await loadDocuments(practitionerId);
    const { count } = await supabase.from("documents").select("*", { count: "exact", head: true }).eq("practitioner_id", practitionerId);
    setHasDocuments((count ?? 0) > 0);
  };

  const openProfileModal = () => {
    const patient = patients.find((p) => p.id === selectedPatientId);
    if (!patient) return;
    setEditAge(patient.age ? String(patient.age) : ""); setEditObjective(patient.objective ?? "");
    setEditPathologies(patient.pathologies ?? ""); setEditAllergies(patient.allergies ?? ""); setEditNotes(patient.notes ?? "");
    setProfileSaved(false); setShowProfileModal(true);
  };

  const saveProfile = async () => {
    if (!selectedPatientId) return;
    setSavingProfile(true);
    await supabase.from("patients").update({ age: editAge ? parseInt(editAge) : null, objective: editObjective || null, pathologies: editPathologies || null, allergies: editAllergies || null, notes: editNotes || null }).eq("user_id", selectedPatientId);
    setPatients((prev) => prev.map((p) => { if (p.id !== selectedPatientId) return p; return { ...p, age: editAge ? parseInt(editAge) : undefined, objective: editObjective || undefined, pathologies: editPathologies || undefined, allergies: editAllergies || undefined, notes: editNotes || undefined }; }));
    setSavingProfile(false); setProfileSaved(true);
    setTimeout(() => setShowProfileModal(false), 1500);
  };

  const saveSettings = async () => {
    if (!practitionerId) return;
    setSavingSettings(true);
    await supabase.from("practitioners").update({ discrete_pin: newPin || null }).eq("user_id", practitionerId);
    if (newPin) setSavedPin(newPin); setNewPin("");
    setSavingSettings(false); setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  const handleDiscretClick = () => {
    if (discretMode) { if (savedPin) { setPinInput(""); setPinError(""); setShowPinModal(true); } else { setDiscretMode(false); } }
    else { setDiscretMode(true); }
  };

  const verifyPin = () => {
    if (pinInput === savedPin) { setDiscretMode(false); setShowPinModal(false); setPinInput(""); setPinError(""); }
    else { setPinError("Code incorrect"); setPinInput(""); }
  };

  const selectedPatient = displayedSelectedPatient;
  const totalMessages = onboardingDemoMode ? 131 : patients.reduce((sum, p) => sum + p.totalMessages, 0);

  const getCalendarDays = () => {
    const year = reportMonth.getFullYear(); const month = reportMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: ({ day: number; date: string } | null)[] = [];
    const startDay = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({ day: i, date: dateStr });
    }
    return days;
  };

  const generateReport = async () => {
    if (!selectedPatientId) return;
    setReportLoading(true); setReportContent(""); setReportError("");
    try {
      const now = new Date(); let dateFrom = ""; let dateTo = now.toISOString().split("T")[0];
      if (reportPeriod === "week") { const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7); dateFrom = weekAgo.toISOString().split("T")[0]; }
      else if (reportPeriod === "month") { const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1); dateFrom = monthAgo.toISOString().split("T")[0]; }
      else { dateFrom = reportDateFrom; dateTo = reportDateTo; }
      const { data: journalEntries } = await supabase.from("journal_entries").select("date, mood, food_rating, emotions").eq("patient_id", selectedPatientId).gte("date", dateFrom).lte("date", dateTo).order("date", { ascending: true });
      const { data: chatMessages } = await supabase.from("conversations").select("role, content, created_at").eq("patient_id", selectedPatientId).eq("practitioner_id", practitionerId!).gte("created_at", `${dateFrom}T00:00:00`).lte("created_at", `${dateTo}T23:59:59`).order("created_at", { ascending: true });
      const hasJournal = journalEntries && journalEntries.length > 0;
      const hasChat = chatMessages && chatMessages.length > 0;
      if (!hasJournal && !hasChat) { setReportContent("Aucune donnée disponible sur cette période."); setReportLoading(false); return; }
      let journalSection = "";
      if (hasJournal) {
        const avgMood = (journalEntries.reduce((sum, e) => sum + e.mood, 0) / journalEntries.length).toFixed(1);
        const avgFood = (journalEntries.reduce((sum, e) => sum + e.food_rating, 0) / journalEntries.length).toFixed(1);
        const allEmotions = journalEntries.flatMap((e) => e.emotions as string[]);
        const emotionCounts: Record<string, number> = {};
        allEmotions.forEach((em) => { emotionCounts[em] = (emotionCounts[em] ?? 0) + 1; });
        const topEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([em, count]) => `${em} (${count}x)`).join(", ");
        journalSection = `\nJOURNAL DE BORD (${journalEntries.length} entrées) :\n- Humeur moyenne : ${avgMood}/10\n- Alimentation moyenne : ${avgFood}/3\n- Émotions dominantes : ${topEmotions || "non renseignées"}`;
      }
      let chatSection = "";
      if (hasChat) { const patientMessages = chatMessages.filter((m) => m.role === "user").map((m) => m.content).join("\n- "); chatSection = `\nCONVERSATIONS (${chatMessages.length} messages) :\n- ${patientMessages}`; }
      const prompt = `Génère un compte rendu professionnel pour un praticien en nutrition. Période du ${dateFrom} au ${dateTo}.\n${journalSection}\n${chatSection}\n\nStructure : 1. Vue d'ensemble 2. État émotionnel et alimentaire 3. Sujets abordés 4. Points positifs 5. Axes de travail 6. Questions clés à poser.\nTon professionnel et concis. Sans markdown.`;
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: prompt, practitionerId: practitionerId ?? undefined }) });
      const aiData = (await res.json()) as { response?: string };
      setReportContent(aiData.response ?? "Impossible de générer le rapport.");
    } catch { setReportError("La génération a échoué. Vérifiez votre connexion et réessayez."); }
    finally { setReportLoading(false); }
  };

  const resetInviteForm = () => {
    setInviteEmail(""); setInviteAge(""); setInviteSexe(""); setInviteTaille(""); setInvitePoids("");
    setInvitePathologies(""); setInviteAllergies(""); setInviteTraitements(""); setInviteObjectifClinique("");
    setInviteBriefJumeau(""); setInviteNotes(""); setInviteNiveauActivite(""); setInviteRegime(""); setInviteError("");
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true); setInviteError("");
    try {
      const res = await fetch("/api/invite-patient", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail.trim(), practitionerId: practitionerId ?? "", age: inviteAge ? parseInt(inviteAge) : null, sexe: inviteSexe || null, taille: inviteTaille ? parseInt(inviteTaille) : null, poids: invitePoids ? parseFloat(invitePoids) : null, pathologies: invitePathologies || null, allergies: inviteAllergies || null, traitements: inviteTraitements || null, objectif_clinique: inviteObjectifClinique || null, brief_jumeau: inviteBriefJumeau || null, notes: inviteNotes || null, niveau_activite: inviteNiveauActivite || null, regime_specifique: inviteRegime || null }) });
      const data = await res.json() as { error?: string };
      if (!res.ok) setInviteError(data.error ?? "Une erreur est survenue.");
      else { setInviteSuccess(true); resetInviteForm(); if (practitionerId) await loadPatients(practitionerId); }
    } catch { setInviteError("Impossible d'envoyer l'invitation."); }
    finally { setInviting(false); }
  };

  const formatTime = (seconds: number) => { const m = Math.floor(seconds / 60).toString().padStart(2, "0"); const s = (seconds % 60).toString().padStart(2, "0"); return `${m}:${s}`; };
  const fileTypeIcon = (type: string) => { if (["jpg","jpeg","png"].includes(type)) return "🖼️"; if (["mp3","wav","m4a"].includes(type)) return "🎙️"; if (["xlsx","csv"].includes(type)) return "📊"; if (type === "pdf") return "📕"; if (type === "docx") return "📝"; return "📄"; };
  const today = new Date().toISOString().split("T")[0];

  return (
    <div style={{ minHeight: "100vh", background: "#070B09", color: "white", fontFamily: "Inter, sans-serif" }}>

      {/* ═══ ONBOARDING ═══ */}
      {showOnboarding && (
        <OnboardingTour
          step={onboardingStep}
          practitionerName={practitionerName}
          onNext={handleOnboardingNext}
          onSkip={handleOnboardingSkip}
        />
      )}

      {/* ═══ HEADER ═══ */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(7,7,7,0.8)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 40, padding: "0 24px" }}>
        <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowAccountMenu(prev => !prev)}
              style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "4px 8px", borderRadius: 10, transition: "background 0.2s", display: "flex", alignItems: "center", gap: 10 }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${emerald}`, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                {practitionerPhoto ? <img src={practitionerPhoto} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : AVATARS[selectedAvatar]}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "white" }}>
                  {practitionerName ? `Bonjour ${practitionerName.split(" ")[0]} 👋` : "Dashboard"}
                  <span style={{ fontSize: 11, color: "#64748b", marginLeft: 6 }}>▾</span>
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                  {onboardingDemoMode ? "4 patients · 131 messages" : `${patients.length} patient${patients.length > 1 ? "s" : ""} · ${totalMessages} messages`}
                </p>
              </div>
            </button>

            {showAccountMenu && (
              <>
                <div onClick={() => setShowAccountMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 50, background: "#0d0d0d", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", padding: "6px", minWidth: 230 }}>
                  <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white" }}>{practitionerName}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{practitionerEmail}</p>
                  </div>
                  <button onClick={() => { handleDiscretClick(); setShowAccountMenu(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: discretMode ? "rgba(245,158,11,0.08)" : "transparent", border: "none", cursor: "pointer", transition: "all 0.15s", marginBottom: 2 }}
                    onMouseEnter={e => { if (!discretMode) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = discretMode ? "rgba(245,158,11,0.08)" : "transparent"; }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: discretMode ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${discretMode ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke={discretMode ? amber : "#94a3b8"} strokeWidth="1.8"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={discretMode ? amber : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round"/></svg>
                    </div>
                    <div style={{ textAlign: "left", flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: discretMode ? amber : "white" }}>Mode discret</p>
                      <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>{discretMode ? "Actif - cliquer pour désactiver" : "Masquer les données patients"}</p>
                    </div>
                    {discretMode && <div style={{ width: 8, height: 8, borderRadius: "50%", background: amber, flexShrink: 0 }} />}
                  </button>
                  <button onClick={() => { setShowSettingsModal(true); setShowAccountMenu(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", transition: "all 0.15s", marginBottom: 2 }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#94a3b8" strokeWidth="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="#94a3b8" strokeWidth="1.8"/></svg>
                    </div>
                    <div style={{ textAlign: "left" }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "white" }}>Paramètres</p>
                      <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>Compte, PIN, sécurité</p>
                    </div>
                  </button>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
                  <button onClick={() => { setShowLogoutModal(true); setShowAccountMenu(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "transparent", border: "none", cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(244,63,94,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/><polyline points="16,17 21,12 16,7" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f87171" }}>Se déconnecter</p>
                  </button>
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {(["patients", "radar", "valeur", "patterns"] as ActiveTab[]).map((tab) => {
              const labels: Record<ActiveTab, string> = { patients: "Suivi", radar: "Radar", valeur: "Impact", patterns: "Insights" };
              const isActive = activeTab === tab;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ height: 36, borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: isActive ? "1px solid rgba(16,185,129,0.18)" : "1px solid transparent", background: isActive ? "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))" : "transparent", color: isActive ? emerald : "#64748b", transition: "all 0.2s", boxShadow: isActive ? "0 2px 12px rgba(0,0,0,0.3)" : "none", position: "relative" }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = emerald; e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.15)"; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; } }}>
                  {labels[tab]}
                </button>
              );
            })}
            <button onClick={() => void openJumeauModal()}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 12, background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))", border: "1px solid rgba(16,185,129,0.18)", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))"; e.currentTarget.style.transform = "translateY(0)"; }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: emerald, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM17.5 14v7M14 17.5h7" stroke="black" strokeWidth="2" strokeLinecap="round"/></svg>
              </div>
              <div style={{ textAlign: "left" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: emerald }}>Mon Jumeau</p>
                <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>Gérer mes documents</p>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Bandeau critique global */}
      {patients.some(p => p.emotional_status === "red_critical") && (
  <div style={{ background: "rgba(244,63,94,0.12)", borderBottom: "1px solid rgba(244,63,94,0.4)", padding: "10px 24px", animation: "criticalPulse 2s ease-in-out infinite", position: "sticky", top: 64, zIndex: 45 }}>
    <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>🚨</span>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: coral }}>Alerte critique — Intervention immédiate requise</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: 8 }}>
        {patients.filter(p => p.emotional_status === "red_critical").map(p => (
          <button key={p.id} onClick={() => { setSelectedPatientId(p.id); setActiveTab("patients"); }}
            style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 20, padding: "3px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: coral, filter: discretMode ? "blur(4px)" : "none" }}>
            {p.firstName} {p.lastName}
          </button>
        ))}
      </div>
    </div>
  </div>
)}


      {/* Bandeau victoires */}
      {victoryPatients.length > 0 && (
        <div style={{ background: "rgba(16,185,129,0.08)", borderBottom: "1px solid rgba(16,185,129,0.2)", padding: "10px 24px" }}>
          <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: emerald, letterSpacing: "0.1em", textTransform: "uppercase" }}>🏆 Victoires détectées</span>
            {victoryPatients.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 20, padding: "4px 12px" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: emerald, filter: discretMode ? "blur(4px)" : "none" }}>{p.firstName}</span>
                <span style={{ fontSize: 11, color: "#94a3b8", filter: discretMode ? "blur(4px)" : "none" }}>— {p.latest_victory}</span>
                {!onboardingDemoMode && (victorySent === p.id ? (
                  <span style={{ fontSize: 11, color: emerald }}>✅ Envoyé !</span>
                ) : (
                  <button onClick={() => void sendVictory(p.id, p.latest_victory ?? "")} disabled={sendingVictory === p.id}
                    style={{ height: 22, borderRadius: 11, padding: "0 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", background: emerald, color: "black" }}>
                    {sendingVictory === p.id ? "..." : "Envoyer un bravo"}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bandeau alertes */}
      {(redPatients.length > 0 || orangePatients.length > 0) && (
        <div style={{ background: "rgba(244,63,94,0.08)", borderBottom: "1px solid rgba(244,63,94,0.2)", padding: "10px 24px" }}>
          <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: coral, letterSpacing: "0.1em", textTransform: "uppercase" }}>⚡ Attention requise</span>
            {redPatients.map((p) => (
              <button key={p.id} onClick={() => { setSelectedPatientId(p.id); setActiveTab("patients"); }}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 20, padding: "4px 12px", cursor: "pointer" }}>
                <span style={{ fontSize: 10 }}>🔴</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: coral, filter: discretMode ? "blur(4px)" : "none" }}>{p.firstName}</span>
                {p.emotional_insight && <span style={{ fontSize: 11, color: "#94a3b8", filter: discretMode ? "blur(4px)" : "none" }}>— {p.emotional_insight}</span>}
              </button>
            ))}
            {orangePatients.map((p) => (
              <button key={p.id} onClick={() => { setSelectedPatientId(p.id); setActiveTab("patients"); }}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 20, padding: "4px 12px", cursor: "pointer" }}>
                <span style={{ fontSize: 10 }}>🟠</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: amber, filter: discretMode ? "blur(4px)" : "none" }}>{p.firstName}</span>
                {p.emotional_insight && <span style={{ fontSize: 11, color: "#94a3b8", filter: discretMode ? "blur(4px)" : "none" }}>— {p.emotional_insight}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1600, margin: "0 auto", padding: "24px" }}>

        {/* ═══ VUE SUIVI ═══ */}
        {activeTab === "patients" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0,1fr) 300px", gap: 16, height: "calc(100vh - 160px)" }}>

            {/* Sidebar patients */}
            <div style={{ display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%", height: 36, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "white", padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                {loading && !onboardingDemoMode ? (
                  <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 20 }}>Chargement...</p>
                ) : filteredPatients.length === 0 ? (
                  <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 20 }}>Aucun patient</p>
                ) : filteredPatients.map((patient) => {
                  const isSelected = patient.id === (selectedPatientId ?? (onboardingDemoMode ? "demo-1" : null));
                  const statusColor = getStatusColor(patient.emotional_status);
                  const isRed = patient.emotional_status === "red";
                  return (
                    <button key={patient.id} onClick={() => setSelectedPatientId(patient.id)}
                      style={{ width: "100%", borderRadius: 10, padding: "10px 12px", textAlign: "left", cursor: "pointer", marginBottom: 4, background: isSelected ? "rgba(16,185,129,0.08)" : "transparent", border: isSelected ? "1px solid rgba(16,185,129,0.2)" : "1px solid transparent", boxShadow: isRed && !isSelected ? "0 0 0 1px rgba(244,63,94,0.2)" : "none", transition: "all 0.2s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: patient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0 }}>
                          {patient.initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? emerald : "white", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{patient.firstName}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              {patient.latest_victory && <span style={{ fontSize: 10 }}>🏆</span>}
                              <span style={{ fontSize: 10, color: statusColor }}>●</span>
                            </div>
                          </div>
                          <p style={{ margin: 0, fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>
                            {patient.emotional_insight || patient.lastMessage}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button onClick={() => setShowInviteModal(true)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 12, background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))", border: "1px solid rgba(16,185,129,0.18)", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))"; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: emerald, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="black" strokeWidth="2.5" strokeLinecap="round"/></svg>
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: emerald }}>Inviter un patient</p>
                    <p style={{ margin: 0, fontSize: 10, color: "#64748b" }}>Envoyer un accès personnalisé</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Zone conversation */}
            <div style={{ display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
              {selectedPatient ? (
                <>
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: selectedPatient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white" }}>
                        {selectedPatient.initials}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "white", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{selectedPatient.firstName} {selectedPatient.lastName}</p>
                        <p style={{ margin: 0, fontSize: 12, color: "#64748b", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{onboardingDemoMode ? "patient@email.fr" : (selectedPatient as RealPatient).email}</p>
                      </div>
                    </div>
                    <button onClick={() => { if (!onboardingDemoMode) { setShowReportModal(true); setReportContent(""); } }}
                      style={{ height: 32, borderRadius: 8, padding: "0 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.08)", color: emerald }}>
                      📊 Rapport IA
                    </button>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", background: "#070707", display: "flex", flexDirection: "column", gap: 12 }}>
                    {displayedConversations.length === 0 ? (
                      <p style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 40 }}>Aucune conversation</p>
                    ) : displayedConversations.map((message) => {
                      const isPatient = message.role === "user";
                      return (
                        <div key={message.id} style={{ display: "flex", justifyContent: isPatient ? "flex-start" : "flex-end" }}>
                          <div style={{ maxWidth: "78%" }}>
                            <div style={{ borderRadius: 14, borderBottomRightRadius: isPatient ? 14 : 4, borderBottomLeftRadius: isPatient ? 4 : 14, padding: "10px 14px", fontSize: 14, lineHeight: 1.6, background: isPatient ? "rgba(255,255,255,0.06)" : emerald, color: isPatient ? "#e2e8f0" : "black", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>
                              {message.content}
                            </div>
                            <p style={{ margin: "4px 0 0", fontSize: 10, color: "#4b5563", textAlign: isPatient ? "left" : "right" }}>
                              {new Date(message.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ fontSize: 14, color: "#4b5563" }}>{loading ? "Chargement..." : "Sélectionnez un patient"}</p>
                </div>
              )}
            </div>

            {/* Fiche patient */}
            <div style={{ overflowY: "auto", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 16 }}>
              {selectedPatient ? (
                <>
                  <div style={{ textAlign: "center", marginBottom: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: selectedPatient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "white", margin: "0 auto 10px" }}>
                      {selectedPatient.initials}
                    </div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{selectedPatient.firstName} {selectedPatient.lastName}</p>
                    <p style={{ margin: "2px 0 8px", fontSize: 12, color: "#64748b", filter: discretMode ? "blur(4px)" : "none", transition: "filter 0.2s" }}>{onboardingDemoMode ? "patient@email.fr" : (selectedPatient as RealPatient).email}</p>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 20, padding: "4px 12px", background: `${getStatusColor(selectedPatient.emotional_status)}15`, border: `1px solid ${getStatusColor(selectedPatient.emotional_status)}30` }}>
                      <span style={{ fontSize: 10 }}>{getStatusEmoji(selectedPatient.emotional_status)}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: getStatusColor(selectedPatient.emotional_status), filter: discretMode ? "blur(4px)" : "none" }}>
                        {selectedPatient.emotional_insight || (selectedPatient.emotional_status === "green" ? "Adhésion positive" : selectedPatient.emotional_status === "orange" ? "Vigilance modérée" : "Attention requise")}
                      </span>
                    </div>
                  </div>

                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "10px 12px", marginBottom: 10 }}>
                    {[
                      { label: "Messages", value: String(selectedPatient.totalMessages) },
                      { label: "Âge", value: onboardingDemoMode ? "34 ans" : (selectedPatient as RealPatient).age ? `${(selectedPatient as RealPatient).age} ans` : "—" },
                      { label: "Poids", value: onboardingDemoMode ? "68 kg" : (selectedPatient as RealPatient).poids ? `${(selectedPatient as RealPatient).poids} kg` : "—" },
                    ].map((item) => (
                      <div key={item.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{item.label}</span>
                        <span style={{ fontSize: 11, color: "#e2e8f0", fontWeight: 500 }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Alerte admin */}
                  {(selectedPatient.admin_alerts?.filter(a => !a.seen).length ?? 0) > 0 && !onboardingDemoMode && (
                    <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 12 }}>⚠️</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: amber }}>Action requise</span>
                      </div>
                      {selectedPatient.admin_alerts?.filter(a => !a.seen).map((alert, i) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <p style={{ margin: "0 0 6px", fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                            {alert.type === "crisis" && alert.alert_type === "suicide" && "Le patient a exprimé des idées suicidaires."}
                            {alert.type === "crisis" && alert.alert_type === "medical" && "Urgence médicale signalée par le patient."}
                            {alert.type === "crisis" && alert.alert_type === "threat" && "Le patient a exprimé une menace envers autrui."}
                            {alert.type === "alert" && "Comportement sensible détecté — relecture recommandée."}
                            {alert.type === "admin_alert" && alert.alert_type === "identity_correction" && "Le patient signale une erreur dans son nom."}
                          </p>
                          {alert.type === "crisis" ? (
                            <LeverAlerteCritique alert={alert} patientId={selectedPatient.id} onResolved={() => {
                              setPatients(prev => prev.map(p => p.id === selectedPatient.id ? {
                                ...p,
                                emotional_status: "green",
                                admin_alerts: []
                              } : p));
                            }} />
                          ) : (
                            <LeverAlerteSimple alert={alert} patientId={selectedPatient.id} murmureSuggere={(alert as { murmure?: string }).murmure ?? ""} onResolved={(murmure) => {
                              setPatients(prev => prev.map(p => p.id === selectedPatient.id ? {
                                ...p,
                                emotional_status: "green",
                                practitioner_instruction: murmure || p.practitioner_instruction,
                                admin_alerts: p.admin_alerts?.map(a => a === alert ? { ...a, seen: true } : a)
                              } : p));
                            }} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                   {/* Murmure */}
                   <div style={{ background: "rgba(16,185,129,0.05)", borderRadius: 10, border: "1px solid rgba(16,185,129,0.2)", padding: "10px 12px", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 11 }}>🎙️</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: emerald }}>Murmure actif</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                      {onboardingDemoMode ? "Sois plus doux cette semaine, elle traverse une période difficile." : ((selectedPatient as RealPatient).practitioner_instruction || "Aucune consigne active")}
                    </p>
                  </div>

                  {!onboardingDemoMode && (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#64748b" }}>Notes privées</p>
                      <textarea value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} placeholder="Notes visibles uniquement par vous..." rows={3}
                        style={{ width: "100%", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "white", padding: "8px 10px", fontSize: 12, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}
                        onFocus={(e) => e.target.style.borderColor = "rgba(16,185,129,0.3)"}
                        onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
                      <button onClick={() => void savePrivateNotes()} disabled={savingPrivateNotes}
                        style={{ marginTop: 4, height: 28, borderRadius: 6, padding: "0 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none", background: privateNotesSaved ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)", color: privateNotesSaved ? emerald : "#94a3b8" }}>
                        {privateNotesSaved ? "✅ Sauvegardé" : savingPrivateNotes ? "..." : "Sauvegarder"}
                      </button>
                    </div>
                  )}
                

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button onClick={() => !onboardingDemoMode && openMurmureModal()}
                      style={{ height: 38, borderRadius: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: emerald, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      🎙️ {!onboardingDemoMode && (selectedPatient as RealPatient).practitioner_instruction ? "Modifier le murmure" : "Ajouter un murmure"}
                    </button>
                    <button onClick={() => !onboardingDemoMode && openProfileModal()}
                      style={{ height: 38, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      ✏️ Modifier le profil
                    </button>
                    <button onClick={() => { if (!onboardingDemoMode) { setShowReportModal(true); setReportContent(""); } }}
                      style={{ height: 38, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      📊 Rapport IA
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                  <p style={{ fontSize: 13, color: "#4b5563" }}>Sélectionnez un patient</p>
                </div>
              )}
            </div>
          </div>
        )}

       
{activeTab === "radar" && (
  <div>
    {/* ═══ BANDEAU CRITIQUE ═══ */}
    {displayedPatients.some(p => p.emotional_status === "red_critical") && (
      <div style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 16, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, animation: "criticalPulse 2s ease-in-out infinite" }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>🚨</span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: coral }}>Alerte critique — Intervention immédiate requise</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {displayedPatients.filter(p => p.emotional_status === "red_critical").map(p => (
              <button key={p.id} onClick={() => { setSelectedPatientId(p.id); setActiveTab("patients"); }}
                style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: 20, padding: "3px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: coral, filter: discretMode ? "blur(4px)" : "none" }}>
                {p.firstName} {p.lastName}
              </button>
            ))}
          </div>
        </div>
      </div>
    )}

    {/* ═══ HEADER RÉSILIENCE ═══ */}
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Radar émotionnel</h2>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Résilience du cabinet · Statut IA mis à jour à chaque message</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {/* Carte 1 — Delta stress */}
        <div style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 16, padding: 20 }}>
          <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Delta de stress moyen</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 4px", fontSize: 10, color: "#64748b" }}>Avant</p>
              <div style={{ height: 6, background: "rgba(244,63,94,0.15)", borderRadius: 3, marginBottom: 4 }}>
                <div style={{ height: "100%", width: "72%", background: coral, borderRadius: 3 }} />
              </div>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: coral }}>7.2</p>
            </div>
            <div style={{ fontSize: 18, color: "#64748b", paddingBottom: 4 }}>→</div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 4px", fontSize: 10, color: "#64748b" }}>Après</p>
              <div style={{ height: 6, background: "rgba(16,185,129,0.15)", borderRadius: 3, marginBottom: 4 }}>
                <div style={{ height: "100%", width: "31%", background: emerald, borderRadius: 3 }} />
              </div>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: emerald }}>3.1</p>
            </div>
          </div>
          <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 8, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12 }}>📉</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: emerald }}>-57% de stress moyen</span>
          </div>
        </div>

        {/* Carte 2 — Crises absorbées */}
        <div style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 16, padding: 20 }}>
          <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Crises apaisées</p>
          <p style={{ margin: "0 0 4px", fontSize: 48, fontWeight: 900, color: "#818cf8", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {patients.reduce((sum, p) => sum + (p.totalMessages > 0 ? 1 : 0), 0) || 0}
          </p>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>ce mois-ci en autonomie totale</p>
          <div style={{ background: "rgba(99,102,241,0.08)", borderRadius: 8, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12 }}>🛡️</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>Sans votre intervention</span>
          </div>
        </div>

        {/* Carte 3 — Top outils */}
        <div style={{ background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 16, padding: 20 }}>
          <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Top des outils</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { rank: 1, label: "Cohérence cardiaque", pct: 48, color: emerald },
              { rank: 2, label: "Ancrage sensoriel", pct: 31, color: "#06b6d4" },
              { rank: 3, label: "Marche consciente", pct: 21, color: "#8b5cf6" },
            ].map((tool) => (
              <div key={tool.rank} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", width: 16, flexShrink: 0 }}>{tool.rank}.</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: "white" }}>{tool.label}</span>
                    <span style={{ fontSize: 11, color: tool.color, fontWeight: 600 }}>{tool.pct}%</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${tool.pct}%`, background: tool.color, borderRadius: 2, transition: "width 0.8s ease" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Séparateur */}
      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 24 }} />
    </div>

    {/* ═══ GRID PATIENTS ═══ */}
    {displayedPatients.length === 0 ? (
      <p style={{ textAlign: "center", color: "#64748b", marginTop: 60 }}>Aucun patient</p>
    ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {[...displayedPatients].sort((a, b) => {
          const order = { red_critical: 0, red: 1, orange: 2, green: 3 };
          return (order[a.emotional_status as keyof typeof order] ?? 3) - (order[b.emotional_status as keyof typeof order] ?? 3);
        }).map((patient) => {
          const isCritical = patient.emotional_status === "red_critical";
          const isRed = patient.emotional_status === "red" || isCritical;
          const statusColor = isCritical ? coral : getStatusColor(patient.emotional_status);
          return (
            <div key={patient.id} style={{ borderRadius: 16, padding: "20px", background: isCritical ? "rgba(244,63,94,0.08)" : isRed ? "rgba(244,63,94,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${isCritical ? "rgba(244,63,94,0.5)" : isRed ? "rgba(244,63,94,0.25)" : "rgba(255,255,255,0.06)"}`, boxShadow: isCritical ? "0 0 32px rgba(244,63,94,0.25)" : isRed ? "0 0 24px rgba(244,63,94,0.12)" : "none", transition: "all 0.3s", animation: isCritical ? "criticalPulse 2s ease-in-out infinite" : "none" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <button onClick={() => { setSelectedPatientId(patient.id); setActiveTab("patients"); }} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: patient.avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "white" }}>{patient.initials}</div>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: isCritical ? coral : "white", filter: discretMode ? "blur(4px)" : "none" }}>{patient.firstName} {patient.lastName}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{patient.totalMessages} messages</p>
                  </div>
                </button>
                <span style={{ fontSize: 18 }}>{isCritical ? "🚨" : getStatusEmoji(patient.emotional_status)}</span>
              </div>
              {patient.emotional_insight && (
                <p style={{ margin: "0 0 10px", fontSize: 12, color: statusColor, lineHeight: 1.5, fontStyle: "italic", filter: discretMode ? "blur(4px)" : "none" }}>
                  "{patient.emotional_insight}"
                </p>
              )}
              {isCritical && (
                <div style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 8, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: coral }}>⚡ Intervention immédiate</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}

    <style>{`
      @keyframes criticalPulse {
        0%, 100% { box-shadow: 0 0 32px rgba(244,63,94,0.25); }
        50% { box-shadow: 0 0 48px rgba(244,63,94,0.5); }
      }
    `}</style>
  </div>
)}


        {/* ═══ VUE IMPACT ═══ */}
        {activeTab === "valeur" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Impact de votre jumeau</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Ce que votre jumeau a accompli ce mois-ci</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginBottom: 24 }}>
              {[
                { icon: "💬", label: "Messages gérés", value: monthlyStats?.messages_geres ?? 0, unit: "messages", desc: "Questions répondues à votre place", color: emerald },
                { icon: "🌙", label: "Crises nocturnes", value: monthlyStats?.crises_nocturnes ?? 0, unit: "interventions", desc: "Moments où votre jumeau était là pour eux", color: "#8b5cf6" },
                { icon: "⏱️", label: "Temps économisé", value: monthlyStats?.temps_economise_heures ?? 0, unit: "heures", desc: "Estimé à 1,2 min par message géré", color: amber },
                { icon: "🔄", label: "Questions répétitives", value: `${monthlyStats?.questions_repetitives_pct ?? 0}%`, unit: "", desc: "Absorbées par le jumeau sans vous", color: "#06b6d4" },
              ].map((stat, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "24px", backdropFilter: "blur(20px)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 24 }}>{stat.icon}</span>
                    <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{stat.label}</span>
                  </div>
                  <p style={{ margin: "0 0 4px", fontSize: 36, fontWeight: 800, color: stat.color, fontVariantNumeric: "tabular-nums" }}>
                    {stat.value}{stat.unit && <span style={{ fontSize: 14, fontWeight: 400, color: "#64748b", marginLeft: 6 }}>{stat.unit}</span>}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{stat.desc}</p>
                </div>
              ))}
            </div>
            <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 16, padding: "24px" }}>
              <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "white" }}>🧬 Synthèse du mois</p>
              <p style={{ margin: 0, fontSize: 14, color: "#94a3b8", lineHeight: 1.8 }}>
                Ce mois-ci, votre jumeau a répondu à <strong style={{ color: "white" }}>{monthlyStats?.messages_geres ?? 0} questions</strong>, géré <strong style={{ color: "white" }}>{monthlyStats?.crises_nocturnes ?? 0} moments difficiles</strong> en dehors de vos heures de consultation, et vous a économisé environ <strong style={{ color: "white" }}>{monthlyStats?.temps_economise_heures ?? 0} heures</strong> de suivi.
                <br /><br />
                <strong style={{ color: emerald }}>{monthlyStats?.questions_repetitives_pct ?? 0}% des questions répétitives</strong> ont été absorbées sans votre intervention. Votre expertise travaille 24h/24.
              </p>
            </div>
          </div>
        )}

        {/* ═══ VUE INSIGHTS ═══ */}
        {activeTab === "patterns" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Insights comportementaux</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>L'IA détecte ce que l'œil humain ne voit pas</p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Analyser le patient</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {patients.map((p) => (
                  <button key={p.id} onClick={() => setSelectedPatientId(p.id)}
                    style={{ height: 36, borderRadius: 20, padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: selectedPatientId === p.id ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent", background: selectedPatientId === p.id ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)", color: selectedPatientId === p.id ? emerald : "#64748b", transition: "all 0.2s", filter: discretMode ? "blur(4px)" : "none" }}>
                    {p.firstName} {p.lastName}
                  </button>
                ))}
              </div>
            </div>
            {selectedPatient && !onboardingDemoMode && (
              <div style={{ marginBottom: 20 }}>
                <button onClick={() => void generatePatternInsight()} disabled={patternLoading}
                  style={{ height: 44, borderRadius: 20, padding: "0 24px", fontSize: 14, fontWeight: 600, cursor: patternLoading ? "not-allowed" : "pointer", border: "none", background: patternLoading ? "rgba(255,255,255,0.05)" : emerald, color: patternLoading ? "#64748b" : "black", transition: "all 0.2s" }}>
                  {patternLoading ? "Analyse en cours... 🧬" : `Analyser ${selectedPatient.firstName} →`}
                </button>
              </div>
            )}
            {patternInsight && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "24px" }}>
                <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: emerald, letterSpacing: "0.08em", textTransform: "uppercase" }}>🧬 Insights — {selectedPatient?.firstName}</p>
                {patternInsight.split("\n").filter(Boolean).map((line, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: emerald, flexShrink: 0, marginTop: 7 }} />
                    <p style={{ margin: 0, fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>{line.replace(/^[-•*]\s*/, "")}</p>
                  </div>
                ))}
              </div>
            )}
            {!patternInsight && !patternLoading && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <p style={{ fontSize: 32, marginBottom: 12 }}>🔬</p>
                <p style={{ fontSize: 15, fontWeight: 600, color: "white", marginBottom: 6 }}>Détection de patterns comportementaux</p>
                <p style={{ fontSize: 13, color: "#64748b", maxWidth: 400, margin: "0 auto" }}>Sélectionnez un patient et lancez l'analyse. L'IA croisera journal de bord et conversations pour révéler des corrélations invisibles.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ═══ MODALES (identiques à l'original) ═══ */}

      {showPinModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowPinModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 32, width: "100%", maxWidth: 360, border: `1px solid rgba(245,158,11,0.3)`, boxShadow: "0 20px 60px rgba(0,0,0,0.8)", textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke={amber} strokeWidth="1.8"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={amber} strokeWidth="1.8" strokeLinecap="round"/></svg>
            </div>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>Mode discret</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Entrez votre code PIN pour désactiver</p>
            <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") verifyPin(); }} placeholder="Code PIN" maxLength={6} autoFocus
              style={{ width: "100%", height: 52, borderRadius: 12, border: `1px solid ${pinError ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.1)"}`, background: "#161616", color: "white", padding: "0 16px", fontSize: 20, outline: "none", boxSizing: "border-box", textAlign: "center", letterSpacing: "0.3em", fontFamily: "monospace", marginBottom: 8 }} />
            {pinError && <p style={{ margin: "0 0 12px", fontSize: 13, color: "#f87171" }}>{pinError}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowPinModal(false)} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>Annuler</button>
              <button onClick={verifyPin} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: amber, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,158,11,0.2)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(245,158,11,0.12)"; }}>Déverrouiller</button>
            </div>
          </div>
        </div>
      )}

      {showLogoutModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowLogoutModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, border: "1px solid rgba(244,63,94,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/><polyline points="16,17 21,12 16,7" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </div>
            <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: "white" }}>Se déconnecter ?</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#64748b" }}>Vous devrez vous reconnecter pour accéder à votre dashboard.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowLogoutModal(false)} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>Annuler</button>
              <button onClick={async () => { const s = createSupabaseBrowserClient(); await s.auth.signOut(); window.location.href = "/login"; }} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.15)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.35)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.2)"; }}>Se déconnecter</button>
            </div>
          </div>
        </div>
      )}

      {showDeletePinModal && (
        <div onClick={e => { if (e.target === e.currentTarget) { setShowDeletePinModal(false); setDeletePinInput(""); setDeletePinError(""); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 360, border: "1px solid rgba(244,63,94,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="#f87171" strokeWidth="1.8"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </div>
            <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: "white" }}>Supprimer le PIN</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Entrez votre PIN actuel pour confirmer</p>
            <input type="password" value={deletePinInput} onChange={e => setDeletePinInput(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" maxLength={6} autoFocus
              style={{ width: "100%", height: 48, borderRadius: 12, border: `1px solid ${deletePinError ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.1)"}`, background: "#161616", color: "white", padding: "0 16px", fontSize: 18, outline: "none", boxSizing: "border-box", textAlign: "center", letterSpacing: "0.3em", fontFamily: "Inter, sans-serif", marginBottom: 8 }} />
            {deletePinError && <p style={{ margin: "0 0 8px", fontSize: 13, color: "#f87171" }}>{deletePinError}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button onClick={() => { setShowDeletePinModal(false); setDeletePinInput(""); setDeletePinError(""); }} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>Annuler</button>
              <button onClick={async () => { if (deletePinInput === savedPin) { await supabase.from("practitioners").update({ discrete_pin: null }).eq("user_id", practitionerId!); setSavedPin(""); setShowDeletePinModal(false); setDeletePinInput(""); setDeletePinError(""); } else { setDeletePinError("Code incorrect"); setDeletePinInput(""); } }} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.15)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.35)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.2)"; }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div onClick={e => { if (e.target === e.currentTarget) { setShowPasswordModal(false); setPasswordResetSent(false); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>Changer le mot de passe</h2>
              <button onClick={() => { setShowPasswordModal(false); setPasswordResetSent(false); }} style={{ background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8", width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
            {passwordResetSent ? (
              <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, padding: "20px", textAlign: "center" }}>
                <p style={{ fontSize: 28, marginBottom: 10 }}>✅</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "white" }}>Email envoyé !</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>Vérifiez votre boîte mail à <strong style={{ color: emerald }}>{practitionerEmail}</strong></p>
                <button onClick={() => { setShowPasswordModal(false); setPasswordResetSent(false); }} style={{ marginTop: 16, height: 40, borderRadius: 20, padding: "0 20px", background: emerald, border: "none", color: "black", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Fermer</button>
              </div>
            ) : (
              <>
                <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>Un lien de réinitialisation sera envoyé à <strong style={{ color: "white" }}>{practitionerEmail}</strong></p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowPasswordModal(false)} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>Annuler</button>
                  <button onClick={async () => { const s = createSupabaseBrowserClient(); await s.auth.resetPasswordForEmail(practitionerEmail, { redirectTo: `${window.location.origin}/reset-password` }); setPasswordResetSent(true); }} style={{ flex: 2, height: 44, borderRadius: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: emerald, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; }}>Envoyer le lien →</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowSettingsModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 24, padding: 28, width: "100%", maxWidth: 480, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "white" }}>Paramètres</h2>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Gérez votre compte et vos préférences</p>
              </div>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Votre profil</p>
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", padding: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", border: `2px solid ${emerald}`, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {practitionerPhoto ? <img src={practitionerPhoto} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : AVATARS[selectedAvatar]}
                    </div>
                    <button onClick={() => avatarInputRef.current?.click()} style={{ position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: "50%", background: emerald, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="black" strokeWidth="2.5" strokeLinecap="round"/></svg>
                    </button>
                    <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => setPractitionerPhoto(ev.target?.result as string); reader.readAsDataURL(file); }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "white" }}>{practitionerName}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{practitionerEmail}</p>
                    {practitionerSpecialty && <p style={{ margin: "2px 0 0", fontSize: 11, color: emerald }}>{practitionerSpecialty}</p>}
                  </div>
                </div>
                {!practitionerPhoto && (
                  <>
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b" }}>Choisir un avatar</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {AVATARS.map((avatar, i) => (
                        <button key={i} onClick={() => setSelectedAvatar(i)} style={{ width: 40, height: 40, borderRadius: "50%", border: `2px solid ${selectedAvatar === i ? emerald : "rgba(255,255,255,0.08)"}`, background: selectedAvatar === i ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
                          {avatar}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {practitionerPhoto && <button onClick={() => setPractitionerPhoto(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#f87171", textDecoration: "underline", padding: 0, marginTop: 4 }}>Supprimer la photo</button>}
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Mode discret</p>
              <div style={{ background: "rgba(245,158,11,0.05)", borderRadius: 12, border: "1px solid rgba(245,158,11,0.2)", padding: "16px" }}>
                <p style={{ margin: "0 0 10px", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{savedPin ? "Un PIN est défini. Entrez un nouveau code pour le modifier." : "Définissez un code PIN pour sécuriser la sortie du mode discret."}</p>
                <input type="password" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={savedPin ? "Nouveau PIN (4-6 chiffres)" : "Créer un PIN (4-6 chiffres)"} maxLength={6}
                  style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid rgba(245,158,11,0.3)", background: "#161616", color: "white", padding: "0 12px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", marginBottom: 10 }} />
                <button onClick={() => void saveSettings()} disabled={savingSettings || !newPin || newPin.length < 4}
                  style={{ width: "100%", height: 40, borderRadius: 10, background: savingSettings || !newPin || newPin.length < 4 ? "rgba(255,255,255,0.04)" : "rgba(245,158,11,0.08)", border: `1px solid ${savingSettings || !newPin || newPin.length < 4 ? "rgba(255,255,255,0.06)" : "rgba(245,158,11,0.2)"}`, color: savingSettings || !newPin || newPin.length < 4 ? "#64748b" : amber, fontSize: 13, fontWeight: 500, cursor: savingSettings || !newPin || newPin.length < 4 ? "not-allowed" : "pointer", transition: "all 0.2s", marginBottom: savedPin ? 8 : 0 }}
                  onMouseEnter={e => { if (!savingSettings && newPin && newPin.length >= 4) e.currentTarget.style.background = "rgba(245,158,11,0.15)"; }}
                  onMouseLeave={e => { if (!savingSettings && newPin && newPin.length >= 4) e.currentTarget.style.background = "rgba(245,158,11,0.08)"; }}>
                  {settingsSaved ? "✅ PIN sauvegardé" : savingSettings ? "Sauvegarde..." : "Sauvegarder le PIN →"}
                </button>
                {savedPin && <button onClick={() => setShowDeletePinModal(true)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#f87171", textDecoration: "underline", padding: 0 }}>Supprimer le PIN</button>}
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Sécurité</p>
              <button onClick={() => setShowPasswordModal(true)} style={{ width: "100%", height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "white"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#94a3b8"; }}>Changer mon mot de passe →</button>
            </div>
            <div>
              <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Session</p>
              <button onClick={() => setShowLogoutModal(true)} style={{ width: "100%", height: 44, borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.15)"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; }}>Se déconnecter</button>
            </div>
          </div>
        </div>
      )}

      {showMurmureModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowMurmureModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, border: "1px solid rgba(16,185,129,0.2)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>🎙️ Murmure du praticien</h2>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>Consigne prioritaire pour {selectedPatient?.firstName} · Persistante jusqu'à suppression</p>
              </div>
              <button onClick={() => setShowMurmureModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8" }}>×</button>
            </div>
            <div style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 12, color: emerald, lineHeight: 1.6 }}>⚡ Cette consigne sera injectée en priorité absolue dans chaque réponse du jumeau pour ce patient.</p>
            </div>
            <textarea value={murmureText} onChange={(e) => setMurmureText(e.target.value)} placeholder="Ex: Sois plus doux cette semaine, elle traverse une période difficile au travail." rows={5}
              style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.6 }} />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              {murmureText && <button onClick={() => setMurmureText("")} style={{ height: 44, borderRadius: 10, padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid rgba(244,63,94,0.3)", background: "rgba(244,63,94,0.08)", color: "#f87171" }}>Supprimer</button>}
              <button onClick={() => void saveMurmure()} disabled={savingMurmure} style={{ flex: 1, height: 44, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", background: emerald, color: "black" }}>
                {savingMurmure ? "Sauvegarde..." : "Activer le murmure →"}
              </button>
            </div>
          </div>
        </div>
      )}

{showJumeauModal && (
  <div onClick={(e) => { if (e.target === e.currentTarget) setShowJumeauModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
    <div style={{ background: "#0d0d0d", borderRadius: 24, padding: 28, width: "100%", maxWidth: 560, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", maxHeight: "90vh", overflowY: "auto" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: emerald, textTransform: "uppercase", letterSpacing: "0.1em" }}>Votre expertise</p>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "white" }}>Mon Jumeau</h2>
        </div>
        <button onClick={() => setShowJumeauModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8" }}>×</button>
      </div>

      {/* Score de fidélité */}
      {(() => {
        const count = documents.length;
        const score = count === 0 ? 70 : count === 1 ? 85 : 100;
        const color = count === 0 ? "#f59e0b" : count === 1 ? "#06b6d4" : "#10b981";
        const msg = count === 0
          ? "⚠️ Jumeau initialisé — Votre jumeau connaît votre personnalité mais il lui manque encore votre expertise. Partagez votre vision et votre signature pour lui donner votre pleine précision."
          : count === 1
          ? "🔹 Jumeau Personnalisé — Une première brique de votre expertise a été intégrée. Ajoutez un second document pour que votre double soit parfaitement opérationnel et certifié."
          : "✅ Jumeau certifié — Précision maximale atteinte. Votre jumeau possède désormais votre expertise.";
        return (
          <div style={{ background: `${color}10`, borderRadius: 16, border: `2px solid ${color}40`, padding: "16px", marginBottom: 20, transition: "all 0.5s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>Score de fidélité du jumeau</span>
              <span style={{ fontSize: 16, fontWeight: 800, color }}>{score}%</span>
            </div>
            <div style={{ height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 5 }}>
              <div style={{ height: "100%", borderRadius: 5, backgroundColor: color, width: `${score}%`, transition: "width 0.7s" }} />
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 13, color, fontWeight: 500 }}>{msg}</p>
          </div>
        );
      })()}

      {/* Documents indexés */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px" }}>Documents indexés ({documents.length})</p>
        {loadingDocs ? (
          <p style={{ fontSize: 13, color: "#64748b" }}>Chargement...</p>
        ) : documents.length === 0 ? (
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px dashed rgba(255,255,255,0.08)", padding: "20px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Aucun document indexé</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {documents.map((doc) => (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{fileTypeIcon(doc.file_type)}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "white", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.file_name.startsWith("dashboard_note_") ? "Note personnalisée" : doc.file_name.startsWith("memo_vocal_") ? "Mémo vocal" : doc.file_name}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>{new Date(doc.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                </div>
                <button onClick={() => void deleteDocument(doc.id, doc.file_name)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", flexShrink: 0, marginLeft: 8, padding: "4px 8px", borderRadius: 6, transition: "color 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                  onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Encadrés upload */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.8px" }}>Ajouter des documents</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          {[
            { type: "protocole" as const, icon: "📋", label: "Protocoles & méthodes", desc: "Articles, plans alimentaires", note: "✓ Indexé tel quel", noteColor: emerald },
            { type: "patient" as const, icon: "🗂️", label: "Données patients", desc: "Bilans, comptes-rendus", note: "✓ Anonymisé avant indexation", noteColor: "#60a5fa" }
          ].map(({ type, icon, label, desc, note, noteColor }) => (
            <label key={type} style={{ borderRadius: 12, border: `2px dashed ${documentType === type ? (type === "patient" ? "#60a5fa" : emerald) : "rgba(255,255,255,0.15)"}`, background: documentType === type ? (type === "patient" ? "rgba(96,165,250,0.08)" : "rgba(16,185,129,0.08)") : "rgba(255,255,255,0.02)", padding: "14px", textAlign: "left", cursor: "pointer", transition: "all 0.2s", display: "block" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = type === "patient" ? "rgba(96,165,250,0.6)" : "rgba(16,185,129,0.6)"; e.currentTarget.style.background = type === "patient" ? "rgba(96,165,250,0.05)" : "rgba(16,185,129,0.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = documentType === type ? (type === "patient" ? "#60a5fa" : emerald) : "rgba(255,255,255,0.15)"; e.currentTarget.style.background = documentType === type ? (type === "patient" ? "rgba(96,165,250,0.08)" : "rgba(16,185,129,0.08)") : "rgba(255,255,255,0.02)"; }}>
              <input type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.csv,.mp3,.wav,.m4a"
                onChange={e => { setDocumentType(type); handleFileChange(e); }}
                style={{ display: "none" }} />
              <p style={{ margin: "0 0 6px", fontSize: 22 }}>{icon}</p>
              <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "white" }}>{label}</p>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748b" }}>{desc}</p>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: noteColor, fontWeight: 600 }}>{note}</p>
              <div style={{ borderRadius: 8, border: "1px dashed rgba(255,255,255,0.12)", padding: "6px 10px", textAlign: "center" }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>Cliquez pour sélectionner · PDF, DOCX, TXT, MP3...</span>
              </div>
            </label>
          ))}
        </div>

        {/* Fichiers en attente */}
        {uploadedFiles.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {uploadedFiles.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span style={{ fontSize: 13, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                </div>
                <button onClick={() => setUploadedFiles(prev => prev.filter((_, j) => j !== i))}
                  style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4, flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                  onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            ))}
            <button onClick={async () => {
              await uploadFiles();
              if (practitionerId) await loadDocuments(practitionerId);
            }} disabled={uploading || !documentType}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 12px", borderRadius: 12, background: uploading || !documentType ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))", border: `1px solid ${uploading || !documentType ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.18)"}`, color: uploading || !documentType ? "#64748b" : emerald, fontSize: 14, fontWeight: 600, cursor: uploading || !documentType ? "not-allowed" : "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { if (!uploading && documentType) { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
              onMouseLeave={e => { e.currentTarget.style.background = uploading || !documentType ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))"; e.currentTarget.style.transform = "translateY(0)"; }}>
              {uploading ? <><svg style={{ animation: "spin 1s linear infinite" }} width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>Indexation en cours...</> : `Indexer ${uploadedFiles.length} fichier${uploadedFiles.length > 1 ? "s" : ""} →`}
            </button>
            {uploading && <p style={{ fontSize: 12, color: "#f59e0b", textAlign: "center", marginTop: 6 }}>Patientez, l'indexation peut prendre quelques instants.</p>}
          </div>
        )}
      </div>

      {/* Textarea + micro */}
      <div style={{ marginBottom: 12 }}>
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 700, color: "white" }}>Ajouter une instruction</p>
        <div style={{ position: "relative" }}>
          <textarea value={jumeauText} onChange={e => setJumeauText(e.target.value)}
            placeholder="Ajoutez une nuance, une nouvelle méthode ou une instruction à votre jumeau..."
            rows={4}
            style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "14px 48px 14px 14px", fontSize: 13, outline: "none", resize: "none", fontFamily: "Inter, sans-serif", boxSizing: "border-box", transition: "border-color 0.2s" }}
            onFocus={e => e.target.style.borderColor = emerald}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
          <div style={{ position: "absolute", bottom: 12, right: 12, display: "flex", alignItems: "center", gap: 6 }}>
            {isRecording && <span style={{ fontSize: 11, color: "#f87171" }}>{formatTime(recordingTime)}</span>}
            {!audioBlob && (
              <button onClick={isRecording ? stopRecording : startRecording} title="Mémo vocal"
                style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: isRecording ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(16,185,129,0.3)", background: isRecording ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.15)", transition: "all 0.2s" }}>
                {isRecording ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171", animation: "breathe 1s ease-in-out infinite" }} /> : <span style={{ fontSize: 13 }}>🎙️</span>}
              </button>
            )}
          </div>
        </div>

        {audioBlob && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <span style={{ fontSize: 13, color: emerald, flex: 1 }}>✅ Mémo enregistré ({formatTime(recordingTime)})</span>
            <button onClick={async () => { uploadAudioMemo(); if (practitionerId) { await new Promise(r => setTimeout(r, 2000)); await loadDocuments(practitionerId); } }}
              style={{ borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))", border: "1px solid rgba(16,185,129,0.18)", color: emerald, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))"; e.currentTarget.style.transform = "translateY(0)"; }}>
              Indexer ce mémo →
            </button>
            <button onClick={() => setAudioBlob(null)}
              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}
              onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
              onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        )}

        {jumeauText.trim() && !audioBlob && (
          <button onClick={async () => {
            setJumeauTextUploading(true);
            const blob = new Blob([jumeauText], { type: "text/plain" });
            const file = new File([blob], `note_praticien_${Date.now()}.txt`, { type: "text/plain" });
            const formData = new FormData();
            formData.append("file", file);
            formData.append("practitionerId", practitionerId ?? "");
            formData.append("documentType", "protocole");
            try {
              const res = await fetch("/api/upload-document", { method: "POST", body: formData });
              const data = await res.json() as { success?: boolean };
              if (res.ok && data.success) {
                setJumeauText("");
                if (practitionerId) await loadDocuments(practitionerId);
              }
            } catch { /* silencieux */ }
            setJumeauTextUploading(false);
          }} disabled={jumeauTextUploading}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: jumeauTextUploading ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))", border: `1px solid ${jumeauTextUploading ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.18)"}`, color: jumeauTextUploading ? "#64748b" : emerald, fontSize: 13, fontWeight: 600, cursor: jumeauTextUploading ? "not-allowed" : "pointer", transition: "all 0.2s", marginTop: 8 }}
            onMouseEnter={e => { if (!jumeauTextUploading) { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
            onMouseLeave={e => { e.currentTarget.style.background = jumeauTextUploading ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))"; e.currentTarget.style.transform = "translateY(0)"; }}>
            {jumeauTextUploading ? <><svg style={{ animation: "spin 1s linear infinite" }} width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>Indexation en cours...</> : "Indexer cette note →"}
          </button>
        )}
        {jumeauTextUploading && <p style={{ fontSize: 12, color: "#f59e0b", textAlign: "center", marginTop: 6 }}>Patientez, l'indexation peut prendre quelques instants.</p>}
      </div>

    </div>
  </div>
)}

      {showProfileModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowProfileModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 460, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>✏️ Profil — {selectedPatient?.firstName}</h2>
              <button onClick={() => setShowProfileModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8" }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[{ label: "Âge", value: editAge, onChange: setEditAge, placeholder: "Ex: 34", type: "number" }, { label: "Objectif principal", value: editObjective, onChange: setEditObjective, placeholder: "Ex: Perte de poids", type: "text" }, { label: "Pathologies", value: editPathologies, onChange: setEditPathologies, placeholder: "Ex: Diabète type 2", type: "text" }, { label: "Allergies", value: editAllergies, onChange: setEditAllergies, placeholder: "Ex: Gluten, lactose", type: "text" }].map(({ label, value, onChange, placeholder, type }) => (
                <div key={label}>
                  <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                  <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                    style={{ width: "100%", height: 44, borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                    onFocus={(e) => e.target.style.borderColor = emerald} onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                </div>
              ))}
              <div>
                <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Notes internes</p>
                <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes visibles uniquement par vous..." rows={3}
                  style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "12px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif" }}
                  onFocus={(e) => e.target.style.borderColor = emerald} onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              </div>
            </div>
            <button onClick={() => void saveProfile()} disabled={savingProfile}
              style={{ width: "100%", height: 48, borderRadius: 12, background: profileSaved ? "rgba(16,185,129,0.2)" : emerald, border: profileSaved ? `1px solid ${emerald}` : "none", color: profileSaved ? emerald : "black", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 20 }}>
              {profileSaved ? "✅ Sauvegardé !" : savingProfile ? "Sauvegarde..." : "Sauvegarder"}
            </button>
          </div>
        </div>
      )}

      {showReportModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowReportModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 20, padding: 28, width: "100%", maxWidth: 580, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "white" }}>📊 Rapport — {selectedPatient?.firstName}</h2>
              <button onClick={() => setShowReportModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94a3b8" }}>×</button>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                {[{ value: "week", label: "Cette semaine" }, { value: "month", label: "Ce mois" }, { value: "custom", label: "Calendrier" }].map((option) => (
                  <button key={option.value} onClick={() => { setReportPeriod(option.value as ReportPeriod); setReportDateFrom(""); setReportDateTo(""); }}
                    style={{ flex: 1, height: 38, borderRadius: 8, border: `1.5px solid ${reportPeriod === option.value ? emerald : "rgba(255,255,255,0.1)"}`, background: reportPeriod === option.value ? "rgba(16,185,129,0.15)" : "transparent", color: reportPeriod === option.value ? emerald : "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {option.label}
                  </button>
                ))}
              </div>
              {reportPeriod === "custom" && (
                <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <button onClick={() => setReportMonth(new Date(reportMonth.getFullYear(), reportMonth.getMonth() - 1))} style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "white", fontSize: 16 }}>←</button>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "white", textTransform: "capitalize" }}>{reportMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
                    <button onClick={() => setReportMonth(new Date(reportMonth.getFullYear(), reportMonth.getMonth() + 1))} style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", color: "white", fontSize: 16 }}>→</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                    {["L","M","M","J","V","S","D"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#64748b", padding: "4px 0" }}>{d}</div>)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                    {getCalendarDays().map((day, i) => {
                      if (!day) return <div key={i} />;
                      const isFuture = day.date > today;
                      const isFrom = day.date === reportDateFrom;
                      const isTo = day.date === reportDateTo;
                      const isInRange = reportDateFrom && reportDateTo && day.date > reportDateFrom && day.date < reportDateTo;
                      return (
                        <button key={i} onClick={() => { if (isFuture) return; if (!reportDateFrom || (reportDateFrom && reportDateTo)) { setReportDateFrom(day.date); setReportDateTo(""); } else if (day.date >= reportDateFrom) setReportDateTo(day.date); else { setReportDateFrom(day.date); setReportDateTo(""); } }}
                          style={{ aspectRatio: "1", borderRadius: 8, border: "none", cursor: isFuture ? "not-allowed" : "pointer", background: isFrom || isTo ? emerald : isInRange ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)", color: isFrom || isTo ? "black" : isFuture ? "#374151" : "white", fontSize: 12, fontWeight: isFrom || isTo ? 700 : 400, opacity: isFuture ? 0.3 : 1 }}>
                          {day.day}
                        </button>
                      );
                    })}
                  </div>
                  {reportDateFrom && <p style={{ margin: "12px 0 0", fontSize: 12, color: emerald, textAlign: "center" }}>{reportDateTo ? `Du ${new Date(reportDateFrom + "T12:00:00").toLocaleDateString("fr-FR")} au ${new Date(reportDateTo + "T12:00:00").toLocaleDateString("fr-FR")}` : `Début : ${new Date(reportDateFrom + "T12:00:00").toLocaleDateString("fr-FR")} — Sélectionnez la fin`}</p>}
                </div>
              )}
            </div>
            {reportError && (
              <div style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 12, fontSize: 13, color: "#f87171", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{reportError}</span>
                <button onClick={() => void generateReport()}
                  style={{ background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 8, padding: "6px 14px", color: "#f87171", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Réessayer →
                </button>
              </div>
            )}
            {!reportContent && (
              <button onClick={() => void generateReport()} disabled={reportLoading || (reportPeriod === "custom" && (!reportDateFrom || !reportDateTo))}
                style={{ width: "100%", height: 48, borderRadius: 12, background: reportLoading ? "#1a1a1a" : emerald, border: "none", color: reportLoading ? "#4a4a4a" : "black", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>
                {reportLoading ? "Génération en cours... 🤖" : "Générer le rapport IA"}
              </button>
            )}
            {reportContent && (
              <>
                <div style={{ background: "#0a0a0a", borderRadius: 16, padding: "20px", border: "1px solid rgba(255,255,255,0.06)", fontSize: 14, color: "#e2e8f0", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 16 }}>{reportContent}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setReportContent("")} style={{ flex: 1, height: 44, borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>Nouvelle période</button>
                  <button onClick={() => void navigator.clipboard.writeText(reportContent)} style={{ flex: 1, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "none", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>📋 Copier</button>
                  <button onClick={() => void exportPDF()} style={{ flex: 1, height: 44, borderRadius: 12, background: emerald, border: "none", color: "black", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>📄 PDF</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showInviteModal && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setShowInviteModal(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0d0d0d", borderRadius: 24, padding: 32, width: "100%", maxWidth: 560, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", maxHeight: "92vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => { setShowInviteModal(false); resetInviteForm(); setInviteSuccess(false); }} style={{ position: "absolute", top: 18, right: 18, background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", fontSize: 20, color: "#94a3b8", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "white" }}>Inviter un patient</h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>Votre patient recevra un email pour accéder à son espace personnalisé.</p>
            {inviteSuccess ? (
              <div style={{ background: "rgba(16,185,129,0.15)", border: `1px solid ${emerald}`, borderRadius: 14, padding: "20px", textAlign: "center", color: emerald, fontWeight: 600, fontSize: 16 }}>✅ Invitation envoyée !</div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "white" }}>Email *</p>
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@patient.fr"
                    style={{ width: "100%", height: 48, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 16px", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                    onFocus={(e) => e.target.style.borderColor = emerald} onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, marginBottom: 16 }}>
                  <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "white" }}>Profil du patient</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                    {[{ label: "Âge", value: inviteAge, onChange: setInviteAge, placeholder: "34", type: "number" }, { label: "Taille (cm)", value: inviteTaille, onChange: setInviteTaille, placeholder: "168", type: "number" }, { label: "Poids (kg)", value: invitePoids, onChange: setInvitePoids, placeholder: "72", type: "number" }].map(({ label, value, onChange, placeholder, type }) => (
                      <div key={label}>
                        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                          style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                          onFocus={(e) => e.target.style.borderColor = emerald} onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Sexe</p>
                      <select value={inviteSexe} onChange={(e) => setInviteSexe(e.target.value)} style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: inviteSexe ? "white" : "#64748b", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                        <option value="">—</option><option value="Femme">Femme</option><option value="Homme">Homme</option><option value="Autre">Autre</option>
                      </select>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Activité</p>
                      <select value={inviteNiveauActivite} onChange={(e) => setInviteNiveauActivite(e.target.value)} style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: inviteNiveauActivite ? "white" : "#64748b", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                        <option value="">—</option><option value="Sédentaire">Sédentaire</option><option value="Légère">Légère</option><option value="Modérée">Modérée</option><option value="Intense">Intense</option><option value="Athlète">Athlète</option>
                      </select>
                    </div>
                    <div>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Régime</p>
                      <select value={inviteRegime} onChange={(e) => setInviteRegime(e.target.value)} style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: inviteRegime ? "white" : "#64748b", padding: "0 10px", fontSize: 13, outline: "none", boxSizing: "border-box" }}>
                        <option value="">—</option><option value="Omnivore">Omnivore</option><option value="Végétarien">Végétarien</option><option value="Vegan">Vegan</option><option value="Sans gluten">Sans gluten</option><option value="Halal">Halal</option><option value="Méditerranéen">Méditerranéen</option>
                      </select>
                    </div>
                  </div>
                  {[{ label: "Pathologies", value: invitePathologies, onChange: setInvitePathologies, placeholder: "Ex: Diabète type 2" }, { label: "Allergies", value: inviteAllergies, onChange: setInviteAllergies, placeholder: "Ex: Gluten, lactose" }, { label: "Traitements", value: inviteTraitements, onChange: setInviteTraitements, placeholder: "Ex: Metformine 500mg" }, { label: "Objectif", value: inviteObjectifClinique, onChange: setInviteObjectifClinique, placeholder: "Ex: Perte de poids" }].map(({ label, value, onChange, placeholder }) => (
                    <div key={label} style={{ marginBottom: 10 }}>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{label}</p>
                      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                        style={{ width: "100%", height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        onFocus={(e) => e.target.style.borderColor = emerald} onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                    </div>
                  ))}
                </div>
                <div style={{ background: "rgba(16,185,129,0.06)", borderRadius: 16, border: "1.5px solid rgba(16,185,129,0.25)", padding: "18px", marginBottom: 16 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 800, color: emerald }}>🎯 Brief pour le jumeau</p>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#94a3b8" }}>Consigne de départ pour personnaliser les réponses.</p>
                  <textarea value={inviteBriefJumeau} onChange={(e) => setInviteBriefJumeau(e.target.value)} placeholder="Ex: Sois très encourageant sur le sport, mais ferme sur l'hydratation." rows={3}
                    style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(16,185,129,0.3)", background: "#161616", color: "white", padding: "12px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif" }}
                    onFocus={(e) => e.target.style.borderColor = emerald} onBlur={(e) => e.target.style.borderColor = "rgba(16,185,129,0.3)"} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Notes internes</p>
                  <textarea value={inviteNotes} onChange={(e) => setInviteNotes(e.target.value)} placeholder="Notes visibles uniquement par vous..." rows={2}
                    style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)", background: "#161616", color: "white", padding: "10px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "Inter, sans-serif" }}
                    onFocus={(e) => e.target.style.borderColor = emerald} onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                </div>
                {inviteError && <p style={{ margin: "0 0 16px", fontSize: 13, color: "#f87171" }}>{inviteError}</p>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setShowInviteModal(false); resetInviteForm(); }} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, fontWeight: 500, transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }} onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>Annuler</button>
                  <button onClick={() => void sendInvite()} disabled={inviting || !inviteEmail.trim()}
                    style={{ flex: 2, height: 48, borderRadius: 12, background: inviting || !inviteEmail.trim() ? "rgba(255,255,255,0.04)" : "rgba(16,185,129,0.12)", border: `1px solid ${inviting || !inviteEmail.trim() ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.3)"}`, color: inviting || !inviteEmail.trim() ? "#64748b" : emerald, cursor: inviting || !inviteEmail.trim() ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s" }}
                    onMouseEnter={e => { if (!inviting && inviteEmail.trim()) e.currentTarget.style.background = "rgba(16,185,129,0.2)"; }}
                    onMouseLeave={e => { if (!inviting && inviteEmail.trim()) e.currentTarget.style.background = "rgba(16,185,129,0.12)"; }}>
                    {inviting ? "Envoi..." : "Envoyer l'invitation →"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes onboardingPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
