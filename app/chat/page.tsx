"use client";

import { KeyboardEvent, useState, useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import JournalModal from "./JournalModal";
import BreathingExercise from "./BreathingExercise";
import AncrageExercise from "./AncrageExercise";
import MindfulEating from "./MindfulEating";
import RestructurationExercise from "./RestructurationExercise";
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
  manger:    <IconLeaf2  size={28} color={CYAN} />,
  breathing: <IconWind   size={28} color={CYAN} />,
  ancrage:   <IconEye    size={28} color={CYAN} />,
  defusion:  <IconLayers size={28} color={CYAN} />,
};

const LIBRARY_EXERCISE_ICONS: Record<string, (color: string) => React.ReactElement> = {
  breathing: (c) => <IconWind   size={22} color={c} />,
  ancrage:   (c) => <IconEye    size={22} color={c} />,
  defusion:  (c) => <IconLayers size={22} color={c} />,
  manger:    (c) => <IconLeaf2  size={22} color={c} />,
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
  isMobile?: boolean;
};

const InputBar = ({ isCenter = false, message, setMessage, send, loading, pendingImage, photoHovered, setPhotoHovered, handleImageClick, handleKeyDown, inputRef, isMobile = false }: InputBarProps) => {
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
      display: "flex",
      alignItems: "center",
      background: "rgba(20,30,24,0.96)",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      borderRadius: 26,
      border: "none",
      padding: isCenter ? "12px 12px 12px 18px" : "10px 10px 10px 18px",
      transition: "box-shadow 0.25s",
      boxShadow: focused
        ? "0 6px 36px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)"
        : "0 4px 24px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.06)",
      minHeight: isCenter ? 80 : 70,
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
          placeholder={pendingImage ? "Votre question…" : "Écrire un message…"}
          rows={1}
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
          {!isMobile && <span style={{ fontSize: 11, color: ACCENT, fontWeight: 500, whiteSpace: "nowrap", maxWidth: photoHovered ? 120 : 0, opacity: photoHovered ? 1 : 0, transition: "max-width 0.25s ease, opacity 0.2s", overflow: "hidden" }}>Partager une photo</span>}
          <button onClick={handleImageClick} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.25)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: ACCENT, transition: "all 0.15s", flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.14)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.45)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.07)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.25)"; }}>
            <CameraIcon size={16} color="currentColor" />
          </button>
        </div>
        {/* Send — même DA que les autres boutons */}
        <button onClick={() => void send()} disabled={!canSend}
          style={{
            width: 36, height: 36,
            borderRadius: "50%",
            background: canSend ? "rgba(16,185,129,0.10)" : "rgba(16,185,129,0.04)",
            border: `1px solid ${canSend ? "rgba(16,185,129,0.35)" : "rgba(16,185,129,0.12)"}`,
            cursor: canSend ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={canSend ? (e => { e.currentTarget.style.background = "rgba(16,185,129,0.18)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.55)"; }) : undefined}
          onMouseLeave={canSend ? (e => { e.currentTarget.style.background = "rgba(16,185,129,0.10)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.35)"; }) : undefined}>
          <ArrowUpIcon size={14} color={canSend ? ACCENT : TEXT_MUTED} />
        </button>
      </div>
    </div>
  );
};

// ═══ ONBOARDING TOUR PATIENT ═══
type OnboardingProps = {
  firstName: string;
  onDone: () => void;
};

const OnboardingTour = ({ firstName, onDone }: OnboardingProps) => {
  const [visible, setVisible] = useState(false);
  const [os, setOs] = useState<"ios" | "android" | "desktop">("desktop");

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) setOs("ios");
    else if (/android/i.test(ua)) setOs("android");
    else setOs("desktop");
    return () => clearTimeout(t);
  }, []);

  const StepIcon = ({ children }: { children: React.ReactNode }) => (
    <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {children}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "relative", zIndex: 1, width: "calc(100% - 40px)", maxWidth: 400,
        background: "#0d0d0d", borderRadius: 24, padding: "40px 30px 32px",
        border: "1px solid rgba(16,185,129,0.18)",
        boxShadow: "0 40px 120px rgba(0,0,0,0.9), 0 0 80px rgba(16,185,129,0.12), 0 0 200px rgba(16,185,129,0.06)",
        opacity: visible ? 1 : 0, transform: visible ? "scale(1) translateY(0)" : "scale(0.97) translateY(8px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
        fontFamily: "Inter, sans-serif",
      }}>
        {/* Ligne accent haut */}
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 160, height: 2, background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.6), transparent)", borderRadius: 2 }} />

        {/* Logo cercle lumineux */}
        <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 24px" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(16,185,129,0.2)", filter: "blur(16px)" }} />
          <div style={{ position: "relative", width: 72, height: 72, borderRadius: "50%", border: "2px solid rgba(16,185,129,0.6)", boxShadow: "0 0 16px rgba(16,185,129,0.3), 0 0 32px rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/logo-new.svg" alt="" style={{ width: 36, height: 36 }} />
          </div>
        </div>

        {/* Titre */}
        <h1 style={{ margin: "0 0 20px", fontSize: 17, fontWeight: 800, color: "white", textAlign: "center", letterSpacing: "0.04em", lineHeight: 1.35, textTransform: "uppercase" }}>
          Bienvenue dans votre<br />espace, {firstName}&nbsp;!
        </h1>

        {/* Corps */}
        <p style={{ margin: "0 0 28px", fontSize: 13, color: "rgba(255,255,255,0.46)", lineHeight: 1.85, textAlign: "center" }}>
          Ici, vous pouvez échanger à tout moment avec votre compagnon de suivi. Il est là pour vous écouter, vous accompagner au quotidien et vous aider à progresser entre vos consultations.
        </p>

        {/* Section PWA — masquée sur desktop */}
        {os !== "desktop" && (
          <div style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "16px 14px 14px", marginBottom: 24 }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em" }}>INSTALLER L&apos;APPLICATION</p>
            <p style={{ margin: "0 0 14px", fontSize: 12, color: "rgba(255,255,255,0.36)", lineHeight: 1.6 }}>
              Pour accéder à votre espace en un clic, installez l&apos;app sur votre écran d&apos;accueil. C&apos;est gratuit et se fait en{" "}
              <strong style={{ color: "rgba(255,255,255,0.6)" }}>{os === "ios" ? "3" : "2"} clics</strong> :
            </p>

            {/* Étapes iOS */}
            {os === "ios" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StepIcon>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  </StepIcon>
                  <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>Cliquer sur <strong style={{ color: "rgba(255,255,255,0.85)" }}>Partager</strong></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StepIcon>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </StepIcon>
                  <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>Faites défiler vers le bas</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StepIcon>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  </StepIcon>
                  <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>Appuyer sur <strong style={{ color: "rgba(255,255,255,0.85)" }}>Sur l&apos;écran d&apos;accueil</strong></span>
                </div>
              </div>
            )}

            {/* Étapes Android */}
            {os === "android" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StepIcon>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1.3" fill="#10b981"/><circle cx="12" cy="12" r="1.3" fill="#10b981"/><circle cx="12" cy="19" r="1.3" fill="#10b981"/></svg>
                  </StepIcon>
                  <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>Cliquer sur le menu <strong style={{ color: "rgba(255,255,255,0.85)" }}>⋮</strong> en haut à droite</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <StepIcon>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  </StepIcon>
                  <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>Appuyer sur <strong style={{ color: "rgba(255,255,255,0.85)" }}>Ajouter à l&apos;écran d&apos;accueil</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <button onClick={onDone}
          style={{ width: "100%", height: 48, borderRadius: 13, background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.07))", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.28), rgba(16,185,129,0.12))"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.07))"; }}>
          Accéder au chat
        </button>
      </div>
    </div>
  );
};

// ═══ BIBLIOTHÈQUE D'EXERCICES — accès direct, hors situation de crise ═══
// Les 5 exercices retravaillés (Gemini Live). Lancés en dehors de toute triage SOS,
// toujours en origin "pratique" (Exercices pratiqués côté Dashboard, jamais "[Non résolu]").
const LIBRARY_EXERCISES: { id: string; label: string; desc: string; iconBg: string; iconColor: string }[] = [
  { id: "breathing", label: "Retrouver mon calme",       desc: "Ralentir avec la respiration",              iconBg: "rgba(59,130,246,0.15)",  iconColor: "#60a5fa" },
  { id: "ancrage",   label: "Me reconnecter",            desc: "Revenir à ce qui m'entoure",                iconBg: "rgba(16,185,129,0.12)",  iconColor: ACCENT },
  { id: "defusion",  label: "Défier une pensée négative", desc: "Prendre du recul sur ce que je me dis",   iconBg: "rgba(245,158,11,0.12)",  iconColor: "#fbbf24" },
  { id: "manger",    label: "Accompagner mon repas",     desc: "Manger avec plus de conscience",            iconBg: "rgba(139,92,246,0.12)",  iconColor: "#a78bfa" },
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
  const [practitionerTutoiement, setPractitionerTutoiement] = useState("");
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    // En mode test l'iframe est intégrée dans le dashboard desktop —
    // on force toujours le layout desktop quelle que soit la largeur du panneau.
    if (new URLSearchParams(window.location.search).get("test") === "true") return false;
    return window.innerWidth < 768;
  });
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileScreen, setProfileScreen] = useState<"main" | "victoires" | "voix" | "password" | "legal" | "erreur" | "preferences">("main");
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  // Signaler une erreur
  const [errorField, setErrorField] = useState("");
  const [errorCorrection, setErrorCorrection] = useState("");
  const [errorSubmitting, setErrorSubmitting] = useState(false);
  const [errorSubmitted, setErrorSubmitted] = useState(false);
  // Préférences alimentaires
  const [profileData, setProfileData] = useState<{
    age?: number | null; sexe?: string | null; taille?: number | null; poids?: number | null;
    pathologies?: string | null; allergies?: string | null; traitements?: string | null;
    objectif_clinique?: string | null; niveau_activite?: string | null; regime_specifique?: string | null;
    objective?: string | null; motivation?: string | null; defi?: string | null; aliments_aimes?: string | null; aliments_detestes?: string | null;
  } | null>(null);
  const [prefObjectif, setPrefObjectif] = useState("");
  const [prefMotivation, setPrefMotivation] = useState("");
  const [prefDefi, setPrefDefi] = useState("");
  const [prefAliments, setPrefAliments] = useState("");
  const [prefEvite, setPrefEvite] = useState("");
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);
  const [prefLoaded, setPrefLoaded] = useState(false);
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
  // Supprime l'écho realtime du message assistant qu'on vient de streamer
  const blockRealtimeAssistantRef = useRef<boolean>(false);
  const hasMessages = messages.filter(m => !m.hidden).length > 0;
  const sidebarWidth = 305;
  const [showToast, setShowToast] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
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
  // showLibraryModal supprimé — exercices intégrés directement dans la sidebar
  const [postExerciseStep, setPostExerciseStep] = useState<{ toolId: string; answer: string } | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [chatSearchIdx, setChatSearchIdx] = useState(0);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ─── Mode test (praticien qui simule l'expérience patient) ──────────────────
  const isTestMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("test") === "true";
  const [testToken, setTestToken] = useState<string | null>(null);
  // tFetch : wrapper fetch qui ajoute Authorization: Bearer en mode test
  const tFetch = useCallback((url: string, opts?: RequestInit): Promise<Response> => {
    if (!testToken) return fetch(url, opts);
    const headers = new Headers(opts?.headers);
    headers.set("Authorization", `Bearer ${testToken}`);
    return fetch(url, { ...opts, headers });
  }, [testToken]);

  // ─── Voix thérapeutique ────────────────────────────────────────────────────
  const { voices: therapeuticVoices, selectedVoice: selectedTherapeuticVoice, setSelectedVoice: setTherapeuticVoice, previewVoice: previewTherapeuticVoice, warmUp: warmUpVoice, isPlaying: isVoicePlaying } = useTherapeuticVoice();

  // Préchauffage du WebSocket quand l'écran voix s'ouvre
  // + chargement profil pour "erreur" et "preferences"
  useEffect(() => {
    if (profileScreen === "voix" && selectedTherapeuticVoice) {
      warmUpVoice(selectedTherapeuticVoice.id);
    }
    if (profileScreen === "erreur") {
      setErrorField("");
      setErrorCorrection("");
      setErrorSubmitted(false);
    }
    if ((profileScreen === "erreur" || profileScreen === "preferences") && !prefLoaded) {
      void fetch("/api/get-patient-profile")
        .then(r => r.json())
        .then((data: { patient?: { age?: number | null; sexe?: string | null; taille?: number | null; poids?: number | null; pathologies?: string | null; allergies?: string | null; traitements?: string | null; objectif_clinique?: string | null; niveau_activite?: string | null; regime_specifique?: string | null; objective?: string | null; motivation?: string | null; defi?: string | null; aliments_aimes?: string | null; aliments_detestes?: string | null } }) => {
          if (data.patient) {
            setProfileData(data.patient);
            setPrefObjectif(data.patient.objective ?? "");
            setPrefMotivation(data.patient.motivation ?? "");
            setPrefDefi(data.patient.defi ?? "");
            setPrefAliments(data.patient.aliments_aimes ?? "");
            setPrefEvite(data.patient.aliments_detestes ?? "");
            setPrefLoaded(true);
          }
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileScreen]);

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
    // En mode test (iframe dans le dashboard) → toujours desktop, pas de recalcul au resize.
    if (new URLSearchParams(window.location.search).get("test") === "true") return;
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
      const res = await tFetch(`/api/sos/closures?patientId=${pid}&practitionerId=${practId}`);
      if (!res.ok) return;
      const data = await res.json() as { events?: SosClosureEvent[] };
      if (!data.events?.length) return;
      setMessages(mergeSosClosures(rows, data.events) as ChatMessage[]);
    } catch { /* silencieux */ }
  }, [tFetch]);

  const handleOnboardingDone = useCallback(async () => {
    setShowOnboarding(false);
    if (!patientId) return;
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await supabase.from("patients").update({ onboarding_done: true }).eq("user_id", patientId);
  }, [patientId]);

  // ── Effect 1 : test mode — s'exécute UNE seule fois au montage ──────────────
  useEffect(() => {
    if (!isTestMode) return;
    fetch("/api/test-mode/session")
      .then(r => r.json())
      .then(async (d: { access_token?: string; refresh_token?: string; patient_user_id?: string; error?: string }) => {
        if (!d.access_token || !d.patient_user_id) { setSessionLoading(false); return; }
        setTestToken(d.access_token);
        const pid = d.patient_user_id;
        setPatientId(pid);
        // Créer un client Supabase avec une clé de stockage séparée pour ne pas écraser la session praticien
        const testSupabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { auth: { storageKey: "sb-test-auth-token" } }
        );
        await testSupabase.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token! });
        // Charger le vrai prénom du patient test
        const { data: testPat } = await testSupabase.from("patients").select("first_name, last_name").eq("user_id", pid).single();
        const tp = testPat as { first_name?: string | null; last_name?: string | null } | null;
        if (tp?.first_name) {
          setPatientFirstName(tp.first_name);
          setPatientInitials(`${tp.first_name[0]}${tp.last_name?.[0] ?? "T"}`.toUpperCase());
        } else {
          setPatientFirstName("Patient");
          setPatientInitials("PT");
        }
        // Charger les infos praticien (avec Bearer token)
        const practInfoRes = await fetch("/api/patient/practitioner-info", {
          headers: { Authorization: `Bearer ${d.access_token}` },
        });
        if (!practInfoRes.ok) {
          const errText = await practInfoRes.text().catch(() => "");
          console.error("[NutriTwin] practitioner-info (test mode) FAILED", practInfoRes.status, errText);
        }
        if (practInfoRes.ok) {
          const practInfo = await practInfoRes.json() as { practitionerId: string; plan: string; tutoiement?: string };
          const practId = practInfo.practitionerId;
          setPractitionerIdFromDb(practId);
          setPractitionerPlan(practInfo.plan || "essentiel");
          if (practInfo.tutoiement) setPractitionerTutoiement(practInfo.tutoiement);
          // Restaurer le currentSessionId pour continuer la session en cours après refresh
          const restoredSessionId = sessionStorage.getItem("nt_session_id");
          if (restoredSessionId) setCurrentSessionId(restoredSessionId);
          // Charger l'historique via API serveur (service_role, bypass RLS, gère practitioner_id=null)
          const histRes = await fetch(`/api/conversations?practitionerId=${practId}`, {
            headers: { Authorization: `Bearer ${d.access_token}` },
          });
          if (histRes.ok) {
            const { messages: testHistData } = await histRes.json() as { messages: { role: "user" | "assistant"; content: string; created_at: string }[] };
            if (testHistData?.length) {
              setMessages(testHistData as ChatMessage[]);
              void hydrateSosClosures(pid, practId, testHistData);
            }
          } else {
            console.error("[NutriTwin] /api/conversations (test) FAILED", histRes.status, await histRes.text().catch(() => ""));
          }
        }
        await loadSessions(pid);
        setSessionLoading(false);
      })
      .catch(() => setSessionLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionnellement vide — le setup test ne s'exécute qu'une fois au montage

  // ── Effect 2 : authentification normale par cookie (skippé en mode test) ───
  useEffect(() => {
    if (isTestMode) return;

    // ── Mode normal : authentification par cookie ────────────────────────────
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
      // Charger les infos praticien via API sécurisée (service role, bypass RLS)
      const practInfoRes = await tFetch("/api/patient/practitioner-info");
      if (!practInfoRes.ok) {
        const errText = await practInfoRes.text().catch(() => "");
        console.error("[NutriTwin] practitioner-info FAILED", practInfoRes.status, errText);
      }
      if (practInfoRes.ok) {
        const practInfo = await practInfoRes.json() as { practitionerId: string; plan: string; firstName: string; lastName: string; tutoiement?: string };
        const practId = practInfo.practitionerId;
        setPractitionerIdFromDb(practId);
        setPractitionerPlan(practInfo.plan || "essentiel");
        if (practInfo.tutoiement) setPractitionerTutoiement(practInfo.tutoiement);
        // Restaurer le currentSessionId pour continuer la session en cours après refresh
        const restoredSessionId = sessionStorage.getItem("nt_session_id");
        if (restoredSessionId) setCurrentSessionId(restoredSessionId);
        // Charger l'historique via API serveur (service_role, bypass RLS, gère practitioner_id=null)
        const histRes = await tFetch(`/api/conversations?practitionerId=${practId}`);
        if (histRes.ok) {
          const { messages: allHist } = await histRes.json() as { messages: { role: "user" | "assistant"; content: string; created_at: string }[] };
          if (allHist?.length) {
            setMessages(allHist as ChatMessage[]);
            void hydrateSosClosures(data.user.id, practId, allHist);
          }
        } else {
          console.error("[NutriTwin] /api/conversations FAILED", histRes.status, await histRes.text().catch(() => ""));
        }
      }
      const { data: pat } = await supabase.from("patients").select("first_name, last_name, onboarding_done, emotional_status, practitioner_pinned_message, avatar_updated_at").eq("user_id", data.user.id).single();
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
        // 2. Comparer la version DB (avatar_updated_at) avec la version locale
        // Si elles correspondent → la b64 en cache est à jour, pas besoin de toucher le CDN
        // Si elles divergent → autre appareil a uploadé, on re-fetch avec le timestamp DB comme cache-buster
        const dbAvatarVersion = (p as { avatar_updated_at?: string | null }).avatar_updated_at ?? null;
        const cachedVersion = localStorage.getItem(`avatar_version_${userId}`);
        const versionMatch = dbAvatarVersion && cachedVersion === dbAvatarVersion;
        if (!versionMatch) {
          try {
            const { data: photoData } = supabase.storage.from("Avatars").getPublicUrl(`${userId}/avatar.jpg`);
            if (photoData && dbAvatarVersion) {
              // Utiliser avatar_updated_at comme cache-buster (stable, pas Date.now())
              const freshUrl = photoData.publicUrl + "?t=" + encodeURIComponent(dbAvatarVersion);
              const res = await fetch(freshUrl);
              if (res.ok) {
                const blob = await res.blob();
                const reader = new FileReader();
                reader.onload = () => {
                  const b64 = reader.result as string;
                  setPatientPhoto(b64);
                  localStorage.setItem(`avatar_b64_${userId}`, b64);
                  localStorage.setItem(`avatar_version_${userId}`, dbAvatarVersion);
                };
                reader.readAsDataURL(blob);
              } else {
                // Photo supprimée ou inexistante
                setPatientPhoto(null);
                localStorage.removeItem(`avatar_b64_${userId}`);
                localStorage.removeItem(`avatar_version_${userId}`);
              }
            }
          } catch {
            // Erreur réseau — on garde le cache local
          }
        }
        // Charger victoires (latest_victory retourné par get-patient-profile)
        const latestVictory = (p as { latest_victory?: string }).latest_victory;
        const victories: string[] = latestVictory ? [latestVictory] : [];
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSessions, hydrateSosClosures]);

  // ─── Heartbeat "dernière connexion" ─────────────────────────────────────────
  // Rafraîchit last_seen_at toutes les 5 min tant que l'onglet est visible, et
  // au retour au premier plan, pour que le dashboard praticien reflète une
  // session en cours même sans nouveaux messages.
  // Désactivé en mode test pour ne pas polluer les métriques d'assiduité réelles.
  useEffect(() => {
    if (!patientId) return;
    if (isTestMode) return;
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
          // Bloquer l'écho realtime pendant et juste après le stream assistant
          if (row.role === "assistant" && blockRealtimeAssistantRef.current) {
            blockRealtimeAssistantRef.current = false;
            return;
          }
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


  // ─── Restructuration cognitive overlay complete ──────────────────────────────
  // Pas de message dans le chat patient — uniquement un log backend visible côté praticien.
  const handleDefusionTransitionToChat = useCallback((
    original: string,
    reformulated: string,
    closing: string
  ) => {
    setShowDefusionExercise(false);
    // Note : le log vers /api/exercise/log est géré directement par RestructurationExercise
  }, []);

  // Soumission de la réponse post-exercice depuis la modale
  const handlePostExerciseSubmit = useCallback(async () => {
    if (!postExerciseStep) return;
    const { toolId, answer } = postExerciseStep;
    setPostExerciseStep(null);
    closeTool();

    // Tracer l'événement SOS en arrière-plan (placeholder)
    if (patientId && practitionerIdFromDb) {
      tFetch("/api/sos-feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, practitionerId: practitionerIdFromDb, eventId: null, stressBeforeProxy: 5, scoreAfter: 5, isPlaceholder: true }),
      }).catch(() => {});
    }

    // Envoyer la réponse post-exercice à Gemini → récupérer le message de clôture → l'afficher dans le chat
    if (patientId && practitionerIdFromDb) {
      try {
        const res = await tFetch("/api/chat", {
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
    const needsMic = ["breathing", "ancrage", "manger", "defusion", "sos"].includes(toolId);
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
      void tFetch("/api/chat", {
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

  const sendHidden = async (msg: string) => {
    if (!patientId || !practitionerIdFromDb) return;
    try { await tFetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: msg, patientId, practitionerId: practitionerIdFromDb, sessionId: currentSessionId ?? undefined }) }); }
    catch { /* silencieux */ }
  };

  const sendStressData = async (before: number, after: number, toolId: string) => {
    if (!patientId || !practitionerIdFromDb) return;
    try {
      await tFetch("/api/sos-feedback", {
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
      { role: "widget", content: "", sosSummary: { word: word || "—", feeling, intake: intake?.trim() || null, intakeMurmure: null, crisisLevel: null, crisisMessageId: null } },
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
    const id = (data as { id: string } | null)?.id ?? null;
    if (id) {
      setCurrentSessionId(id);
      sessionStorage.setItem("nt_session_id", id);
    }
    return id;
  };

  const loadSession = async (sessionId: string) => {
    if (!patientId || !practitionerIdFromDb) return;
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from("conversations").select("role, content, created_at").eq("patient_id", patientId).eq("practitioner_id", practitionerIdFromDb).eq("session_id", sessionId).order("created_at", { ascending: true });
    if (data) {
      setMessages(data as ChatMessage[]);
      setCurrentSessionId(sessionId);
      // Persiste la session courante pour la restaurer après un refresh
      sessionStorage.setItem("nt_session_id", sessionId);
      if (isMobile) setSidebarOpen(false);
      void hydrateSosClosures(patientId, practitionerIdFromDb, data as { role: "user" | "assistant"; content: string; created_at: string }[]);
    }
  };

  const deleteSession = async (sessionId: string) => {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await supabase.from("conversations_sessions").delete().eq("id", sessionId);
    if (currentSessionId === sessionId) {
      setMessages([]);
      setCurrentSessionId(null);
      sessionStorage.removeItem("nt_session_id");
    }
    if (patientId) await loadSessions(patientId);
  };

  const handleImageClick = () => {
    if (!["pro", "cabinet"].includes(practitionerPlan)) { setShowUpsellModal(true); return; }
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
    const userMsg: ChatMessage = { role: "user", content: trimmed || "📷 Photo", imageUrl: img?.previewUrl, ...(opts?.hidden ? { hidden: true } : {}) };
    const newMessages: ChatMessage[] = [...messages, userMsg];
    const assistantIndex = newMessages.length;
    blockRealtimeAssistantRef.current = true; // bloquer l'écho realtime pendant le stream
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setMessage(""); setPendingImage(null); setLoading(true);
    abortControllerRef.current = new AbortController();

    // ─── Reset refs stream ───
    if (typewriterRafRef.current !== null) { cancelAnimationFrame(typewriterRafRef.current); typewriterRafRef.current = null; }
    targetTextRef.current = "";
    displayedLenRef.current = 0;
    streamDoneRef.current = false;

    try {
      const body: Record<string, string | undefined> = { message: trimmed || "Analyse cette photo", patientId: patientId ?? undefined, practitionerId: practitionerIdFromDb ?? undefined, sessionId: currentSessionId ?? undefined };
      if (img) { body.imageBase64 = img.base64; body.imageMimeType = img.mimeType; }
      const res = await tFetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: abortControllerRef.current.signal });
      if (!res.ok) {
        // Erreur plan vision — afficher un message explicite au lieu de "Impossible de contacter le serveur"
        if (res.status === 403 && img) {
          const errData = await res.json().catch(() => ({})) as { error?: string };
          if (errData.error === "vision_plan_required") {
            setShowUpsellModal(true);
            setMessages(prev => prev.slice(0, -2)); // annuler le message utilisateur + placeholder assistant
            setLoading(false); return;
          }
        }
        throw new Error("Erreur");
      }
      if (!res.body) throw new Error("Erreur");

      // ─── Stream : RAF typewriter — découple réception et affichage ───
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let fullText = "";

      // Tick RAF : avance l'affichage de N chars/frame (≈3 en live, 6 en rattrapage)
      const tick = () => {
        const target = targetTextRef.current;
        const cur = displayedLenRef.current;
        if (cur < target.length) {
          const speed = streamDoneRef.current ? 6 : 3;
          const next = Math.min(cur + speed, target.length);
          displayedLenRef.current = next;
          setMessages(prev => {
            const u = [...prev];
            if (u[assistantIndex]) u[assistantIndex] = { ...u[assistantIndex], content: target.slice(0, next) };
            return u;
          });
        }
        if (!streamDoneRef.current || displayedLenRef.current < targetTextRef.current.length) {
          typewriterRafRef.current = requestAnimationFrame(tick);
        } else {
          typewriterRafRef.current = null;
        }
      };
      typewriterRafRef.current = requestAnimationFrame(tick);

      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        fullText += decoder.decode(value, { stream: true });
        const visible = fullText
          .replace(/\|\|\|[\s\S]*?\|\|\|/g, "")
          .trim();
        targetTextRef.current = visible;
      }
      streamDoneRef.current = true;

      // ─── Stream vide = erreur silencieuse côté Vertex AI ───
      if (!fullText.trim()) {
        if (typewriterRafRef.current !== null) { cancelAnimationFrame(typewriterRafRef.current); typewriterRafRef.current = null; }
        setMessages(prev => {
          const u = [...prev];
          if (u[assistantIndex]) u[assistantIndex] = { role: "assistant", content: "Une erreur s'est produite lors de l'analyse. Veuillez réessayer." };
          return u;
        });
        setLoading(false); return;
      }

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

      // ─── Test mode : notifier le dashboard parent du nouveau message IA ───
      if (isTestMode && typeof window !== "undefined" && window.parent !== window && patientId) {
        const visibleReply = fullText
          .replace(/\|\|\|[\s\S]*?\|\|\|/g, "")
          .trim();
        if (visibleReply) {
          window.parent.postMessage(
            { type: "nutri-twin:new-message", patientId, content: visibleReply },
            window.location.origin
          );
        }
      }
    } catch (err) {
      // ─── Abort ou erreur réseau : stopper le typewriter ───
      if (typewriterRafRef.current !== null) { cancelAnimationFrame(typewriterRafRef.current); typewriterRafRef.current = null; }
      if ((err as Error).name !== "AbortError") {
        setMessages(prev => { const u = [...prev]; u[assistantIndex] = { role: "assistant", content: "Impossible de contacter le serveur." }; return u; });
      }
    } finally { setLoading(false); setTimeout(() => { blockRealtimeAssistantRef.current = false; }, 5000); }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement> | KeyboardEvent<HTMLInputElement>) => {
    // Desktop (non-touch) : Enter envoie. Mobile/tactile : Enter insère un saut de ligne.
    // On utilise navigator.maxTouchPoints plutôt que window.innerWidth pour éviter les faux
    // positifs dans l'iframe test mode (largeur ~640px < 768px alors qu'on est sur desktop).
    const isTouch = typeof window !== "undefined" && navigator.maxTouchPoints > 0;
    if (e.key === "Enter" && !e.shiftKey && !isTouch) { e.preventDefault(); void send(); }
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
          firstName={patientFirstName}
          onDone={handleOnboardingDone}
        />
      )}

      {/* Modale bibliothèque supprimée — exercices intégrés dans la sidebar */}

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


      {/* ─── Restructuration cognitive full-screen overlay ─── */}
      {showDefusionExercise && patientId && practitionerIdFromDb && (
        <RestructurationExercise
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

     {/* Modale profil — design moderne (sous-écrans) */}
{showProfileModal && (() => {
  const closeModal = () => { setShowProfileModal(false); setProfileScreen("main"); setPrefLoaded(false); setPrefSaved(false); setErrorSubmitted(false); };

  // ── Rangée générique ─────────────────────────────────────────────────────
  const Row = ({
    icon, label, onClick, chevron, loading,
  }: {
    icon: React.ReactNode; label: string; onClick?: () => void;
    chevron?: boolean; loading?: boolean;
  }) => (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14,
        padding: "0 20px", minHeight: 52, background: "none", border: "none",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: onClick ? "pointer" : "default", transition: "background 0.12s",
        textAlign: "left",
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
      onTouchStart={e => { if (onClick) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
      onTouchEnd={e => { e.currentTarget.style.background = "none"; }}
    >
      <span style={{ width: 22, display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_MUTED, flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{ flex: 1, fontSize: 16, color: TEXT_PRIMARY, textAlign: "left" }}>
        {label}
      </span>
      {loading ? (
        <span style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTop: `2px solid ${ACCENT}`, display: "inline-block", animation: "spin 1s linear infinite", flexShrink: 0 }} />
      ) : chevron ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
      ) : null}
    </button>
  );

  // ── En-tête des sous-écrans ───────────────────────────────────────────────
  const btnStyle: React.CSSProperties = { width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0, transition: "all 0.15s" };
  const btnEnter = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; };
  const btnLeave = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#64748b"; };

  const SubHeader = ({ title }: { title: string }) => (
    <div style={{ display: "flex", alignItems: "center", padding: "20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, gap: 8 }}>
      <button onClick={() => setProfileScreen("main")} style={btnStyle} onMouseEnter={btnEnter} onMouseLeave={btnLeave}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <span style={{ flex: 1, textAlign: "center", fontSize: 17, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: "-0.01em" }}>{title}</span>
      <button onClick={closeModal} style={btnStyle} onMouseEnter={btnEnter} onMouseLeave={btnLeave}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );

  return (
    <div
      onClick={closeModal}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "20px 14px" : 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "#060908", borderRadius: 20, width: "100%", maxWidth: 390, maxHeight: "90dvh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 0 0 1px rgba(255,255,255,0.10), 0 24px 64px rgba(0,0,0,0.60), 0 0 52px rgba(16,185,129,0.07)" }}
      >

        {/* ══════════════════ ÉCRAN PRINCIPAL ══════════════════ */}
        {profileScreen === "main" && (
          <>
            {/* Bouton fermeture */}
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 14px 0", flexShrink: 0 }}>
              <button
                onClick={closeModal}
                style={btnStyle}
                onMouseEnter={btnEnter}
                onMouseLeave={btnLeave}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Avatar + identité */}
            <div style={{ textAlign: "center", padding: "10px 20px 22px", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 10px" }}>
                {patientPhoto ? (
                  <img src={patientPhoto} alt="avatar" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(16,185,129,0.5)" }} onError={() => setPatientPhoto(null)} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#10b981", border: "1px solid rgba(16,185,129,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#000" }}>{patientInitials}</div>
                )}
                <button
                  onClick={() => patientAvatarRef.current?.click()} disabled={uploadingPhoto}
                  style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: "50%", background: ACCENT, border: "2px solid black", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  {uploadingPhoto
                    ? <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTop: "2px solid #000", display: "inline-block", animation: "spin 1s linear infinite" }} />
                    : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  }
                </button>
                <input
                  ref={patientAvatarRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={async e => {
                    const file = e.target.files?.[0]; if (!file || !patientId) return;
                    setUploadingPhoto(true);
                    try {
                      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
                      const compressed = await compressImage(file);
                      const dataUrl = `data:image/jpeg;base64,${compressed.base64}`;
                      setPatientPhoto(dataUrl);
                      localStorage.setItem(`avatar_b64_${patientId}`, dataUrl);
                      const byteString = atob(compressed.base64);
                      const ab = new ArrayBuffer(byteString.length);
                      const ia = new Uint8Array(ab);
                      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                      const blob = new Blob([ab], { type: "image/jpeg" });
                      await supabase.storage.from("Avatars").upload(`${patientId}/avatar.jpg`, blob, { upsert: true, contentType: "image/jpeg", cacheControl: "no-store" });
                      lastSelfUploadAtRef.current = Date.now();
                      const newAvatarVersion = new Date().toISOString();
                      localStorage.setItem(`avatar_upload_ts_${patientId}`, String(Date.now()));
                      localStorage.setItem(`avatar_version_${patientId}`, newAvatarVersion);
                      await supabase.from("patients").update({ avatar_updated_at: newAvatarVersion }).eq("user_id", patientId);
                    } catch { /* silencieux */ }
                    setUploadingPhoto(false);
                    if (patientAvatarRef.current) patientAvatarRef.current.value = "";
                  }}
                />
              </div>

              {patientPhoto && (
                <button
                  onClick={async () => {
                    if (!patientId) return;
                    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
                    await supabase.storage.from("Avatars").remove([`${patientId}/avatar.jpg`]);
                    localStorage.removeItem(`avatar_b64_${patientId}`);
                    lastSelfUploadAtRef.current = Date.now();
                    localStorage.setItem(`avatar_upload_ts_${patientId}`, String(Date.now()));
                    localStorage.removeItem(`avatar_version_${patientId}`);
                    setPatientPhoto(null);
                    await supabase.from("patients").update({ avatar_updated_at: new Date().toISOString() }).eq("user_id", patientId);
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: TEXT_MUTED, textDecoration: "underline", textDecorationStyle: "dotted", padding: "0 0 8px", display: "block", margin: "0 auto" }}
                  onMouseEnter={e => e.currentTarget.style.color = TEXT_SECONDARY}
                  onMouseLeave={e => e.currentTarget.style.color = TEXT_MUTED}
                >Revenir aux initiales</button>
              )}

              <h3 style={{ margin: "0 0 2px", fontSize: 20, fontWeight: 700, color: TEXT_PRIMARY }}>{patientFirstName} {editLastName}</h3>
              <p style={{ margin: "0 0 10px", fontSize: 13, color: TEXT_MUTED }}>{patientEmail}</p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 20, padding: "3px 10px" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontSize: 10, color: ACCENT, fontWeight: 600 }}>Identité vérifiée par votre praticien</span>
              </div>
            </div>

            {/* Rangées scrollables */}
            <div style={{ flex: 1, overflowY: "auto", paddingTop: 8, paddingBottom: 12 }}>

              {/* Groupe 1 */}
              <div>
                <Row
                  icon={<IconAward size={18} strokeWidth={1.6} />}
                  label="Mes victoires"
                  chevron
                  onClick={() => setProfileScreen("victoires")}
                />
                <Row
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
                  label="Ma voix de suivi"
                  chevron
                  onClick={() => setProfileScreen("voix")}
                />
                <Row
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M14 14h7v7h-7z"/><path d="M3 14h7v7H3z"/></svg>}
                  label="Mes préférences alimentaires"
                  chevron
                  onClick={() => setProfileScreen("preferences")}
                />
                <Row
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                  label="Mot de passe"
                  chevron
                  onClick={() => setProfileScreen("password")}
                />
              </div>

              {/* Groupe 2 */}
              <div>
                <Row
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                  label="Mentions légales"
                  chevron
                  onClick={() => setProfileScreen("legal")}
                />
                <Row
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                  label="Signaler une erreur dans mon dossier"
                  chevron
                  onClick={() => setProfileScreen("erreur")}
                />
              </div>

              {/* Se déconnecter */}
              <div>
                <Row
                  icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
                  label="Se déconnecter"
                  onClick={() => { closeModal(); setShowLogoutPatientModal(true); }}
                />
              </div>

              {/* Action destructive */}
              <div style={{ padding: "28px 20px 20px", display: "flex", justifyContent: "center" }}>
                <button
                  onClick={() => { closeModal(); setShowDeleteAccountModal(true); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#f87171", padding: 0, transition: "color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#fca5a5"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "#f87171"; }}
                >
                  Clôturer mon accompagnement
                </button>
              </div>

            </div>
          </>
        )}

        {/* ══════════════════ SOUS-ÉCRAN : VICTOIRES ══════════════════ */}
        {profileScreen === "victoires" && (
          <>
            <SubHeader title="Mes victoires" />
            <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24, paddingTop: 8 }}>
              {patientVictories.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 24px" }}>
                  <div style={{ marginBottom: 10 }}><IconAward size={32} strokeWidth={1.2} color={TEXT_MUTED} /></div>
                  <p style={{ margin: 0, fontSize: 14, color: TEXT_MUTED }}>Aucune victoire pour l'instant.</p>
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: TEXT_MUTED, opacity: 0.7 }}>Elles apparaissent au fil de vos échanges et exercices.</p>
                </div>
              ) : (
                patientVictories.slice(-10).reverse().map((v, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ flexShrink: 0, marginTop: 2 }}><IconAward size={15} color={ACCENT} strokeWidth={1.5} /></div>
                    <p style={{ margin: 0, fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.55 }}>{v}</p>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ══════════════════ SOUS-ÉCRAN : VOIX ══════════════════ */}
        {profileScreen === "voix" && (
          <>
            <style>{`
              @keyframes vp-bar { 0%,100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
            `}</style>
            <SubHeader title="Ma voix de suivi" />
            <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24, paddingTop: 8 }}>
              {therapeuticVoices.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 24px", color: TEXT_MUTED, fontSize: 14 }}>
                  Aucune voix disponible pour le moment.
                </div>
              ) : (
                therapeuticVoices.map(v => {
                  const isSelected = selectedTherapeuticVoice?.id === v.id;
                  const isPreviewing = previewingVoiceId === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        setTherapeuticVoice(v);
                        setPreviewingVoiceId(v.id);
                        previewTherapeuticVoice(v, `Bonjour ${patientFirstName || "toi"}, je suis là pour t'accompagner.`);
                      }}
                      style={{ width: "100%", display: "flex", alignItems: "center", padding: "14px 20px", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", gap: 14, transition: "background 0.12s", textAlign: "left" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                      onTouchStart={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                      onTouchEnd={e => { e.currentTarget.style.background = "none"; }}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: "0 0 2px", fontSize: 15, color: isSelected ? ACCENT : TEXT_PRIMARY, fontWeight: isSelected ? 600 : 400 }}>
                          {v.name}
                          <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.4, fontWeight: 400 }}>{v.gender === "FEMALE" ? "♀" : "♂"}</span>
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: TEXT_MUTED }}>{v.description}</p>
                      </div>
                      {/* Indicateur de lecture / sélection */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        {isPreviewing && isVoicePlaying && (
                          /* Barres animées — lecture en cours uniquement */
                          <div style={{ display: "flex", alignItems: "flex-end", gap: 2.5, height: 16, flexShrink: 0 }}>
                            {[0, 1, 2, 3].map(i => (
                              <div key={i} style={{ width: 3, borderRadius: 2, background: ACCENT, transformOrigin: "bottom", animation: `vp-bar 0.7s ease-in-out ${i * 0.12}s infinite`, height: 14 }} />
                            ))}
                          </div>
                        )}
                        {isSelected && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ══════════════════ SOUS-ÉCRAN : MOT DE PASSE ══════════════════ */}
        {profileScreen === "password" && (
          <>
            <SubHeader title="Mot de passe" />
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: TEXT_MUTED, marginBottom: 6, fontWeight: 500, letterSpacing: "0.02em" }}>Nouveau mot de passe</label>
                  <input
                    type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••"
                    style={{ width: "100%", height: 44, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TEXT_PRIMARY, padding: "0 14px", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: TEXT_MUTED, marginBottom: 6, fontWeight: 500, letterSpacing: "0.02em" }}>Confirmer le nouveau mot de passe</label>
                  <input
                    type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••"
                    style={{ width: "100%", height: 44, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TEXT_PRIMARY, padding: "0 14px", fontSize: 15, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  />
                </div>
                {passwordMsg && (
                  <p style={{ margin: 0, fontSize: 13, color: passwordMsg.type === "ok" ? ACCENT : "#f87171" }}>
                    {passwordMsg.type === "ok" ? "✓ " : "⚠ "}{passwordMsg.text}
                  </p>
                )}
                <button
                  disabled={passwordLoading}
                  onClick={async () => {
                    if (!newPassword || newPassword.length < 6) { setPasswordMsg({ type: "err", text: "Minimum 6 caractères." }); return; }
                    if (newPassword !== confirmPassword) { setPasswordMsg({ type: "err", text: "Les mots de passe ne correspondent pas." }); return; }
                    setPasswordLoading(true); setPasswordMsg(null);
                    try {
                      const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
                      const { error } = await supabase.auth.updateUser({ password: newPassword });
                      if (error) { setPasswordMsg({ type: "err", text: "Erreur lors de la mise à jour." }); }
                      else { setPasswordMsg({ type: "ok", text: "Mot de passe mis à jour avec succès." }); setNewPassword(""); setConfirmPassword(""); }
                    } catch { setPasswordMsg({ type: "err", text: "Une erreur est survenue." }); }
                    setPasswordLoading(false);
                  }}
                  style={{ height: 44, borderRadius: 10, background: ACCENT_DIM, border: `1px solid rgba(16,185,129,0.28)`, color: ACCENT, fontSize: 15, fontWeight: 600, cursor: passwordLoading ? "not-allowed" : "pointer", opacity: passwordLoading ? 0.65 : 1, transition: "all 0.15s", marginTop: 8 }}
                  onMouseEnter={e => { if (!passwordLoading) e.currentTarget.style.background = "rgba(16,185,129,0.14)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ACCENT_DIM; }}
                >
                  {passwordLoading ? "Mise à jour…" : "Mettre à jour"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════ SOUS-ÉCRAN : MENTIONS LÉGALES ══════════════════ */}
        {profileScreen === "legal" && (
          <>
            <SubHeader title="Mentions légales" />
            <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24, paddingTop: 8 }}>
              {/* Téléchargement données + liens légaux — même template */}
              <div>
                {/* Télécharger mes données */}
                <button
                  disabled={exportingRGPD}
                  onClick={async () => {
                    if (!patientId) return;
                    setExportingRGPD(true);
                    try {
                      const res = await fetch(`/api/export-rgpd?patientId=${patientId}`);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = `nutritwin-export-${new Date().toISOString().split("T")[0]}.json`; a.click();
                      URL.revokeObjectURL(url);
                    } catch { /* silencieux */ }
                    setExportingRGPD(false);
                  }}
                  style={{ width: "100%", display: "flex", alignItems: "center", padding: "0 20px", minHeight: 52, background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", gap: 14, transition: "background 0.12s", textAlign: "left", fontFamily: "inherit" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  {exportingRGPD
                    ? <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTop: `2px solid ${ACCENT}`, display: "inline-block", animation: "spin 1s linear infinite", flexShrink: 0 }} />
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  }
                  <span style={{ flex: 1, fontSize: 15, color: TEXT_PRIMARY, fontWeight: 400 }}>Télécharger mes données personnelles</span>
                </button>
                {/* Liens légaux */}
                {([
                  { label: "Politique de confidentialité", href: "/confidentialite" },
                  { label: "Conditions générales d'utilisation", href: "/cgu" },
                ] as { label: string; href: string }[]).map(({ label, href }) => (
                  <a
                    key={href} href={href} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", padding: "0 20px", minHeight: 52, textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.12s", gap: 14, fontFamily: "inherit" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style={{ flex: 1, fontSize: 15, color: TEXT_PRIMARY, fontWeight: 400 }}>{label}</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══════════════════ SOUS-ÉCRAN : ERREUR DOSSIER ══════════════════ */}
        {profileScreen === "erreur" && (() => {
          const allFields = [
            { group: "Informations personnelles", label: "Âge", value: profileData?.age ? `${profileData.age} ans` : null },
            { group: "Informations personnelles", label: "Taille", value: profileData?.taille ? `${profileData.taille} cm` : null },
            { group: "Informations personnelles", label: "Poids", value: profileData?.poids ? `${profileData.poids} kg` : null },
            { group: "Informations personnelles", label: "Sexe", value: profileData?.sexe ?? null },
            { group: "Contexte médical", label: "Pathologies", value: profileData?.pathologies ?? null },
            { group: "Contexte médical", label: "Allergies", value: profileData?.allergies ?? null },
            { group: "Contexte médical", label: "Traitements", value: profileData?.traitements ?? null },
            { group: "Contexte médical", label: "Objectif clinique", value: profileData?.objectif_clinique ?? null },
            { group: "Contexte médical", label: "Activité physique", value: profileData?.niveau_activite ?? null },
            { group: "Contexte médical", label: "Régime alimentaire", value: profileData?.regime_specifique ?? null },
          ];
          const groups = ["Informations personnelles", "Contexte médical"];
          return (
            <>
              <SubHeader title="Signaler une erreur" />
              <div style={{ flex: 1, overflowY: "auto", paddingBottom: 28, paddingTop: 0 }}>
                {errorSubmitted ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 24px", textAlign: "center" }}>
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: `rgba(16,185,129,0.12)`, border: `1.5px solid rgba(16,185,129,0.35)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <p style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>Demande envoyée</p>
                    <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED, lineHeight: 1.6, maxWidth: 260 }}>Votre praticien a été notifié et corrigera votre dossier prochainement.</p>
                  </div>
                ) : (
                  <>
                    {/* Instruction en haut */}
                    <div style={{ padding: "16px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED, lineHeight: 1.6 }}>
                        Cliquez sur l&apos;information incorrecte pour signaler une erreur à votre praticien.
                      </p>
                    </div>
                    {/* Loading */}
                    {!prefLoaded && (
                      <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                        <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTop: `2px solid ${ACCENT}`, animation: "spin 1s linear infinite" }} />
                      </div>
                    )}
                    {/* Champs cliquables */}
                    {prefLoaded && groups.map(group => (
                      <div key={group}>
                        <p style={{ margin: 0, padding: "14px 20px 6px", fontSize: 10, fontWeight: 700, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.1em" }}>{group}</p>
                        {allFields.filter(f => f.group === group).map(f => {
                          const isOpen = errorField === f.label;
                          return (
                            <div key={f.label}>
                              <button
                                onClick={() => { setErrorField(isOpen ? "" : f.label); setErrorCorrection(""); }}
                                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px", background: isOpen ? "rgba(16,185,129,0.06)" : "none", border: "none", borderBottom: isOpen ? "none" : "1px solid rgba(255,255,255,0.04)", cursor: "pointer", gap: 12, transition: "background 0.12s", textAlign: "left" }}
                                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = "none"; }}
                              >
                                <span style={{ fontSize: 14, color: isOpen ? ACCENT : TEXT_PRIMARY, fontWeight: isOpen ? 500 : 400, flex: 1 }}>{f.label}</span>
                                <span style={{ fontSize: 13, color: f.value ? TEXT_SECONDARY : TEXT_MUTED, fontStyle: f.value ? "normal" : "italic", flexShrink: 0, maxWidth: 140, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {f.value ?? "Non renseigné"}
                                </span>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isOpen ? ACCENT : "rgba(255,255,255,0.2)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6"/></svg>
                              </button>
                              {/* Zone de correction inline */}
                              {isOpen && (
                                <div style={{ padding: "0 20px 14px", background: "rgba(16,185,129,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                  <p style={{ margin: "0 0 8px", fontSize: 12, color: TEXT_MUTED }}>Quelle correction souhaitez-vous apporter ?</p>
                                  <textarea
                                    autoFocus
                                    value={errorCorrection}
                                    onChange={e => setErrorCorrection(e.target.value)}
                                    placeholder={`Valeur correcte pour ${f.label.toLowerCase()}…`}
                                    rows={2}
                                    style={{ width: "100%", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: `1px solid rgba(16,185,129,0.25)`, color: TEXT_PRIMARY, padding: "9px 12px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit", lineHeight: 1.5, transition: "border-color 0.15s" }}
                                    onFocus={e => { e.currentTarget.style.borderColor = `rgba(16,185,129,0.5)`; }}
                                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.25)"; }}
                                  />
                                  <button
                                    disabled={!errorCorrection.trim() || errorSubmitting}
                                    onClick={async () => {
                                      setErrorSubmitting(true);
                                      try {
                                        const res = await fetch("/api/patient/report-error", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ field: errorField, correction: errorCorrection }),
                                        });
                                        if (res.ok) setErrorSubmitted(true);
                                      } finally { setErrorSubmitting(false); }
                                    }}
                                    style={{ marginTop: 8, height: 38, width: "100%", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: !errorCorrection.trim() || errorSubmitting ? "not-allowed" : "pointer", opacity: !errorCorrection.trim() || errorSubmitting ? 0.4 : 1, background: `rgba(16,185,129,0.1)`, border: `1px solid rgba(16,185,129,0.28)`, color: ACCENT, transition: "all 0.15s" }}
                                    onMouseEnter={e => { if (errorCorrection.trim()) e.currentTarget.style.background = `rgba(16,185,129,0.18)`; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = `rgba(16,185,129,0.1)`; }}
                                  >
                                    {errorSubmitting ? "Envoi…" : "Envoyer la correction"}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          );
        })()}

        {/* ══════════════════ SOUS-ÉCRAN : PRÉFÉRENCES ALIMENTAIRES ══════════════════ */}
        {profileScreen === "preferences" && (
          <>
            <SubHeader title="Mes préférences alimentaires" />
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 32px" }}>
              {!prefLoaded ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.08)", borderTop: `2px solid ${ACCENT}`, animation: "spin 1s linear infinite" }} />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: TEXT_MUTED, marginBottom: 6, fontWeight: 500, letterSpacing: "0.02em" }}>Mon objectif principal</label>
                    <input
                      type="text" value={prefObjectif} onChange={e => { setPrefObjectif(e.target.value); setPrefSaved(false); }}
                      placeholder="Perdre du poids, avoir plus d'énergie…"
                      style={{ width: "100%", height: 44, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TEXT_PRIMARY, padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
                      onFocus={e => { e.currentTarget.style.borderColor = `rgba(16,185,129,0.4)`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: TEXT_MUTED, marginBottom: 6, fontWeight: 500, letterSpacing: "0.02em" }}>Ma motivation</label>
                    <textarea
                      value={prefMotivation} onChange={e => { setPrefMotivation(e.target.value); setPrefSaved(false); }}
                      placeholder="Ce qui me pousse à prendre soin de moi…" rows={2}
                      style={{ width: "100%", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TEXT_PRIMARY, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit", lineHeight: 1.5, transition: "border-color 0.15s" }}
                      onFocus={e => { e.currentTarget.style.borderColor = `rgba(16,185,129,0.4)`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: TEXT_MUTED, marginBottom: 6, fontWeight: 500, letterSpacing: "0.02em" }}>Mon principal défi</label>
                    <textarea
                      value={prefDefi} onChange={e => { setPrefDefi(e.target.value); setPrefSaved(false); }}
                      placeholder="Grignotages, manque de temps, stress…" rows={2}
                      style={{ width: "100%", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TEXT_PRIMARY, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit", lineHeight: 1.5, transition: "border-color 0.15s" }}
                      onFocus={e => { e.currentTarget.style.borderColor = `rgba(16,185,129,0.4)`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: TEXT_MUTED, marginBottom: 6, fontWeight: 500, letterSpacing: "0.02em" }}>Aliments que j&apos;aime</label>
                    <textarea
                      value={prefAliments} onChange={e => { setPrefAliments(e.target.value); setPrefSaved(false); }}
                      placeholder="Poulet, légumes, riz, fruits…" rows={2}
                      style={{ width: "100%", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TEXT_PRIMARY, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit", lineHeight: 1.5, transition: "border-color 0.15s" }}
                      onFocus={e => { e.currentTarget.style.borderColor = `rgba(16,185,129,0.4)`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: TEXT_MUTED, marginBottom: 6, fontWeight: 500, letterSpacing: "0.02em" }}>Aliments que j&apos;évite</label>
                    <textarea
                      value={prefEvite} onChange={e => { setPrefEvite(e.target.value); setPrefSaved(false); }}
                      placeholder="Gluten, lactose, viande rouge…" rows={2}
                      style={{ width: "100%", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TEXT_PRIMARY, padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit", lineHeight: 1.5, transition: "border-color 0.15s" }}
                      onFocus={e => { e.currentTarget.style.borderColor = `rgba(16,185,129,0.4)`; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                    />
                  </div>
                  {prefSaved && (
                    <p style={{ margin: 0, fontSize: 13, color: ACCENT }}>✓ Préférences enregistrées</p>
                  )}
                  <button
                    disabled={prefSaving}
                    onClick={async () => {
                      setPrefSaving(true);
                      setPrefSaved(false);
                      try {
                        await fetch("/api/patient/update-preferences", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            objective: prefObjectif || null,
                            motivation: prefMotivation || null,
                            defi: prefDefi || null,
                            aliments_aimes: prefAliments || null,
                            aliments_detestes: prefEvite || null,
                          }),
                        });
                        setPrefSaved(true);
                      } finally {
                        setPrefSaving(false);
                      }
                    }}
                    style={{ width: "100%", height: 44, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: prefSaving ? "not-allowed" : "pointer", opacity: prefSaving ? 0.6 : 1, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.28)", color: ACCENT, transition: "all 0.15s", marginTop: 4 }}
                    onMouseEnter={e => { if (!prefSaving) e.currentTarget.style.background = "rgba(16,185,129,0.18)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.1)"; }}
                  >
                    {prefSaving ? "Enregistrement…" : "Enregistrer mes préférences"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
})()}

{/* Modale déconnexion patient */}
{showLogoutPatientModal && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
    <div style={{ background: "#0a0f0c", borderRadius: 24, padding: 28, width: "100%", maxWidth: 340, border: `1px solid ${BORDER}`, textAlign: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/><polyline points="16,17 21,12 16,7" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round"/></svg>
      </div>
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
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
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

      {!isTestMode && sidebarOpen && isMobile && <div
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

      {/* ═══ SIDEBAR (masquée en mode test) ═══ */}
      {!isTestMode && <aside style={{
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
              <p style={{ margin: 0, fontSize: 22, fontWeight: 400, color: TEXT_PRIMARY, letterSpacing: "-0.025em", lineHeight: 1, fontFamily: "var(--font-jakarta), sans-serif" }}>
                Nutri<strong style={{ fontWeight: 900, color: ACCENT }}>Twin</strong>
              </p>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
                Votre compagnon de suivi
              </span>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", transition: "all 0.15s", flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.color = "#e2e8f0"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "#64748b"; }}
              onMouseDown={e => { e.currentTarget.style.transform = "scale(0.88)"; e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
              onTouchStart={e => { navigator.vibrate?.(8); e.currentTarget.style.transform = "scale(0.88)"; e.currentTarget.style.background = "rgba(255,255,255,0.28)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"; }}
              onTouchEnd={() => { /* pas de revert : la sidebar se ferme via onClick, le bouton disparaît */ }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* ═══ AIDE IMMÉDIATE ═══ */}
          <p style={{ margin: "0 4px 8px", fontSize: 10, fontWeight: 600, color: TEXT_MUTED, letterSpacing: "0.12em", textTransform: "uppercase" }}>Aide immédiate</p>
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => {
                if (emotionalStatus === "red_critical") return;
                if (!patientId || !practitionerIdFromDb) return;
                const recentLines = messages.slice(-8).map(m => {
                  const roleLabel = m.role === "user" ? "Patient" : "Jumeau";
                  return `${roleLabel}: ${m.content.slice(0, 300)}`;
                });
                const builtContext = recentLines.length > 0
                  ? `[contexte chat récent]\n${recentLines.join("\n")}`
                  : "Mon Soutien";
                setSosSosContext(builtContext);
                void tFetch("/api/chat", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ message: "", patientId, practitionerId: practitionerIdFromDb, isSOS: true, sosContext: "Mon Soutien", origin: "crise" }),
                }).catch(() => {});
                setShowSOSExercise(true);
                if (isMobile) setSidebarOpen(false);
              }}
              disabled={sosLoading || emotionalStatus === "red_critical" || !patientId || !practitionerIdFromDb}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderRadius: 11, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.28)", cursor: sosLoading ? "not-allowed" : "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { if (!sosLoading) { e.currentTarget.style.background = "rgba(6,182,212,0.14)"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.45)"; } }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(6,182,212,0.08)"; e.currentTarget.style.borderColor = "rgba(6,182,212,0.28)"; }}>
              {sosLoading
                ? <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${CYAN_DIM}`, borderTop: `2px solid ${CYAN}`, animation: "spin 1s linear infinite", flexShrink: 0 }} />
                : <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(6,182,212,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <IconActivity size={14} color={CYAN} />
                  </div>
              }
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#cffafe", letterSpacing: "-0.1px" }}>{sosLoading ? "En route..." : "Mon Soutien"}</p>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.4, marginLeft: "auto" }}><path d="M9 18l6-6-6-6" stroke={CYAN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 4px 14px" }} />

          {/* ═══ EXERCICES ═══ */}
          <p style={{ margin: "0 4px 8px", fontSize: 10, fontWeight: 600, color: TEXT_MUTED, letterSpacing: "0.12em", textTransform: "uppercase" }}>Exercices</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 12 }}>
            {LIBRARY_EXERCISES.map(ex => (
              <button key={ex.id}
                onClick={() => { void handleToolSelect(ex.id, "Bibliothèque", emotionalStatus === "red_behavioral" ? undefined : "pratique"); if (isMobile) setSidebarOpen(false); }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "5px 8px", borderRadius: 9, background: "transparent", border: "1px solid transparent", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: ex.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {(LIBRARY_EXERCISE_ICONS[ex.id] ?? ((c: string) => <IconStar size={13} color={c} />))(ex.iconColor)}
                </div>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: TEXT_PRIMARY, flex: 1 }}>{ex.label}</p>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: 0.2 }}><path d="M9 18l6-6-6-6" stroke={TEXT_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            ))}
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
                      <button onClick={() => { setChatSearch(""); setChatSearchIdx(0); }} style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", color: TEXT_MUTED, fontSize: 12, lineHeight: 1, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
                    )}
                  </div>
                  {q && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, color: matchIndices.length > 0 ? ACCENT : TEXT_MUTED }}>
                        {matchIndices.length === 0 ? "Aucun résultat" : `${safeIdx + 1} / ${matchIndices.length} résultat${matchIndices.length > 1 ? "s" : ""}`}
                      </span>
                      {matchIndices.length > 1 && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => handleSearchNav(-1)} style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", color: TEXT_SECONDARY, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>↑</button>
                          <button onClick={() => handleSearchNav(1)} style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)", cursor: "pointer", color: TEXT_SECONDARY, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>↓</button>
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

          {/* ═══ SIDEBAR BOTTOM — Profil (masqué en mode test) ═══ */}
          {!isTestMode && <div style={{ paddingBottom: isMobile ? "max(44px, env(safe-area-inset-bottom, 44px))" : 32, flexShrink: 0 }}>
          <button
            onClick={() => setShowProfileModal(true)}
            style={{ padding: "10px 8px", display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", borderRadius: 12, transition: "background 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.transform = "scale(1)"; }}
            onMouseDown={e => { e.currentTarget.style.transform = "scale(0.98)"; }}
            onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
            onTouchStart={e => { navigator.vibrate?.(8); e.currentTarget.style.transform = "scale(0.98)"; }}
            onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; }}>
            {/* Avatar */}
            <div style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid rgba(16,185,129,0.5)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, pointerEvents: "none" }}>
              {patientPhoto ? (
                <img src={patientPhoto} alt="avatar" style={{ width: 40, height: 40, objectFit: "cover" }} />
              ) : (
                <div style={{ width: 40, height: 40, background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#000" }}>{patientInitials}</div>
              )}
            </div>
            {/* Nom + sous-titre */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: "0 0 1px", fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{patientFirstName || "Patient"}</p>
              <p style={{ margin: 0, fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: "0.08em" }}>Mon profil</p>
            </div>
            {/* Icône settings — identique au bouton de fermeture de la modale profil */}
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s", color: "#64748b" }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.13)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.18)"; (e.currentTarget as HTMLDivElement).style.color = "#e2e8f0"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.10)"; (e.currentTarget as HTMLDivElement).style.color = "#64748b"; }}>
              <SettingsIcon size={15} color="currentColor" />
            </div>
          </button>
          </div>}{/* /padding-bottom wrapper + isTestMode guard */}
        </div>
      </aside>}{/* /isTestMode guard on aside */}

      {/* ─── Garde de bord gauche (mobile, sidebar fermée) ─── */}
      {!isTestMode && isMobile && !sidebarOpen && (
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

        {/* ═══ BANDEAU MODE TEST — masqué si dans iframe (le dashboard l'affiche déjà) ═══ */}
        {isTestMode && typeof window !== "undefined" && window.self === window.top && (
          <div style={{ height: 28, background: "rgba(16,185,129,0.1)", borderBottom: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, flexShrink: 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: "#6ee7b7", letterSpacing: "0.1em", textTransform: "uppercase" }}>Mode test — vue patient simulée</span>
          </div>
        )}

        <header style={{ background: "rgba(8,14,11,0.75)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", height: 60, display: "flex", alignItems: "center", flexShrink: 0, position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ flex: 1, padding: isMobile ? "0 16px" : "0 24px", display: "flex", alignItems: "center" }}>
            {(isTestMode || !sidebarOpen || isMobile) && (
              <>
                {!isTestMode && (
                  <button onClick={() => setSidebarOpen(v => !v)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.13)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.transform = "scale(1)"; }}
                    onMouseDown={e => { e.currentTarget.style.transform = "scale(0.88)"; e.currentTarget.style.background = "rgba(255,255,255,0.2)"; }}
                    onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                    onTouchStart={e => { navigator.vibrate?.(8); e.currentTarget.style.transform = "scale(0.88)"; e.currentTarget.style.background = "rgba(255,255,255,0.28)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"; }}
                    onTouchEnd={() => {}}>
                    <MenuIcon size={isMobile ? 16 : 15} />
                  </button>
                )}
                <span style={{ fontSize: 20, fontWeight: 400, fontFamily: "var(--font-jakarta), sans-serif", color: "rgba(255,255,255,0.92)", letterSpacing: "-0.025em", marginLeft: isTestMode ? 0 : 18, userSelect: "none" }}>
                  Nutri<strong style={{ fontWeight: 900, color: "#10b981" }}>Twin</strong>
                </span>
              </>
            )}
          </div>
        </header>

        {/* ── Wrapper fades haut/bas (style Gemini) ── */}
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>

          {/* Fade haut */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 20, background: "linear-gradient(to bottom, #0b0f0d 0%, transparent 100%)", pointerEvents: "none", zIndex: 5 }} />

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
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: isMobile ? "96px 16px 100px" : "96px 24px 100px" }}>
              <div style={{ maxWidth: 580, width: "100%", textAlign: "center" }}>
                {/* NutriTwin logo */}
                <div style={{ position: "relative", margin: "0 auto 28px", display: "inline-block" }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(16,185,129,0.2)", filter: "blur(16px)" }} />
                  <div style={{ position: "relative", width: 75, height: 75 }}>
                    <div style={{ width: 75, height: 75, borderRadius: "50%", background: "transparent", border: "2px solid rgba(16,185,129,0.6)", boxShadow: "0 0 16px rgba(16,185,129,0.3), 0 0 32px rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <img src="/logo-new.svg" alt="NutriTwin" style={{ width: 36, height: 36 }} />
                    </div>
                  </div>
                </div>
                <h1 style={{ margin: "0 0 8px", fontSize: isMobile ? 26 : 30, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: "-0.5px" }}>
                  {patientFirstName ? `Bonjour ${patientFirstName}` : "Bonjour"}
                </h1>
                <p style={{ margin: "0 0 28px", fontSize: isMobile ? 15 : 16, color: TEXT_SECONDARY, lineHeight: 1.7 }}>
                  {practitionerTutoiement?.toLowerCase().includes("tutoiement") ? "Comment puis-je t'aider aujourd'hui ?" : "Comment puis-je vous aider aujourd'hui ?"}
                </p>
                <div style={{ marginBottom: 40 }}>
                  <InputBar isCenter={true} message={message} setMessage={setMessage} send={send} loading={loading} pendingImage={pendingImage} photoHovered={photoHovered} setPhotoHovered={setPhotoHovered} handleImageClick={handleImageClick} handleKeyDown={handleKeyDown} inputRef={inputRef} isMobile={isMobile} />
                </div>
                {!isMobile && <p style={{ margin: "0 0 16px", fontSize: 11, fontWeight: 600, color: TEXT_MUTED, letterSpacing: "0.1em", textTransform: "uppercase" }}>Questions fréquentes</p>}
                {!isMobile && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                  {quickActions.map(action => (
                    <button key={action} onClick={() => void send(action)}
                      style={{ background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 28, padding: "9px 18px", fontSize: 14, color: TEXT_SECONDARY, cursor: "pointer", transition: "all 0.25s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.14)"; e.currentTarget.style.color = ACCENT; e.currentTarget.style.borderColor = "rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(16,185,129,0.12)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = ACCENT_DIM; e.currentTarget.style.color = TEXT_SECONDARY; e.currentTarget.style.borderColor = ACCENT_BORDER; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                      {action}
                    </button>
                  ))}
                </div>}

                {/* ── Carte PWA — intégrée dans l'écran d'accueil, pas de popup ── */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <PwaInstallPrompt />
                </div>
              </div>
            </div>
          )}

          {hasMessages && (
            <div style={{ flex: isMobile ? 1 : undefined, padding: isMobile ? `24px 16px ${pendingImage ? 180 : 100}px` : "24px 36px 24px" }}>
              <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28, touchAction: "auto" }}>
                {visibleMessages.map((msg, index) => {
                  const isUser = msg.role === "user";
                  const isLastAssistant = msg.role === "assistant" && index === visibleMessages.length - 1;
                  if (msg.role === "assistant" && !msg.content && isLastAssistant) {
                    return (
                      <div key={index} ref={el => { messageRefs.current[index] = el; }}
                        style={{ display: "flex", alignItems: "flex-start", animation: "fadeUp 0.3s ease", paddingLeft: 38, paddingTop: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", animation: "nt-dot 1.4s ease-in-out infinite", animationDelay: "0s" }} />
                          <div style={{ width: 5, height: 5, borderRadius: "50%", animation: "nt-dot 1.4s ease-in-out infinite", animationDelay: "0.2s" }} />
                          <div style={{ width: 5, height: 5, borderRadius: "50%", animation: "nt-dot 1.4s ease-in-out infinite", animationDelay: "0.4s" }} />
                        </div>
                      </div>
                    );
                  }
                  // Cartes SOS (role "widget") — affichées uniquement côté praticien
                  // (dashboard/page.tsx). Côté patient on les ignore silencieusement.
                  if (msg.role === "widget") return null;
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
                          <div style={{ padding: isMobile ? "12px 16px" : "13px 18px", borderRadius: 22, background: isActiveMatch ? "rgba(16,185,129,0.22)" : "rgba(16,185,129,0.12)", color: "rgba(255,255,255,0.95)", fontSize: 14, lineHeight: 1.6, border: isActiveMatch ? `1.5px solid rgba(16,185,129,0.45)` : "none", transition: "all 0.3s" }}>
                            {msg.content}
                          </div>
                        ) : (
                          <>
                            <div style={{ padding: isMobile ? "4px 2px" : "4px 0", background: "transparent", border: isActiveMatch ? `1px solid rgba(16,185,129,0.25)` : "none", borderRadius: isActiveMatch ? 14 : 0, paddingLeft: isActiveMatch ? 14 : 0, color: "rgba(255,255,255,0.95)", fontSize: 15, lineHeight: 1.8, transition: "all 0.3s" }}>
                              {msg.content}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
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
              ? `linear-gradient(to bottom, transparent 0%, #0b0f0d 20px, #0b0f0d 100%)`
              : `linear-gradient(to bottom, transparent 0%, rgba(11,15,13,0.97) 20px, rgba(11,15,13,0.97) 100%)`,
            backdropFilter: isMobile ? undefined : "blur(12px)",
            WebkitBackdropFilter: isMobile ? undefined : "blur(12px)",
            padding: isMobile ? "16px 12px 12px" : "28px 20px 16px",
            paddingBottom: isMobile ? `max(12px, env(safe-area-inset-bottom, 0px))` : "20px",
            paddingLeft: isMobile ? `max(12px, env(safe-area-inset-left, 0px))` : undefined,
            paddingRight: isMobile ? `max(12px, env(safe-area-inset-right, 0px))` : undefined,
            opacity: sidebarOpen && isMobile ? 0.4 : 1,
            pointerEvents: sidebarOpen && isMobile ? "none" : "auto",
            transition: "opacity 0.25s",
            ...(isMobile ? { transform: "translateZ(0)", WebkitTransform: "translateZ(0)" } : {}),
          }}>
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
              {pendingImage && (
                <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "none", display: "flex", alignItems: "center", gap: 10 }}>
                  <img
                    src={pendingImage.previewUrl}
                    alt="Aperçu"
                    style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY, lineHeight: 1.3 }}>Photo prête à l&apos;envoi</p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: TEXT_SECONDARY, lineHeight: 1.4 }}>Ajoutez un message pour préciser votre question</p>
                  </div>
                  <button
                    onClick={() => setPendingImage(null)}
                    style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: TEXT_SECONDARY, fontSize: 14, flexShrink: 0, transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = TEXT_PRIMARY; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = TEXT_SECONDARY; }}>
                    ×
                  </button>
                </div>
              )}
              {imageCompressing && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ height: 2, background: SURFACE, borderRadius: 1 }}>
                    <div style={{ height: "100%", background: ACCENT, borderRadius: 1, width: `${compressionProgress}%`, transition: "width 0.1s" }} />
                  </div>
                </div>
              )}
              <InputBar isCenter={false} message={message} setMessage={setMessage} send={send} loading={loading} pendingImage={pendingImage} photoHovered={photoHovered} setPhotoHovered={setPhotoHovered} handleImageClick={handleImageClick} handleKeyDown={handleKeyDown} inputRef={inputRef} isMobile={isMobile} />
              <p style={{ margin: "10px 0 0", fontSize: 10, color: TEXT_MUTED, textAlign: "center", whiteSpace: "nowrap" }}>
                NutriTwin est une IA · En cas de doute, consultez votre praticien
              </p>
            </div>
            {/* ─── Bouton scroll-to-bottom ─── */}
            {showScrollBottom && (
              <button
                onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", zIndex: 26, width: 40, height: 40, borderRadius: "50%", background: "rgba(15,22,18,0.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(16,185,129,0.45)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 18px rgba(0,0,0,0.4)", transition: "border-color 0.2s, box-shadow 0.2s", color: ACCENT }}
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
        @keyframes nt-dot { 0%, 60%, 100% { transform: translateY(0); background: rgba(255,255,255,0.18); box-shadow: none; } 30% { transform: translateY(-7px); background: rgba(255,255,255,0.88); box-shadow: 0 0 6px rgba(255,255,255,0.5); } }
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
