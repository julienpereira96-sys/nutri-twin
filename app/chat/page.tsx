"use client";

import { KeyboardEvent, useState, useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import JournalModal from "./JournalModal";
import BreathingExercise from "./BreathingExercise";
import AncrageExercise from "./AncrageExercise";
import MindfulEating from "./MindfulEating";
import EcritureExercise from "./EcritureExercise";
import DefusionExercise from "./DefusionExercise";
import SOSExercise from "./SOSExercise";
import PwaInstallPrompt from "./PwaInstallPrompt";
import MicConsentOverlay from "./MicConsentOverlay";
import { useTherapeuticVoice } from "@/hooks/useTherapeuticVoice";
import { useMicPermission, hasMicConsent, markMicConsent } from "@/hooks/useMicPermission";
import { mergeSosClosures, type SosClosureEvent, type SosSummary } from "@/lib/sosClosures";
import {
  IconCheckRing,
  IconWave,
  IconAward,
  IconSiren,
  IconPin,
} from "./SosIcons";

type ChatMessage = {
  role: "user" | "assistant" | "widget";
  content: string;
  imageUrl?: string;
  hidden?: boolean;
  /** Set when Gemini detected acute distress — two exercise IDs to offer */
  sosTrigger?: [string, string];
  /** role "widget" — carte de notification "Exercice SOS terminé" */
  sosSummary?: SosSummary;
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
const ACCENT_DIM = "rgba(16,185,129,0.08)";
const ACCENT_BORDER = "rgba(16,185,129,0.18)";
// Couleurs thérapeutiques Mon Soutien — cobalt/cyan
const CYAN = "#06b6d4";
const CYAN_DIM = "rgba(6,182,212,0.08)";
const CYAN_BORDER = "rgba(6,182,212,0.18)";
const SURFACE = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.07)";
const TEXT_PRIMARY = "rgba(255,255,255,0.88)";
const TEXT_SECONDARY = "rgba(255,255,255,0.45)";
const TEXT_MUTED = "rgba(255,255,255,0.22)";
const BG_MAIN = "#0b0f0d";
// Direction artistique — émeraude unifié

const quickActions = [
  "J'ai craqué ce soir, que faire ?",
  "Pourquoi j'ai encore faim après avoir mangé ?",
  "Que manger quand je rentre tard ?",
  "Comment résister à une fringale ?",
  "Comment rester motivé ?",
  "Pourquoi je ne vois pas de résultats ?",
];

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
const IconStar = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const IconLeaf2 = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
  </svg>
);

const TOOL_SVG_ICONS: Record<string, React.ReactElement> = {
  manger: <IconLeaf2 size={28} color={CYAN} />,
  breathing: <IconWind size={28} color={CYAN} />,
  ancrage: <IconEye size={28} color={CYAN} />,
  ecriture: <IconPen size={28} color={CYAN} />,
  defusion: <IconLayers size={28} color={CYAN} />,
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
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><LeafIcon size={Math.round(size * 0.42)} /></div>
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
    <div className="nt-inputbar" style={{
      display: "flex", alignItems: "center",
      background: "rgba(20,30,24,0.96)",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      borderRadius: 26,
      border: "none",
      padding: isCenter ? "18px 16px" : "10px 10px 10px 18px",
      transition: "box-shadow 0.25s",
      boxShadow: focused
        ? "0 6px 36px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)"
        : "0 4px 24px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.06)",
      minHeight: isCenter ? 120 : 70,
      gap: 8,
    }}>
      {/* Textarea */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "stretch", paddingBottom: 2 }}>
        <textarea
          ref={inputRef}
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={handleKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={pendingImage ? "Ajoutez un commentaire..." : "Écrire un message…"}
          rows={isCenter ? 3 : 1}
          spellCheck={false}
          className="chat-input"
          style={{ width: "100%", border: "none", background: "transparent", color: TEXT_PRIMARY, fontSize: 16, outline: "none", caretColor: ACCENT, lineHeight: 1.55, resize: "none", fontFamily: "inherit", display: "block", maxHeight: 160, overflowY: "hidden", padding: 0, touchAction: "auto" }}
        />
      </div>
      {/* Actions — alignés en bas pour suivre la hauteur du textarea */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, paddingBottom: 1 }}>
        {/* Camera */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}
          onMouseEnter={() => setPhotoHovered(true)}
          onMouseLeave={() => setPhotoHovered(false)}>
          <span style={{ fontSize: 11, color: ACCENT, fontWeight: 500, whiteSpace: "nowrap", maxWidth: photoHovered ? 120 : 0, opacity: photoHovered ? 1 : 0, transition: "max-width 0.25s ease, opacity 0.2s", overflow: "hidden" }}>Analyser votre repas</span>
          <button onClick={handleImageClick} style={{ width: 32, height: 32, borderRadius: "50%", background: photoHovered ? ACCENT_DIM : "transparent", border: `1px solid ${photoHovered ? ACCENT_BORDER : "rgba(255,255,255,0.08)"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", flexShrink: 0 }}>
            <CameraIcon size={15} color={photoHovered ? ACCENT : TEXT_MUTED} />
          </button>
        </div>
        {/* Send — même DA que les autres boutons */}
        <button onClick={() => void send()} disabled={!canSend}
          style={{
            width: 32, height: 32,
            borderRadius: "50%",
            background: "transparent",
            border: `1px solid ${canSend ? ACCENT_BORDER : "rgba(255,255,255,0.08)"}`,
            cursor: canSend ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
            flexShrink: 0,
          }}>
          <ArrowUpIcon size={14} color={canSend ? ACCENT : TEXT_MUTED} />
        </button>
      </div>
    </div>
  );
};

// ═══ ONBOARDING TOUR ═══
const onboardingSteps: {
  id: string;
  highlight: string | null;
  icon: React.ReactNode;
  title: string;
  text: string;
  position: "center" | "sidebar" | "bottom";
  glowColor?: string;
}[] = [
  {
    id: "welcome",
    highlight: null,
    icon: <LeafIcon size={18} color={ACCENT} />,
    title: "Bienvenue",
    text: "Je suis votre compagnon de suivi, créé à partir de l'expertise de votre praticien. Laissez-moi vous montrer vos outils en quelques secondes.",
    position: "center" as const,
  },
  {
    id: "sos",
    highlight: "sos",
    icon: <IconActivity size={18} color={ACCENT} />,
    title: "Mon Soutien",
    text: "Ce bouton est votre ancre immédiate en cas de tempête. Fringale, stress, coup de mou — une aide guidée vous attend en un clic. Je ne vous laisserai jamais seul(e).",
    position: "sidebar" as const,
    glowColor: "rgba(16,185,129,0.4)",
  },
  {
    id: "camera",
    highlight: "camera",
    icon: <CameraIcon size={18} color={ACCENT} />,
    title: "Analyse de repas",
    text: "Prenez votre assiette en photo. Je l'analyserai instantanément pour vérifier si elle respecte nos objectifs de la semaine.",
    position: "bottom" as const,
    glowColor: "rgba(16,185,129,0.4)",
  },
  {
    id: "chat",
    highlight: null,
    icon: <IconThought size={18} color={ACCENT} />,
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
          <div style={{ width: 36, height: 36, borderRadius: 10, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {current.icon}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY }}>{current.title}</p>
            {isFirst && firstName && (
              <p style={{ margin: 0, fontSize: 11, color: ACCENT }}>Bonjour {firstName}</p>
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
            {isLast ? "C'est parti →" : "Suivant →"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Labels courts pour les boutons [TRIGGER_SOS] dans le chat
const SOS_EXERCISE_META: Record<string, { label: string; icon: string }> = {
  breathing:        { label: "Calmer mon souffle",         icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" },
  ancrage:          { label: "Ancrer mes 5 sens",          icon: "M12 2a10 10 0 100 20A10 10 0 0012 2zm0 2a8 8 0 110 16A8 8 0 0112 4zm0 3a5 5 0 100 10A5 5 0 0012 7zm0 2a3 3 0 110 6A3 3 0 0112 9z" },
  manger:           { label: "Manger en pleine conscience", icon: "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" },
  defusion:         { label: "Prendre de la distance",     icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" },
  ecriture:         { label: "Écrire pour me libérer",     icon: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" },
};

// ═══ BIBLIOTHÈQUE D'EXERCICES — accès direct, hors situation de crise ═══
// Les 5 exercices retravaillés (Gemini Live). Lancés en dehors de toute triage SOS,
// toujours en origin "pratique" (Exercices pratiqués côté Dashboard, jamais "[Non résolu]").
const LIBRARY_EXERCISES: { id: string; label: string; desc: string; icon: string }[] = [
  { id: "breathing", label: "Cohérence cardiaque", desc: "Respiration guidée · 3 min · Calme le système nerveux", icon: SOS_EXERCISE_META.breathing.icon },
  { id: "ancrage", label: "Ancrage sensoriel", desc: "Technique 5-4-3-2-1 · Retour au moment présent", icon: SOS_EXERCISE_META.ancrage.icon },
  { id: "manger", label: "Pleine conscience alimentaire", desc: "Manger en conscience, sans jugement", icon: SOS_EXERCISE_META.manger.icon },
  { id: "ecriture", label: "Écriture cathartique", desc: "Déposer ce qui pèse, à son rythme", icon: SOS_EXERCISE_META.ecriture.icon },
  { id: "defusion", label: "Défusion cognitive", desc: "Prendre de la distance avec ses pensées", icon: SOS_EXERCISE_META.defusion.icon },
];

// ═══ CARTE DE NOTIFICATION "EXERCICE SOS TERMINÉ" ═══
// Remplace l'ancien double échange écrit (bulle "user" + réponse isPostExercise)
// une fois SOSExercise fermé normalement — l'échange de clôture est déjà 100%
// oral à l'intérieur de l'exercice (question, réponse, ancrage final, tout en
// voix). Carte compacte, repliée par défaut, distincte d'une bulle de chat —
// au clic elle déplie le mot tracé et le ressenti partagé, en texte simple
// (template, pas un résumé généré par LLM — source unique de vérité : les
// champs bruts déjà stockés dans sos_events via /api/sos/log).
function SosSummaryCard({ word, feeling, intake }: SosSummary) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(o => !o)}
      role="button"
      tabIndex={0}
      style={{
        display: "flex", flexDirection: "column", gap: open ? 10 : 0,
        padding: "12px 16px", borderRadius: 14,
        background: "rgba(16,185,129,0.04)",
        border: "1px solid rgba(16,185,129,0.15)",
        cursor: "pointer", maxWidth: 360, transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 9, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <IconCheckRing size={15} color="rgba(16,185,129,0.9)" />
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.75)" }}>Exercice SOS terminé</span>
        <svg
          style={{ marginLeft: "auto", flexShrink: 0, opacity: 0.4, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        ><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      {open && (
        <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.55)", paddingLeft: 38 }}>
          {intake && (
            <p style={{ margin: "0 0 4px" }}>Ce qui a motivé l&apos;exercice : <span style={{ color: "rgba(255,255,255,0.8)", fontStyle: "italic" }}>« {intake} »</span></p>
          )}
          <p style={{ margin: "0 0 4px" }}>Mot tracé : <span style={{ color: "rgba(255,255,255,0.8)" }}>{word}</span></p>
          <p style={{ margin: 0 }}>Comment je me sens après : <span style={{ color: "rgba(255,255,255,0.8)", fontStyle: "italic" }}>« {feeling} »</span></p>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  // splashFading / splashGone / splashStartRef supprimés — le splash statique
  // (layout.tsx #static-splash) est piloté directement via JS (voir useEffect ci-dessous),
  // ce qui évite tout doublon React et le saut d'animation du spinner.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ActiveTool>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [patientFirstName, setPatientFirstName] = useState("");
  const [patientInitials, setPatientInitials] = useState("?");
  const [practitionerIdFromDb, setPractitionerIdFromDb] = useState<string | null>(null);
  const [practitionerPlan, setPractitionerPlan] = useState("essentiel");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
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
  // ─── Full-screen breathing overlay (new immersive exercise) ───
  const [showBreathingExercise, setShowBreathingExercise] = useState(false);
  const [breathingSosContext, setBreathingSosContext] = useState("");
  // ─── Full-screen ancrage overlay ───
  const [showAncrageExercise, setShowAncrageExercise] = useState(false);
  const [ancrageSosContext, setAncrageSosContext] = useState("");
  // ─── Full-screen manger pleine conscience overlay ───
  const [showMangerExercise, setShowMangerExercise] = useState(false);
  const [mangerSosContext, setMangerSosContext] = useState("");
  // ─── Full-screen écriture cathartique overlay ───
  const [showEcritureExercise, setShowEcritureExercise] = useState(false);
  const [ecrirtureSosContext, setEcritureSosContext] = useState("");
  // ─── Full-screen défusion cognitive overlay ───
  const [showDefusionExercise, setShowDefusionExercise] = useState(false);
  const [defusionSosContext, setDefusionSosContext] = useState("");
  // ─── Consentement microphone ─────────────────────────────────────────────────
  // Affiche MicConsentOverlay UNE SEULE FOIS (si permission "prompt") avant le
  // premier exercice vocal. Après accord, le navigateur retient la permission.
  const { statusRef: micStatusRef } = useMicPermission();
  const [pendingTool, setPendingTool] = useState<{ toolId: string; sosContext: string; forcedOrigin?: "pratique" } | null>(null);
  const [showMicConsent, setShowMicConsent] = useState(false);
  const [ancrageStep, setAncrageStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  // Timestamp du dernier upload photo depuis cet appareil — évite que Realtime écrase la nouvelle photo avec l'ancienne depuis le CDN
  const lastSelfUploadAtRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // ─── Swipe mobile ───
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const swipeIntentRef = useRef<"horizontal" | "vertical" | null>(null);
  const mainAreaRef = useRef<HTMLDivElement>(null);
  // ─── Ref session courante (pour Realtime sans recréer la subscription) ───
  const currentSessionIdRef = useRef<string | null>(null);
  useEffect(() => { currentSessionIdRef.current = currentSessionId; }, [currentSessionId]);
  // ─── Scroll-to-bottom ───
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  // ─── Typewriter refs ───
  const targetTextRef = useRef<string>("");
  const displayedLenRef = useRef<number>(0);
  const streamDoneRef = useRef<boolean>(false);
  const typewriterRafRef = useRef<number | null>(null);
  const hasMessages = messages.filter(m => !m.hidden).length > 0;
  const sidebarWidth = 305;
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
  const [showSOSExercise, setShowSOSExercise] = useState(false);
  const [sosSosContext, setSosSosContext] = useState("");
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [postExerciseStep, setPostExerciseStep] = useState<{ toolId: string; answer: string } | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [chatSearchIdx, setChatSearchIdx] = useState(0);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ─── Voix thérapeutique ────────────────────────────────────────────────────
  const { voices: therapeuticVoices, selectedVoice: selectedTherapeuticVoice, setSelectedVoice: setTherapeuticVoice, previewVoice: previewTherapeuticVoice } = useTherapeuticVoice();

  const ancrageSteps = [
    { count: 5, sense: "voyez", icon: <IconEye size={34} color={CYAN} /> },
    { count: 4, sense: "touchez", icon: <IconActivity size={34} color={CYAN} /> },
    { count: 3, sense: "entendez", icon: <IconWave size={34} color={CYAN} /> },
    { count: 2, sense: "sentez", icon: <IconWind size={34} color={CYAN} /> },
    { count: 1, sense: "goûtez", icon: <IconLeaf2 size={34} color={CYAN} /> },
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
    let touchStartTarget: Element | null = null;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartTarget = e.target as Element | null;
    };
    const handleTouchMove = (e: TouchEvent) => {
      const active = document.activeElement;
      if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) return;
      if (touchStartTarget && (touchStartTarget.tagName === "TEXTAREA" || touchStartTarget.tagName === "INPUT")) return;
      const dx = e.touches[0].clientX - touchStartXRef.current;
      const dy = e.touches[0].clientY - touchStartYRef.current;
      if (!swipeIntentRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        swipeIntentRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (swipeIntentRef.current === "horizontal") e.preventDefault();
    };
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  // ─── Garde de bord gauche : bloque le retour arrière Safari ──────────────────
  // Safari intercepte les swipes partant des ~20px de bord gauche AVANT touchmove.
  // Un listener touchstart non-passif avec preventDefault() sur cette zone
  // capture le geste avant Safari et permet d'ouvrir la sidebar à la place.
  const edgeGuardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const guard = edgeGuardRef.current;
    if (!guard) return;
    let startX = 0, startY = 0;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      e.preventDefault(); // bloque Safari back-swipe dès touchstart
    };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (dx > 30 && dy < 80) setSidebarOpen(true);
    };
    guard.addEventListener("touchstart", onStart, { passive: false });
    guard.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      guard.removeEventListener("touchstart", onStart);
      guard.removeEventListener("touchend", onEnd);
    };
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

  // Reconstruit la carte "Exercice SOS terminé" au bon endroit chronologique
  // dans un fil déjà chargé, à partir de sos_events (closing_message rempli)
  // — jamais depuis `conversations` (voir lib/sosClosures.ts pour le pourquoi).
  // Appelé après chaque chargement de fil (mount + changement de session) ;
  // silencieux en cas d'échec, l'absence de carte n'est jamais bloquante.
  const hydrateSosClosures = useCallback(async (
    pid: string,
    practId: string,
    rows: { role: "user" | "assistant"; content: string; created_at: string }[],
  ) => {
    try {
      const res = await fetch(`/api/sos/closures?patientId=${pid}&practitionerId=${practId}`);
      if (!res.ok) return;
      const data = await res.json() as { events?: SosClosureEvent[] };
      if (!data.events?.length) return;
      setMessages(mergeSosClosures(rows, data.events) as ChatMessage[]);
    } catch { /* silencieux */ }
  }, []);

  const completeOnboarding = useCallback(async (pid: string) => {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await supabase.from("patients").update({ onboarding_done: true }).eq("user_id", pid);
    setShowOnboarding(false);
    // Message de clôture dans le chat
    setMessages([{
      role: "assistant",
      content: "Voilà, vous avez vos outils en main. Je reste ici, dans le chat, pour répondre à vos questions.",
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
      // Heartbeat "dernière connexion" — indépendant de l'envoi de messages,
      // affiché dans le dashboard praticien (cf. migration add_patients_last_seen_at.sql)
      void supabase.from("patients").update({ last_seen_at: new Date().toISOString() }).eq("user_id", data.user.id);
      const { data: rel } = await supabase.from("patient_practitioner").select("practitioner_id").eq("patient_id", data.user.id).single();
      if (rel) {
        const practId = rel.practitioner_id as string;
        setPractitionerIdFromDb(practId);
        const { data: pract } = await supabase.from("practitioners").select("first_name, last_name, plan").eq("user_id", practId).single();
        if (pract) { const p = pract as { first_name: string; last_name: string; plan: string }; setPractitionerPlan(p.plan || "essentiel"); }
        const { data: hist } = await supabase.from("conversations").select("role, content, created_at").eq("patient_id", data.user.id).eq("practitioner_id", practId).is("session_id", null).order("created_at", { ascending: true });
        if (hist?.length) {
          setMessages(hist as ChatMessage[]);
          void hydrateSosClosures(data.user.id, practId, hist as { role: "user" | "assistant"; content: string; created_at: string }[]);
        }
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
        // 1. Afficher immédiatement depuis localStorage (rapide, pas de flash)
        const userId = data.user.id;
        const cachedB64 = localStorage.getItem(`avatar_b64_${userId}`);
        if (cachedB64) setPatientPhoto(cachedB64);
        // 2. Vérifier Supabase en arrière-plan pour sync cross-device
        // Sauf si cet appareil vient d'uploader (CDN stale pendant ~30s)
        const uploadTs = parseInt(localStorage.getItem(`avatar_upload_ts_${userId}`) ?? "0", 10);
        const justUploaded = Date.now() - uploadTs < 30_000;
        if (!justUploaded) {
          try {
            const { data: photoData } = supabase.storage.from("Avatars").getPublicUrl(`${userId}/avatar.jpg`);
            if (photoData) {
              const freshUrl = photoData.publicUrl + "?t=" + Date.now();
              const res = await fetch(freshUrl);
              if (res.ok) {
                const blob = await res.blob();
                const reader = new FileReader();
                reader.onload = () => {
                  const b64 = reader.result as string;
                  setPatientPhoto(b64);
                  localStorage.setItem(`avatar_b64_${userId}`, b64);
                };
                reader.readAsDataURL(blob);
              } else if (!cachedB64) {
                setPatientPhoto(null);
              }
            }
          } catch {
            // Erreur réseau — on garde le cache local
          }
        }
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
      setSessionLoading(false);
    });

    return () => { subscription.unsubscribe(); };
  }, [loadSessions, hydrateSosClosures]);

  // ─── Heartbeat "dernière connexion" ─────────────────────────────────────────
  // Rafraîchit last_seen_at toutes les 5 min tant que l'onglet est visible, et
  // au retour au premier plan, pour que le dashboard praticien reflète une
  // session en cours même sans nouveaux messages.
  useEffect(() => {
    if (!patientId) return;
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const ping = () => { void supabase.from("patients").update({ last_seen_at: new Date().toISOString() }).eq("user_id", patientId); };
    const interval = setInterval(() => { if (document.visibilityState === "visible") ping(); }, 5 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [patientId]);

  // ─── Microphone permission ───────────────────────────────────────────────────
  // Le warmup anticipé est intentionnellement supprimé.
  // La permission est demandée uniquement quand un exercice vocal est lancé,
  // précédée de MicConsentOverlay (explication + CTA) si l'état est "prompt".

  // ─── Realtime : message épinglé praticien ───────────────────────────────────
  // S'abonne aux UPDATE sur la ligne du patient dès que patientId est connu.
  // Pas de rechargement de page nécessaire — le bandeau se met à jour instantanément.
  useEffect(() => {
    if (!patientId) return;
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const channel = supabase
      .channel(`patient-pinned-${patientId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "patients", filter: `user_id=eq.${patientId}` },
        (payload) => {
          type PatientRow = {
            practitioner_pinned_message?: { text: string; sent_at: string; practitioner_id: string } | null;
            emotional_status?: string;
            avatar_updated_at?: string | null;
            user_id?: string;
          };
          const row = payload.new as PatientRow;
          const oldRow = payload.old as PatientRow;
          // Message épinglé
          setPinnedMessage(row.practitioner_pinned_message ?? null);
          // Statut émotionnel (ex : praticien déverrouille depuis le dashboard)
          if (row.emotional_status === "red_critical" || row.emotional_status === "red_behavioral") {
            setEmotionalStatus(row.emotional_status);
          } else if (row.emotional_status === "green") {
            setEmotionalStatus("green");
            setShowSasButtons(false);
          }
          // Photo — re-fetch si avatar_updated_at a changé (upload ou suppression depuis un autre appareil)
          // On ignore si cet appareil vient d'uploader (CDN stale pendant ~30s)
          const realtimeUploadTs = parseInt(localStorage.getItem(`avatar_upload_ts_${row.user_id ?? patientId}`) ?? "0", 10);
          const realtimeJustUploaded = Date.now() - realtimeUploadTs < 30_000;
          if (row.avatar_updated_at && row.avatar_updated_at !== oldRow?.avatar_updated_at && !realtimeJustUploaded) {
            const uid = row.user_id ?? patientId;
            const sup = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
            const { data: pd } = sup.storage.from("Avatars").getPublicUrl(`${uid}/avatar.jpg`);
            if (pd) {
              fetch(pd.publicUrl + "?t=" + Date.now())
                .then(r => r.ok ? r.blob() : Promise.reject())
                .then(blob => {
                  const reader = new FileReader();
                  reader.onload = () => {
                    const b64 = reader.result as string;
                    setPatientPhoto(b64);
                    localStorage.setItem(`avatar_b64_${uid}`, b64);
                  };
                  reader.readAsDataURL(blob);
                })
                .catch(() => {
                  // Photo supprimée sur l'autre appareil
                  setPatientPhoto(null);
                  localStorage.removeItem(`avatar_b64_${uid}`);
                });
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId]);

  // ─── Realtime : messages du chat ────────────────────────────────────────────
  // S'abonne aux INSERT sur conversations dès que patientId et practitionerIdFromDb sont connus.
  // La session courante est lue via ref pour garder la subscription stable.
  // Anti-doublon : si le message vient d'être envoyé depuis cet appareil, il est déjà en state.
  useEffect(() => {
    if (!patientId || !practitionerIdFromDb) return;
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const channel = supabase
      .channel(`conversations-${patientId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations", filter: `patient_id=eq.${patientId}` },
        (payload) => {
          type MsgRow = { role: string; content: string; session_id: string | null; practitioner_id: string };
          const row = payload.new as MsgRow;
          // Ignorer si pas le bon praticien ou pas la session affichée
          if (row.practitioner_id !== practitionerIdFromDb) return;
          if (row.session_id !== currentSessionIdRef.current) return;
          // Ignorer si déjà présent (envoyé depuis cet appareil)
          setMessages(prev => {
            if (prev.some(m => m.role === row.role && m.content === row.content)) return prev;
            return [...prev, { role: row.role as ChatMessage["role"], content: row.content }];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId, practitionerIdFromDb]);

  // Pilote le splash statique (layout.tsx) directement via JS :
  // • Au montage   : on ne fait RIEN — le #static-splash reste visible
  // • Quand la session est chargée : fade-out via opacity CSS, puis suppression du DOM
  useEffect(() => {
    if (sessionLoading) return;
    const el = document.getElementById("static-splash");
    if (!el) return;
    // La transition CSS (0.45s) est déjà déclarée dans layout.tsx
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    const t = setTimeout(() => el.remove(), 500);
    return () => clearTimeout(t);
  }, [sessionLoading]);

  useEffect(() => () => { if (breathingIntervalRef.current) clearInterval(breathingIntervalRef.current); }, []);

  const closeTool = useCallback(() => {
    setActiveTool(null);
    setBreathingStep("idle"); setBreathingCycle(0); setBreathingTimer(0);
    if (breathingIntervalRef.current) clearInterval(breathingIntervalRef.current);
    setAncrageStep(0);
  }, []);

  // ─── Exercice terminé : ferme la modale + follow-up IA via canal dédié ───
  // N'utilise PAS send() pour éviter :
  //   - l'affichage du message système dans le fil patient
  //   - le déclenchement de l'analyse de crise
  //   - la mise à jour prématurée de emotional_status en BDD
  // ─── Breathing overlay — clôture avec injection du résumé dans le chat ──────
  const handleBreathingTransitionToChat = useCallback((message: string) => {
    setShowBreathingExercise(false);
    // Injecter le résumé de l'exercice comme message assistant dans le chat
    if (message?.trim()) {
      setMessages(prev => [...prev, { role: "assistant", content: message.trim() }]);
    }
    // Ouvrir la modale post-exercice pour la question de ressenti
    setActiveTool({ id: "breathing", data: null });
    setPostExerciseStep({ toolId: "breathing", answer: "" });
  }, []);

  // ─── Ancrage 5-4-3-2-1 : injection chat + victoire dashboard ─────────────────
  const handleAncrageComplete = useCallback(() => {
    setShowAncrageExercise(false);
    setActiveTool({ id: "ancrage", data: null });
    setPostExerciseStep({ toolId: "ancrage", answer: "" });
  }, []);

  const handleAncrageTransitionToChat = useCallback((summary: string, closing: string) => {
    setShowAncrageExercise(false);
    setMessages((prev) => [
      ...prev,
      { role: "user" as const, content: summary },
      { role: "assistant" as const, content: closing },
    ]);
    setActiveTool({ id: "ancrage", data: null });
    setPostExerciseStep({ toolId: "ancrage", answer: "victoire" });
  }, []);

  // ─── Manger pleine conscience overlay complete ───────────────────────────────
  const handleMangerComplete = useCallback(() => {
    setShowMangerExercise(false);
    setActiveTool({ id: "manger", data: null });
    setPostExerciseStep({ toolId: "manger", answer: "" });
  }, []);

  // ─── MindfulEating : injection chat + log dashboard ──────────────────────────
  const handleMindfulEatingTransition = useCallback((
    summary: string,
    exitMode: "victory" | "moderate" | "severe"
  ) => {
    setShowMangerExercise(false);
    setMessages((prev) => [
      ...prev,
      { role: "user" as const, content: summary },
    ]);
    setActiveTool({ id: "manger", data: null });
    setPostExerciseStep({ toolId: "manger", answer: exitMode === "victory" ? "victoire" : exitMode });
  }, []);

  // ─── Écriture cathartique : injection chat + clôture ──────────────────────────
  const handleEcritureTransitionToChat = useCallback((
    patientText: string,
    tccBlocks: { label: string; emoji: string; text: string }[]
  ) => {
    setShowEcritureExercise(false);

    // 1 bulle patient (résumé de la décharge)
    const userBubble = patientText.trim()
      ? `📝 *Exercice d'écriture — décharge émotionnelle :*\n\n${patientText.trim().slice(0, 400)}${patientText.trim().length > 400 ? "…" : ""}`
      : "📝 *J'ai complété l'exercice d'écriture cathartique.*";

    // 3 bulles Twin (une par bloc TCC)
    const twinBubbles = tccBlocks.map(
      (b) => `**${b.emoji} ${b.label}**\n\n${b.text}`
    );

    setMessages((prev) => [
      ...prev,
      { role: "user" as const, content: userBubble },
      ...twinBubbles.map((content) => ({ role: "assistant" as const, content })),
    ]);

    setActiveTool({ id: "ecriture", data: null });
    setPostExerciseStep({ toolId: "ecriture", answer: "" });
  }, []);

  // ─── Défusion cognitive overlay complete ─────────────────────────────────────
  const handleDefusionTransitionToChat = useCallback((
    evacuatedThoughts: string[],
    closing: string
  ) => {
    setShowDefusionExercise(false);

    // Bulle patient : liste des pensées observées
    const userContent = evacuatedThoughts.length > 0
      ? `*Défusion ACT — pensées observées et libérées :*\n${evacuatedThoughts.map((t) => `• « ${t} »`).join("\n")}`
      : "*J'ai complété l'exercice de défusion cognitive.*";

    setMessages((prev) => [
      ...prev,
      { role: "user" as const, content: userContent },
      { role: "assistant" as const, content: closing },
    ]);

    setActiveTool({ id: "defusion", data: null });
    setPostExerciseStep({ toolId: "defusion", answer: "" });
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

    // Envoyer la réponse post-exercice à Gemini → récupérer le message de clôture → l'afficher dans le chat
    if (patientId && practitionerIdFromDb) {
      try {
        const res = await fetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: answer.trim(),
            patientId,
            practitionerId: practitionerIdFromDb,
            isPostExercise: true,
            toolId,
          }),
        });
        if (res.ok) {
          const closingText = await res.text();
          if (closingText?.trim()) {
            setMessages(prev => [...prev, { role: "assistant", content: closingText.trim() }]);
          }
        }
      } catch { /* silencieux */ }
    }
  }, [postExerciseStep, patientId, practitionerIdFromDb, closeTool]);

  // ─── Sélection d'un outil dans le duo → modale plein écran ───
  // forcedOrigin: "pratique" pour la bibliothèque d'exercices (geste proactif délibéré,
  // toujours traité comme "Exercice pratiqué", jamais comme une crise non résolue).
  const handleToolSelect = useCallback(async (toolId: string, sosContext: string, forcedOrigin?: "pratique") => {
    // ── Consentement microphone ──────────────────────────────────────────────
    // Les exercices vocaux (Gemini Live) nécessitent le micro.
    // Si la permission n'a pas encore été accordée, on affiche d'abord
    // MicConsentOverlay pour contextualiser la demande native du navigateur.
    // Les exercices sans micro (journal) passent directement.
    const needsMic = ["breathing", "ancrage", "manger", "ecriture", "defusion", "sos"].includes(toolId);
    // Stratégie localStorage — sans race condition avec navigator.permissions :
    //   • !hasMicConsent()            → l'utilisateur n'a jamais vu l'explication → overlay
    //   • micStatusRef === "denied"   → a refusé le dialog natif → overlay instructions réglages
    //   • sinon                       → permission déjà accordée → exercice direct
    const isDenied = micStatusRef.current === "denied";
    if (needsMic && (!hasMicConsent() || isDenied)) {
      setPendingTool({ toolId, sosContext, forcedOrigin });
      setShowMicConsent(true);
      return;
    }

    // Enregistrer l'événement (sos_events) en arrière-plan — alimente le Dashboard
    // ("Crises désamorcées" / "Exercices pratiqués") et la 🏆 victoire automatique.
    if (patientId && practitionerIdFromDb) {
      void fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "", patientId, practitionerId: practitionerIdFromDb, isSOS: true,
          sosContext: `${sosContext} | outil: ${toolId}`,
          ...(forcedOrigin ? { origin: forcedOrigin } : {}),
        }),
      }).catch(() => {});
    }

    // Breathing → overlay immersif dédié (bypass activeTool)
    if (toolId === "breathing") {
      setBreathingSosContext(sosContext);
      setShowBreathingExercise(true);
      return;
    }

    // Ancrage 5-4-3-2-1 → overlay immersif dédié (bypass activeTool)
    if (toolId === "ancrage") {
      setAncrageSosContext(sosContext);
      setShowAncrageExercise(true);
      return;
    }

    // Manger en pleine conscience → overlay immersif dédié (bypass activeTool)
    if (toolId === "manger") {
      setMangerSosContext(sosContext);
      setShowMangerExercise(true);
      return;
    }

    // Écriture cathartique → overlay immersif dédié (bypass activeTool)
    if (toolId === "ecriture") {
      setEcritureSosContext(sosContext);
      setShowEcritureExercise(true);
      return;
    }

    // Défusion cognitive → overlay immersif dédié (bypass activeTool)
    if (toolId === "defusion") {
      setDefusionSosContext(sosContext);
      setShowDefusionExercise(true);
      return;
    }

    // Tous les outils de la bibliothèque (breathing, ancrage, manger, ecriture,
    // defusion) sont interceptés ci-dessus via leurs overlays dédiés — il ne
    // reste ici aucun toolId à traiter via activeTool/InlineWidget (supprimé,
    // devenu mort depuis que les 5 exercices ont leur propre écran immersif).
  }, [patientId, practitionerIdFromDb]);

  // ─── Parcours Post-Chat (Cas A) ─────────────────────────────────────────────
  // Déclenché quand le patient clique sur un bouton [TRIGGER_SOS] dans le chat.
  // Extrait les 6 derniers échanges comme contexte personnalisé → ouvre l'exercice.
  const handleChatSosTrigger = useCallback((toolId: string) => {
    // Build a context string from the last 6 visible messages
    const visible = messages.filter(m => !m.hidden && m.role !== "widget");
    const recentMessages = visible.slice(-6);
    const contextLines = recentMessages.map(m => {
      const roleLabel = m.role === "user" ? "Patient" : "Jumeau";
      return `${roleLabel}: ${m.content.slice(0, 300)}`;
    });
    const sosContext = `[contexte chat récent]\n${contextLines.join("\n")}`;
    void handleToolSelect(toolId, sosContext);
  }, [messages, handleToolSelect]);

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

  // handleSOSTransitionToChat : appelé quand SOSExercise termine normalement.
  // L'échange de clôture (question, réponse, ancrage final) est déjà 100% oral
  // à l'intérieur de l'exercice — plus de round-trip écrit ici (ancien double
  // coût : bulle "user" injectée + nouvelle réponse Gemini isPostExercise sur
  // un texte déjà traité à l'oral). Le garde-fou critique tourne déjà en
  // direct pendant la clôture orale (runVoiceCrisisCheck côté SOSExercise),
  // donc rien à reproduire ici non plus. On se contente d'une carte de
  // notification compacte, dépliable, avec le mot tracé et le ressenti.
  const handleSOSTransitionToChat = useCallback((closingText: string, word: string, intake: string) => {
    setShowSOSExercise(false);
    const trimmed = closingText?.trim() ?? "";
    const isPlaceholder = !trimmed || trimmed.startsWith("[");
    const feeling = isPlaceholder ? "Aucun ressenti partagé à voix haute" : trimmed;
    // crisisLevel/crisisMessageId restent null ici — connus seulement côté
    // serveur (isSosIntakeCheck). Au prochain chargement du fil (reload,
    // changement de session), hydrateSosClosures les complètera depuis
    // sos_events. Léger délai d'affichage, jamais une perte d'information.
    setMessages(prev => [...prev,
      { role: "widget", content: "", sosSummary: { word: word || "—", feeling, intake: intake?.trim() || null, crisisLevel: null, crisisMessageId: null } },
    ]);
  }, []);

  // handleSOSCriticalSafety : appelé uniquement si le garde-fou critique se
  // déclenche pendant l'intake vocal de SOSExercise (red_critical détecté
  // alors que le patient parlait). Le message patient, la réponse de sécurité,
  // l'alerte praticien et le statut emotional_status ont déjà été persistés
  // côté serveur (isSosIntakeCheck) — on injecte juste la réponse de sécurité
  // dans le fil visible, sans repasser par le pipeline isPostExercise (qui
  // referait une analyse de crise sur un texte qui n'est pas du patient).
  const handleSOSCriticalSafety = useCallback((safetyText: string) => {
    setShowSOSExercise(false);
    if (safetyText?.trim()) {
      setMessages(prev => [...prev, { role: "assistant", content: safetyText.trim() }]);
    }
  }, []);

  const createSession = async (firstMessage: string) => {
    if (!patientId || !practitionerIdFromDb) return null;
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from("conversations_sessions").insert({ patient_id: patientId, practitioner_id: practitionerIdFromDb, title: firstMessage.slice(0, 40) + (firstMessage.length > 40 ? "..." : ""), last_message: firstMessage, last_message_at: new Date().toISOString() }).select().single();
    return (data as { id: string } | null)?.id ?? null;
  };

  const loadSession = async (sessionId: string) => {
    if (!patientId || !practitionerIdFromDb) return;
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from("conversations").select("role, content, created_at").eq("patient_id", patientId).eq("practitioner_id", practitionerIdFromDb).eq("session_id", sessionId).order("created_at", { ascending: true });
    if (data) {
      setMessages(data as ChatMessage[]);
      setCurrentSessionId(sessionId);
      if (isMobile) setSidebarOpen(false);
      void hydrateSosClosures(patientId, practitionerIdFromDb, data as { role: "user" | "assistant"; content: string; created_at: string }[]);
    }
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

    // ─── Reset refs stream ───
    if (typewriterRafRef.current !== null) { cancelAnimationFrame(typewriterRafRef.current); typewriterRafRef.current = null; }
    targetTextRef.current = "";
    displayedLenRef.current = 0;
    streamDoneRef.current = false;

    try {
      const body: Record<string, string | undefined> = { message: trimmed || "Analyse cette photo", patientId: patientId ?? undefined, practitionerId: practitionerIdFromDb ?? undefined };
      if (img) { body.imageBase64 = img.base64; body.imageMimeType = img.mimeType; }
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: abortControllerRef.current.signal });
      if (!res.ok || !res.body) throw new Error("Erreur");

      // ─── Stream : chaque chunk est affiché immédiatement, sans RAF ───
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let fullText = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        fullText += decoder.decode(value, { stream: true });
        const visible = fullText
          .replace(/\|\|\|[\s\S]*?\|\|\|/g, "")
          .replace(/\[TRIGGER_SOS:[^\]]*\]/g, "")
          .trim();
        setMessages(prev => {
          const u = [...prev];
          if (u[assistantIndex]) u[assistantIndex] = { ...u[assistantIndex], content: visible };
          return u;
        });
      }
      streamDoneRef.current = true;

      // ─── Signaux post-stream ───
      if (fullText.includes("|||SAS|||")) { setShowSasButtons(true); }
      const statusMatch = fullText.match(/\|\|\|([\s\S]*?)\|\|\|/);
      if (statusMatch) {
        try {
          const parsed = JSON.parse(statusMatch[1]) as { status: string };
          if (parsed.status === "red_critical") { setEmotionalStatus("red_critical"); }
          else if (parsed.status === "red_behavioral") { setEmotionalStatus("red_behavioral"); }
        } catch { /* silencieux */ }
      }

      // ─── TRIGGER_SOS : détresse aiguë détectée par Gemini ───
      const sosTriggerMatch = fullText.match(/\[TRIGGER_SOS:\s*(\w+),\s*(\w+)\]/);
      if (sosTriggerMatch && !activeTool) {
        const exo1 = sosTriggerMatch[1].trim();
        const exo2 = sosTriggerMatch[2].trim();
        setMessages(prev => {
          const u = [...prev];
          u[assistantIndex] = { ...u[assistantIndex], sosTrigger: [exo1, exo2] as [string, string] };
          return u;
        });
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
    // Mobile : Enter insère un saut de ligne — envoi uniquement sur desktop (Enter sans Shift)
    if (e.key === "Enter" && !e.shiftKey && !isMobile) { e.preventDefault(); void send(); }
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
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}><IconCheckRing size={48} color="#10b981" strokeWidth={1.3} style={{ filter: "drop-shadow(0 0 8px rgba(16,185,129,0.4))" }} /></div>
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
            // activeTool n'est jamais défini avec un toolId hors "journal" sans que
            // postExerciseStep soit déjà posé dans le même batch d'état (voir les
            // handlers handle*TransitionToChat/Complete ci-dessus) — cette branche
            // est donc gardée par sécurité, sans rendu (l'ancien InlineWidget,
            // devenu mort depuis le passage aux 5 overlays immersifs, a été retiré).
            null
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

      {/* Splash React supprimé — le #static-splash (layout.tsx) est piloté
          directement via JS dans le useEffect sessionLoading ci-dessus.
          Cela évite le doublon React + le saut d'animation du spinner. */}

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

      {/* ═══ BIBLIOTHÈQUE D'EXERCICES — Modale ═══ */}
      {showLibraryModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#060d14", borderRadius: 24, padding: "28px 24px", width: "100%", maxWidth: 420, border: `1px solid ${ACCENT_BORDER}`, boxShadow: "0 24px 80px rgba(0,0,0,0.7)", animation: "fadeUp 0.3s ease", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </div>
              <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 700, color: TEXT_PRIMARY }}>Bibliothèque d'exercices</h3>
              <p style={{ margin: 0, fontSize: 13, color: TEXT_SECONDARY }}>À pratiquer quand tu veux, même quand tout va bien</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {LIBRARY_EXERCISES.map(ex => (
                <button key={ex.id}
                  onClick={() => { setShowLibraryModal(false); void handleToolSelect(ex.id, "Bibliothèque", emotionalStatus === "red_behavioral" ? undefined : "pratique"); }}
                  style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", borderRadius: 16, background: "rgba(16,185,129,0.04)", border: `1px solid ${ACCENT_BORDER}`, cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = ACCENT_DIM; e.currentTarget.style.borderColor = "rgba(16,185,129,0.35)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.04)"; e.currentTarget.style.borderColor = ACCENT_BORDER; e.currentTarget.style.transform = "translateY(0)"; }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {TOOL_SVG_ICONS[ex.id] ?? <IconStar size={28} color={ACCENT} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>{ex.label}</p>
                    <p style={{ margin: 0, fontSize: 12, color: TEXT_MUTED }}>{ex.desc}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" stroke={TEXT_MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              ))}
            </div>
            <button onClick={() => setShowLibraryModal(false)}
              style={{ width: "100%", height: 38, borderRadius: 10, background: "transparent", border: `1px solid ${BORDER}`, color: TEXT_MUTED, fontSize: 13, cursor: "pointer" }}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ═══ SAS DE DÉCOMPRESSION ═══ */}
      {showSasButtons && !activeTool && (
        <div style={{ position: "fixed", bottom: hasMessages ? 110 : 190, left: "50%", transform: "translateX(-50%)", zIndex: 91, width: "calc(100% - 32px)", maxWidth: 520, background: "#0a0f0c", borderRadius: 18, border: `1px solid ${ACCENT_BORDER}`, padding: "16px 18px", boxShadow: "0 8px 36px rgba(16,185,129,0.08), 0 8px 32px rgba(0,0,0,0.5)", animation: "fadeUp 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconWave size={16} color={ACCENT} strokeWidth={1.5} /></div>
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

      {renderTool()}

      {/* ─── Consentement microphone (première utilisation) ──────────────────
           Affiché UNE SEULE FOIS avant le premier exercice vocal si la permission
           n'est pas encore accordée. Après accord, le navigateur retient la
           permission et cet overlay ne réapparaîtra jamais.
      ─────────────────────────────────────────────────────────────────────── */}
      {showMicConsent && pendingTool && (
        <MicConsentOverlay
          exerciseName={
            pendingTool.toolId === "breathing" ? "La cohérence cardiaque" :
            pendingTool.toolId === "ancrage"   ? "L'ancrage sensoriel"   :
            pendingTool.toolId === "manger"    ? "La pleine conscience alimentaire" :
            pendingTool.toolId === "ecriture"  ? "L'écriture cathartique" :
            pendingTool.toolId === "defusion"  ? "La défusion cognitive"  :
            "L'exercice SOS"
          }
          denied={micStatusRef.current === "denied"}
          onStart={() => {
            markMicConsent(); // marquer "a vu l'explication" → plus jamais d'overlay
            setShowMicConsent(false);
            const p = pendingTool;
            setPendingTool(null);
            void handleToolSelect(p.toolId, p.sosContext, p.forcedOrigin);
          }}
          onClose={() => {
            setShowMicConsent(false);
            setPendingTool(null);
          }}
        />
      )}

      {/* ─── Breathing exercise full-screen overlay ─── */}
      {showBreathingExercise && (
        <BreathingExercise
          sosContext={breathingSosContext}
          firstName={patientFirstName}
          patientId={patientId ?? undefined}
          practitionerId={practitionerIdFromDb ?? undefined}
          onTransitionToChat={handleBreathingTransitionToChat}
          onClose={() => setShowBreathingExercise(false)}
        />
      )}

      {/* ─── Ancrage 5-4-3-2-1 full-screen overlay ─── */}
      {showAncrageExercise && (
        <AncrageExercise
          patientId={patientId ?? undefined}
          practitionerId={practitionerIdFromDb ?? undefined}
          sosContext={ancrageSosContext}
          firstName={patientFirstName}
          onTransitionToChat={handleAncrageTransitionToChat}
          onCompleted={handleAncrageComplete}
          onClose={() => setShowAncrageExercise(false)}
        />
      )}

      {/* ─── Manger en pleine conscience full-screen overlay ─── */}
      {/* ─── MindfulEating full-screen overlay ─── */}
      {showMangerExercise && patientId && practitionerIdFromDb && (
        <MindfulEating
          patientId={patientId}
          practitionerId={practitionerIdFromDb}
          firstName={patientFirstName}
          sosContext={mangerSosContext}
          onTransitionToChat={handleMindfulEatingTransition}
          onClose={() => setShowMangerExercise(false)}
        />
      )}

      {/* ─── Écriture cathartique full-screen overlay ─── */}
      {showEcritureExercise && patientId && practitionerIdFromDb && (
        <EcritureExercise
          patientId={patientId}
          practitionerId={practitionerIdFromDb}
          firstName={patientFirstName}
          sosContext={ecrirtureSosContext}
          onTransitionToChat={handleEcritureTransitionToChat}
          onClose={() => setShowEcritureExercise(false)}
        />
      )}

      {/* ─── Défusion cognitive full-screen overlay ─── */}
      {showDefusionExercise && patientId && practitionerIdFromDb && (
        <DefusionExercise
          patientId={patientId}
          practitionerId={practitionerIdFromDb}
          sosContext={defusionSosContext}
          firstName={patientFirstName}
          onTransitionToChat={handleDefusionTransitionToChat}
          onClose={() => setShowDefusionExercise(false)}
        />
      )}

      {/* ─── SOSExercise Gemini Live — mode SOS immersif ─── */}
      {showSOSExercise && patientId && practitionerIdFromDb && (
        <SOSExercise
          patientId={patientId}
          practitionerId={practitionerIdFromDb}
          firstName={patientFirstName}
          sosContext={sosSosContext}
          onTransitionToChat={handleSOSTransitionToChat}
          onCriticalSafety={handleSOSCriticalSafety}
          onClose={() => setShowSOSExercise(false)}
        />
      )}

     {/* Modale profil */}
{showProfileModal && (
  <div onClick={() => setShowProfileModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#0a0f0c", borderRadius: 24, padding: 28, width: "100%", maxWidth: 360, border: `1px solid ${ACCENT_BORDER}`, maxHeight: "90vh", overflowY: "auto", position: "relative" }}>

      {/* Croix de fermeture */}
      <button onClick={() => setShowProfileModal(false)}
        style={{ position: "absolute", top: 16, right: 16, width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 16, transition: "all 0.15s" }}
        onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#e2e8f0"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#64748b"; }}>
        ×
      </button>

      {/* Avatar */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 8px" }}>
          {patientPhoto ? (
            <img src={patientPhoto} alt="avatar" style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(16,185,129,0.5)" }} onError={() => setPatientPhoto(null)} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#10b981", border: "1px solid rgba(16,185,129,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, color: "#000" }}>{patientInitials}</div>
          )}
          {/* Bouton crayon — modifier la photo */}
          <button onClick={() => patientAvatarRef.current?.click()} disabled={uploadingPhoto}
            style={{ position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            {uploadingPhoto
              ? <span style={{ width: 11, height: 11, borderRadius: "50%", border: "2px solid rgba(16,185,129,0.2)", borderTop: `2px solid ${ACCENT}`, display: "inline-block", animation: "spin 1s linear infinite" }} />
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            }
          </button>
          <input ref={patientAvatarRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
            const file = e.target.files?.[0]; if (!file || !patientId) return;
            setUploadingPhoto(true);
            try {
              const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
              const compressed = await compressImage(file);
              const dataUrl = `data:image/jpeg;base64,${compressed.base64}`;
              // Afficher immédiatement + persister en localStorage (contourne le CDN Supabase)
              setPatientPhoto(dataUrl);
              localStorage.setItem(`avatar_b64_${patientId}`, dataUrl);
              const byteString = atob(compressed.base64);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
              const blob = new Blob([ab], { type: "image/jpeg" });
              await supabase.storage.from("Avatars").upload(`${patientId}/avatar.jpg`, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "no-store" });
              // Marquer l'upload local (ref + localStorage) pour ignorer le CDN stale pendant 30s
              lastSelfUploadAtRef.current = Date.now();
              localStorage.setItem(`avatar_upload_ts_${patientId}`, String(Date.now()));
              // Déclenche le re-fetch sur les autres appareils via Realtime
              await supabase.from("patients").update({ avatar_updated_at: new Date().toISOString() }).eq("user_id", patientId);
            } catch { /* silencieux */ }
            setUploadingPhoto(false);
            if (patientAvatarRef.current) patientAvatarRef.current.value = "";
          }} />
        </div>
        {/* Lien "Revenir aux initiales" — visible seulement si photo présente */}
        {patientPhoto && (
          <button
            onClick={async () => {
              if (!patientId) return;
              const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
              await supabase.storage.from("Avatars").remove([`${patientId}/avatar.jpg`]);
              localStorage.removeItem(`avatar_b64_${patientId}`);
              // Garde 30s pour que le Realtime n'aille pas re-fetcher l'ancienne image depuis le CDN encore stale
              lastSelfUploadAtRef.current = Date.now();
              localStorage.setItem(`avatar_upload_ts_${patientId}`, String(Date.now()));
              setPatientPhoto(null);
              // Déclenche la suppression sur les autres appareils via Realtime
              await supabase.from("patients").update({ avatar_updated_at: new Date().toISOString() }).eq("user_id", patientId);
            }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: TEXT_MUTED, textDecoration: "underline", textDecorationStyle: "dotted", padding: "0 0 10px", display: "block", margin: "0 auto" }}
            onMouseEnter={e => e.currentTarget.style.color = TEXT_SECONDARY}
            onMouseLeave={e => e.currentTarget.style.color = TEXT_MUTED}>
            Revenir aux initiales
          </button>
        )}
        {!patientPhoto && <div style={{ height: 10 }} />}

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
          alert("Votre praticien a été notifié. Il corrigera votre dossier prochainement.");
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
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: TEXT_MUTED, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}><IconAward size={13} color={TEXT_MUTED} strokeWidth={1.5} /> Mes Victoires</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {patientVictories.slice(-5).reverse().map((v, i) => (
              <div key={i} style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                <IconAward size={14} color={ACCENT} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.5 }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sélecteur de voix thérapeutique */}
      {therapeuticVoices.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: TEXT_MUTED, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            Voix thérapeutique
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {therapeuticVoices.map((v) => {
              const isSelected = selectedTherapeuticVoice?.id === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setTherapeuticVoice(v);
                    const preview = `Bonjour ${patientFirstName || "toi"}, je suis là pour t'accompagner.`;
                    previewTherapeuticVoice(v, preview);
                  }}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: isSelected ? "rgba(16,185,129,0.10)" : "rgba(255,255,255,0.03)",
                    border: isSelected ? `1px solid rgba(16,185,129,0.40)` : `1px solid ${BORDER}`,
                    color: isSelected ? ACCENT : TEXT_SECONDARY,
                    fontSize: 12,
                    fontWeight: isSelected ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.name}
                      <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.5, fontWeight: 400 }}>
                        {v.gender === "FEMALE" ? "♀" : "♂"}
                      </span>
                    </span>
                    <span style={{ fontSize: 10, opacity: 0.45, fontWeight: 400 }}>{v.description}</span>
                  </span>
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              );
            })}
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
          style={{ width: "100%", height: 40, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, color: TEXT_SECONDARY, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.2)"; e.currentTarget.style.color = "#f87171"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_SECONDARY; e.currentTarget.style.transform = "scale(1)"; }}
          onMouseDown={e => { e.currentTarget.style.transform = "scale(0.96)"; e.currentTarget.style.background = "rgba(244,63,94,0.16)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.3)"; e.currentTarget.style.color = "#f87171"; }}
          onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_SECONDARY; }}
          onTouchStart={e => { navigator.vibrate?.(8); e.currentTarget.style.transform = "scale(0.96)"; e.currentTarget.style.background = "rgba(244,63,94,0.16)"; e.currentTarget.style.borderColor = "rgba(244,63,94,0.3)"; e.currentTarget.style.color = "#f87171"; }}
          onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_SECONDARY; }}>
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
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><IconCheckRing size={36} color={TEXT_MUTED} strokeWidth={1.3} /></div>
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
          style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#f87171", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(244,63,94,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(244,63,94,0.08)"; e.currentTarget.style.transform = "scale(1)"; }}
          onMouseDown={e => { e.currentTarget.style.transform = "scale(0.95)"; e.currentTarget.style.background = "rgba(244,63,94,0.22)"; }}
          onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(244,63,94,0.08)"; }}
          onTouchStart={e => { navigator.vibrate?.(8); e.currentTarget.style.transform = "scale(0.95)"; e.currentTarget.style.background = "rgba(244,63,94,0.22)"; }}
          onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(244,63,94,0.08)"; }}>
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
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 20,
        }} />}

      {/* ═══ SIDEBAR ═══ */}
      <aside style={{
        // Desktop : width anime 0 ↔ sidebarWidth (dans le flux flex)
        // Mobile  : position fixed, width fixe 80vw, translateX pour ouvrir/fermer
        //           → jamais d'impact sur le layout, le contenu NE BOUGE PAS
        width:    isMobile ? "80vw" : (sidebarOpen ? sidebarWidth : 0),
        minWidth: isMobile ? 0       : (sidebarOpen ? sidebarWidth : 0),
        background: "#060908",
        display: "flex",
        flexDirection: "column",
        position: isMobile ? "fixed" : "relative",
        top: 0, left: 0,
        height: "100dvh",
        zIndex: isMobile ? 50 : 1,
        transform: isMobile ? `translateX(${sidebarOpen ? "0%" : "-100%"})` : "none",
        transition: isMobile
          ? "transform 0.25s ease"
          : "width 0.25s ease, min-width 0.25s ease",
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: "4px 0 32px rgba(0,0,0,0.6)",
        borderRight: "1px solid rgba(16,185,129,0.08)",
      }}>
        <div style={{ width: isMobile ? "80vw" : sidebarWidth, display: "flex", flexDirection: "column", height: "100%", padding: "0 12px" }}>

          {/* Header sidebar */}
          <div style={{ height: 72, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "transparent", borderBottom: "1px solid rgba(255,255,255,0.05)", margin: "0 -12px", marginBottom: 16, flexShrink: 0 }}>
            {/* Logo + nom + sous-titre */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(16,185,129,0.5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 585 586" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M456 0.87578C451.1 1.27578 433.3 1.37577 416.5 1.17577C377.6 0.475768 341.2 2.0758 319.5 5.2758C296.3 8.6758 294.5 9.07578 294.5 9.87578C294.5 10.3758 293.6 10.4758 292.5 10.1758C291.3 9.87583 290.5 10.1758 290.5 10.7758C290.5 11.4758 290.1 11.6758 289.5 11.3758C288.3 10.6758 269.3 15.5758 254.7 20.4758C226.6 29.9758 196.5 43.9757 173 58.5757C73.1 120.776 12.9 217.176 1.30005 333.376C0.300049 343.176 0 375.476 0 465.876V585.376L120 585.676C250.9 585.976 269.6 585.376 298.6 580.476C344.7 572.676 392 553.776 430.4 527.876C455.5 511.076 489.7 479.376 507.1 456.876C519.1 441.476 533.8 419.076 532.9 417.676C532.5 416.976 532.5 416.676 533 417.076C534 418.076 539 409.876 547 393.776C563.1 361.676 572.6 333.276 579.4 296.376C585.2 264.876 585 269.276 584.7 130.876C584.5 60.7758 584.1 2.57579 583.9 1.57579C583.4 -0.0242076 579.8 -0.124208 524.2 0.0757925C491.6 0.0757925 461 0.47578 456 0.87578ZM528.8 31.7758C530.3 32.2758 519.1 43.9757 469.3 93.5757C435.6 127.176 405.1 157.176 401.5 160.376C365.4 192.376 312.4 218.976 262.5 230.376L248 233.576L247.7 230.676C247 224.176 254.3 196.476 261.7 177.376C265.8 166.976 273.3 151.676 278 144.376C279.7 141.576 281 138.676 280.7 137.876C280.4 137.076 280.6 136.676 281 137.076C281.4 137.476 284 134.576 286.8 130.576C295.7 117.576 309.8 101.076 317.5 94.4758C319.4 92.7758 322.8 89.5758 325 87.3758C327.1 85.1758 328.5 84.0758 328 84.8758C327.5 85.6758 329.3 84.4758 332 82.1758C346.5 70.0758 375.5 53.6758 394 47.2758C398.4 45.7758 402.2 44.2758 402.5 43.9758C402.8 43.6758 403.7 43.2758 404.5 43.1758C408.8 42.7758 423.5 38.1758 422.8 37.4758C422.4 36.9758 423 36.9758 424.2 37.2758C425.4 37.6758 429.2 37.2758 432.7 36.4758C446 33.4758 456 32.5758 487.5 31.9758C505.4 31.5758 521.6 31.1758 523.5 31.1758C525.4 31.0758 527.8 31.3758 528.8 31.7758ZM345.5 34.8758C345.5 35.3758 339.8 39.5758 332.8 44.1758C304.5 62.6758 282.3 84.0758 262 112.376C255.5 121.376 246.9 135.876 247.2 137.076C247.4 137.476 247.1 137.876 246.6 137.876C245.5 137.876 235.6 158.976 230.7 171.876C225.1 186.476 219.1 211.376 216.5 230.376C210 278.376 200.8 313.476 186 347.876C178.4 365.276 171.5 377.776 157 400.376L146.1 417.376L89.5 473.876L33 530.376L32.7 510.376C32.4 487.176 34.4 469.476 40 447.376C52.5 397.876 82.6 350.576 121.5 319.176C139.7 304.476 164.5 289.176 179.8 283.176C184.6 281.276 186.7 279.976 187 278.476C187.2 277.276 188.1 270.776 189 263.876C189.9 256.976 190.8 250.376 191.1 249.076C191.4 247.576 191.1 246.876 190 246.876C189.2 246.876 182.1 249.376 174.3 252.476C135.8 267.376 101.7 291.176 72.1001 323.576C59.1001 337.876 50.2 350.076 37.5 371.176C34.2 376.476 31.9 379.476 31.5 378.676C31.2 377.976 31.2001 367.476 31.6001 355.376C32.7001 321.076 37.1 295.376 47.2 264.376C54.6 241.776 60.8 227.276 71 208.876C104.9 148.076 156.3 99.4758 219 68.8758C256.6 50.6758 297.8 38.4758 334.9 34.9758C339.3 34.4758 343.6 34.0758 344.3 33.9758C344.9 33.9758 345.5 34.2758 345.5 34.8758ZM553.3 82.0757C552.7 112.476 551.4 124.076 546 145.476C542.1 160.776 537.7 172.176 528.5 191.376C520.3 208.276 512.8 219.676 499.8 234.876C487.9 248.876 480.4 256.476 470.5 264.476C453.2 278.376 438.7 287.676 422 295.376C408.7 301.576 403.1 304.176 402 304.476C386.7 309.276 373.8 312.476 360.5 314.876C351.4 316.476 339.7 318.676 334.4 319.776C292.8 328.376 251.2 343.876 219 362.776C215.2 365.076 211.5 366.876 210.8 366.876C210.1 366.876 210.7 364.776 212.4 361.076C224 337.776 234.2 306.876 239.5 279.376C242.2 264.876 242.7 263.876 246.5 263.876C248.2 263.876 256.9 262.276 265.8 260.376C324.3 247.576 371.5 224.976 416.2 188.276C427.6 178.876 521 86.5757 521 84.5757C521 83.9757 521.5 83.3758 522 83.3758C523.4 83.3758 546.1 60.7758 545.8 59.6758C545.6 59.2758 546.1 58.9757 546.8 59.0757C547.4 59.2757 547.9 58.7757 547.7 58.0757C547.6 57.2757 547.9 56.9758 548.4 57.2758C548.9 57.5758 549.8 57.1758 550.5 56.3758C553.5 52.7758 553.7 55.1757 553.3 82.0757ZM555.4 225.876C555.5 236.076 553.2 264.376 551 278.876C545.2 317.876 530.5 361.376 512.3 393.176C495.7 422.076 480.5 442.076 457.6 464.876C431.7 490.676 407 507.976 371.8 524.876C354.2 533.376 322.7 544.476 323.7 541.976C323.9 541.476 329.2 537.376 335.5 532.876C356.6 517.776 371.4 503.976 388.5 483.376C416.8 449.476 436.1 409.076 446 363.276C449.8 345.876 450.2 342.376 448.3 343.276C447.6 343.576 441.8 345.876 435.5 348.376C416.1 355.976 417.7 354.476 413.9 368.476C404.6 402.976 386.1 438.176 363.2 465.376C322.7 513.476 270.3 542.676 208 551.976C197 553.576 57.7001 554.476 56.1001 552.876C55.4001 552.176 68.4 538.476 103.5 503.276C175.9 430.776 188.6 419.176 214.9 401.476C241.2 383.776 274.5 368.176 304.5 359.576C308.9 358.276 312.2 356.876 311.8 356.376C311.3 355.976 311.5 355.876 312.2 356.276C312.9 356.576 317.8 355.776 323.2 354.476C336.5 351.076 362 345.876 365 345.876C366.4 345.876 367.5 345.476 367.5 344.976C367.5 344.376 368.4 344.176 369.6 344.376C370.7 344.576 378.5 343.076 386.8 340.976C423.9 331.676 463 311.476 492.1 286.776C508.8 272.576 530.4 247.976 541.8 230.076C544.2 226.376 547.9 220.676 550 217.376L553.9 211.376L554.6 214.376C555 215.976 555.3 221.176 555.4 225.876Z" fill="#10B981"/>
                  </svg>
                </div>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: "-0.5px", lineHeight: 1 }}>
                  Nutri<span style={{ color: ACCENT, textShadow: "0 0 14px rgba(16,185,129,0.30)" }}>Twin</span>
                </p>
              </div>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", letterSpacing: "0.10em", textTransform: "uppercase", paddingLeft: 36 }}>
                Votre compagnon de suivi
              </span>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.opacity = "1"; }}
              onMouseDown={e => { e.currentTarget.style.transform = "scale(0.88)"; e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onTouchStart={e => { navigator.vibrate?.(8); e.currentTarget.style.transform = "scale(0.88)"; e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
              onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={TEXT_SECONDARY} strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* ═══ MON SOUTIEN — Bouton ═══ */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => {
                if (emotionalStatus === "red_critical") return;
                if (!patientId || !practitionerIdFromDb) return;
                // Construire contexte depuis les derniers messages du chat
                const recentLines = messages.slice(-8).map(m => {
                  const roleLabel = m.role === "user" ? "Patient" : "Jumeau";
                  return `${roleLabel}: ${m.content.slice(0, 300)}`;
                });
                const builtContext = recentLines.length > 0
                  ? `[contexte chat récent]\n${recentLines.join("\n")}`
                  : "Mon Soutien";
                setSosSosContext(builtContext);
                // Créer sos_event origin "crise" (Mon Soutien = toujours une demande d'aide)
                void fetch("/api/chat", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ message: "", patientId, practitionerId: practitionerIdFromDb, isSOS: true, sosContext: "Mon Soutien", origin: "crise" }),
                }).catch(() => {});
                setShowSOSExercise(true);
                if (isMobile) setSidebarOpen(false);
              }}
              disabled={sosLoading || emotionalStatus === "red_critical" || !patientId || !practitionerIdFromDb}
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

          {/* ═══ BIBLIOTHÈQUE D'EXERCICES — Bouton ═══ */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => { setShowLibraryModal(true); if (isMobile) setSidebarOpen(false); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 14, background: "rgba(16,185,129,0.06)", border: `1px solid ${ACCENT_BORDER}`, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.06)"; e.currentTarget.style.borderColor = ACCENT_BORDER; }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              <div style={{ textAlign: "left", flex: 1, position: "relative" }}>
                <p style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: "-0.2px" }}>Bibliothèque</p>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(16,185,129,0.65)", lineHeight: 1.5 }}>Exercices à pratiquer librement</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}><path d="M9 18l6-6-6-6" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 4px 14px" }} />

          {/* ═══ RECHERCHE DANS LA CONVERSATION ═══ */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
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
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
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
          </div>

          {/* ═══ SIDEBAR BOTTOM — Profil ═══ */}
          <div style={{ padding: isMobile ? "0 4px 44px" : "0 4px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <button onClick={() => setShowProfileModal(true)} style={{ flexShrink: 0, background: "none", border: "none", padding: 0, cursor: "pointer", transition: "transform 0.15s, opacity 0.15s" }}
              onMouseDown={e => { e.currentTarget.style.transform = "scale(0.92)"; }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
              onTouchStart={e => { navigator.vibrate?.(8); e.currentTarget.style.transform = "scale(0.92)"; }}
              onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(16,185,129,0.5)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {patientPhoto ? (
                  <img src={patientPhoto} alt="avatar" style={{ width: 40, height: 40, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 40, height: 40, background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#000" }}>{patientInitials}</div>
                )}
              </div>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 1px", fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{patientFirstName || "Patient"}</p>
              <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED }}>Mon profil</p>
            </div>
            <button onClick={() => setShowProfileModal(true)} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "scale(1)"; }}
              onMouseDown={e => { e.currentTarget.style.transform = "scale(0.88)"; e.currentTarget.style.background = "rgba(255,255,255,0.18)"; }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onTouchStart={e => { navigator.vibrate?.(8); e.currentTarget.style.transform = "scale(0.88)"; e.currentTarget.style.background = "rgba(255,255,255,0.18)"; }}
              onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}>
              <SettingsIcon size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Garde de bord gauche (mobile, sidebar fermée) ─── */}
      {isMobile && !sidebarOpen && (
        <div
          ref={edgeGuardRef}
          style={{
            position: "fixed",
            top: 0, bottom: 0,
            left: 0, width: 20,
            zIndex: 200,
            touchAction: "none",
          }}
        />
      )}

      {/* ═══ ZONE PRINCIPALE ═══ */}
      <div ref={mainAreaRef} style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, touchAction: "pan-y" }}
        onTouchStart={e => {
          touchStartXRef.current = e.touches[0].clientX;
          touchStartYRef.current = e.touches[0].clientY;
          swipeIntentRef.current = null;
        }}
        onTouchEnd={e => {
          if (swipeIntentRef.current !== "horizontal") return;
          // Ne pas ouvrir/fermer la sidebar si un champ de saisie est actif
          const active = document.activeElement;
          if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) return;
          const dx = e.changedTouches[0].clientX - touchStartXRef.current;
          if (dx > 50 && !sidebarOpen) setSidebarOpen(true);
          if (dx < -50 && sidebarOpen) setSidebarOpen(false);
        }}>

        <header style={{ background: "rgba(8,14,11,0.75)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", height: 60, display: "flex", alignItems: "center", flexShrink: 0, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ flex: 1, padding: isMobile ? "0 16px" : "0 24px", display: "flex", alignItems: "center" }}>
            {(!sidebarOpen || isMobile) && (
              <button onClick={() => setSidebarOpen(v => !v)} style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}>
                <MenuIcon size={15} />
              </button>
            )}
          </div>
        </header>

        {/* ── Wrapper fades haut/bas (style Gemini) ── */}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>

          {/* Fade haut */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 72, background: "linear-gradient(to bottom, #0b0f0d 0%, transparent 100%)", pointerEvents: "none", zIndex: 5 }} />

          <main ref={scrollContainerRef} style={{ height: "100%", overflowY: "auto", overscrollBehaviorX: "none", display: "flex", flexDirection: "column" }}
          onScroll={e => {
            const el = e.currentTarget;
            setShowScrollBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 400);
          }}>
          {/* ═══ BANDEAU POST-IT PRATICIEN ═══ */}
          {pinnedMessage && (
            <div style={{ position: "sticky", top: 0, zIndex: 30, margin: "0 0 0 0", background: "rgba(16,185,129,0.06)", borderBottom: "1px solid rgba(16,185,129,0.2)", backdropFilter: "blur(12px)", padding: "10px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <IconPin size={16} color="rgba(16,185,129,0.7)" strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }} />
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
          {!hasMessages && !sessionLoading && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: isMobile ? "24px 16px 100px" : "32px 24px 100px" }}>
              <div style={{ maxWidth: 580, width: "100%", textAlign: "center" }}>
                <div style={{ position: "relative", width: 64, height: 64, margin: "0 auto 24px" }}>
                  {/* Halo cyan externe — léger, décalé de phase */}
                  <div style={{ position: "absolute", inset: -24, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.07), transparent 62%)", animation: "glow-idle 4s ease-in-out infinite", animationDelay: "1.4s", pointerEvents: "none" }} />
                  {/* Halo vert interne — existant */}
                  <div style={{ position: "absolute", inset: -12, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.18), transparent 70%)", animation: "glow-idle 3s ease-in-out infinite" }} />
                  {/* Cercle principal avec bordure dégradée vert→cyan */}
                  <div style={{ width: 64, height: 64, borderRadius: "50%", border: "1.5px solid transparent", background: "linear-gradient(#080e0b, #080e0b) padding-box, linear-gradient(135deg, rgba(16,185,129,0.65), rgba(52,211,153,0.45)) border-box", boxShadow: "0 0 20px rgba(16,185,129,0.12), 0 0 36px rgba(16,185,129,0.06)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}><LeafIcon size={28} /></div>
                </div>
                <h1 style={{ margin: "0 0 8px", fontSize: isMobile ? 26 : 30, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: "-0.5px" }}>
                  {patientFirstName ? `Bonjour ${patientFirstName}` : "Bonjour"}
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

                {/* ── Carte PWA — intégrée dans l'écran d'accueil, pas de popup ── */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <PwaInstallPrompt />
                </div>
              </div>
            </div>
          )}

          {hasMessages && (
            <div style={{ flex: isMobile ? 1 : undefined, padding: isMobile ? "16px 16px 100px" : "24px 36px 24px" }}>
              <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28, touchAction: "auto" }}>
                {visibleMessages.map((msg, index) => {
                  const isUser = msg.role === "user";
                  const isLastAssistant = msg.role === "assistant" && index === visibleMessages.length - 1;
                  if (msg.role === "assistant" && !msg.content && isLastAssistant) {
                    return (
                      <div key={index} ref={el => { messageRefs.current[index] = el; }}
                        style={{ display: "flex", alignItems: "flex-start", animation: "fadeUp 0.3s ease", paddingLeft: 38 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 2 }}>
                          <div style={{ position: "relative", width: 20, height: 20, flexShrink: 0 }}>
                            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", animation: "spin 1.8s linear infinite" }} viewBox="0 0 20 20" fill="none">
                              <circle cx="10" cy="10" r="8" stroke="rgba(16,185,129,0.08)" strokeWidth="1.5"/>
                              <circle cx="10" cy="10" r="8" stroke="#10b981" strokeWidth="1.5" strokeDasharray="16 35" strokeLinecap="round"/>
                            </svg>
                          </div>
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", fontStyle: "italic", animation: "nt-analyse 1.8s ease-in-out infinite" }}>Analyse en cours</span>
                        </div>
                      </div>
                    );
                  }
                  if (msg.role === "widget" && msg.sosSummary) {
                    return (
                      <div key={index} ref={el => { messageRefs.current[index] = el; }}
                        style={{ display: "flex", justifyContent: "flex-start", animation: "fadeUp 0.25s ease" }}>
                        <SosSummaryCard {...msg.sosSummary} />
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
                          <div style={{ padding: isMobile ? "12px 16px" : "13px 18px", borderRadius: 18, background: isActiveMatch ? "rgba(16,185,129,0.07)" : "rgba(16,185,129,0.03)", color: "rgba(255,255,255,0.75)", fontSize: 14, lineHeight: 1.6, border: isActiveMatch ? `1.5px solid rgba(16,185,129,0.4)` : "1px solid rgba(16,185,129,0.2)", transition: "all 0.3s" }}>
                            {msg.content}
                          </div>
                        ) : (
                          <>
                            <div style={{ padding: isMobile ? "4px 2px" : "4px 0", background: "transparent", border: isActiveMatch ? `1px solid rgba(16,185,129,0.25)` : "none", borderRadius: isActiveMatch ? 14 : 0, paddingLeft: isActiveMatch ? 14 : 0, color: "rgba(255,255,255,0.95)", fontSize: 15, lineHeight: 1.8, transition: "all 0.3s" }}>
                              {msg.content}
                            </div>
                            {msg.sosTrigger && (
                              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                                <p style={{ margin: "0 0 6px", fontSize: 12, color: "rgba(255,255,255,0.38)", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600 }}>
                                  Un exercice pourrait t&apos;aider maintenant
                                </p>
                                {msg.sosTrigger.map(toolId => {
                                  const meta = SOS_EXERCISE_META[toolId];
                                  if (!meta) return null;
                                  return (
                                    <button key={toolId}
                                      onClick={() => handleChatSosTrigger(toolId)}
                                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.15)", cursor: "pointer", textAlign: "left", transition: "all 0.2s", width: "100%" }}
                                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.09)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.04)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.15)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                                      <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(16,185,129,0.9)"><path d={meta.icon}/></svg>
                                      </div>
                                      <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>{meta.label}</span>
                                      <svg style={{ marginLeft: "auto", flexShrink: 0, opacity: 0.4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </>
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

          {/* Fade bas */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 56, background: "linear-gradient(to top, #0b0f0d 0%, transparent 100%)", pointerEvents: "none", zIndex: 5 }} />

        </div>{/* fin wrapper fades */}

        {/* ═══ BANNIÈRE URGENCE RED_CRITICAL ═══ */}
        {emotionalStatus === "red_critical" && (
          <div style={{ background: "rgba(127,0,0,0.18)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(244,63,94,0.35)", padding: isMobile ? "14px 16px" : "16px 24px", flexShrink: 0 }}>
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 16, padding: "16px 18px" }}>
                <IconSiren size={22} color="#f87171" strokeWidth={1.5} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#f87171" }}>Une alerte a été transmise à votre praticien</p>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "#fca5a5", lineHeight: 1.6 }}>Si vous traversez une situation d'urgence, contactez immédiatement un professionnel.</p>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a href="tel:15" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.4)", color: "#f87171", fontSize: 15, fontWeight: 700, textDecoration: "none", transition: "all 0.2s" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.25)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.15)"}>
                      <span>SAMU · 15</span>
                    </a>
                    <a href="tel:3114" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", color: "#fca5a5", fontSize: 15, fontWeight: 700, textDecoration: "none", transition: "all 0.2s" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.2)"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.1)"}>
                      <span>Numéro national · 3114</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {hasMessages && emotionalStatus !== "red_critical" && (
          <div style={{
            position: isMobile ? "fixed" : "sticky",
            bottom: 0, left: 0, right: 0,
            zIndex: isMobile ? 25 : 10,
            background: isMobile
              ? `linear-gradient(to bottom, transparent 0%, #0b0f0d 38%)`
              : `linear-gradient(to bottom, transparent 0%, rgba(11,15,13,0.97) 32%)`,
            backdropFilter: isMobile ? undefined : "blur(12px)",
            WebkitBackdropFilter: isMobile ? undefined : "blur(12px)",
            padding: isMobile ? "16px 12px 12px" : "28px 20px 20px",
            paddingBottom: isMobile ? `max(12px, env(safe-area-inset-bottom, 0px))` : "24px",
            paddingLeft: isMobile ? `max(12px, env(safe-area-inset-left, 0px))` : undefined,
            paddingRight: isMobile ? `max(12px, env(safe-area-inset-right, 0px))` : undefined,
            opacity: sidebarOpen && isMobile ? 0.4 : 1,
            pointerEvents: sidebarOpen && isMobile ? "none" : "auto",
            transition: "opacity 0.25s",
            ...(isMobile ? { transform: "translateZ(0)", WebkitTransform: "translateZ(0)" } : {}),
          }}>
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
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
              <p style={{ margin: "10px 0 0", fontSize: 10, color: TEXT_MUTED, textAlign: "center", whiteSpace: "nowrap" }}>
                NutriTwin est une IA · En cas de doute, consultez votre praticien
              </p>
            </div>
            {/* ─── Bouton scroll-to-bottom ─── */}
            {showScrollBottom && (
              <button
                onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", zIndex: 26, width: 44, height: 44, borderRadius: "50%", background: "rgba(15,22,18,0.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(16,185,129,0.45)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 18px rgba(0,0,0,0.4)", transition: "border-color 0.2s, box-shadow 0.2s", color: ACCENT }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = "inset 0 1px 3px rgba(0,0,0,0.3), 0 6px 24px rgba(16,185,129,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.35)"; e.currentTarget.style.boxShadow = "inset 0 1px 3px rgba(0,0,0,0.3), 0 4px 18px rgba(0,0,0,0.25)"; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12l7 7 7-7"/>
                </svg>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} style={{ display: "none" }} />
          </div>
        )}
      </div>

      {/* Toast supprimé — le ressenti post-exercice est maintenant recueilli dans la modale */}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes glow-idle { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.1); } }
        @keyframes ripple-out { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(2.8); opacity: 0; } }
        @keyframes pulse-ring { 0%, 100% { box-shadow: 0 0 14px rgba(16,185,129,0.3), 0 0 28px rgba(16,185,129,0.1); } 50% { box-shadow: 0 0 22px rgba(16,185,129,0.55), 0 0 40px rgba(16,185,129,0.2); } }
        @keyframes glow-sos { 0%, 100% { box-shadow: 0 0 16px rgba(16,185,129,0.25), inset 0 0 10px rgba(16,185,129,0.08); } 50% { box-shadow: 0 0 28px rgba(16,185,129,0.45), inset 0 0 14px rgba(16,185,129,0.15); } }
        @keyframes breathe { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(0.75); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .nt-inputbar:focus-within { border-color: rgba(16,185,129,0.45) !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.06), 0 0 16px rgba(16,185,129,0.06) !important; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes nt-analyse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.65; } }
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
