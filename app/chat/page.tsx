"use client";

import { KeyboardEvent, useState, useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import JournalModal from "./JournalModal";

type WidgetMeta = {
  toolId: string;
  toolData: ToolData | null;
  completed: boolean;
};

type ChatMessage = {
  role: "user" | "assistant" | "widget";
  content: string;
  imageUrl?: string;
  hidden?: boolean;
  widgetMeta?: WidgetMeta;
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
// Couleurs thérapeutiques Mon Soutien — cobalt/cyan
const CYAN = "#06b6d4";
const CYAN_DIM = "rgba(6,182,212,0.08)";
const CYAN_BORDER = "rgba(6,182,212,0.18)";
const SURFACE = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_PRIMARY = "#f1f5f9";
const TEXT_SECONDARY = "#94a3b8";
const TEXT_MUTED = "#64748b";
const BG_MAIN = "#080e0b";
// Direction artistique — émeraude unifié

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

const ArrowUpIcon = ({ size = 16, color = "white" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 19V5M5 12l7-7 7 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SettingsIcon = ({ size = 16, color = TEXT_MUTED }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// ─── Icônes SVG outline pour les modales Mon Soutien ───
const IconFork = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
  </svg>
);
const IconActivity = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IconThought = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    <line x1="9" y1="10" x2="9" y2="10" strokeWidth="2"/><line x1="12" y1="10" x2="12" y2="10" strokeWidth="2"/><line x1="15" y1="10" x2="15" y2="10" strokeWidth="2"/>
  </svg>
);
const IconMoon = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);
const IconWind = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
  </svg>
);
const IconEye = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const IconPen = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);
const IconLayers = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
);
const IconFootprints = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0z"/>
    <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0z"/>
  </svg>
);
const IconStar = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const IconBody = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="1.5"/><path d="M12 8v6"/><path d="M9 10.5l3 1.5 3-1.5"/><path d="M9 20l3-4 3 4"/>
  </svg>
);
const IconLeaf2 = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
  </svg>
);

// Maps d'icônes SVG pour les modales Mon Soutien
const TRIAGE_ICONS: Record<string, React.ReactElement> = {
  fringale: <IconFork size={24} color={CYAN} />,
  stress: <IconActivity size={24} color={CYAN} />,
  "culpabilité": <IconThought size={24} color={CYAN} />,
  "coup de mou": <IconMoon size={24} color={CYAN} />,
};
const TOOL_SVG_ICONS: Record<string, React.ReactElement> = {
  body_scan: <IconBody size={28} color={CYAN} />,
  manger: <IconLeaf2 size={28} color={CYAN} />,
  breathing: <IconWind size={28} color={CYAN} />,
  ancrage: <IconEye size={28} color={CYAN} />,
  ecriture: <IconPen size={28} color={CYAN} />,
  defusion: <IconLayers size={28} color={CYAN} />,
  marche: <IconFootprints size={28} color={CYAN} />,
  adaptive_coaching: <IconStar size={28} color={CYAN} />,
};

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

const InputBar = ({ isCenter = false, message, setMessage, send, loading, pendingImage, photoHovered, setPhotoHovered, handleImageClick, handleKeyDown, inputRef }: InputBarProps) => {
  const canSend = !loading && (message.trim().length > 0 || !!pendingImage);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el || isCenter) return;
    el.style.height = "auto";
    const newHeight = Math.min(el.scrollHeight, 160);
    el.style.height = newHeight + "px";
    el.style.overflowY = el.scrollHeight > 160 ? "auto" : "hidden";
  }, [message, isCenter, inputRef]);

  return (
    <div className="nt-inputbar" style={{ display: "flex", alignItems: "center", background: "rgba(15,22,18,0.92)", borderRadius: 18, border: `1px solid ${focused ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.10)"}`, padding: isCenter ? "16px 14px" : "10px 10px 10px 14px", transition: "border-color 0.25s, box-shadow 0.25s", minHeight: isCenter ? 110 : 50, gap: 6 }}>
      {/* Textarea */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-start", paddingTop: isCenter ? 0 : 2 }}>
        <textarea
          ref={inputRef}
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={handleKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={pendingImage ? "Ajoutez un commentaire..." : "Posez votre question..."}
          rows={isCenter ? 3 : 1}
          spellCheck={false}
          className="chat-input"
          style={{ width: "100%", border: "none", background: "transparent", color: TEXT_PRIMARY, fontSize: 15, outline: "none", caretColor: ACCENT, lineHeight: isCenter ? 1.65 : 1.5, resize: "none", fontFamily: "inherit", display: "block", maxHeight: 160, overflowY: "hidden", padding: 0 }}
        />
      </div>
      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {/* Camera — label inline au survol */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}
          onMouseEnter={() => setPhotoHovered(true)}
          onMouseLeave={() => setPhotoHovered(false)}>
          <span style={{ fontSize: 11, color: ACCENT, fontWeight: 500, whiteSpace: "nowrap", maxWidth: photoHovered ? 120 : 0, opacity: photoHovered ? 1 : 0, transition: "max-width 0.25s ease, opacity 0.2s", overflow: "hidden" }}>Analyser votre repas</span>
          <button onClick={handleImageClick} style={{ width: 32, height: 32, borderRadius: 8, background: photoHovered ? ACCENT_DIM : "transparent", border: `1px solid ${photoHovered ? ACCENT_BORDER : "transparent"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0 }}>
            <CameraIcon size={15} color={photoHovered ? ACCENT : TEXT_MUTED} />
          </button>
        </div>
        {/* Send — transparent, bordure émeraude quand actif */}
        <button onClick={() => void send()} disabled={!canSend}
          style={{ width: 32, height: 32, borderRadius: 9, background: "transparent", border: `1.5px solid ${canSend ? "rgba(16,185,129,0.55)" : "rgba(255,255,255,0.08)"}`, cursor: canSend ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0 }}>
          <ArrowUpIcon size={14} color={canSend ? ACCENT : TEXT_MUTED} />
        </button>
      </div>
    </div>
  );
};

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
    glowColor: "rgba(16,185,129,0.4)",
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

function generateCelebration(firstName: string, toolId: string): string {
  const toolNames: Record<string, string> = {
    breathing: "la cohérence cardiaque", ancrage: "l'ancrage sensoriel",
    manger: "la pleine conscience", marche: "la marche consciente",
    body_scan: "le body scan", defusion: "la défusion cognitive",
    ecriture: "l'écriture cathartique", adaptive_coaching: "ce moment de coaching",
  };
  const tool = toolNames[toolId] ?? "cet exercice";
  const name = firstName || "toi";
  const msgs = [
    `Bien joué, ${name}. Tu as pris un moment pour toi avec ${tool}. Chaque geste de soin compte énormément. 🌿`,
    `Tu l'as fait, ${name}. ${tool.charAt(0).toUpperCase() + tool.slice(1)}, c'est une vraie preuve de bienveillance envers toi-même. 🌿`,
    `${name}, tu viens de choisir le calme plutôt que la réaction. C'est une compétence qui se renforce à chaque fois. 🌿`,
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

// ═══ INLINE WIDGET — Exercice conversationnel embarqué dans le chat ═══
type InlineWidgetProps = {
  toolId: string;
  toolData: ToolData | null;
  firstName: string;
  frozen: boolean;
  onComplete: (toolId: string) => void | Promise<void>;
};

const InlineWidget = ({ toolId, toolData, firstName, frozen, onComplete }: InlineWidgetProps) => {
  type WidgetPhase = "exercise" | "done";
  const [phase, setPhase] = useState<WidgetPhase>(frozen ? "done" : "exercise");
  const [celebrationMsg, setCelebrationMsg] = useState(frozen ? generateCelebration(firstName, toolId) : "");

  // Breathing
  const [breathStep, setBreathStep] = useState<BreathingStep>("idle");
  const [breathCycle, setBreathCycle] = useState(0);
  const [breathTimer, setBreathTimer] = useState(0);
  const breathRef = useRef<NodeJS.Timeout | null>(null);
  // Ancrage / Marche
  const [exStep, setExStep] = useState(0);

  useEffect(() => () => { if (breathRef.current) clearInterval(breathRef.current); }, []);

  const breathColor: Record<BreathingStep, string> = { idle: CYAN, inhale: CYAN, hold: "#6366f1", exhale: "#34d399", done: CYAN };
  const breathLabel: Record<BreathingStep, string> = { idle: "", inhale: "Inspirez...", hold: "Retenez...", exhale: "Expirez...", done: "Bravo !" };

  const startBreathing = () => {
    let cycle = 1, step: BreathingStep = "inhale", timer = 5;
    setBreathStep("inhale"); setBreathCycle(1); setBreathTimer(5);
    const dur: Record<string, number> = { inhale: 5, hold: 4, exhale: 5 };
    const interval = setInterval(() => {
      timer--; setBreathTimer(timer);
      if (timer <= 0) {
        if (step === "inhale") { step = "hold"; timer = dur.hold; setBreathStep("hold"); setBreathTimer(timer); }
        else if (step === "hold") { step = "exhale"; timer = dur.exhale; setBreathStep("exhale"); setBreathTimer(timer); }
        else { cycle++; if (cycle <= 5) { step = "inhale"; timer = dur.inhale; setBreathStep("inhale"); setBreathCycle(cycle); setBreathTimer(timer); } else { setBreathStep("done"); clearInterval(interval); } }
      }
    }, 1000);
    breathRef.current = interval;
  };

  const finishExercise = () => {
    const msg = generateCelebration(firstName, toolId);
    setCelebrationMsg(msg);
    setPhase("done");
    void onComplete(toolId);
  };

  const introMsg = toolData?.twin_message || (() => {
    const v = TOOL_VARIANTS[toolId] ?? ["Prenons un moment ensemble."];
    return v[Math.floor(Math.random() * v.length)];
  })();

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
  const scriptSteps = Object.values(toolData?.tool_script ?? {});

  const renderExercise = () => {
    if (toolId === "breathing") return (
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>Respirer</p>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: TEXT_MUTED }}>5 cycles · 5s inhale · 4s pause · 5s exhale</p>
        {breathStep === "idle" && <><p style={{ fontSize: 13, color: TEXT_SECONDARY, marginBottom: 16, lineHeight: 1.7 }}>La cohérence cardiaque réduit le stress et les envies de grignoter.</p><button onClick={startBreathing} style={{ width: "100%", height: 44, borderRadius: 12, background: CYAN, border: "none", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Commencer</button></>}
        {breathStep !== "idle" && breathStep !== "done" && (<><p style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 12 }}>Cycle {breathCycle} / 5</p>
          <div style={{ width: 100, height: 100, borderRadius: "50%", margin: "0 auto 16px", background: `radial-gradient(circle, ${breathColor[breathStep]}18, transparent)`, border: `1.5px solid ${breathColor[breathStep]}44`, display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 1s ease", transform: breathStep === "inhale" ? "scale(1.15)" : breathStep === "exhale" ? "scale(0.88)" : "scale(1.05)" }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: breathColor[breathStep] }}>{breathTimer}</span>
          </div>
          <p style={{ fontSize: 18, fontWeight: 600, color: breathColor[breathStep], marginBottom: 12 }}>{breathLabel[breathStep]}</p></>)}
        {breathStep === "done" && <><p style={{ fontSize: 36, margin: "0 0 10px" }}>🎉</p><p style={{ fontSize: 14, color: TEXT_SECONDARY, marginBottom: 16 }}>Excellent ! Votre corps vous remercie. 🌿</p><button onClick={finishExercise} style={{ width: "100%", height: 44, borderRadius: 12, background: CYAN, border: "none", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Continuer →</button></>}
      </div>
    );

    if (toolId === "ancrage") return (
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>S'apaiser</p>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: TEXT_MUTED }}>Technique 5-4-3-2-1</p>
        {exStep < 5 ? (<><div style={{ fontSize: 36, marginBottom: 10 }}>{ancrageSteps[exStep].icon}</div>
          <div style={{ background: CYAN_DIM, borderRadius: 14, padding: "14px", marginBottom: 14, border: `1px solid ${CYAN_BORDER}` }}>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: CYAN }}>{ancrageSteps[exStep].count}</p>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: TEXT_PRIMARY }}>chose{ancrageSteps[exStep].count > 1 ? "s" : ""} que vous <strong>{ancrageSteps[exStep].sense}</strong></p>
          </div>
          <button onClick={() => { if (exStep < 4) setExStep(s => s + 1); else finishExercise(); }} style={{ width: "100%", height: 44, borderRadius: 12, background: CYAN, border: "none", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{exStep < 4 ? "Suivant →" : "Terminer"}</button></>
        ) : (<><p style={{ fontSize: 36, margin: "0 0 10px" }}>✨</p><p style={{ fontSize: 14, color: TEXT_SECONDARY, marginBottom: 14 }}>Ancré(e) dans le moment présent. 🌿</p><button onClick={finishExercise} style={{ width: "100%", height: 44, borderRadius: 12, background: CYAN, border: "none", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Continuer →</button></>)}
      </div>
    );

    if (toolId === "marche") return (
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>Se vider la tête</p>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: TEXT_MUTED }}>Étape {Math.min(exStep + 1, marcheSteps.length)} / {marcheSteps.length}</p>
        {exStep < marcheSteps.length ? (<>
          <div style={{ background: CYAN_DIM, borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${CYAN_BORDER}`, minHeight: 72, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ margin: 0, fontSize: 14, color: TEXT_PRIMARY, lineHeight: 1.7 }}>{marcheSteps[exStep]}</p>
          </div>
          <div style={{ height: 2, background: SURFACE, borderRadius: 1, marginBottom: 14 }}><div style={{ height: "100%", borderRadius: 1, background: CYAN, width: `${((exStep + 1) / marcheSteps.length) * 100}%`, transition: "width 0.3s" }} /></div>
          <button onClick={() => { if (exStep < marcheSteps.length - 1) setExStep(s => s + 1); else finishExercise(); }} style={{ width: "100%", height: 44, borderRadius: 12, background: CYAN, border: "none", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{exStep < marcheSteps.length - 1 ? "Suivant →" : "Terminer"}</button></>
        ) : (<><p style={{ fontSize: 36, margin: "0 0 10px" }}>🌿</p><p style={{ fontSize: 14, color: TEXT_SECONDARY, marginBottom: 14 }}>Belle promenade ! Chaque pas conscient est une victoire.</p><button onClick={finishExercise} style={{ width: "100%", height: 44, borderRadius: 12, background: CYAN, border: "none", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Continuer →</button></>)}
      </div>
    );

    // body_scan, manger, ecriture, defusion, adaptive_coaching — liste d'étapes
    const steps = scriptSteps.length > 0 ? scriptSteps : (() => {
      const defaults: Record<string, string[]> = {
        body_scan: ["Pose une main sur ton ventre. Ferme les yeux.", "Scan ton estomac : est-il vide, tendu, ou simplement agité ?", "Remonte vers ta gorge : y a-t-il une boule, une tension ?", "Observe ta tête : est-ce une pensée qui commande, ou ton corps ?", "Si c'est ton corps qui parle, mange. Si c'est ta tête, respire d'abord."],
        manger: ["Pose ton téléphone. Regarde ton assiette.", "Respire trois fois lentement avant de commencer.", "Prends une bouchée. Mâche 20 fois en comptant.", "Dépose tes couverts entre chaque bouchée.", "Remarque les saveurs. Mange jusqu'à satiété, pas jusqu'à vide."],
        ecriture: ["Prends une grande inspiration. Laisse venir.", "Écris sans filtre ce qui te pèse en ce moment.", "Ne te relis pas. Continue jusqu'à ce que la page soit pleine.", "Froisse le papier (ou efface) — c'est libéré. Personne ne lira.", "Observe : tu te sens plus léger(e) ?"],
        defusion: ["Identifie la pensée qui te pèse. Écris-la mentalement.", "Dis-toi : 'J'ai la pensée que...' plutôt que 'Je suis...'", "Imagine cette pensée comme un nuage qui passe dans le ciel.", "Répète-la avec une voix de personnage de dessin animé.", "Observe : tu n'es pas cette pensée. Elle passe."],
        adaptive_coaching: ["Prends une grande inspiration.", "Identifie la pensée qui te pèse.", "Questionne-la doucement : est-elle vraiment vraie ?", "Propose-toi une action simple et accessible.", "Reprends contact avec le moment présent."],
      };
      return defaults[toolId] ?? ["Respire. Tu as fait le bon choix.", "Chaque petit geste de soin compte.", "Tu prends soin de toi — c'est déjà une victoire."];
    })();

    return (
      <div>
        {toolId === "ecriture" && (
          <div style={{ background: CYAN_DIM, border: `1px solid ${CYAN_BORDER}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 12, color: CYAN, lineHeight: 1.6 }}>🔒 Ce que tu écris ici ne sera pas sauvegardé. C'est juste pour toi.</p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: CYAN_DIM, border: `1px solid ${CYAN_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: CYAN }}>{i + 1}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.6 }}>{step}</p>
            </div>
          ))}
        </div>
        {toolId === "ecriture" && (
          <textarea placeholder="Écris tout ce qui te pèse... sans filtre, sans jugement." rows={5}
            style={{ width: "100%", borderRadius: 10, border: `1px solid ${CYAN_BORDER}`, background: "rgba(6,182,212,0.03)", color: TEXT_PRIMARY, padding: "12px", fontSize: 13, outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box", marginBottom: 14 }} />
        )}
        <button onClick={finishExercise} style={{ width: "100%", height: 44, borderRadius: 12, background: CYAN, border: "none", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          {toolId === "manger" ? "Bon appétit 🌿" : toolId === "ecriture" ? "J'ai vidé mon sac 🌿" : "Terminer 🌿"}
        </button>
      </div>
    );
  };

  const containerStyle: React.CSSProperties = {
    background: "#060f14",
    border: `1px solid ${CYAN_BORDER}`,
    borderRadius: 20,
    padding: "18px 20px",
    maxWidth: 460,
    animation: "fadeUp 0.3s ease",
    opacity: frozen && phase !== "done" ? 0.6 : 1,
  };

  // ─── Phase: exercise ───
  if (phase === "exercise") return (
    <div style={containerStyle}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, padding: "9px 12px", background: CYAN_DIM, borderRadius: 10, border: `1px solid ${CYAN_BORDER}` }}>
        <LeafIcon size={13} color={CYAN} />
        <p style={{ margin: 0, fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.55 }}>{introMsg}</p>
      </div>
      {renderExercise()}
    </div>
  );

  // ─── Phase: done (gelé) ───
  return (
    <div style={{ ...containerStyle, cursor: "default" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: celebrationMsg ? 12 : 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: CYAN_DIM, border: `1px solid ${CYAN_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🌟</div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>Exercice terminé</p>
      </div>
      {celebrationMsg && <p style={{ margin: 0, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.7 }}>{celebrationMsg}</p>}
    </div>
  );
};

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const scrollContainerRef = useRef<HTMLElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // ─── Swipe mobile ───
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const swipeIntentRef = useRef<"horizontal" | "vertical" | null>(null);
  const mainAreaRef = useRef<HTMLDivElement>(null);
  // ─── Scroll-to-bottom ───
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  // ─── Typewriter refs ───
  const targetTextRef = useRef<string>("");
  const displayedLenRef = useRef<number>(0);
  const streamDoneRef = useRef<boolean>(false);
  const typewriterRafRef = useRef<number | null>(null);
  const hasMessages = messages.filter(m => !m.hidden).length > 0;
  const sidebarWidth = 305;
  const [showPreemptiveSOS, setShowPreemptiveSOS] = useState(false);
  const [showToast, setShowToast] = useState(false);
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
  const [pinnedMessage, setPinnedMessage] = useState<{ text: string; sent_at: string; practitioner_id: string } | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [savingPatientProfile, setSavingPatientProfile] = useState(false);
  const [patientProfileSaved, setPatientProfileSaved] = useState(false);
  const [exportingRGPD, setExportingRGPD] = useState(false);
  const patientAvatarRef = useRef<HTMLInputElement>(null);
  const [emotionalStatus, setEmotionalStatus] = useState<"green" | "red_behavioral" | "red_critical">("green");
  const [showSasButtons, setShowSasButtons] = useState(false);
  const [showSOSTriageModal, setShowSOSTriageModal] = useState(false);
  const [selectedTriageCtx, setSelectedTriageCtx] = useState("");
  const [showToolDuo, setShowToolDuo] = useState(false);
  const [postExerciseStep, setPostExerciseStep] = useState<{ toolId: string; answer: string } | null>(null);
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

  // Scroll vers le bas : instantané pendant le stream (60fps typewriter), smooth quand loading s'arrête
  useEffect(() => {
    if (loading) {
      const el = scrollContainerRef.current;
      if (!el) return;
      const id = setInterval(() => { el.scrollTop = el.scrollHeight; }, 32);
      return () => clearInterval(id);
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [loading]);
  // Scroll immédiat pour les changements non-stream (chargement session, navigation)
  useEffect(() => { if (!loading) messagesEndRef.current?.scrollIntoView({ behavior: "instant" }); }, [messages, loading]);

  useEffect(() => {
    const check = () => { const m = window.innerWidth < 768; setIsMobile(m); if (m) setSidebarOpen(false); };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ─── Swipe non-passif : verrou directionnel dès les premiers pixels ───
  useEffect(() => {
    const el = mainAreaRef.current;
    if (!el) return;
    const handleTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - touchStartXRef.current;
      const dy = e.touches[0].clientY - touchStartYRef.current;
      if (!swipeIntentRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        swipeIntentRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (swipeIntentRef.current === "horizontal") e.preventDefault();
    };
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => el.removeEventListener("touchmove", handleTouchMove);
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
      const { data: pat } = await supabase.from("patients").select("first_name, last_name, onboarding_done, emotional_status, practitioner_pinned_message").eq("user_id", data.user.id).single();
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
        const ppm = (p as { practitioner_pinned_message?: { text: string; sent_at: string; practitioner_id: string } | null }).practitioner_pinned_message;
        if (ppm) setPinnedMessage(ppm);
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

  const closeTool = useCallback(() => {
    setActiveTool(null);
    setBreathingStep("idle"); setBreathingCycle(0); setBreathingTimer(0);
    if (breathingIntervalRef.current) clearInterval(breathingIntervalRef.current);
    setAncrageStep(0); setMarcheStep(0);
  }, []);

  // ─── Exercice terminé : ferme la modale + follow-up IA via canal dédié ───
  // N'utilise PAS send() pour éviter :
  //   - l'affichage du message système dans le fil patient
  //   - le déclenchement de l'analyse de crise
  //   - la mise à jour prématurée de emotional_status en BDD
  // Appelée par InlineWidget quand l'exercice se termine
  // → affiche le step post-exercice DANS la modale (pas d'injection dans le chat)
  const handleExerciseComplete = useCallback((toolId: string) => {
    setPostExerciseStep({ toolId, answer: "" });
  }, []);

  // Soumission de la réponse post-exercice depuis la modale
  const handlePostExerciseSubmit = useCallback(async () => {
    if (!postExerciseStep) return;
    const { toolId, answer } = postExerciseStep;
    setPostExerciseStep(null);
    closeTool();

    // Tracer l'événement SOS en arrière-plan (placeholder)
    if (patientId && practitionerIdFromDb) {
      fetch("/api/sos-feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, practitionerId: practitionerIdFromDb, eventId: null, stressBeforeProxy: 5, scoreAfter: 5, isPlaceholder: true }),
      }).catch(() => {});
    }

    // Envoyer la réponse au canal isPostExercise pour analyse Gemini (apaisement)
    // — traitement silencieux en arrière-plan, ne modifie pas l'UI chat
    if (patientId && practitionerIdFromDb && answer.trim()) {
      fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: answer.trim(),
          patientId,
          practitionerId: practitionerIdFromDb,
          isPostExercise: true,
        }),
      }).catch(() => {});
    }
  }, [postExerciseStep, patientId, practitionerIdFromDb, closeTool]);

  // ─── Sélection d'un outil dans le duo → modale plein écran ───
  const handleToolSelect = useCallback(async (toolId: string, sosContext: string) => {
    setShowToolDuo(false);
    const defaultData: ToolData = { tool_id: toolId, twin_message: getVariant(toolId), tool_script: {} };
    setActiveTool({ id: toolId, data: defaultData });
    // Fetch en arrière-plan pour personnaliser
    if (patientId && practitionerIdFromDb) {
      try {
        const res = await fetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "", patientId, practitionerId: practitionerIdFromDb, isSOS: true, sosContext: `${sosContext} | outil: ${toolId}` }),
        });
        const data = await res.json() as { tool?: ToolData };
        if (data.tool) {
          setActiveTool(prev => prev ? { ...prev, data: data.tool! } : prev);
        }
      } catch { /* garder données par défaut */ }
    }
  }, [patientId, practitionerIdFromDb, getVariant]);

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

  // handleSOS : appelé depuis la bannière préemptive → ouvre le triage
  const handleSOS = () => {
    setShowPreemptiveSOS(false);
    setShowSOSTriageModal(true);
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

  const send = async (text?: string, opts?: { hidden?: boolean }) => {
    const trimmed = (text ?? message).trim();
    if ((!trimmed && !pendingImage) || loading) return;
    const img = pendingImage;
    const userMsg: ChatMessage = { role: "user", content: trimmed || "📷 Photo de repas", imageUrl: img?.previewUrl, ...(opts?.hidden ? { hidden: true } : {}) };
    const newMessages: ChatMessage[] = [...messages, userMsg];
    const assistantIndex = newMessages.length;
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setMessage(""); setPendingImage(null); setLoading(true);
    abortControllerRef.current = new AbortController();

    // ─── Reset typewriter ───
    if (typewriterRafRef.current !== null) { cancelAnimationFrame(typewriterRafRef.current); typewriterRafRef.current = null; }
    targetTextRef.current = "";
    displayedLenRef.current = 0;
    streamDoneRef.current = false;

    // ─── RAF tick : avance de 4 chars/frame ≈ 240 chars/sec à 60fps ───
    const CHARS_PER_FRAME = 4;
    const tick = () => {
      const target = targetTextRef.current;
      const cur = displayedLenRef.current;
      if (cur < target.length) {
        const next = Math.min(cur + CHARS_PER_FRAME, target.length);
        displayedLenRef.current = next;
        setMessages(prev => {
          const u = [...prev];
          if (u[assistantIndex]) u[assistantIndex] = { ...u[assistantIndex], content: target.slice(0, next) };
          return u;
        });
      }
      // Continue tant que le stream n'est pas terminé OU qu'on n'a pas tout affiché
      if (!streamDoneRef.current || displayedLenRef.current < targetTextRef.current.length) {
        typewriterRafRef.current = requestAnimationFrame(tick);
      } else {
        typewriterRafRef.current = null;
      }
    };
    typewriterRafRef.current = requestAnimationFrame(tick);

    try {
      const body: Record<string, string | undefined> = { message: trimmed || "Analyse cette photo", patientId: patientId ?? undefined, practitionerId: practitionerIdFromDb ?? undefined };
      if (img) { body.imageBase64 = img.base64; body.imageMimeType = img.mimeType; }
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: abortControllerRef.current.signal });
      if (!res.ok || !res.body) throw new Error("Erreur");

      // ─── Stream : mise à jour cible uniquement, le RAF affiche ───
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let fullText = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        fullText += decoder.decode(value, { stream: true });
        targetTextRef.current = fullText.replace(/\|\|\|[\s\S]*?\|\|\|/g, "").trim();
      }

      // ─── Stream terminé : attendre que le typewriter finisse ───
      streamDoneRef.current = true;
      await new Promise<void>(resolve => {
        const waitForTypewriter = () => {
          if (displayedLenRef.current >= targetTextRef.current.length) { resolve(); }
          else { setTimeout(waitForTypewriter, 16); }
        };
        waitForTypewriter();
      });

      // ─── Signaux post-stream ───
      if (fullText.includes("|||SAS|||")) { setShowSasButtons(true); }
      const statusMatch = fullText.match(/\|\|\|([\s\S]*?)\|\|\|/);
      if (statusMatch) {
        try {
          const parsed = JSON.parse(statusMatch[1]) as { status: string };
          if (parsed.status === "red_critical") { setEmotionalStatus("red_critical"); }
          else if (parsed.status === "red_behavioral") { setEmotionalStatus("red_behavioral"); if (!activeTool) setShowPreemptiveSOS(true); }
          else if (parsed.status === "red" && !activeTool) { setShowPreemptiveSOS(true); }
        } catch { /* silencieux */ }
      }
    } catch (err) {
      // ─── Abort ou erreur réseau : stopper le typewriter ───
      if (typewriterRafRef.current !== null) { cancelAnimationFrame(typewriterRafRef.current); typewriterRafRef.current = null; }
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

  const breathingColor: Record<BreathingStep, string> = { idle: ACCENT, inhale: ACCENT, hold: "#6366f1", exhale: "#34d399", done: ACCENT };
  const breathingLabel: Record<BreathingStep, string> = { idle: "", inhale: "Inspirez...", hold: "Retenez...", exhale: "Expirez...", done: "Bravo !" };
  const visibleMessages = messages.filter(m => !m.hidden && !m.content.startsWith("[INFO SYSTÈME") && !m.content.startsWith("[POST_EXERCICE"));

  // Modale plein écran pour tous les outils Mon Soutien
  const renderTool = () => {
    if (!activeTool) return null;
    if (activeTool.id === "journal") {
      return <JournalModal patientId={patientId} practitionerId={practitionerIdFromDb} onClose={() => closeTool()} />;
    }
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(4,10,16,0.96)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: isMobile ? "20px 16px" : "24px" }}>
        {/* Bouton fermer — masqué pendant le step post-exercice */}
        {!postExerciseStep && (
          <button onClick={() => closeTool()} style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_MUTED, fontSize: 20, lineHeight: 1 }}>×</button>
        )}
        <div style={{ width: "100%", maxWidth: 440 }}>
          {postExerciseStep ? (
            /* ─── Step post-exercice : question de ressenti à l'intérieur de la modale ─── */
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🌿</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#e2e8f0" }}>
                Bravo pour ce moment de soin
              </h2>
              <p style={{ margin: "0 0 24px", fontSize: 15, color: "#94a3b8", lineHeight: 1.6 }}>
                Comment tu te sens dans ton corps et dans ta tête là, tout de suite ?
              </p>
              <textarea
                autoFocus
                value={postExerciseStep.answer}
                onChange={e => setPostExerciseStep(prev => prev ? { ...prev, answer: e.target.value } : null)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handlePostExerciseSubmit(); } }}
                placeholder="Décris ce que tu ressens…"
                rows={3}
                style={{ width: "100%", borderRadius: 12, border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.04)", color: "#e2e8f0", padding: "12px 14px", fontSize: 15, outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6, marginBottom: 12 }}
                onFocus={e => { e.target.style.borderColor = "rgba(16,185,129,0.5)"; }}
                onBlur={e => { e.target.style.borderColor = "rgba(16,185,129,0.25)"; }}
              />
              <button
                onClick={() => void handlePostExerciseSubmit()}
                disabled={!postExerciseStep.answer.trim()}
                style={{ width: "100%", height: 46, borderRadius: 12, background: postExerciseStep.answer.trim() ? "#10b981" : "rgba(16,185,129,0.2)", border: "none", color: postExerciseStep.answer.trim() ? "black" : "#64748b", fontSize: 15, fontWeight: 700, cursor: postExerciseStep.answer.trim() ? "pointer" : "default", transition: "all 0.2s" }}>
                Valider →
              </button>
              <button
                onClick={() => void handlePostExerciseSubmit()}
                style={{ marginTop: 10, background: "none", border: "none", color: "#475569", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
                Passer
              </button>
            </div>
          ) : (
            /* ─── Exercice normal ─── */
            <InlineWidget
              toolId={activeTool.id}
              toolData={activeTool.data}
              firstName={patientFirstName}
              frozen={false}
              onComplete={handleExerciseComplete}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* DM Sans — chargé uniquement pour le chat */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet" />
    <div style={{ height: "100dvh", background: BG_MAIN, fontFamily: "'DM Sans', -apple-system, sans-serif", display: "flex", color: TEXT_PRIMARY, overflow: "hidden" }}>

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

      {/* ═══ MODALE DUO D'OUTILS ═══ */}
      {showToolDuo && (() => {
        const duos = TOOL_DUOS[selectedTriageCtx] ?? TOOL_DUOS["stress"];
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "#060d14", borderRadius: 24, padding: "28px 24px", width: "100%", maxWidth: 400, border: `1px solid ${CYAN_BORDER}`, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", animation: "fadeUp 0.3s ease" }}>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: CYAN_DIM, border: `1px solid ${CYAN_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  {TRIAGE_ICONS[selectedTriageCtx] ?? <IconActivity size={22} color={CYAN} />}
                </div>
                <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: TEXT_PRIMARY }}>Qu'est-ce qui te parle le mieux ?</h3>
                <p style={{ margin: 0, fontSize: 13, color: TEXT_SECONDARY }}>Choisis l'exercice qui te semble le plus accessible</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                {duos.map(tool => (
                  <button key={tool.id}
                    onClick={() => void handleToolSelect(tool.id, selectedTriageCtx)}
                    style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", borderRadius: 16, background: "rgba(6,182,212,0.04)", border: "1px solid rgba(6,182,212,0.12)", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = CYAN_DIM; e.currentTarget.style.borderColor = CYAN_BORDER; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(6,182,212,0.04)"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.12)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: CYAN_DIM, border: `1px solid ${CYAN_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {TOOL_SVG_ICONS[tool.id] ?? <IconStar size={28} color={CYAN} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>{tool.label}</p>
                      <p style={{ margin: 0, fontSize: 12, color: TEXT_MUTED }}>{tool.desc}</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" stroke={TEXT_MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
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

      {/* ═══ SAS DE DÉCOMPRESSION ═══ */}
      {showSasButtons && !activeTool && (
        <div style={{ position: "fixed", bottom: hasMessages ? 110 : 190, left: "50%", transform: "translateX(-50%)", zIndex: 91, width: "calc(100% - 32px)", maxWidth: 520, background: "#0a0f0c", borderRadius: 18, border: `1px solid ${ACCENT_BORDER}`, padding: "16px 18px", boxShadow: "0 8px 36px rgba(16,185,129,0.08), 0 8px 32px rgba(0,0,0,0.5)", animation: "fadeUp 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 17 }}>🌊</div>
            <p style={{ margin: 0, fontSize: 13, color: TEXT_PRIMARY, lineHeight: 1.55 }}>
              On se retrouve après notre discussion d'hier. Comment tu souhaites avancer aujourd'hui ?
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => void handleSasReprendreFile()}
              style={{ flex: 1, height: 40, borderRadius: 12, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)", color: "#6ee7b7", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.25)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.55)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.15)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.35)"; }}>
              ✦ Reprendre le fil
            </button>
            <button
              onClick={() => void handleSasResterSafe()}
              style={{ flex: 1, height: 40, borderRadius: 12, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.15)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = ACCENT_DIM; e.currentTarget.style.borderColor = ACCENT_BORDER; }}>
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
          <div style={{ background: "#060d14", borderRadius: 24, padding: "28px 24px", width: "100%", maxWidth: 400, border: `1px solid ${CYAN_BORDER}`, boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: CYAN_DIM, border: `1px solid ${CYAN_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <IconActivity size={22} color={CYAN} />
              </div>
              <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY }}>Comment puis-je vous aider ?</h3>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_SECONDARY }}>Choisissez ce qui correspond le mieux à ce que vous ressentez</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { key: "fringale", label: "Fringale / Impulsion alimentaire", ctx: "fringale", desc: "Envie soudaine, compulsion, difficulté à résister" },
                { key: "stress", label: "Pic de stress / Anxiété forte", ctx: "stress", desc: "Tension, agitation, sensation d'être dépassé(e)" },
                { key: "culpabilité", label: "Culpabilité / Ruminations", ctx: "culpabilité", desc: "Pensées négatives qui tournent en boucle" },
                { key: "coup de mou", label: "Coup de mou / Baisse de régime", ctx: "coup de mou", desc: "Fatigue, découragement, manque d'élan" },
              ].map(({ key, label, ctx, desc }) => (
                <button key={ctx} onClick={() => { setShowSOSTriageModal(false); setSelectedTriageCtx(ctx); setShowToolDuo(true); }}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}`, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = CYAN_DIM; e.currentTarget.style.borderColor = CYAN_BORDER; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = BORDER; }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: CYAN_DIM, border: `1px solid ${CYAN_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {TRIAGE_ICONS[key]}
                  </div>
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

      {sidebarOpen && isMobile && <div
        onClick={() => setSidebarOpen(false)}
        onTouchStart={e => { touchStartXRef.current = e.touches[0].clientX; touchStartYRef.current = e.touches[0].clientY; swipeIntentRef.current = null; }}
        onTouchEnd={e => {
          const dx = e.changedTouches[0].clientX - touchStartXRef.current;
          const dy = Math.abs(e.changedTouches[0].clientY - touchStartYRef.current);
          if (dx < -40 && dy < 80) setSidebarOpen(false);
        }}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 20 }} />}

      {/* ═══ SIDEBAR ═══ */}
      <aside style={{ width: sidebarOpen ? (isMobile ? "80vw" : sidebarWidth) : 0, minWidth: sidebarOpen ? (isMobile ? "80vw" : sidebarWidth) : 0, background: "linear-gradient(180deg, #0b1a14 0%, #090f0c 50%, #070c0a 100%)", display: "flex", flexDirection: "column", position: isMobile ? "fixed" : "relative", top: 0, left: 0, height: "100dvh", zIndex: isMobile ? 30 : 1, transition: "width 0.25s ease, min-width 0.25s ease", overflow: "hidden", flexShrink: 0, boxShadow: "4px 0 24px rgba(0,0,0,0.5)", borderRight: "1px solid rgba(16,185,129,0.08)", }}>
        <div style={{ width: isMobile ? "80vw" : sidebarWidth, display: "flex", flexDirection: "column", height: "100%", padding: "0 12px" }}>

          {/* Header sidebar */}
          <div style={{ height: 64, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", borderBottom: "1px solid rgba(16,185,129,0.12)", margin: "0 -12px", marginBottom: 16, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.6px", lineHeight: 1 }}>
                Nutri<span style={{ color: ACCENT, textShadow: "0 0 18px rgba(16,185,129,0.35)" }}>Twin</span>
              </p>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={TEXT_SECONDARY} strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* ═══ MON SOUTIEN — Bouton ═══ */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => { if (emotionalStatus === "red_critical") return; setShowSOSTriageModal(true); if (isMobile) setSidebarOpen(false); }}
              disabled={sosLoading || emotionalStatus === "red_critical"}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 14, background: "rgba(6,182,212,0.07)", border: "1px solid rgba(6,182,212,0.25)", cursor: sosLoading ? "not-allowed" : "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { if (!sosLoading) { e.currentTarget.style.background = "rgba(6,182,212,0.13)"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.42)"; } }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(6,182,212,0.07)"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.25)"; }}>
              {sosLoading ? (
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${CYAN_DIM}`, borderTop: `2px solid ${CYAN}`, animation: "spin 1s linear infinite", flexShrink: 0 }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill={CYAN} stroke={CYAN} strokeWidth="0.5" style={{ flexShrink: 0, filter: "drop-shadow(0 0 5px rgba(6,182,212,0.4))" }}>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              )}
              <div style={{ textAlign: "left", flex: 1, position: "relative" }}>
                <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: "#cffafe", letterSpacing: "-0.2px" }}>{sosLoading ? "En route..." : "Mon Soutien"}</p>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(6,182,212,0.65)", lineHeight: 1.5 }}>Aide immédiate</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}><path d="M9 18l6-6-6-6" stroke={CYAN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
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

          {/* ═══ SIDEBAR BOTTOM — Avatar + Settings ═══ */}
          <div style={{ padding: "12px 4px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, margin: "0 -12px", paddingLeft: 16, paddingRight: 12, flexShrink: 0 }}>
            <button onClick={() => setShowProfileModal(true)}
              style={{ width: 38, height: 38, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #10b981, #059669)", border: "2px solid rgba(16,185,129,0.35)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "black", flexShrink: 0, boxShadow: "0 0 10px rgba(16,185,129,0.15)", transition: "box-shadow 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 16px rgba(16,185,129,0.35)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 0 10px rgba(16,185,129,0.15)"}>
              {patientInitials}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: TEXT_PRIMARY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{patientFirstName || "Patient"}</p>
              <p style={{ margin: 0, fontSize: 10, color: TEXT_MUTED }}>Mon profil</p>
            </div>
            <button onClick={() => setShowProfileModal(true)} style={{ width: 30, height: 30, borderRadius: 8, background: "transparent", border: `1px solid ${BORDER}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = SURFACE; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = BORDER; }}>
              <SettingsIcon size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ═══ ZONE PRINCIPALE ═══ */}
      <div ref={mainAreaRef} style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, touchAction: "pan-y" }}
        onTouchStart={e => {
          touchStartXRef.current = e.touches[0].clientX;
          touchStartYRef.current = e.touches[0].clientY;
          swipeIntentRef.current = null;
        }}
        onTouchEnd={e => {
          if (swipeIntentRef.current !== "horizontal") return;
          const dx = e.changedTouches[0].clientX - touchStartXRef.current;
          if (dx > 50 && !sidebarOpen) setSidebarOpen(true);
          if (dx < -50 && sidebarOpen) setSidebarOpen(false);
        }}>

        <header style={{ background: "rgba(8,14,11,0.78)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 16px", height: 64, display: "flex", alignItems: "center", gap: 10, flexShrink: 0, position: "sticky", top: 0, zIndex: 10 }}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}>
              <MenuIcon size={17} />
            </button>
          )}
          {isMobile && sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <MenuIcon size={16} />
            </button>
          )}
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            {hasMessages && (
              <div>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: TEXT_PRIMARY, lineHeight: 1.3 }}>Votre compagnon de suivi</p>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: ACCENT, animation: "breathe 3s ease-in-out infinite" }} />
                  <span style={{ fontSize: 11, color: ACCENT, fontWeight: 500 }}>{loading ? "En train de réfléchir..." : "À votre écoute"}</span>
                </div>
              </div>
            )}
          </div>
        </header>

        <main ref={scrollContainerRef} style={{ flex: 1, overflowY: "auto", overscrollBehaviorX: "none", display: "flex", flexDirection: "column", paddingBottom: isMobile ? 100 : 0 }}
          onScroll={e => {
            const el = e.currentTarget;
            setShowScrollBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 220);
          }}>
          {/* ═══ BANDEAU POST-IT PRATICIEN ═══ */}
          {pinnedMessage && (
            <div style={{ position: "sticky", top: 0, zIndex: 30, margin: "0 0 0 0", background: "rgba(16,185,129,0.06)", borderBottom: "1px solid rgba(16,185,129,0.2)", backdropFilter: "blur(12px)", padding: "10px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📌</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 600, color: "rgba(16,185,129,0.7)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Message de votre praticien</p>
                <p style={{ margin: 0, fontSize: 14, color: "#e2e8f0", lineHeight: 1.6 }}>{pinnedMessage.text}</p>
              </div>
              <button
                onClick={async () => {
                  setPinnedMessage(null);
                  if (patientId) {
                    fetch("/api/dismiss-pinned-message", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ patientId }),
                    }).catch(() => {});
                  }
                }}
                style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 8, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "rgba(16,185,129,0.85)", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", marginTop: 2 }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(16,185,129,0.22)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(16,185,129,0.12)"}>
                Lu ✓
              </button>
            </div>
          )}
          {!hasMessages && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: isMobile ? "24px 16px 100px" : "32px 24px 100px" }}>
              <div style={{ maxWidth: 580, width: "100%", textAlign: "center" }}>
                <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 24px" }}>
                  {/* Halo cyan externe — léger, décalé de phase */}
                  <div style={{ position: "absolute", inset: -24, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.07), transparent 62%)", animation: "glow-idle 4s ease-in-out infinite", animationDelay: "1.4s", pointerEvents: "none" }} />
                  {/* Halo vert interne — existant */}
                  <div style={{ position: "absolute", inset: -12, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.18), transparent 70%)", animation: "glow-idle 3s ease-in-out infinite" }} />
                  {/* Cercle principal avec bordure dégradée vert→cyan */}
                  <div style={{ width: 64, height: 64, borderRadius: "50%", border: "1.5px solid transparent", background: "linear-gradient(#080e0b, #080e0b) padding-box, linear-gradient(135deg, rgba(16,185,129,0.65), rgba(52,211,153,0.45)) border-box", boxShadow: "0 0 20px rgba(16,185,129,0.12), 0 0 36px rgba(16,185,129,0.06)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", fontSize: 28 }}>🌿</div>
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
                      style={{ background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 28, padding: "9px 18px", fontSize: isMobile ? 13 : 14, color: TEXT_SECONDARY, cursor: "pointer", transition: "all 0.25s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.14)"; e.currentTarget.style.color = ACCENT; e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(16,185,129,0.12)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = ACCENT_DIM; e.currentTarget.style.color = TEXT_SECONDARY; e.currentTarget.style.borderColor = ACCENT_BORDER; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {hasMessages && (
            <div style={{ flex: 1, padding: isMobile ? "16px 16px 80px" : "24px 36px 80px" }}>
              <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20, touchAction: "auto" }}>
                {visibleMessages.map((msg, index) => {
                  const isUser = msg.role === "user";
                  const isLastAssistant = msg.role === "assistant" && index === visibleMessages.length - 1;
                  if (msg.role === "assistant" && !msg.content && isLastAssistant) {
                    return (
                      <div key={index} ref={el => { messageRefs.current[index] = el; }}
                        style={{ display: "flex", alignItems: "flex-start", animation: "fadeUp 0.3s ease", paddingLeft: 38 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
                          <div className="nt-skeleton" style={{ height: 12, width: isMobile ? 200 : 240, borderRadius: 6 }} />
                          <div className="nt-skeleton nt-skeleton-2" style={{ height: 12, width: isMobile ? 155 : 185, borderRadius: 6 }} />
                          <div className="nt-skeleton nt-skeleton-3" style={{ height: 12, width: isMobile ? 178 : 210, borderRadius: 6 }} />
                        </div>
                      </div>
                    );
                  }
                  const q = chatSearch.trim().toLowerCase();
                  const matchIndices = q ? visibleMessages.reduce<number[]>((acc, m, i) => { if (m.content.toLowerCase().includes(q)) acc.push(i); return acc; }, []) : [];
                  const isChatMatch = q && msg.content.toLowerCase().includes(q);
                  const isActiveMatch = matchIndices[Math.min(chatSearchIdx, matchIndices.length - 1)] === index;
                  return (
                    <div key={index} ref={el => { messageRefs.current[index] = el; }}
                      style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", alignItems: isUser ? "flex-end" : "flex-start", gap: 0, animation: "fadeUp 0.25s ease", transition: "opacity 0.2s", opacity: q && !isChatMatch ? 0.35 : 1 }}>
                      <div style={{ maxWidth: isUser ? (isMobile ? "82%" : "65%") : "100%" }}>
                        {msg.imageUrl && (
                          <div style={{ marginBottom: 6, display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                            <img src={msg.imageUrl} alt="Photo" style={{ maxWidth: isMobile ? 160 : 200, maxHeight: isMobile ? 160 : 200, borderRadius: 14, objectFit: "cover", border: `1px solid ${ACCENT_BORDER}` }} />
                          </div>
                        )}
                        {isUser ? (
                          <div style={{ padding: isMobile ? "10px 16px" : "11px 18px", borderRadius: 18, background: isActiveMatch ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.07)", color: TEXT_PRIMARY, fontSize: 15, lineHeight: 1.7, border: isActiveMatch ? `1.5px solid ${ACCENT}` : "1px solid rgba(255,255,255,0.1)", boxShadow: "none", transition: "all 0.3s" }}>
                            {msg.content}
                          </div>
                        ) : (
                          <div style={{ padding: "2px 0", background: "transparent", color: TEXT_PRIMARY, fontSize: 15, lineHeight: 1.7, border: isActiveMatch ? `1px solid rgba(16,185,129,0.4)` : "none", borderRadius: isActiveMatch ? 10 : 0, paddingLeft: isActiveMatch ? 10 : 0, boxShadow: isActiveMatch ? `0 0 0 3px rgba(16,185,129,0.07)` : "none", transition: "all 0.3s" }}>
                            {msg.content}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <button onClick={stopGeneration}
                    style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 10, background: "transparent", border: `1px solid rgba(255,255,255,0.08)`, cursor: "pointer", color: TEXT_MUTED, fontSize: 11, transition: "all 0.2s", marginTop: -4 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(244,63,94,0.3)"; e.currentTarget.style.color = "#f87171"; e.currentTarget.style.background = "rgba(244,63,94,0.04)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = TEXT_MUTED; e.currentTarget.style.background = "transparent"; }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    Arrêter
                  </button>
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
          <div style={{
            position: isMobile ? "fixed" : "static",
            bottom: 0, left: 0, right: 0,
            zIndex: isMobile ? 25 : "auto",
            background: "rgba(7,12,10,0.78)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: isMobile ? "12px 12px" : "14px 20px",
            paddingBottom: `max(${isMobile ? "16px" : "14px"}, env(safe-area-inset-bottom, 0px))`,
            opacity: sidebarOpen && isMobile ? 0.4 : 1,
            pointerEvents: sidebarOpen && isMobile ? "none" : "auto",
            transition: "opacity 0.25s",
            paddingLeft: isMobile ? "max(12px, env(safe-area-inset-left, 0px))" : undefined,
            paddingRight: isMobile ? "max(12px, env(safe-area-inset-right, 0px))" : undefined,
            flexShrink: 0,
          }}>
            <div style={{ maxWidth: 768, margin: "0 auto" }}>
              {pendingImage && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img src={pendingImage.previewUrl} alt="Preview" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: `1px solid ${ACCENT_BORDER}` }} />
                    <p style={{ margin: 0, fontSize: 12, color: TEXT_SECONDARY }}>Photo prête</p>
                    <button onClick={() => setPendingImage(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: TEXT_SECONDARY, fontSize: 18 }}>×</button>
                  </div>
                </div>
              )}
              {imageCompressing && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ height: 2, background: SURFACE, borderRadius: 1 }}>
                    <div style={{ height: "100%", background: ACCENT, borderRadius: 1, width: `${compressionProgress}%`, transition: "width 0.1s" }} />
                  </div>
                </div>
              )}
              <InputBar isCenter={false} message={message} setMessage={setMessage} send={send} loading={loading} pendingImage={pendingImage} photoHovered={photoHovered} setPhotoHovered={setPhotoHovered} handleImageClick={handleImageClick} handleKeyDown={handleKeyDown} inputRef={inputRef} />
              <p style={{ margin: "5px 0 0", fontSize: 10, color: TEXT_MUTED, textAlign: "center", whiteSpace: "nowrap" }}>
                NutriTwin est une IA · En cas de doute, consultez votre praticien
              </p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} style={{ display: "none" }} />
          </div>
        )}

        {/* ─── Bouton scroll-to-bottom ─── */}
        {showScrollBottom && hasMessages && (
          <button
            onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
            style={{ position: "fixed", bottom: isMobile ? 100 : 80, left: "50%", transform: "translateX(-50%)", zIndex: 26, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.07)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(16,185,129,0.35)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 18px rgba(0,0,0,0.25)", transition: "all 0.2s", color: ACCENT }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.transform = "translateX(-50%) translateY(2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.35)"; e.currentTarget.style.transform = "translateX(-50%)"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
          </button>
        )}
      </div>

      {/* Toast supprimé — le ressenti post-exercice est maintenant recueilli dans la modale */}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes glow-idle { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.1); } }
        @keyframes glow-sos { 0%, 100% { box-shadow: 0 0 16px rgba(16,185,129,0.25), inset 0 0 10px rgba(16,185,129,0.08); } 50% { box-shadow: 0 0 28px rgba(16,185,129,0.45), inset 0 0 14px rgba(16,185,129,0.15); } }
        @keyframes breathe { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(0.75); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .nt-inputbar:focus-within { border-color: rgba(16,185,129,0.45) !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.06), 0 0 16px rgba(16,185,129,0.06) !important; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes nt-pulse { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.65; } }
        .nt-skeleton { background: linear-gradient(90deg, rgba(16,185,129,0.08), rgba(30,50,38,0.55), rgba(16,185,129,0.06)); animation: nt-pulse 1.7s ease-in-out infinite; }
        .nt-skeleton-2 { animation-delay: 0.18s; }
        .nt-skeleton-3 { animation-delay: 0.36s; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }
        input::placeholder, textarea::placeholder { color: #475569; }
        @media (max-width: 767px) { .chat-input { font-size: 16px !important; } }
      `}</style>
    </div>
    </>
  );
}
