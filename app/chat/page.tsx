"use client";

import { KeyboardEvent, useState, useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import JournalModal from "./JournalModal";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  hidden?: boolean;
};

type BreathingStep = "idle" | "inhale" | "hold" | "exhale" | "done";

type Session = {
  id: string;
  title: string;
  last_message_at: string;
};

type ToolData = {
  tool_id: string;
  twin_message: string;
  tool_script: Record<string, string>;
};

type ActiveTool = {
  id: string;
  data: ToolData | null;
} | null;

const ACCENT = "#10b981";
const ACCENT_DIM = "rgba(16,185,129,0.1)";
const ACCENT_BORDER = "rgba(16,185,129,0.2)";
const SURFACE = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "#f1f5f9";
const TEXT_SECONDARY = "#94a3b8";
const TEXT_MUTED = "#64748b";
const BG_MAIN = "#080e0b";
// Direction artistique Cyan / Émeraude — espace interactif
const CYAN = "#06b6d4";
const CYAN_DIM = "rgba(6,182,212,0.08)";
const CYAN_BORDER = "rgba(6,182,212,0.2)";

const quickActions = [
  "J'ai craqué ce soir, que faire ?",
  "Pourquoi j'ai encore faim après avoir mangé ?",
  "Que manger quand je rentre tard ?",
  "Comment résister à une fringale ?",
  "Comment rester motivé ?",
  "Pourquoi je ne vois pas de résultats ?",
];

const TOOL_VARIANTS: Record<string, string[]> = {
  breathing: ["Prenons un moment pour respirer ensemble.", "Votre corps a besoin de calme. On y va.", "La respiration est votre ancre. Suivez mon rythme.", "Trois minutes peuvent tout changer.", "Laissez votre souffle vous ramener ici."],
  ancrage: ["Revenons dans le moment présent, pas à pas.", "Cinq sens, cinq instants de présence.", "On va ralentir le temps ensemble.", "Regardez autour de vous. Vous êtes en sécurité."],
  marche: ["Chaque pas est une intention.", "Votre corps sait comment se ressourcer.", "On va déposer ce poids ensemble."],
  manger: ["Ce repas mérite toute votre attention.", "Manger lentement est un acte de soin.", "Posez tout. Ce moment est pour vous."],
};

async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width, height = img.height;
        if (width > 1024 || height > 1024) {
          if (width > height) { height = Math.round((height * 1024) / width); width = 1024; }
          else { width = Math.round((width * 1024) / height); height = 1024; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        resolve({ base64: canvas.toDataURL("image/jpeg", 0.7).split(",")[1], mimeType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const LeafIcon = ({ size = 16, color = ACCENT }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 22C12 22 4 16 4 9C4 5.13 7.58 2 12 2C16.42 2 20 5.13 20 9C20 16 12 22 12 22Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 22V12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12 12C12 12 8 9 8 6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M12 12C12 12 16 9 16 6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const CameraIcon = ({ size = 18, color = TEXT_SECONDARY }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M23 19C23 20.1 22.1 21 21 21H3C1.9 21 1 20.1 1 19V8C1 6.9 1.9 6 3 6H7L9 3H15L17 6H21C22.1 6 23 6.9 23 8V19Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="13" r="4" stroke={color} strokeWidth="1.5"/>
  </svg>
);

const SendIcon = ({ size = 16, color = "black" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M22 2L11 13" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SearchIcon = ({ size = 14, color = TEXT_MUTED }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="11" cy="11" r="8" stroke={color} strokeWidth="1.5"/>
    <path d="M21 21L16.65 16.65" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const MenuIcon = ({ size = 16, color = TEXT_SECONDARY }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M3 12H21M3 6H21M3 18H21" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const ArcSpinner = ({ size = 28 }: { size?: number }) => {
  const r = size / 2 - 3;
  const circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ animation: "spin 1.4s linear infinite", position: "absolute" }}>
        <defs>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.2"/>
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#34d399" stopOpacity="1"/>
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(16,185,129,0.08)" strokeWidth="2"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#arcGrad)" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={`${circ * 0.65} ${circ * 0.35}`}
          style={{ filter: `drop-shadow(0 0 4px ${ACCENT})` }}/>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5 }}>🌿</div>
    </div>
  );
};

type InputBarProps = {
  isCenter?: boolean;
  message: string;
  setMessage: (v: string) => void;
  send: (text?: string) => Promise<void>;
  loading: boolean;
  pendingImage: { base64: string; mimeType: string; previewUrl: string } | null;
  photoHovered: boolean;
  setPhotoHovered: (v: boolean) => void;
  handleImageClick: () => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement> | KeyboardEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
};

const InputBar = ({ isCenter = false, message, setMessage, send, loading, pendingImage, photoHovered, setPhotoHovered, handleImageClick, handleKeyDown, inputRef }: InputBarProps) => (
  <div className="nt-inputbar" style={{ display: "flex", gap: 8, alignItems: isCenter ? "flex-start" : "center", background: SURFACE, borderRadius: isCenter ? 16 : 14, border: `1px solid ${BORDER}`, padding: isCenter ? "18px 16px" : "6px 8px 6px 14px", transition: "border-color 0.25s, box-shadow 0.25s", minHeight: isCenter ? 120 : undefined }}>
    {isCenter ? (
      <div style={{ flex: 1, minWidth: 0 }}>
        <textarea
          ref={inputRef}
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={handleKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>}
          placeholder="Posez-moi vos questions, je suis là pour vous accompagner entre vos séances..."
          rows={3}
          spellCheck={false}
          style={{ width: "100%", border: "none", background: "transparent", color: TEXT_PRIMARY, fontSize: 16, outline: "none", caretColor: CYAN, lineHeight: 1.6, resize: "none", fontFamily: "inherit", display: "block" }}
        />
      </div>
    ) : (
      <input
        value={message}
        onChange={e => setMessage(e.target.value)}
        onKeyDown={handleKeyDown as React.KeyboardEventHandler<HTMLInputElement>}
        placeholder={pendingImage ? "Ajoutez un commentaire..." : "Posez votre question..."}
        style={{ flex: 1, height: 36, border: "none", background: "transparent", color: TEXT_PRIMARY, fontSize: 15, outline: "none", caretColor: CYAN }}
      />
    )}
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, alignSelf: isCenter ? "flex-end" : "center" }}>
      <div style={{ position: "relative", flexShrink: 0 }}
        onMouseEnter={() => setPhotoHovered(true)}
        onMouseLeave={() => setPhotoHovered(false)}>
        <span style={{ position: "absolute", right: "100%", top: "50%", fontSize: 12, color: ACCENT, fontWeight: 500, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 6, padding: "3px 10px", background: ACCENT_DIM, whiteSpace: "nowrap", marginRight: 8, opacity: photoHovered ? 1 : 0, transform: photoHovered ? "translateY(-50%) translateX(0px)" : "translateY(-50%) translateX(20px)", transition: "opacity 0.5s ease, transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)", pointerEvents: "none" }}>Analyser votre repas</span>
        <button onClick={handleImageClick} style={{ width: 34, height: 34, borderRadius: 8, background: photoHovered ? ACCENT_DIM : "transparent", border: `1px solid ${photoHovered ? ACCENT_BORDER : "transparent"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0 }}>
          <CameraIcon size={16} color={photoHovered ? ACCENT : TEXT_MUTED} />
        </button>
      </div>
      <button onClick={() => void send()} disabled={loading || (!message.trim() && !pendingImage)}
        style={{ width: 36, height: 36, borderRadius: 10, background: !loading && (message.trim() || pendingImage) ? "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)" : SURFACE, border: "none", cursor: !loading && (message.trim() || pendingImage) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.25s", boxShadow: !loading && (message.trim() || pendingImage) ? "0 0 14px rgba(6,182,212,0.3), 0 0 6px rgba(16,185,129,0.2)" : "none" }}>
        <SendIcon size={14} color={!loading && (message.trim() || pendingImage) ? "white" : TEXT_MUTED} />
      </button>
    </div>
  </div>
);

// ═══ ONBOARDING TOUR ═══
const onboardingSteps = [
  {
    id: "welcome",
    highlight: null,
    icon: "🌿",
    title: "Bienvenue",
    text: "Je suis votre compagnon de suivi, créé à partir de l'expertise de votre praticien. Laissez-moi vous montrer vos outils en quelques secondes.",
    position: "center" as const,
  },
  {
    id: "sos",
    highlight: "sos",
    icon: "💙",
    title: "Mon Soutien",
    text: "Ce bouton est votre ancre immédiate en cas de tempête. Fringale, stress, coup de mou — une aide guidée vous attend en un clic. Je ne vous laisserai jamais seul(e).",
    position: "sidebar" as const,
    glowColor: "rgba(6,182,212,0.4)",
  },
  {
    id: "camera",
    highlight: "camera",
    icon: "📸",
    title: "Analyse de repas",
    text: "Prenez votre assiette en photo. Je l'analyserai instantanément pour vérifier si elle respecte nos objectifs de la semaine.",
    position: "bottom" as const,
    glowColor: "rgba(16,185,129,0.4)",
  },
  {
    id: "chat",
    highlight: null,
    icon: "💬",
    title: "La conversation",
    text: "Ici, nous discutons de tout, comme si vous étiez au cabinet. Posez vos questions, partagez vos doutes. Je reste là, disponible pour vous.",
    position: "center" as const,
  },
];

type OnboardingProps = {
  step: number;
  firstName: string;
  onNext: () => void;
  onSkip: () => void;
  isMobile: boolean;
};

const OnboardingTour = ({ step, firstName, onNext, onSkip, isMobile }: OnboardingProps) => {
  const current = onboardingSteps[step];
  const isLast = step === onboardingSteps.length - 1;
  const isFirst = step === 0;

  const getBubblePosition = () => {
    if (current.position === "center") return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    if (current.position === "sidebar") return isMobile
      ? { bottom: 100, left: "50%", transform: "translateX(-50%)" }
      : { top: 200, left: 325, transform: "none" };
    if (current.position === "bottom") return isMobile
      ? { bottom: 100, left: "50%", transform: "translateX(-50%)" }
      : { bottom: 110, right: 80, transform: "none" };
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none" }}>
      {/* Overlay léger */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", pointerEvents: "auto" }} onClick={onSkip} />

      {/* Lueur sur le bouton concerné */}
      {current.highlight === "sos" && !isMobile && (
        <div style={{ position: "absolute", top: 172, left: 12, width: 281, height: 80, borderRadius: 18, boxShadow: `0 0 0 2px ${current.glowColor}, 0 0 28px ${current.glowColor}`, pointerEvents: "none", animation: "breathe 2s ease-in-out infinite" }} />
      )}

      {/* Bulle principale */}
      <div style={{ position: "absolute", ...getBubblePosition(), width: isMobile ? "calc(100% - 40px)" : 340, maxWidth: 340, background: "#0a0f0c", borderRadius: 20, padding: 24, border: `1px solid ${ACCENT_BORDER}`, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", pointerEvents: "auto", animation: "fadeUp 0.35s cubic-bezier(0.16,1,0.3,1)" }}>

        {/* Icône + titre */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
            {current.icon}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>{current.title}</p>
            {isFirst && firstName && (
              <p style={{ margin: 0, fontSize: 11, color: ACCENT }}>Bonjour {firstName} 👋</p>
            )}
          </div>
        </div>

        {/* Texte */}
        <p style={{ margin: "0 0 20px", fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.7 }}>
          {current.text}
        </p>

        {/* Progression */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {onboardingSteps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 2, borderRadius: 1, background: i <= step ? ACCENT : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
          ))}
        </div>

        {/* Boutons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSkip}
            style={{ flex: 1, height: 38, borderRadius: 10, background: "transparent", border: `1px solid ${BORDER}`, color: TEXT_MUTED, fontSize: 13, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = TEXT_SECONDARY; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_MUTED; }}>
            Passer
          </button>
          <button onClick={onNext}
            style={{ flex: 2, height: 38, borderRadius: 10, background: "rgba(16,185,129,0.12)", border: `1px solid ${ACCENT_BORDER}`, color: ACCENT, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = ACCENT_BORDER; }}>
            {isLast ? "C'est parti 🌿" : "Suivant →"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══ CARTOGRAPHIE DES DUOS D'OUTILS SOS ═══
const TOOL_DUOS: Record<string, { id: string; emoji: string; label: string; desc: string }[]> = {
  fringale: [
    { id: "body_scan", emoji: "🧘‍♂️", label: "Scanner mon corps", desc: "Distinguer faim réelle et faim émotionnelle" },
    { id: "manger", emoji: "🍏", label: "Manger en pleine conscience", desc: "Ralentir et savourer, étape par étape" },
  ],
  stress: [
    { id: "breathing", emoji: "🌬️", label: "Calmer mon souffle", desc: "Cohérence cardiaque · 3 min · Prouvé" },
    { id: "ancrage", emoji: "👀", label: "Ancrer mes 5 sens", desc: "Technique 5-4-3-2-1 · Retour au présent" },
  ],
  "culpabilité": [
    { id: "ecriture", emoji: "📝", label: "Écrire pour me libérer", desc: "Vider ce qui pèse · Personne ne lira" },
    { id: "defusion", emoji: "🧠", label: "Prendre de la distance", desc: "Défusion cognitive · Observer sans juger" },
  ],
  "coup de mou": [
    { id: "marche", emoji: "🚶‍♂️", label: "Faire quelques pas", desc: "Marche consciente · Se vider la tête" },
    { id: "adaptive_coaching", emoji: "💬", label: "Retrouver mon jumeau", desc: "Coaching TCC personnalisé pour toi" },
  ],
};

function generateCelebration(firstName: string, toolId: string, before: number, after: number): string {
  const delta = before - after; // positif = stress réduit
  const toolNames: Record<string, string> = {
    breathing: "la cohérence cardiaque", ancrage: "l'ancrage sensoriel",
    manger: "la pleine conscience", marche: "la marche consciente",
    body_scan: "le body scan", defusion: "la défusion cognitive",
    ecriture: "l'écriture cathartique", adaptive_coaching: "ce moment de coaching",
  };
  const tool = toolNames[toolId] ?? "cet exercice";
  const name = firstName || "toi";
  if (delta >= 4) return `Regarde ça, ${name} ! Tu as fait baisser l'intensité de ${delta} points en quelques minutes grâce à ${tool}. Sois fier(e) de toi. 🌿`;
  if (delta >= 2) return `Bien joué, ${name}. Tu as gagné ${delta} points de calme avec ${tool}. Chaque petit pas vers le mieux compte énormément. 🌿`;
  if (delta >= 1) return `Tu as tenu bon, ${name}. Même un point de mieux, c'est une vraie victoire. Tu as choisi de prendre soin de toi. 🌿`;
  if (delta === 0) return `C'est ok, ${name}. ${tool.charAt(0).toUpperCase() + tool.slice(1)} plante parfois une graine qui germe plus tard. L'essentiel, c'est que tu aies essayé. 🌿`;
  return `Tu as essayé, ${name}, et c'est ce qui compte. Ton praticien voit ces données et adaptera ton accompagnement à la prochaine séance. 🌿`;
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientFirstName, setPatientFirstName] = useState("");
  const [patientInitials, setPatientInitials] = useState("?");
  const [practitionerIdFromDb, setPractitionerIdFromDb] = useState<string | null>(null);
  const [practitionerPlan, setPractitionerPlan] = useState("essentiel");
  const [isMobile, setIsMobile] = useState(false);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [pendingImage, setPendingImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [hoveredSession, setHoveredSession] = useState<string | null>(null);
  const [photoHovered, setPhotoHovered] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [breathingStep, setBreathingStep] = useState<BreathingStep>("idle");
  const [breathingCycle, setBreathingCycle] = useState(0);
  const [breathingTimer, setBreathingTimer] = useState(0);
  const breathingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [ancrageStep, setAncrageStep] = useState(0);
  const [marcheStep, setMarcheStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasMessages = messages.filter(m => !m.hidden).length > 0;
  const sidebarWidth = 305;
  const [showStressModal, setShowStressModal] = useState(false);
  const [showStressBeforeModal, setShowStressBeforeModal] = useState(false);
  const [stressBefore, setStressBefore] = useState<number | null>(null);
  const [stressAfter, setStressAfter] = useState<number | null>(null);
  const [completedToolId, setCompletedToolId] = useState<string | null>(null);
  const [showPreemptiveSOS, setShowPreemptiveSOS] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [pendingToolData, setPendingToolData] = useState<{ id: string; data: ToolData } | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [patientEmail, setPatientEmail] = useState("");
  const [patientPhoto, setPatientPhoto] = useState<string | null>(null);
  const [patientVictories, setPatientVictories] = useState<string[]>([]);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showLogoutPatientModal, setShowLogoutPatientModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [savingPatientProfile, setSavingPatientProfile] = useState(false);
  const [patientProfileSaved, setPatientProfileSaved] = useState(false);
  const [exportingRGPD, setExportingRGPD] = useState(false);
  const patientAvatarRef = useRef<HTMLInputElement>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackScore, setFeedbackScore] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [emotionalStatus, setEmotionalStatus] = useState<"green" | "red_behavioral" | "red_critical">("green");
  const [showSasButtons, setShowSasButtons] = useState(false);
  const [showSOSTriageModal, setShowSOSTriageModal] = useState(false);
  const [selectedTriageCtx, setSelectedTriageCtx] = useState("");
  const [showToolDuo, setShowToolDuo] = useState(false);
  const [chatSearch, setChatSearch] = useState("");
  const [chatSearchIdx, setChatSearchIdx] = useState(0);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);


  const ancrageSteps = [
    { count: 5, sense: "voyez", icon: "👀" },
    { count: 4, sense: "touchez", icon: "🤲" },
    { count: 3, sense: "entendez", icon: "👂" },
    { count: 2, sense: "sentez", icon: "👃" },
    { count: 1, sense: "goûtez", icon: "👅" },
  ];

  const marcheSteps = [
    "Levez-vous doucement. Sentez vos pieds sur le sol.",
    "Commencez à marcher lentement. Chaque pas est intentionnel.",
    "Observez votre environnement. Couleurs, formes, lumières.",
    "Sentez l'air sur votre peau. La température autour de vous.",
    "Synchronisez respiration et pas. Vous êtes présent.",
    "Vous êtes ancré dans le moment présent. 🌿",
  ];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const check = () => { const m = window.innerWidth < 768; setIsMobile(m); if (m) setSidebarOpen(false); };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    setFilteredSessions(q ? sessions.filter(s => s.title.toLowerCase().includes(q)) : sessions);
  }, [searchQuery, sessions]);

  const loadSessions = useCallback(async (pid: string) => {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from("conversations_sessions").select("id, title, last_message_at").eq("patient_id", pid).order("last_message_at", { ascending: false }).limit(20);
    if (data) { setSessions(data as Session[]); setFilteredSessions(data as Session[]); }
  }, []);

  const completeOnboarding = useCallback(async (pid: string) => {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await supabase.from("patients").update({ onboarding_done: true }).eq("user_id", pid);
    setShowOnboarding(false);
    // Message de clôture dans le chat
    setMessages([{
      role: "assistant",
      content: "Voilà, vous avez vos outils en main. Je reste ici, dans le chat, pour répondre à vos questions. 🌿",
    }]);
  }, []);

  const handleOnboardingNext = useCallback(() => {
    if (onboardingStep < onboardingSteps.length - 1) {
      setOnboardingStep(s => s + 1);
    } else {
      if (patientId) void completeOnboarding(patientId);
    }
  }, [onboardingStep, patientId, completeOnboarding]);

  const handleOnboardingSkip = useCallback(() => {
    if (patientId) void completeOnboarding(patientId);
  }, [patientId, completeOnboarding]);

  useEffect(() => {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    // Écouter l'expiration de session en cours d'utilisation
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        if (event === "SIGNED_OUT") {
          window.location.href = "/patient-login?reason=session_expired";
        }
      }
    });

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.href = "/patient-login?reason=session_expired";
        return;
      }
      setPatientId(data.user.id);
      const { data: rel } = await supabase.from("patient_practitioner").select("practitioner_id").eq("patient_id", data.user.id).single();
      if (rel) {
        const practId = rel.practitioner_id as string;
        setPractitionerIdFromDb(practId);
        const { data: pract } = await supabase.from("practitioners").select("first_name, last_name, plan").eq("user_id", practId).single();
        if (pract) { const p = pract as { first_name: string; last_name: string; plan: string }; setPractitionerPlan(p.plan || "essentiel"); }
        const { data: hist } = await supabase.from("conversations").select("role, content").eq("patient_id", data.user.id).eq("practitioner_id", practId).is("session_id", null).order("created_at", { ascending: true });
        if (hist?.length) setMessages(hist as ChatMessage[]);
      }
      const { data: pat } = await supabase.from("patients").select("first_name, last_name, onboarding_done, emotional_status").eq("user_id", data.user.id).single();
      if (pat) {
        const p = pat as { first_name?: string; last_name?: string; onboarding_done?: boolean };
        if (p.first_name) setPatientFirstName(p.first_name);
        const es = (p as { emotional_status?: string }).emotional_status;
        if (es === "red_critical" || es === "red_behavioral") setEmotionalStatus(es);
        setPatientInitials(`${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase() || "?");
        if (p.first_name) setEditFirstName(p.first_name);
        if (p.last_name) setEditLastName(p.last_name ?? "");
        // Charger email
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) setPatientEmail(user.email);
        // Charger photo
        const { data: photoData } = supabase.storage.from("Avatars").getPublicUrl(`${data.user.id}/avatar.jpg`);
        if (photoData) setPatientPhoto(photoData.publicUrl + "?t=" + Date.now());
        // Charger victoires
        const victories = (p as { victories_history?: string[] }).victories_history ?? [];
        setPatientVictories(victories);
        if (!p.onboarding_done) {
          setTimeout(() => setShowOnboarding(true), 600);
        }
      }
      await loadSessions(data.user.id);
    });

    return () => { subscription.unsubscribe(); };
  }, [loadSessions]);

  useEffect(() => () => { if (breathingIntervalRef.current) clearInterval(breathingIntervalRef.current); }, []);

  const getVariant = (toolId: string) => {
    const variants = TOOL_VARIANTS[toolId] ?? ["Prenons un moment ensemble."];
    return variants[Math.floor(Math.random() * variants.length)];
  };

  const closeTool = useCallback((toolId?: string) => {
    setActiveTool(null);
    setBreathingStep("idle"); setBreathingCycle(0); setBreathingTimer(0);
    if (breathingIntervalRef.current) clearInterval(breathingIntervalRef.current);
    setAncrageStep(0); setMarcheStep(0);
    if (toolId && toolId !== "journal") {
      const names: Record<string, string> = { breathing: "cohérence cardiaque", ancrage: "ancrage sensoriel 5-4-3-2-1", marche: "marche consciente", manger: "pleine conscience alimentaire" };
      if (names[toolId]) {
        setCompletedToolId(toolId);
        setShowStressModal(true);
        void sendHidden(`[INFO : Le patient vient de terminer une séance de ${names[toolId]}. Adapte subtilement ton prochain message.]`);
      }
    }
  }, []);

  const sendHidden = async (msg: string) => {
    if (!patientId || !practitionerIdFromDb) return;
    try { await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, patientId, practitionerId: practitionerIdFromDb, sessionId: currentSessionId ?? undefined }) }); }
    catch { /* silencieux */ }
  };

  const sendStressData = async (before: number, after: number, toolId: string) => {
    if (!patientId || !practitionerIdFromDb) return;
    try {
      await fetch("/api/sos-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, practitionerId: practitionerIdFromDb, toolId, stressBefore: before, stressAfter: after }),
      });
    } catch { /* silencieux */ }
  };

  const handleSOS = async (sosContext?: string, directLaunch = false) => {
    if (!patientId || !practitionerIdFromDb || sosLoading) return;
    setSosLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "", patientId, practitionerId: practitionerIdFromDb, isSOS: true, sosContext }),
      });
      const data = await res.json() as { tool?: ToolData };
      const tool = data.tool ?? { tool_id: "breathing", twin_message: getVariant("breathing"), tool_script: {} };
      if (directLaunch) {
        setActiveTool({ id: tool.tool_id, data: tool });
      } else {
        setPendingToolData({ id: tool.tool_id, data: tool });
        setShowStressBeforeModal(true);
      }
    } catch {
      const fallback = { tool_id: "breathing", twin_message: getVariant("breathing"), tool_script: {} };
      if (directLaunch) {
        setActiveTool({ id: "breathing", data: fallback });
      } else {
        setPendingToolData({ id: "breathing", data: fallback });
        setShowStressBeforeModal(true);
      }
    }
    setSosLoading(false);
  };

  const createSession = async (firstMessage: string) => {
    if (!patientId || !practitionerIdFromDb) return null;
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from("conversations_sessions").insert({ patient_id: patientId, practitioner_id: practitionerIdFromDb, title: firstMessage.slice(0, 40) + (firstMessage.length > 40 ? "..." : ""), last_message: firstMessage, last_message_at: new Date().toISOString() }).select().single();
    return (data as { id: string } | null)?.id ?? null;
  };

  const loadSession = async (sessionId: string) => {
    if (!patientId || !practitionerIdFromDb) return;
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from("conversations").select("role, content").eq("patient_id", patientId).eq("practitioner_id", practitionerIdFromDb).eq("session_id", sessionId).order("created_at", { ascending: true });
    if (data) { setMessages(data as ChatMessage[]); setCurrentSessionId(sessionId); if (isMobile) setSidebarOpen(false); }
  };

  const deleteSession = async (sessionId: string) => {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await supabase.from("conversations_sessions").delete().eq("id", sessionId);
    if (currentSessionId === sessionId) { setMessages([]); setCurrentSessionId(null); }
    if (patientId) await loadSessions(patientId);
  };

  const handleImageClick = () => {
    if (!["pro", "cabinet", "fondateur"].includes(practitionerPlan)) { setShowUpsellModal(true); return; }
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImageCompressing(true); setCompressionProgress(0);
    try {
      const pi = setInterval(() => setCompressionProgress(p => Math.min(p + 30, 90)), 100);
      const compressed = await compressImage(file);
      clearInterval(pi); setCompressionProgress(100);
      setTimeout(() => { setImageCompressing(false); setCompressionProgress(0); setPendingImage({ ...compressed, previewUrl: `data:image/jpeg;base64,${compressed.base64}` }); }, 300);
    } catch { setImageCompressing(false); setCompressionProgress(0); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startBreathing = () => {
    let cycle = 1, phase: BreathingStep = "inhale", timer = 5;
    setBreathingStep("inhale"); setBreathingCycle(1); setBreathingTimer(5);
    const dur: Record<string, number> = { inhale: 5, hold: 4, exhale: 5 };
    const interval = setInterval(() => {
      timer--; setBreathingTimer(timer);
      if (timer <= 0) {
        if (phase === "inhale") { phase = "hold"; timer = dur.hold; setBreathingStep("hold"); setBreathingTimer(timer); }
        else if (phase === "hold") { phase = "exhale"; timer = dur.exhale; setBreathingStep("exhale"); setBreathingTimer(timer); }
        else { cycle++; if (cycle <= 5) { phase = "inhale"; timer = dur.inhale; setBreathingStep("inhale"); setBreathingCycle(cycle); setBreathingTimer(timer); } else { setBreathingStep("done"); clearInterval(interval); } }
      }
    }, 1000);
    breathingIntervalRef.current = interval;
  };

  const stopGeneration = () => { abortControllerRef.current?.abort(); setLoading(false); };

  const send = async (text?: string) => {
    const trimmed = (text ?? message).trim();
    if ((!trimmed && !pendingImage) || loading) return;
    const img = pendingImage;
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed || "📷 Photo de repas", imageUrl: img?.previewUrl }];
    const assistantIndex = newMessages.length;
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setMessage(""); setPendingImage(null); setLoading(true);
    abortControllerRef.current = new AbortController();
    try {
      const body: Record<string, string | undefined> = { message: trimmed || "Analyse cette photo", patientId: patientId ?? undefined, practitionerId: practitionerIdFromDb ?? undefined };
      if (img) { body.imageBase64 = img.base64; body.imageMimeType = img.mimeType; }
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: abortControllerRef.current.signal });
      if (!res.ok || !res.body) throw new Error("Erreur");
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let fullText = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        fullText += decoder.decode(value, { stream: true });
        const clean = fullText.replace(/\|\|\|[\s\S]*?\|\|\|/g, "").trim();
        setMessages(prev => { const u = [...prev]; u[assistantIndex] = { role: "assistant", content: clean }; return u; });
      }
      // Détecter le signal sas de décompression
      if (fullText.includes("|||SAS|||")) {
        setShowSasButtons(true);
      }
      const statusMatch = fullText.match(/\|\|\|([\s\S]*?)\|\|\|/);
      if (statusMatch) {
        try {
          const parsed = JSON.parse(statusMatch[1]) as { status: string };
          if (parsed.status === "red_critical") {
            setEmotionalStatus("red_critical");
          } else if (parsed.status === "red_behavioral") {
            setEmotionalStatus("red_behavioral");
            if (!activeTool) setShowPreemptiveSOS(true);
          } else if (parsed.status === "red" && !activeTool) {
            setShowPreemptiveSOS(true);
          }
        } catch { /* silencieux */ }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages(prev => { const u = [...prev]; u[assistantIndex] = { role: "assistant", content: "Impossible de contacter le serveur." }; return u; });
      }
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement> | KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const handleSasReprendreFile = async () => {
    if (!patientId) return;
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await supabase.from("patients").update({ emotional_status: "green", red_behavioral_until: null }).eq("user_id", patientId);
    setEmotionalStatus("green");
    setShowSasButtons(false);
  };

  const handleSasResterSafe = async () => {
    if (!patientId) return;
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const newUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    await supabase.from("patients").update({ red_behavioral_until: newUntil }).eq("user_id", patientId);
    setShowSasButtons(false);
  };

  const breathingColor: Record<BreathingStep, string> = { idle: ACCENT, inhale: ACCENT, hold: "#6366f1", exhale: "#06b6d4", done: ACCENT };
  const breathingLabel: Record<BreathingStep, string> = { idle: "", inhale: "Inspirez...", hold: "Retenez...", exhale: "Expirez...", done: "Bravo !" };
  const visibleMessages = messages.filter(m => !m.hidden);

  const submitFeedback = async (score: number) => {
    setFeedbackScore(score);
    setFeedbackSubmitting(true);
    try {
      const res = await fetch("/api/sos-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          practitionerId: practitionerIdFromDb,
          eventId: null,
          stressBeforeProxy: stressBefore ?? 5,
          scoreAfter: score,
        }),
      });
      const data = await res.json() as { sosFailed?: boolean };
      const celebration = generateCelebration(patientFirstName, completedToolId ?? "", stressBefore ?? 5, score);
      if (data.sosFailed) {
        setFeedbackMessage(`${celebration}\n\nJe vois que la tension reste forte. C'est ok, cela arrive. Ton praticien vient d'être notifié pour t'accompagner. 🌿`);
      } else {
        setFeedbackMessage(celebration);
      }
    } catch {
      setFeedbackMessage(generateCelebration(patientFirstName, completedToolId ?? "", stressBefore ?? 5, score));
    }
    setFeedbackSubmitting(false);
  };

  const openFeedback = () => {
    setShowFeedback(true);
    setFeedbackScore(null);
    setFeedbackMessage("");
  };

  const closeFeedbackAndTool = (toolId: string) => {
    setShowFeedback(false);
    closeTool(toolId);
  };

  const renderTool = () => {
    if (!activeTool) return null;
    if (activeTool.id === "journal") return <JournalModal patientId={patientId} practitionerId={practitionerIdFromDb} onClose={() => closeTool("journal")} />;
    const id = activeTool.id;
    const introMessage = activeTool.data?.twin_message || getVariant(id);

    const content = () => {
      if (id === "breathing") return (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY }}>Respirer</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: TEXT_SECONDARY }}>5 cycles · 5s · 4s · 5s</p>
          {breathingStep === "idle" && <><p style={{ fontSize: 14, color: TEXT_SECONDARY, marginBottom: 20, lineHeight: 1.7 }}>La cohérence cardiaque réduit le stress et les envies de grignoter.</p><button onClick={startBreathing} style={{ width: "100%", height: 48, borderRadius: 12, background: ACCENT, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Commencer</button></>}
          {breathingStep !== "idle" && breathingStep !== "done" && (<><p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 16 }}>Cycle {breathingCycle} / 5</p>
            <div style={{ width: 120, height: 120, borderRadius: "50%", margin: "0 auto 20px", background: `radial-gradient(circle, ${breathingColor[breathingStep]}18, transparent)`, border: `1.5px solid ${breathingColor[breathingStep]}44`, display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 1s ease", transform: breathingStep === "inhale" ? "scale(1.15)" : breathingStep === "exhale" ? "scale(0.88)" : "scale(1.05)" }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: breathingColor[breathingStep] }}>{breathingTimer}</span>
            </div>
            <p style={{ fontSize: 20, fontWeight: 600, color: breathingColor[breathingStep], marginBottom: 16 }}>{breathingLabel[breathingStep]}</p>
            <button onClick={() => closeTool(id)} style={{ width: "100%", height: 42, borderRadius: 10, background: "transparent", border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, fontSize: 14, cursor: "pointer" }}>Arrêter</button></>)}
          {breathingStep === "done" && <><p style={{ fontSize: 44, margin: "0 0 12px" }}>🎉</p><h3 style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, margin: "0 0 8px" }}>Excellent !</h3><p style={{ fontSize: 14, color: TEXT_SECONDARY, marginBottom: 20 }}>Votre corps vous remercie. 🌿</p><button onClick={() => openFeedback()} style={{ width: "100%", height: 48, borderRadius: 12, background: ACCENT, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Terminer</button>
          </>}
        </div>
      );
      if (id === "ancrage") return (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY }}>S'apaiser</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: TEXT_SECONDARY }}>Technique 5-4-3-2-1</p>
          {ancrageStep < 5 ? (<><div style={{ fontSize: 44, marginBottom: 14 }}>{ancrageSteps[ancrageStep].icon}</div>
            <div style={{ background: ACCENT_DIM, borderRadius: 14, padding: "18px", marginBottom: 18, border: `1px solid ${ACCENT_BORDER}` }}>
              <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: ACCENT }}>{ancrageSteps[ancrageStep].count}</p>
              <p style={{ margin: "6px 0 0", fontSize: 15, color: TEXT_PRIMARY }}>chose{ancrageSteps[ancrageStep].count > 1 ? "s" : ""} que vous <strong>{ancrageSteps[ancrageStep].sense}</strong></p>
            </div>
            <button onClick={() => setAncrageStep(p => p + 1)} style={{ width: "100%", height: 48, borderRadius: 12, background: ACCENT, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}>{ancrageStep < 4 ? "Suivant →" : "Terminer"}</button>
            <button onClick={() => closeTool(id)} style={{ width: "100%", height: 40, borderRadius: 10, background: "transparent", border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, fontSize: 13, cursor: "pointer" }}>Quitter</button></>
          ) : (<><p style={{ fontSize: 44, margin: "0 0 12px" }}>✨</p><h3 style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, margin: "0 0 8px" }}>Ancré(e) !</h3><p style={{ fontSize: 14, color: TEXT_SECONDARY, marginBottom: 20 }}>Vous êtes dans le moment présent. 🌿</p><button onClick={() => openFeedback()} style={{ width: "100%", height: 48, borderRadius: 12, background: ACCENT, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Terminer</button></>)}
        </div>
      );
      if (id === "marche") return (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY }}>Se vider la tête</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: TEXT_SECONDARY }}>Étape {Math.min(marcheStep + 1, marcheSteps.length)} / {marcheSteps.length}</p>
          {marcheStep < marcheSteps.length ? (<><div style={{ background: ACCENT_DIM, borderRadius: 14, padding: 20, marginBottom: 14, border: `1px solid ${ACCENT_BORDER}`, minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ margin: 0, fontSize: 15, color: TEXT_PRIMARY, lineHeight: 1.7 }}>{marcheSteps[marcheStep]}</p>
          </div>
            <div style={{ height: 2, background: SURFACE, borderRadius: 1, marginBottom: 16 }}><div style={{ height: "100%", borderRadius: 1, background: ACCENT, width: `${((marcheStep + 1) / marcheSteps.length) * 100}%`, transition: "width 0.3s" }} /></div>
            <button onClick={() => setMarcheStep(p => p + 1)} style={{ width: "100%", height: 48, borderRadius: 12, background: ACCENT, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}>{marcheStep < marcheSteps.length - 1 ? "Suivant →" : "Terminer"}</button>
            <button onClick={() => closeTool(id)} style={{ width: "100%", height: 40, borderRadius: 10, background: "transparent", border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, fontSize: 13, cursor: "pointer" }}>Quitter</button></>
          ) : (<><p style={{ fontSize: 44, margin: "0 0 12px" }}>🌿</p><h3 style={{ fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, margin: "0 0 8px" }}>Belle promenade !</h3><p style={{ fontSize: 14, color: TEXT_SECONDARY, marginBottom: 20 }}>Chaque pas conscient est une victoire. 💚</p><button onClick={() => openFeedback()} style={{ width: "100%", height: 48, borderRadius: 12, background: ACCENT, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Terminer</button></>)}
        </div>
      );
      if (id === "manger") return (
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, textAlign: "center" }}>Manger en pleine conscience</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: TEXT_SECONDARY, textAlign: "center" }}>Avant votre repas</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
            {(Object.values(activeTool.data?.tool_script ?? {}).length > 0 ? Object.values(activeTool.data!.tool_script) : ["Posez votre téléphone.", "Regardez votre assiette.", "Respirez 3 fois.", "Mangez lentement.", "Savourez chaque bouchée."]).map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>{i + 1}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{step}</p>
              </div>
            ))}
          </div>
          <button onClick={() => closeTool(id)} style={{ width: "100%", height: 48, borderRadius: 12, background: ACCENT, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Bon appétit 🌿</button>
        </div>
      );

      if (id === "body_scan") return (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY }}>Body Scan</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: TEXT_SECONDARY }}>Distinguer la faim réelle de la faim émotionnelle</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
            {(Object.values(activeTool.data?.tool_script ?? {}).length > 0
              ? Object.values(activeTool.data!.tool_script)
              : [
                  "Pose une main sur ton ventre. Ferme les yeux.",
                  "Scan ton estomac : est-il vide, tendu, ou simplement agité ?",
                  "Remonte vers ta gorge : y a-t-il une boule, une tension ?",
                  "Observe ta tête : est-ce une pensée qui commande, ou ton corps ?",
                  "Si c'est ton corps qui parle, mange. Si c'est ta tête, respire d'abord."
                ]
            ).map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>{i + 1}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{step}</p>
              </div>
            ))}
          </div>
          <button onClick={() => openFeedback()} style={{ width: "100%", height: 48, borderRadius: 12, background: ACCENT, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Terminer 🌿</button>
        </div>
      );
      
      if (id === "defusion") return (
        <div style={{ textAlign: "center" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY }}>Défusion Cognitive</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: TEXT_SECONDARY }}>Prendre de la distance avec tes pensées</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
            {(Object.values(activeTool.data?.tool_script ?? {}).length > 0
              ? Object.values(activeTool.data!.tool_script)
              : [
                  "Identifie la pensée qui te pèse. Écris-la mentalement.",
                  "Dis-toi : 'J'ai la pensée que...' plutôt que 'Je suis...'",
                  "Imagine cette pensée comme un nuage qui passe dans le ciel.",
                  "Répète-la avec une voix de personnage de dessin animé.",
                  "Observe : tu n'es pas cette pensée. Elle passe."
                ]
            ).map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>{i + 1}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{step}</p>
              </div>
            ))}
          </div>
          <button onClick={() => openFeedback()} style={{ width: "100%", height: 48, borderRadius: 12, background: ACCENT, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Terminer 🌿</button>
        </div>
      );
      
      if (id === "ecriture") return (
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, textAlign: "center" }}>Écriture Cathartique</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: TEXT_SECONDARY, textAlign: "center" }}>Vide ce qui te pèse - personne ne lira</p>
          <div style={{ background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 12, padding: "12px 14px", marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 12, color: ACCENT, lineHeight: 1.6 }}>🔒 Ce que tu écris ici ne sera pas sauvegardé. C'est juste pour toi, pour sortir ça de ta tête.</p>
          </div>
          <textarea
            placeholder="Écris tout ce qui te pèse... sans filtre, sans jugement. Tu as 2 minutes."
            rows={8}
            style={{ width: "100%", borderRadius: 12, border: `1px solid ${ACCENT_BORDER}`, background: "rgba(255,255,255,0.03)", color: TEXT_PRIMARY, padding: "14px", fontSize: 14, outline: "none", resize: "none", fontFamily: "Inter, sans-serif", lineHeight: 1.6, boxSizing: "border-box", marginBottom: 16 }}
          />
          <button onClick={() => openFeedback()} style={{ width: "100%", height: 48, borderRadius: 12, background: ACCENT, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>J'ai vidé mon sac 🌿</button>
        </div>
      );
      
      if (id === "adaptive_coaching") return (
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY, textAlign: "center" }}>Coaching sur mesure</h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: TEXT_SECONDARY, textAlign: "center" }}>Exercice personnalisé pour toi</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
            {(Object.values(activeTool.data?.tool_script ?? {}).length > 0
              ? Object.values(activeTool.data!.tool_script)
              : ["Prends une grande inspiration.", "Identifie la pensée qui te pèse.", "Questionne-la doucement.", "Propose-toi une action simple.", "Reprends contact avec le moment présent."]
            ).map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>{i + 1}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{step}</p>
              </div>
            ))}
          </div>
          <button onClick={() => openFeedback()} style={{ width: "100%", height: 48, borderRadius: 12, background: ACCENT, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Terminer 🌿</button>
        </div>
      );      
      return null;
    };

    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: "#0a0f0c", borderRadius: 24, padding: 28, width: "100%", maxWidth: 440, border: `1px solid ${ACCENT_BORDER}`, position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
          <button onClick={() => closeTool(id)} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: 8, background: SURFACE, border: `1px solid ${BORDER}`, cursor: "pointer", color: TEXT_SECONDARY, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          <div style={{ display: "flex", gap: 10, marginBottom: 20, padding: "12px 14px", background: ACCENT_DIM, borderRadius: 12, border: `1px solid ${ACCENT_BORDER}` }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <LeafIcon size={13} />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{introMessage}</p>
          </div>
          {content()}
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: "100vh", background: `radial-gradient(ellipse at 18% 85%, rgba(6,182,212,0.055) 0%, transparent 48%), radial-gradient(ellipse at 82% 15%, rgba(16,185,129,0.04) 0%, transparent 44%), ${BG_MAIN}`, fontFamily: "'Inter', -apple-system, sans-serif", display: "flex", color: TEXT_PRIMARY, overflow: "hidden" }}>

      {/* ═══ ONBOARDING ═══ */}
      {showOnboarding && (
        <OnboardingTour
          step={onboardingStep}
          firstName={patientFirstName}
          onNext={handleOnboardingNext}
          onSkip={handleOnboardingSkip}
          isMobile={isMobile}
        />
      )}

      {/* ═══ MODALE STRESS AVANT ═══ */}
      {showStressBeforeModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0a0f0c", borderRadius: 24, padding: 28, width: "100%", maxWidth: 380, border: `1px solid ${ACCENT_BORDER}`, textAlign: "center" }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>💭</p>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY }}>Comment est ton niveau de stress ?</h3>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: TEXT_SECONDARY }}>De 1 (très calme) à 10 (très tendu)</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} onClick={() => setStressBefore(n)}
                  style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${stressBefore === n ? ACCENT : "rgba(255,255,255,0.1)"}`, background: stressBefore === n ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)", color: stressBefore === n ? ACCENT : TEXT_SECONDARY, fontSize: 14, fontWeight: stressBefore === n ? 700 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                  {n}
                </button>
              ))}
            </div>
            <button onClick={() => {
              if (!stressBefore) return;
              setShowStressBeforeModal(false);
              setShowToolDuo(true);
            }} disabled={!stressBefore}
              style={{ width: "100%", height: 48, borderRadius: 12, background: stressBefore ? ACCENT : "rgba(255,255,255,0.05)", border: "none", color: stressBefore ? "black" : TEXT_MUTED, fontSize: 15, fontWeight: 600, cursor: stressBefore ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
              Choisir mon exercice →
            </button>
            <button onClick={() => {
              setShowStressBeforeModal(false);
              setShowToolDuo(true);
              setStressBefore(null);
            }} style={{ marginTop: 10, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: TEXT_MUTED }}>
              Passer
            </button>
          </div>
        </div>
      )}

      {/* ═══ MODALE DUO D'OUTILS ═══ */}
      {showToolDuo && (() => {
        const duos = TOOL_DUOS[selectedTriageCtx] ?? TOOL_DUOS["stress"];
        const triageEmoji: Record<string, string> = { fringale: "🍕", stress: "📈", "culpabilité": "🧠", "coup de mou": "🔋" };
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "#0a0f0c", borderRadius: 24, padding: "28px 24px", width: "100%", maxWidth: 400, border: "1px solid rgba(16,185,129,0.2)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)", animation: "fadeUp 0.3s ease" }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <p style={{ fontSize: 28, margin: "0 0 8px" }}>{triageEmoji[selectedTriageCtx] ?? "💙"}</p>
                <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: TEXT_PRIMARY }}>Qu'est-ce qui te parle le mieux ?</h3>
                <p style={{ margin: 0, fontSize: 13, color: TEXT_SECONDARY }}>Choisis l'exercice qui te semble le plus accessible</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {duos.map(tool => (
                  <button key={tool.id} disabled={sosLoading}
                    onClick={() => {
                      setShowToolDuo(false);
                      void handleSOS(`${selectedTriageCtx} | outil préféré: ${tool.id}`, true);
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", borderRadius: 16, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)", cursor: sosLoading ? "not-allowed" : "pointer", textAlign: "left", transition: "all 0.2s", opacity: sosLoading ? 0.5 : 1 }}
                    onMouseEnter={e => { if (!sosLoading) { e.currentTarget.style.background = "rgba(16,185,129,0.1)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.35)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.04)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.15)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                    <span style={{ fontSize: 32, flexShrink: 0 }}>{tool.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>{tool.label}</p>
                      <p style={{ margin: 0, fontSize: 12, color: TEXT_MUTED }}>{tool.desc}</p>
                    </div>
                    {sosLoading ? (
                      <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${ACCENT_BORDER}`, borderTop: `2px solid ${ACCENT}`, flexShrink: 0, animation: "spin 1s linear infinite" }} />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" stroke={TEXT_MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </button>
                ))}
              </div>
              <button onClick={() => { setShowToolDuo(false); setSelectedTriageCtx(""); }}
                style={{ width: "100%", height: 38, borderRadius: 10, background: "transparent", border: `1px solid ${BORDER}`, color: TEXT_MUTED, fontSize: 13, cursor: "pointer" }}>
                Annuler
              </button>
            </div>
          </div>
        );
      })()}

      {/* ═══ MODALE STRESS APRÈS OUTIL ═══ */}
      {showStressModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0a0f0c", borderRadius: 24, padding: 28, width: "100%", maxWidth: 380, border: `1px solid ${ACCENT_BORDER}`, textAlign: "center" }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🌿</p>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: TEXT_PRIMARY }}>Et maintenant, comment vous sentez-vous ?</h3>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: TEXT_SECONDARY }}>De 1 (très tendu) à 10 (très calme)</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} onClick={() => setStressAfter(n)}
                  style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${stressAfter === n ? ACCENT : "rgba(255,255,255,0.1)"}`, background: stressAfter === n ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)", color: stressAfter === n ? ACCENT : TEXT_SECONDARY, fontSize: 14, fontWeight: stressAfter === n ? 700 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                  {n}
                </button>
              ))}
            </div>
            <button onClick={async () => {
              if (!stressAfter) return;
              await sendStressData(stressBefore ?? 0, stressAfter, completedToolId ?? "");
              setShowStressModal(false);
              setStressBefore(null);
              setStressAfter(null);
              setCompletedToolId(null);
              setShowToast(true);
              setTimeout(() => setShowToast(false), 4000);
            }} disabled={!stressAfter}
              style={{ width: "100%", height: 48, borderRadius: 12, background: stressAfter ? ACCENT : "rgba(255,255,255,0.05)", border: "none", color: stressAfter ? "black" : TEXT_MUTED, fontSize: 15, fontWeight: 600, cursor: stressAfter ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
              Valider →
            </button>
            <button onClick={() => { setShowStressModal(false); setStressBefore(null); setStressAfter(null); setCompletedToolId(null); }}
              style={{ marginTop: 10, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: TEXT_MUTED }}>
              Passer
            </button>
          </div>
        </div>
      )}

      {/* ═══ SAS DE DÉCOMPRESSION ═══ */}
      {showSasButtons && !activeTool && (
        <div style={{ position: "fixed", bottom: hasMessages ? 110 : 190, left: "50%", transform: "translateX(-50%)", zIndex: 91, width: "calc(100% - 32px)", maxWidth: 520, background: "#0a0f0c", borderRadius: 18, border: "1px solid rgba(6,182,212,0.3)", padding: "16px 18px", boxShadow: "0 8px 36px rgba(6,182,212,0.1), 0 8px 32px rgba(0,0,0,0.5)", animation: "fadeUp 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid rgba(6,182,212,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 17 }}>🌊</div>
            <p style={{ margin: 0, fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.55 }}>
              On se retrouve après notre discussion d'hier. Comment tu souhaites avancer aujourd'hui ?
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => void handleSasReprendreFile()}
              style={{ flex: 1, height: 40, borderRadius: 12, background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(6,182,212,0.12))", border: "1px solid rgba(16,185,129,0.35)", color: "#6ee7b7", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.28), rgba(6,182,212,0.2))"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.55)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(6,182,212,0.12))"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.35)"; }}>
              ✦ Reprendre le fil
            </button>
            <button
              onClick={() => void handleSasResterSafe()}
              style={{ flex: 1, height: 40, borderRadius: 12, background: "rgba(6,182,212,0.07)", border: "1px solid rgba(6,182,212,0.2)", color: "rgba(6,182,212,0.8)", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(6,182,212,0.13)"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(6,182,212,0.07)"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.2)"; }}>
              Rester en mode safe
            </button>
          </div>
        </div>
      )}

      {/* Bannière préemptive */}
      {showPreemptiveSOS && !activeTool && (
        <div style={{ position: "fixed", bottom: hasMessages ? 100 : 180, left: "50%", transform: "translateX(-50%)", zIndex: 90, width: "calc(100% - 40px)", maxWidth: 500, background: "#0a0f0c", borderRadius: 16, border: `1px solid ${ACCENT_BORDER}`, padding: "14px 16px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", gap: 12, animation: "fadeUp 0.3s ease" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>🌿</div>
          <p style={{ margin: 0, fontSize: 13, color: TEXT_PRIMARY, flex: 1, lineHeight: 1.5 }}>On dirait que la pression monte. On prend 2 minutes ensemble pour souffler ?</p>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => { setShowPreemptiveSOS(false); void handleSOS(); }}
              style={{ height: 34, borderRadius: 8, padding: "0 14px", background: ACCENT, border: "none", color: "black", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              Oui 🌿
            </button>
            <button onClick={() => setShowPreemptiveSOS(false)}
              style={{ height: 34, borderRadius: 8, padding: "0 12px", background: "transparent", border: `1px solid ${BORDER}`, color: TEXT_MUTED, fontSize: 13, cursor: "pointer" }}>
              Non
            </button>
          </div>
        </div>
      )}

      {/* ═══ MODALE TRIAGE SOS ═══ */}
      {showSOSTriageModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0a0f0c", borderRadius: 24, padding: "28px 24px", width: "100%", maxWidth: 400, border: "1px solid rgba(6,182,212,0.25)", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <p style={{ fontSize: 30, margin: "0 0 8px" }}>💙</p>
              <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY }}>Comment puis-je vous aider ?</h3>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_SECONDARY }}>Choisissez ce qui correspond le mieux à ce que vous ressentez</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { emoji: "🍕", label: "Fringale / Impulsion alimentaire", ctx: "fringale", desc: "Envie soudaine, compulsion, difficulté à résister" },
                { emoji: "📈", label: "Pic de stress / Anxiété forte", ctx: "stress", desc: "Tension, agitation, sensation d'être dépassé(e)" },
                { emoji: "🧠", label: "Culpabilité / Ruminations", ctx: "culpabilité", desc: "Pensées négatives qui tournent en boucle" },
                { emoji: "🔋", label: "Coup de mou / Baisse de régime", ctx: "coup de mou", desc: "Fatigue, découragement, manque d'élan" },
              ].map(({ emoji, label, ctx, desc }) => (
                <button key={ctx} onClick={() => { setShowSOSTriageModal(false); setSelectedTriageCtx(ctx); setStressBefore(null); setShowStressBeforeModal(true); }}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(6,182,212,0.08)"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.25)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}>
                  <span style={{ fontSize: 26, flexShrink: 0 }}>{emoji}</span>
                  <div>
                    <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: TEXT_PRIMARY }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setShowSOSTriageModal(false)} style={{ marginTop: 16, width: "100%", height: 38, borderRadius: 10, background: "transparent", border: `1px solid ${BORDER}`, color: TEXT_MUTED, fontSize: 13, cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {showFeedback && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.92)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0a0f0c", borderRadius: 24, padding: 28, width: "100%", maxWidth: 400, border: `1px solid ${ACCENT_BORDER}`, animation: "fadeUp 0.3s ease" }}>
            {!feedbackScore ? (
              <>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <p style={{ fontSize: 28, margin: "0 0 8px" }}>🌿</p>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY, margin: "0 0 6px" }}>Comment tu te sens ?</h3>
                  <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: 0 }}>1 = encore tendu(e) · 10 = complètement apaisé(e)</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                    <button key={score} onClick={() => void submitFeedback(score)} disabled={feedbackSubmitting}
                      style={{ height: 50, borderRadius: 12, border: `1px solid ${score <= 3 ? "rgba(244,63,94,0.25)" : score <= 6 ? "rgba(245,158,11,0.25)" : "rgba(16,185,129,0.25)"}`, background: score <= 3 ? "rgba(244,63,94,0.06)" : score <= 6 ? "rgba(245,158,11,0.06)" : "rgba(16,185,129,0.06)", color: score <= 3 ? "#f87171" : score <= 6 ? "#f59e0b" : ACCENT, fontSize: 17, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.borderColor = score <= 3 ? "rgba(244,63,94,0.5)" : score <= 6 ? "rgba(245,158,11,0.5)" : `rgba(16,185,129,0.5)`; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = score <= 3 ? "rgba(244,63,94,0.25)" : score <= 6 ? "rgba(245,158,11,0.25)" : "rgba(16,185,129,0.25)"; }}>
                      {score}
                    </button>
                  ))}
                </div>
                <button onClick={() => closeFeedbackAndTool(activeTool?.id ?? "")}
                  style={{ width: "100%", height: 36, borderRadius: 10, background: "transparent", border: `1px solid ${BORDER}`, color: TEXT_MUTED, fontSize: 13, cursor: "pointer" }}>
                  Passer
                </button>
              </>
            ) : feedbackSubmitting ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <ArcSpinner size={40} />
                <p style={{ margin: "16px 0 0", fontSize: 14, color: TEXT_SECONDARY }}>Enregistrement...</p>
              </div>
            ) : (
              <>
                {/* Célébration */}
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 16px" }}>
                    <div style={{ position: "absolute", inset: -10, borderRadius: "50%", background: `radial-gradient(circle, ${feedbackScore >= 7 ? "rgba(16,185,129,0.2)" : feedbackScore >= 4 ? "rgba(245,158,11,0.15)" : "rgba(6,182,212,0.15)"}, transparent 70%)`, animation: "glow-idle 2.5s ease-in-out infinite" }} />
                    <div style={{ width: 72, height: 72, borderRadius: "50%", background: feedbackScore >= 7 ? ACCENT_DIM : feedbackScore >= 4 ? "rgba(245,158,11,0.08)" : "rgba(6,182,212,0.08)", border: `1.5px solid ${feedbackScore >= 7 ? ACCENT_BORDER : feedbackScore >= 4 ? "rgba(245,158,11,0.2)" : "rgba(6,182,212,0.2)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>
                      {feedbackScore >= 7 ? "🌟" : feedbackScore >= 4 ? "🌿" : "💙"}
                    </div>
                  </div>
                  {/* Delta visuel si stressBefore connu */}
                  {stressBefore !== null && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: feedbackScore >= 4 ? "rgba(16,185,129,0.08)" : "rgba(6,182,212,0.08)", border: `1px solid ${feedbackScore >= 4 ? ACCENT_BORDER : "rgba(6,182,212,0.2)"}`, borderRadius: 20, padding: "5px 14px", marginBottom: 16 }}>
                      <span style={{ fontSize: 13, color: TEXT_MUTED }}>{stressBefore}</span>
                      <svg width="16" height="8" viewBox="0 0 16 8" fill="none"><path d="M0 4h14M10 1l4 3-4 3" stroke={feedbackScore >= 4 ? ACCENT : "#06b6d4"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span style={{ fontSize: 13, fontWeight: 700, color: feedbackScore >= 7 ? ACCENT : feedbackScore >= 4 ? "#f59e0b" : "#06b6d4" }}>{feedbackScore}</span>
                      {stressBefore - feedbackScore > 0 && (
                        <span style={{ fontSize: 11, color: ACCENT, fontWeight: 600 }}>−{stressBefore - feedbackScore} pts</span>
                      )}
                    </div>
                  )}
                  <p style={{ fontSize: 14, color: TEXT_PRIMARY, lineHeight: 1.75, margin: 0, whiteSpace: "pre-line" }}>{feedbackMessage}</p>
                </div>
                <button onClick={() => closeFeedbackAndTool(activeTool?.id ?? "")}
                  style={{ width: "100%", height: 48, borderRadius: 12, background: ACCENT, border: "none", color: "black", fontSize: 15, fontWeight: 600, cursor: "pointer", boxShadow: "0 0 16px rgba(16,185,129,0.25)" }}>
                  Continuer 🌿
                </button>
              </>
            )}
          </div>
        </div>
        )}
        {renderTool()}

     {/* Modale profil */}
{showProfileModal && (
  <div onClick={() => setShowProfileModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#0a0f0c", borderRadius: 24, padding: 28, width: "100%", maxWidth: 360, border: `1px solid ${ACCENT_BORDER}`, maxHeight: "90vh", overflowY: "auto" }}>

      {/* Avatar */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 12px" }}>
          {patientPhoto ? (
            <img src={patientPhoto} alt="avatar" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(52,211,153,0.4)" }} onError={() => setPatientPhoto(null)} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle at 30% 30%, #10b981, #059669)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "black", border: "2px solid rgba(16,185,129,0.4)" }}>{patientInitials}</div>
          )}
          <button onClick={() => patientAvatarRef.current?.click()} disabled={uploadingPhoto}
            style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: ACCENT, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {uploadingPhoto ? <span style={{ width: 11, height: 11, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTop: "2px solid black", display: "inline-block", animation: "spin 1s linear infinite" }} /> : <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="black" strokeWidth="2.5" strokeLinecap="round"/></svg>}
          </button>
          <input ref={patientAvatarRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
            const file = e.target.files?.[0]; if (!file || !patientId) return;
            setUploadingPhoto(true);
            const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
            const compressed = await compressImage(file);
            const byteString = atob(compressed.base64);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const blob = new Blob([ab], { type: "image/jpeg" });
            await supabase.storage.from("Avatars").upload(`${patientId}/avatar.jpg`, blob, { upsert: true, contentType: "image/jpeg" });
            const { data } = supabase.storage.from("Avatars").getPublicUrl(`${patientId}/avatar.jpg`);
            setPatientPhoto(data.publicUrl + "?t=" + Date.now());
            setUploadingPhoto(false);
            if (patientAvatarRef.current) patientAvatarRef.current.value = "";
          }} />
        </div>

        {/* Identité en lecture seule */}
        <h3 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY }}>{patientFirstName} {editLastName}</h3>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: TEXT_MUTED }}>{patientEmail}</p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 20, padding: "4px 12px", marginBottom: 4 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ fontSize: 10, color: ACCENT, fontWeight: 600 }}>Identité vérifiée par votre praticien</span>
        </div>
        <div style={{ marginTop: 6 }}>
        <button onClick={async () => {
        try {
          const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
          const { data: current } = await supabase.from("patients").select("admin_alerts").eq("user_id", patientId).single();
          const alerts = (current as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];
          await supabase.from("patients").update({
            admin_alerts: [...alerts, {
              type: "admin_alert",
              alert_type: "identity_correction",
              date: new Date().toISOString(),
              seen: false,
            }]
          }).eq("user_id", patientId);
          setShowProfileModal(false);
          alert("Votre praticien a été notifié. Il corrigera votre dossier prochainement. 🌿");
        } catch {
          alert("Une erreur est survenue. Veuillez réessayer.");
        }
      }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: TEXT_MUTED, textDecoration: "underline", textDecorationStyle: "dotted", padding: 0 }}
        onMouseEnter={e => e.currentTarget.style.color = TEXT_SECONDARY}
        onMouseLeave={e => e.currentTarget.style.color = TEXT_MUTED}>
        Une erreur dans votre nom ? Prévenez votre praticien.
      </button>

        </div>
      </div>

      {/* Mes Victoires */}
      {patientVictories.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: TEXT_MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>🏆 Mes Victoires</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {patientVictories.slice(-5).reverse().map((v, i) => (
              <div key={i} style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>🏆</span>
                <p style={{ margin: 0, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5 }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <button onClick={async () => {
          if (!patientId) return;
          setExportingRGPD(true);
          const res = await fetch(`/api/export-rgpd?patientId=${patientId}`);
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = `nutritwin-export-${new Date().toISOString().split("T")[0]}.json`; a.click();
          URL.revokeObjectURL(url);
          setExportingRGPD(false);
        }} disabled={exportingRGPD}
          style={{ width: "100%", height: 40, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = TEXT_PRIMARY; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = TEXT_SECONDARY; }}>
          {exportingRGPD ? "Export en cours..." : "📥 Télécharger mes données (RGPD)"}
        </button>

        <button onClick={() => { setShowProfileModal(false); setShowLogoutPatientModal(true); }}
          style={{ width: "100%", height: 40, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.2)"; e.currentTarget.style.color = "#f87171"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_SECONDARY; }}>
          Se déconnecter
        </button>

        <button onClick={() => { setShowProfileModal(false); setShowDeleteAccountModal(true); }}
          style={{ width: "100%", height: 40, borderRadius: 10, background: "rgba(244,63,94,0.06)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.12)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.35)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.06)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.2)"; }}>
          Clôturer mon accompagnement
        </button>
      </div>

      {/* Liens légaux */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
        <a href="/confidentialite" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: TEXT_MUTED, textDecoration: "none" }}>Confidentialité</a>
        <span style={{ color: TEXT_MUTED, fontSize: 11 }}>·</span>
        <a href="/cgu" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: TEXT_MUTED, textDecoration: "none" }}>CGU</a>
      </div>
    </div>
  </div>
)}

{/* Modale déconnexion patient */}
{showLogoutPatientModal && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
    <div style={{ background: "#0a0f0c", borderRadius: 24, padding: 28, width: "100%", maxWidth: 340, border: `1px solid ${BORDER}`, textAlign: "center" }}>
      <p style={{ fontSize: 32, marginBottom: 12 }}>👋</p>
      <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY }}>Se déconnecter ?</h3>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: TEXT_SECONDARY }}>Vous devrez vous reconnecter pour accéder à votre espace.</p>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setShowLogoutPatientModal(false)}
          style={{ flex: 1, height: 44, borderRadius: 10, background: "transparent", border: `1px solid ${BORDER}`, color: TEXT_MUTED, fontSize: 14, cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = TEXT_SECONDARY; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_MUTED; }}>
          Annuler
        </button>
        <button onClick={async () => {
          const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
          await supabase.auth.signOut();
          window.location.href = "/patient-login";
        }}
          style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; }}>
          Se déconnecter
        </button>
      </div>
    </div>
  </div>
)}

{/* Modale suppression compte */}
{showDeleteAccountModal && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
    <div style={{ background: "#0a0f0c", borderRadius: 24, padding: 28, width: "100%", maxWidth: 360, border: "1px solid rgba(244,63,94,0.2)", textAlign: "center" }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY }}>Clôturer mon accompagnement</h3>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6 }}>Cette action est irréversible. Toutes vos données seront supprimées conformément au RGPD.</p>
      <input type="password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} placeholder="Confirmez avec votre mot de passe"
        style={{ width: "100%", height: 44, borderRadius: 10, border: `1px solid ${deleteError ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.1)"}`, background: "rgba(255,255,255,0.03)", color: TEXT_PRIMARY, padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 8, fontFamily: "inherit" }}
        onFocus={e => e.target.style.borderColor = "rgba(244,63,94,0.4)"}
        onBlur={e => e.target.style.borderColor = deleteError ? "rgba(244,63,94,0.5)" : "rgba(255,255,255,0.1)"} />
      {deleteError && <p style={{ margin: "0 0 12px", fontSize: 12, color: "#f87171" }}>{deleteError}</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button onClick={() => { setShowDeleteAccountModal(false); setDeletePassword(""); setDeleteError(""); }}
          style={{ flex: 1, height: 44, borderRadius: 10, background: "transparent", border: `1px solid ${BORDER}`, color: TEXT_MUTED, fontSize: 14, cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = TEXT_SECONDARY; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_MUTED; }}>
          Annuler
        </button>
        <button onClick={async () => {
          if (!deletePassword || !patientId) return;
          setDeletingAccount(true); setDeleteError("");
          const res = await fetch("/api/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, password: deletePassword, email: patientEmail }) });
          const data = await res.json() as { error?: string };
          if (!res.ok) { setDeleteError(data.error ?? "Erreur"); setDeletingAccount(false); return; }
          window.location.href = "/patient-login";
        }} disabled={deletingAccount || !deletePassword}
          style={{ flex: 1, height: 44, borderRadius: 10, background: deletingAccount || !deletePassword ? "rgba(244,63,94,0.04)" : "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: deletingAccount || !deletePassword ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
          {deletingAccount ? "Suppression..." : "Confirmer"}
        </button>
      </div>
    </div>
  </div>
)}

      {/* Upsell */}
      {showUpsellModal && (
        <div onClick={() => setShowUpsellModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#0a0f0c", borderRadius: 24, padding: 28, width: "100%", maxWidth: 360, textAlign: "center", border: `1px solid ${ACCENT_BORDER}` }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CameraIcon size={22} color={ACCENT} />
            </div>
            <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY }}>Analyse visuelle</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6 }}>Cette option n'est pas encore activée par votre praticien.</p>
            <button onClick={() => setShowUpsellModal(false)}
              style={{ width: "100%", height: 46, borderRadius: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; e.currentTarget.style.transform = "translateY(0)"; }}>
              Compris
            </button>
          </div>
        </div>
      )}

      {sidebarOpen && isMobile && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 20 }} />}

      {/* ═══ SIDEBAR ═══ */}
      <aside style={{ width: sidebarOpen ? sidebarWidth : 0, minWidth: sidebarOpen ? sidebarWidth : 0, background: "linear-gradient(180deg, #0b1a14 0%, #090f0c 50%, #070c0a 100%)", display: "flex", flexDirection: "column", position: isMobile ? "fixed" : "relative", top: 0, left: 0, height: "100vh", zIndex: isMobile ? 30 : 1, transition: "width 0.25s ease, min-width 0.25s ease", overflow: "hidden", flexShrink: 0, boxShadow: "4px 0 24px rgba(0,0,0,5)", borderRight: "1px solid rgba(16,185,129,0.08)", }}>
        <div style={{ width: sidebarWidth, display: "flex", flexDirection: "column", height: "100%", padding: "0 12px" }}>

          {/* Header sidebar */}
          <div style={{ padding: "20px 16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", borderBottom: "1px solid rgba(16,185,129,0.12)", margin: "0 -12px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/logo.svg" alt="NutriTwin" style={{ height: 42, width: "auto", filter: "hue-rotate(17deg) saturate(165%) brightness(87%)" }}
                onError={e => { const t = e.target as HTMLImageElement; t.style.display = "none"; const n = t.nextElementSibling as HTMLElement; if (n) n.style.display = "flex"; }} />
              <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg, #10b981, #059669)", display: "none", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌿</div>
              <div>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: "-0.3px" }}>Nutri<span style={{ color: ACCENT }}>Twin</span></p>
                <p style={{ margin: 0, fontSize: 12, color: TEXT_MUTED }}>Votre espace santé</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
              <MenuIcon size={14} />
            </button>
          </div>

          {/* ═══ MON SOUTIEN — Bouton héro ═══ */}
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={() => { if (emotionalStatus === "red_critical") return; setShowSOSTriageModal(true); if (isMobile) setSidebarOpen(false); }}
              disabled={sosLoading || emotionalStatus === "red_critical"}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 16px", borderRadius: 18, background: "linear-gradient(135deg, rgba(6,182,212,0.12), rgba(6,182,212,0.04))", border: "1px solid rgba(6,182,212,0.3)", cursor: sosLoading ? "not-allowed" : "pointer", transition: "all 0.25s", boxShadow: "0 0 24px rgba(6,182,212,0.12), 0 4px 16px rgba(0,0,0,0.3)", position: "relative", overflow: "hidden" }}
              onMouseEnter={e => { if (!sosLoading) { e.currentTarget.style.background = "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.08))"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.5)"; e.currentTarget.style.boxShadow = "0 0 32px rgba(6,182,212,0.2), 0 4px 20px rgba(0,0,0,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
              onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(6,182,212,0.12), rgba(6,182,212,0.04))"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.3)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(6,182,212,0.12), 0 4px 16px rgba(0,0,0,0.3)"; e.currentTarget.style.transform = "translateY(0)"; }}>
              {/* Lueur de fond animée */}
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 50%, rgba(6,182,212,0.07), transparent 65%)", pointerEvents: "none" }} />
              <div style={{ width: 46, height: 46, borderRadius: 14, border: "1.5px solid rgba(6,182,212,0.5)", background: "rgba(6,182,212,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 16px rgba(6,182,212,0.25), inset 0 0 10px rgba(6,182,212,0.08)", animation: "glow-sos 3s ease-in-out infinite" }}>
                {sosLoading ? (
                  <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(6,182,212,0.3)", borderTop: "2px solid #06b6d4", animation: "spin 1s linear infinite" }} />
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#06b6d4" stroke="#06b6d4" strokeWidth="0.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                )}
              </div>
              <div style={{ textAlign: "left", flex: 1, position: "relative" }}>
                <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#e0f7fa", letterSpacing: "-0.2px" }}>{sosLoading ? "En route..." : "Mon Soutien"}</p>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(6,182,212,0.7)", lineHeight: 1.5 }}>Aide immédiate · Exercices guidés</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}><path d="M9 18l6-6-6-6" stroke="#06b6d4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 4px 14px" }} />

          {/* ═══ RECHERCHE DANS LA CONVERSATION ═══ */}
          {(() => {
            const q = chatSearch.trim().toLowerCase();
            const matchIndices = q
              ? visibleMessages.reduce<number[]>((acc, m, i) => { if (m.content.toLowerCase().includes(q)) acc.push(i); return acc; }, [])
              : [];
            const safeIdx = matchIndices.length > 0 ? Math.min(chatSearchIdx, matchIndices.length - 1) : 0;
            const scrollToMatch = (targetIdx: number) => {
              const msgIdx = matchIndices[targetIdx];
              if (msgIdx == null) return;
              const el = messageRefs.current[msgIdx];
              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
            };
            const handleSearchNav = (dir: 1 | -1) => {
              if (matchIndices.length === 0) return;
              const next = (safeIdx + dir + matchIndices.length) % matchIndices.length;
              setChatSearchIdx(next);
              scrollToMatch(next);
            };
            return (
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: "0 4px 8px", fontSize: 10, fontWeight: 700, color: TEXT_MUTED, letterSpacing: "0.12em", textTransform: "uppercase" }}>Rechercher</p>
                <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "9px 12px", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)", border: `1px solid ${chatSearch ? "rgba(16,185,129,0.2)" : "transparent"}`, transition: "border-color 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <SearchIcon size={13} color={chatSearch ? ACCENT : TEXT_MUTED} />
                    <input
                      value={chatSearch}
                      onChange={e => { setChatSearch(e.target.value); setChatSearchIdx(0); }}
                      placeholder="Mot-clé dans la conversation..."
                      style={{ flex: 1, border: "none", background: "transparent", color: TEXT_PRIMARY, fontSize: 12, outline: "none", caretColor: ACCENT }}
                    />
                    {chatSearch && (
                      <button onClick={() => { setChatSearch(""); setChatSearchIdx(0); }} style={{ background: "none", border: "none", cursor: "pointer", color: TEXT_MUTED, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
                    )}
                  </div>
                  {q && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: matchIndices.length > 0 ? ACCENT : TEXT_MUTED }}>
                        {matchIndices.length === 0 ? "Aucun résultat" : `${safeIdx + 1} / ${matchIndices.length} résultat${matchIndices.length > 1 ? "s" : ""}`}
                      </span>
                      {matchIndices.length > 1 && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => handleSearchNav(-1)} style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: TEXT_SECONDARY, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>↑</button>
                          <button onClick={() => handleSearchNav(1)} style={{ width: 24, height: 24, borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: TEXT_SECONDARY, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>↓</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Aperçus des résultats */}
                {q && matchIndices.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, maxHeight: 200, overflowY: "auto" }}>
                    {matchIndices.map((msgIdx, j) => {
                      const m = visibleMessages[msgIdx];
                      const lc = m.content.toLowerCase();
                      const pos = lc.indexOf(q);
                      const snippet = m.content.slice(Math.max(0, pos - 20), pos + q.length + 40);
                      const before = snippet.slice(0, Math.min(20, pos));
                      const match = snippet.slice(Math.min(20, pos), Math.min(20, pos) + q.length);
                      const after = snippet.slice(Math.min(20, pos) + q.length);
                      return (
                        <button key={j} onClick={() => { setChatSearchIdx(j); scrollToMatch(j); if (isMobile) setSidebarOpen(false); }}
                          style={{ textAlign: "left", padding: "8px 10px", borderRadius: 10, background: j === safeIdx ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${j === safeIdx ? "rgba(16,185,129,0.2)" : "transparent"}`, cursor: "pointer", transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.08)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = j === safeIdx ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)"; }}>
                          <p style={{ margin: "0 0 2px", fontSize: 10, color: m.role === "user" ? ACCENT : TEXT_MUTED, fontWeight: 600 }}>{m.role === "user" ? "Vous" : "Jumeau"}</p>
                          <p style={{ margin: 0, fontSize: 11, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
                            {pos > 20 && "..."}
                            {before}
                            <span style={{ background: "rgba(16,185,129,0.25)", color: ACCENT, fontWeight: 700, borderRadius: 3, padding: "0 2px" }}>{match}</span>
                            {after}
                            {pos + q.length + 40 < m.content.length && "..."}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
                {q && matchIndices.length === 0 && !hasMessages && (
                  <p style={{ margin: "8px 4px 0", fontSize: 11, color: TEXT_MUTED }}>Commencez une conversation pour pouvoir la rechercher.</p>
                )}
              </div>
            );
          })()}

          <div style={{ flex: 1 }} />
        </div>
      </aside>

      {/* ═══ ZONE PRINCIPALE ═══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        <header style={{ background: "linear-gradient(90deg, #0b1a14 0%, #080e0b 50%, #0b1a14 100%)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(16,185,129,0.15)", padding: "0 16px", height: 82, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.background = SURFACE}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <MenuIcon size={16} />
            </button>
          )}
          {isMobile && sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <MenuIcon size={16} />
            </button>
          )}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              {hasMessages && (
                <>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY, lineHeight: 1.3 }}>Votre compagnon de suivi</p>
                  <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED }}>Basé sur l'approche de votre praticien</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: ACCENT, animation: "breathe 3s ease-in-out infinite" }} />
                    <span style={{ fontSize: 11, color: ACCENT, fontWeight: 500 }}>{loading ? "En train de réfléchir..." : "À votre écoute"}</span>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setShowProfileModal(true)}
              style={{ width: 36, height: 36, borderRadius: "50%", background: `radial-gradient(circle at 30% 30%, #10b981, #059669)`, border: "2px solid rgba(16,185,129,0.35)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "black", flexShrink: 0, boxShadow: "0 0 10px rgba(16,185,129,0.15)", transition: "box-shadow 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 16px rgba(16,185,129,0.35)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 10px rgba(16,185,129,0.15)"}>
              {patientInitials}
            </button>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {!hasMessages && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: isMobile ? "24px 16px 100px" : "32px 24px 100px" }}>
              <div style={{ maxWidth: 580, width: "100%", textAlign: "center" }}>
                <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 24px" }}>
                  {/* Halo cyan externe — léger, décalé de phase */}
                  <div style={{ position: "absolute", inset: -24, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.09), transparent 62%)", animation: "glow-idle 4s ease-in-out infinite", animationDelay: "1.4s", pointerEvents: "none" }} />
                  {/* Halo vert interne — existant */}
                  <div style={{ position: "absolute", inset: -12, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.18), transparent 70%)", animation: "glow-idle 3s ease-in-out infinite" }} />
                  {/* Cercle principal avec bordure dégradée vert→cyan */}
                  <div style={{ width: 64, height: 64, borderRadius: "50%", border: "1.5px solid transparent", background: "linear-gradient(#080e0b, #080e0b) padding-box, linear-gradient(135deg, rgba(16,185,129,0.65), rgba(6,182,212,0.45)) border-box", boxShadow: "0 0 20px rgba(16,185,129,0.12), 0 0 36px rgba(6,182,212,0.07)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", fontSize: 28 }}>🌿</div>
                </div>
                <h1 style={{ margin: "0 0 8px", fontSize: isMobile ? 26 : 30, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: "-0.5px" }}>
                  {patientFirstName ? `Bonjour ${patientFirstName} 👋` : "Bonjour 👋"}
                </h1>
                <p style={{ margin: "0 0 28px", fontSize: isMobile ? 15 : 16, color: TEXT_SECONDARY, lineHeight: 1.7 }}>
                  Je suis votre compagnon de suivi, créé à partir de l'expertise de votre praticien.
                </p>
                <div style={{ marginBottom: 40 }}>
                  <InputBar isCenter={true} message={message} setMessage={setMessage} send={send} loading={loading} pendingImage={pendingImage} photoHovered={photoHovered} setPhotoHovered={setPhotoHovered} handleImageClick={handleImageClick} handleKeyDown={handleKeyDown} inputRef={inputRef} />
                </div>
                <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 600, color: TEXT_MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>Questions fréquentes</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {quickActions.map(action => (
                    <button key={action} onClick={() => void send(action)}
                      style={{ background: CYAN_DIM, border: `1px solid ${CYAN_BORDER}`, borderRadius: 28, padding: "9px 18px", fontSize: isMobile ? 13 : 14, color: TEXT_SECONDARY, cursor: "pointer", transition: "all 0.25s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(6,182,212,0.14)"; e.currentTarget.style.color = CYAN; e.currentTarget.style.borderColor = "rgba(6,182,212,0.4)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(6,182,212,0.12)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = CYAN_DIM; e.currentTarget.style.color = TEXT_SECONDARY; e.currentTarget.style.borderColor = CYAN_BORDER; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {hasMessages && (
            <div style={{ flex: 1, padding: isMobile ? "16px 12px 100px" : "20px 20px 100px" }}>
              <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
                {visibleMessages.map((msg, index) => {
                  const isUser = msg.role === "user";
                  const isLastAssistant = !isUser && index === visibleMessages.length - 1;
                  if (!isUser && !msg.content && isLastAssistant) return null;
                  const q = chatSearch.trim().toLowerCase();
                  const matchIndices = q ? visibleMessages.reduce<number[]>((acc, m, i) => { if (m.content.toLowerCase().includes(q)) acc.push(i); return acc; }, []) : [];
                  const isChatMatch = q && msg.content.toLowerCase().includes(q);
                  const isActiveMatch = matchIndices[Math.min(chatSearchIdx, matchIndices.length - 1)] === index;
                  return (
                    <div key={index} ref={el => { messageRefs.current[index] = el; }} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8, animation: "fadeUp 0.25s ease", transition: "opacity 0.2s", opacity: q && !isChatMatch ? 0.35 : 1 }}>
                      <div style={{ maxWidth: isMobile ? "88%" : "76%" }}>
                        {msg.imageUrl && (
                          <div style={{ marginBottom: 6, display: "flex", justifyContent: "flex-end" }}>
                            <img src={msg.imageUrl} alt="Photo" style={{ maxWidth: isMobile ? 160 : 200, maxHeight: isMobile ? 160 : 200, borderRadius: 12, objectFit: "cover", border: `1px solid ${ACCENT_BORDER}` }} />
                          </div>
                        )}
                        <div style={{ padding: isMobile ? "11px 14px" : "12px 18px", borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: isActiveMatch ? "rgba(16,185,129,0.18)" : isUser ? "linear-gradient(135deg, rgba(16,185,129,0.85), rgba(5,150,105,0.7))" : "rgba(255,255,255,0.04)", backdropFilter: isUser ? "none" : "blur(8px)", color: TEXT_PRIMARY, fontSize: 15, lineHeight: 1.75, border: isActiveMatch ? `1.5px solid ${ACCENT}` : isUser ? `1px solid rgba(16,185,129,0.2)` : `1px solid ${BORDER}`, boxShadow: isUser ? "0 2px 12px rgba(0,0,0,0.3)" : isActiveMatch ? `0 0 0 3px rgba(16,185,129,0.15)` : "none", transition: "all 0.3s" }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ArcSpinner size={28} />
                    <button onClick={stopGeneration}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "14px 14px 14px 4px", background: SURFACE, border: `1px solid ${BORDER}`, cursor: "pointer", color: TEXT_SECONDARY, fontSize: 12, transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(244,63,94,0.3)"; e.currentTarget.style.color = "#f87171"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_SECONDARY; }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                      En train de réfléchir... · Arrêter
                    </button>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </main>

        {/* ═══ BANNIÈRE URGENCE RED_CRITICAL ═══ */}
        {emotionalStatus === "red_critical" && (
          <div style={{ background: "rgba(127,0,0,0.18)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(244,63,94,0.35)", padding: isMobile ? "14px 16px" : "16px 24px", flexShrink: 0 }}>
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 16, padding: "16px 18px" }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🚨</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#f87171" }}>Une alerte a été transmise à votre praticien</p>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#fca5a5", lineHeight: 1.6 }}>Si vous traversez une situation d'urgence, contactez immédiatement un professionnel.</p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a href="tel:15" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", color: "#f87171", fontSize: 15, fontWeight: 700, textDecoration: "none", transition: "all 0.2s" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.25)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.15)"}>
                      📞 <span>SAMU · 15</span>
                    </a>
                    <a href="tel:3114" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", color: "#fca5a5", fontSize: 15, fontWeight: 700, textDecoration: "none", transition: "all 0.2s" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.2)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.1)"}>
                      💙 <span>Numéro national · 3114</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {hasMessages && emotionalStatus !== "red_critical" && (
          <div style={{ background: "rgba(7,11,9,0.97)", backdropFilter: "blur(20px)", borderTop: `1px solid ${BORDER}`, padding: isMobile ? "10px 12px" : "10px 20px", paddingBottom: "max(14px, env(safe-area-inset-bottom))", flexShrink: 0 }}>
            {pendingImage && (
              <div style={{ maxWidth: 700, margin: "0 auto 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <img src={pendingImage.previewUrl} alt="Preview" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: `1px solid ${ACCENT_BORDER}` }} />
                  <p style={{ margin: 0, fontSize: 12, color: TEXT_SECONDARY }}>Photo prête</p>
                  <button onClick={() => setPendingImage(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: TEXT_SECONDARY, fontSize: 18 }}>×</button>
                </div>
              </div>
            )}
            {imageCompressing && (
              <div style={{ maxWidth: 700, margin: "0 auto 6px" }}>
                <div style={{ height: 2, background: SURFACE, borderRadius: 1 }}>
                  <div style={{ height: "100%", background: ACCENT, borderRadius: 1, width: `${compressionProgress}%`, transition: "width 0.1s" }} />
                </div>
              </div>
            )}
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
              <InputBar isCenter={false} message={message} setMessage={setMessage} send={send} loading={loading} pendingImage={pendingImage} photoHovered={photoHovered} setPhotoHovered={setPhotoHovered} handleImageClick={handleImageClick} handleKeyDown={handleKeyDown} inputRef={inputRef} />
              <p style={{ margin: "6px 0 0", fontSize: 10, color: TEXT_MUTED, textAlign: "center" }}>
                NutriTwin est une IA et peut se tromper · En cas de doute, consultez votre praticien
              </p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} style={{ display: "none" }} />
          </div>
        )}
      </div>

      {showToast && (
        <div style={{ position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)", zIndex: 120, background: "#0a0f0c", borderRadius: 14, border: `1px solid ${ACCENT_BORDER}`, padding: "12px 20px", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", gap: 10, animation: "fadeUp 0.3s ease", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: 18 }}>🌿</span>
          <p style={{ margin: 0, fontSize: 13, color: TEXT_PRIMARY, fontWeight: 500 }}>Données transmises à votre praticien. Bravo pour ce moment de calme.</p>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes glow-idle { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.1); } }
        @keyframes glow-sos { 0%, 100% { box-shadow: 0 0 16px rgba(6,182,212,0.25), inset 0 0 10px rgba(6,182,212,0.08); } 50% { box-shadow: 0 0 28px rgba(6,182,212,0.45), inset 0 0 14px rgba(6,182,212,0.15); } }
        @keyframes breathe { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(0.75); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .nt-inputbar:focus-within { border-color: rgba(6,182,212,0.45) !important; box-shadow: 0 0 0 3px rgba(6,182,212,0.07), 0 0 16px rgba(6,182,212,0.07) !important; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }
        input::placeholder, textarea::placeholder { color: #475569; }
        @media (max-width: 767px) { .chat-input { font-size: 16px !important; } }
      `}</style>
    </div>
  );
}
