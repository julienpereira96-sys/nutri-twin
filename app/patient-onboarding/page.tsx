"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  { id: "abloc", label: "Très motivé(e)", emoji: "🔥" },
  { id: "optimiste", label: "Optimiste", emoji: "😊" },
  { id: "anxieux", label: "Un peu anxieux(se)", emoji: "😰" },
  { id: "perdu", label: "Complètement perdu(e)", emoji: "😕" },
  { id: "fatigue", label: "Volontaire, mais fatigué(e)", emoji: "😴" },
];

const DEFIS = [
  { id: "temps", label: "Manque de temps", emoji: "⏰" },
  { id: "sucre", label: "Pulsions sucrées", emoji: "🍫" },
  { id: "restaurant", label: "Repas au restaurant", emoji: "🍽️" },
  { id: "motivation", label: "Manque de motivation", emoji: "😔" },
  { id: "cuisine", label: "Manque d'organisation en cuisine", emoji: "👨‍🍳" },
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

const LevierSVG = ({ id }: { id: string }) => {
  if (id === "progres") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="lp1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6ee7b7"/><stop offset="100%" stopColor="#065f46"/></linearGradient>
        <linearGradient id="lp2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#064e3b"/></linearGradient>
        <linearGradient id="lp3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#022c22"/></linearGradient>
      </defs>
      <rect x="2" y="15" width="4.5" height="7" rx="1.2" fill="url(#lp1)"/>
      <rect x="9.75" y="10" width="4.5" height="12" rx="1.2" fill="url(#lp2)"/>
      <rect x="17.5" y="4" width="4.5" height="18" rx="1.2" fill="url(#lp3)"/>
      <path d="M4.5 14L10 9l4.5 3 5-6" stroke="#6ee7b7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="4.5" cy="14" r="1.4" fill="white" opacity="0.95"/>
      <circle cx="10" cy="9" r="1.4" fill="white" opacity="0.95"/>
      <circle cx="14.5" cy="12" r="1.4" fill="white" opacity="0.95"/>
      <circle cx="19.5" cy="6" r="1.4" fill="white" opacity="0.95"/>
    </svg>
  );
  if (id === "encourage") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="le1" cx="40%" cy="35%" r="65%"><stop offset="0%" stopColor="#6ee7b7"/><stop offset="100%" stopColor="#064e3b"/></radialGradient>
      </defs>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" fill="url(#le1)"/>
      <ellipse cx="9" cy="8" rx="3.5" ry="2" fill="white" opacity="0.18" transform="rotate(-35 9 8)"/>
      <path d="M8 10c.5-1.5 2-2.2 3.5-1.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity="0.65"/>
      <circle cx="17.5" cy="5.5" r="1.5" fill="#34d399" opacity="0.7"/>
      <circle cx="20.5" cy="9.5" r="1" fill="#6ee7b7" opacity="0.5"/>
      <circle cx="19.5" cy="3" r="0.7" fill="#a7f3d0" opacity="0.5"/>
    </svg>
  );
  if (id === "comprendre") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="lc1" cx="40%" cy="30%" r="65%"><stop offset="0%" stopColor="#6ee7b7"/><stop offset="100%" stopColor="#065f46"/></radialGradient>
      </defs>
      <path d="M6.8 17A7 7 0 1117.2 17H6.8z" fill="url(#lc1)"/>
      <ellipse cx="9.5" cy="9" rx="2.5" ry="1.5" fill="white" opacity="0.2"/>
      <path d="M9 21h6M12 21v-3" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="7" y="16.5" width="10" height="1.5" rx="0.75" fill="#065f46"/>
      <path d="M12 8.5v3" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="12" cy="13" r="0.8" fill="white"/>
      <circle cx="18.5" cy="4.5" r="1.5" fill="#34d399" opacity="0.6"/>
      <circle cx="21" cy="8" r="1" fill="#6ee7b7" opacity="0.4"/>
    </svg>
  );
  if (id === "routine") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="lr1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#064e3b"/><stop offset="100%" stopColor="#022c22"/></linearGradient>
        <linearGradient id="lr2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#059669"/><stop offset="100%" stopColor="#047857"/></linearGradient>
      </defs>
      <rect x="3" y="4" width="18" height="17" rx="2.5" fill="url(#lr1)" stroke="#10b981" strokeWidth="1.5"/>
      <rect x="3" y="4" width="18" height="6.5" rx="2.5" fill="url(#lr2)"/>
      <rect x="3" y="8" width="18" height="2.5" fill="#047857"/>
      <path d="M8 2v4M16 2v4" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M7.5 15.5l2.5 2.5 5-5" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <ellipse cx="8.5" cy="6" rx="1.5" ry="0.8" fill="white" opacity="0.15"/>
    </svg>
  );
  if (id === "supervise") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="ls1" cx="40%" cy="35%" r="65%"><stop offset="0%" stopColor="#6ee7b7"/><stop offset="100%" stopColor="#065f46"/></radialGradient>
        <radialGradient id="ls2" cx="35%" cy="30%" r="70%"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#047857"/></radialGradient>
      </defs>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="url(#ls1)"/>
      <ellipse cx="9" cy="10" rx="3" ry="1.5" fill="white" opacity="0.2"/>
      <circle cx="12" cy="12" r="4" fill="url(#ls2)"/>
      <circle cx="12" cy="12" r="2" fill="#022c22"/>
      <circle cx="11" cy="11" r="0.9" fill="white" opacity="0.9"/>
    </svg>
  );
  if (id === "simplicite") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="lsi1" cx="40%" cy="35%" r="65%"><stop offset="0%" stopColor="#6ee7b7"/><stop offset="100%" stopColor="#065f46"/></radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#lsi1)"/>
      <ellipse cx="9" cy="8.5" rx="3" ry="1.8" fill="white" opacity="0.2"/>
      <path d="M7.5 12l3.5 3.5 6-7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  return null;
};

const MoodSVG = ({ id }: { id: string }) => {
  if (id === "flame") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="mf1" cx="42%" cy="22%" r="72%">
          <stop offset="0%" stopColor="#6ee7b7"/>
          <stop offset="55%" stopColor="#10b981"/>
          <stop offset="100%" stopColor="#064e3b"/>
        </radialGradient>
        <radialGradient id="mf2" cx="45%" cy="15%" r="65%">
          <stop offset="0%" stopColor="#d1fae5"/>
          <stop offset="100%" stopColor="#059669"/>
        </radialGradient>
      </defs>
      {/* Outer flame */}
      <path d="M12 2.5c-.7 2.8-2.5 4.5-3 7-.6-1.6-1-3-1.5-4.5C5.3 7 4 9.8 4 13c0 4.4 3.6 8 8 8s8-3.6 8-8c0-3.5-2-6.5-5-9C14.6 5.7 14 7.3 13 9c-.6-2.2-1-4.5-1-6.5z" fill="url(#mf1)"/>
      {/* Inner bright core */}
      <path d="M12 10c-.3 1.2-1 2-1.2 3.2-.2-.7-.4-1.4-.7-2C9 12.4 8.5 13.5 8.5 14.5c0 1.9 1.6 3.5 3.5 3.5s3.5-1.6 3.5-3.5c0-1.5-.8-2.7-2-3.5 0 .6-.3 1.2-.7 1.7-.4-1-.6-2-.8-2.7z" fill="url(#mf2)" opacity="0.72"/>
      {/* Highlight */}
      <ellipse cx="9.5" cy="8.5" rx="1.4" ry="2.8" fill="white" opacity="0.17" transform="rotate(-15 9.5 8.5)"/>
      {/* Tip glow */}
      <circle cx="12" cy="4" r="0.7" fill="#a7f3d0" opacity="0.55"/>
    </svg>
  );
  if (id === "sun") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="ms1" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#6ee7b7"/>
          <stop offset="100%" stopColor="#065f46"/>
        </radialGradient>
        <radialGradient id="ms2" cx="35%" cy="28%" r="62%">
          <stop offset="0%" stopColor="#a7f3d0"/>
          <stop offset="100%" stopColor="#047857"/>
        </radialGradient>
      </defs>
      {/* 8 rays */}
      <rect x="10.8" y="1.2" width="2.4" height="3.8" rx="1.2" fill="url(#ms1)"/>
      <rect x="10.8" y="19" width="2.4" height="3.8" rx="1.2" fill="url(#ms1)"/>
      <rect x="1.2" y="10.8" width="3.8" height="2.4" rx="1.2" fill="url(#ms1)"/>
      <rect x="19" y="10.8" width="3.8" height="2.4" rx="1.2" fill="url(#ms1)"/>
      <rect x="10.8" y="1.2" width="2.4" height="3.8" rx="1.2" fill="url(#ms1)" transform="rotate(45 12 12)"/>
      <rect x="10.8" y="19" width="2.4" height="3.8" rx="1.2" fill="url(#ms1)" transform="rotate(45 12 12)"/>
      <rect x="1.2" y="10.8" width="3.8" height="2.4" rx="1.2" fill="url(#ms1)" transform="rotate(45 12 12)"/>
      <rect x="19" y="10.8" width="3.8" height="2.4" rx="1.2" fill="url(#ms1)" transform="rotate(45 12 12)"/>
      {/* Centre disc */}
      <circle cx="12" cy="12" r="5.2" fill="url(#ms2)"/>
      {/* Highlight */}
      <ellipse cx="10.2" cy="10" rx="2" ry="1.3" fill="white" opacity="0.28"/>
    </svg>
  );
  if (id === "cloud") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="mc1" cx="35%" cy="28%" r="70%">
          <stop offset="0%" stopColor="#6ee7b7"/>
          <stop offset="55%" stopColor="#10b981"/>
          <stop offset="100%" stopColor="#065f46"/>
        </radialGradient>
        <linearGradient id="mc2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399"/>
          <stop offset="100%" stopColor="#047857" stopOpacity="0.55"/>
        </linearGradient>
      </defs>
      {/* Cloud body */}
      <path d="M17.5 9C17 5.7 14.2 3 10.8 3 8.4 3 6.2 4.3 5 6.3 3 6.7 1.5 8.4 1.5 10.5 1.5 12.9 3.4 14.8 5.8 15h11.7C19.4 15 21 13.4 21 11.5c0-1.9-1.5-3.4-3.5-2.5z" fill="url(#mc1)"/>
      {/* Highlight */}
      <ellipse cx="8" cy="6.2" rx="3.2" ry="1.4" fill="white" opacity="0.2"/>
      {/* Rain drops */}
      <ellipse cx="8.5" cy="19.5" rx="1.2" ry="2.2" fill="url(#mc2)"/>
      <ellipse cx="12" cy="21" rx="1.2" ry="2.2" fill="url(#mc2)"/>
      <ellipse cx="15.5" cy="19.5" rx="1.2" ry="2.2" fill="url(#mc2)"/>
    </svg>
  );
  if (id === "sceptique") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="msk1" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#6ee7b7"/>
          <stop offset="55%" stopColor="#10b981"/>
          <stop offset="100%" stopColor="#065f46"/>
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10.5" fill="url(#msk1)"/>
      {/* Highlight */}
      <ellipse cx="8.5" cy="7.5" rx="3.5" ry="2" fill="white" opacity="0.18"/>
      {/* Left eye normal, right eye squinted */}
      <ellipse cx="9" cy="12" rx="1.4" ry="1.4" fill="white"/>
      <ellipse cx="15" cy="11.5" rx="1.4" ry="1" fill="white"/>
      {/* Right raised brow */}
      <path d="M13 8.5 Q15 7.5 17 8.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.78"/>
      {/* Skeptical lopsided mouth */}
      <path d="M8 16.5 Q10 15 12 15.5 Q14 16 15.5 15" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  if (id === "compass") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="mco1" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#6ee7b7"/>
          <stop offset="55%" stopColor="#10b981"/>
          <stop offset="100%" stopColor="#065f46"/>
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10.5" fill="url(#mco1)"/>
      {/* Highlight */}
      <ellipse cx="8.5" cy="7.5" rx="3.5" ry="2" fill="white" opacity="0.18"/>
      {/* North needle (white) — légèrement décalé = perdu */}
      <path d="M12 4 L14.2 12 L12 11 L9.8 12 Z" fill="white"/>
      {/* South needle (transparent) */}
      <path d="M12 20 L9.8 12 L12 13 L14.2 12 Z" fill="white" opacity="0.35"/>
      {/* Hub */}
      <circle cx="12" cy="12" r="1.8" fill="#065f46"/>
      <circle cx="12" cy="12" r="0.75" fill="white" opacity="0.6"/>
    </svg>
  );
  if (id === "moon") return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="mm1" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#6ee7b7"/>
          <stop offset="55%" stopColor="#10b981"/>
          <stop offset="100%" stopColor="#064e3b"/>
        </radialGradient>
      </defs>
      {/* Crescent */}
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="url(#mm1)"/>
      {/* Highlight on crescent */}
      <ellipse cx="9" cy="7" rx="2.5" ry="1.5" fill="white" opacity="0.2"/>
      {/* Stars */}
      <circle cx="18.5" cy="5" r="1.4" fill="#6ee7b7" opacity="0.72"/>
      <circle cx="21" cy="10" r="0.9" fill="#a7f3d0" opacity="0.55"/>
      <circle cx="17.5" cy="2.5" r="0.7" fill="#d1fae5" opacity="0.5"/>
    </svg>
  );
  return null;
};

const DefiSVG = ({ id }: { id: string }) => {
  if (id === "clock") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="dc1" cx="40%" cy="35%" r="65%"><stop offset="0%" stopColor="#fcd34d"/><stop offset="100%" stopColor="#92400e"/></radialGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#dc1)"/>
      <ellipse cx="9" cy="8" rx="3.5" ry="2" fill="white" opacity="0.2"/>
      <circle cx="12" cy="3" r="0.8" fill="#451a03" opacity="0.6"/>
      <circle cx="21" cy="12" r="0.8" fill="#451a03" opacity="0.6"/>
      <circle cx="12" cy="21" r="0.8" fill="#451a03" opacity="0.6"/>
      <circle cx="3" cy="12" r="0.8" fill="#451a03" opacity="0.6"/>
      <line x1="12" y1="7" x2="12" y2="12.5" stroke="#451a03" strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="12" y1="12.5" x2="15.5" y2="15" stroke="#451a03" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="1.5" fill="#78350f"/>
    </svg>
  );
  if (id === "heart") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="dh1" cx="40%" cy="35%" r="65%"><stop offset="0%" stopColor="#fcd34d"/><stop offset="100%" stopColor="#78350f"/></radialGradient>
      </defs>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" fill="url(#dh1)"/>
      <ellipse cx="9" cy="8" rx="3.5" ry="2" fill="white" opacity="0.2" transform="rotate(-30 9 8)"/>
      <path d="M8.5 9.5c.5-1.5 2-2 3-1.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity="0.6"/>
      <circle cx="15.5" cy="8.5" r="1.2" fill="#fef3c7" opacity="0.7"/>
    </svg>
  );
  if (id === "utensils") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="du1" cx="40%" cy="35%" r="65%"><stop offset="0%" stopColor="#fcd34d"/><stop offset="100%" stopColor="#78350f"/></radialGradient>
      </defs>
      <circle cx="12" cy="14" r="8" fill="url(#du1)"/>
      <ellipse cx="10" cy="10" rx="3" ry="1.8" fill="white" opacity="0.2"/>
      <line x1="12" y1="6.5" x2="12" y2="22" stroke="#451a03" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M8 3v4.5c0 1.1.9 2 2 2" stroke="#fef3c7" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      <line x1="8" y1="3" x2="8" y2="7.5" stroke="#fef3c7" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="10" y1="3" x2="10" y2="6.5" stroke="#fef3c7" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M16 3v5a2 2 0 002 2v12" stroke="#fef3c7" strokeWidth="1.4" strokeLinecap="round" fill="none"/>
    </svg>
  );
  if (id === "battery") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="db1" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#fcd34d"/><stop offset="100%" stopColor="#b45309"/></linearGradient>
      </defs>
      <rect x="1" y="7" width="18" height="10" rx="2.5" fill="url(#db1)"/>
      <ellipse cx="6" cy="9.5" rx="4" ry="1.5" fill="white" opacity="0.15"/>
      <path d="M23 11v2" stroke="#d97706" strokeWidth="2" strokeLinecap="round"/>
      <rect x="2.5" y="8.5" width="4.5" height="7" rx="1" fill="#ef4444"/>
      <ellipse cx="4.5" cy="9.5" rx="1.5" ry="0.8" fill="white" opacity="0.2"/>
    </svg>
  );
  if (id === "chefhat") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <radialGradient id="dch1" cx="40%" cy="30%" r="65%"><stop offset="0%" stopColor="#fef3c7"/><stop offset="100%" stopColor="#b45309"/></radialGradient>
        <linearGradient id="dch2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fcd34d"/><stop offset="100%" stopColor="#92400e"/></linearGradient>
      </defs>
      <rect x="7" y="17" width="10" height="5" rx="1" fill="url(#dch2)"/>
      <line x1="7" y1="19.5" x2="17" y2="19.5" stroke="#fef3c7" strokeWidth="1" opacity="0.4"/>
      <circle cx="8" cy="11.5" r="4.5" fill="url(#dch1)"/>
      <circle cx="16" cy="11.5" r="4.5" fill="url(#dch1)"/>
      <ellipse cx="12" cy="8" rx="4" ry="5" fill="url(#dch1)"/>
      <ellipse cx="10.5" cy="7" rx="2.5" ry="1.5" fill="white" opacity="0.28"/>
      <rect x="7" y="14.5" width="10" height="3" fill="#b45309"/>
    </svg>
  );
  if (id === "zap2") return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="dz1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fef08a"/><stop offset="100%" stopColor="#b45309"/></linearGradient>
      </defs>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="url(#dz1)"/>
      <polygon points="13 2 9 10 12 10 13 2" fill="white" opacity="0.18"/>
      <line x1="10" y1="10" x2="13" y2="6" stroke="white" strokeWidth="1" opacity="0.35" strokeLinecap="round"/>
    </svg>
  );
  return null;
};

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
  const [confirmObjectifClinique, setConfirmObjectifClinique] = useState("");
  const [confirmNiveauActivite, setConfirmNiveauActivite] = useState("");
  const [confirmRegime, setConfirmRegime] = useState("");
  const [editOriginal, setEditOriginal] = useState<Record<string, string> | null>(null);

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
  const [customAliments, setCustomAliments] = useState<string[]>([]);

  const totalSteps = 4;

  // Guard : empêche l'écriture dans localStorage avant que le chargement initial ne soit terminé.
  // Sans ce ref, l'effet de sauvegarde se déclenche au montage avec les states vides et écrase
  // le localStorage avant que l'API ait eu le temps de répondre — ce qui bloque le pré-remplissage.
  const loadCompleteRef = useRef(false);

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
          if (typeof p.confirmObjectifClinique === "string") setConfirmObjectifClinique(p.confirmObjectifClinique);
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
          if (Array.isArray(p.customAliments)) setCustomAliments(p.customAliments as string[]);
          loadCompleteRef.current = true;
          return; // localStorage prime sur les données Supabase
        }
      } catch { /* ignore */ }

      // 2. Pas de localStorage - charger les données pré-remplies par le praticien via API
      const res = await fetch("/api/get-patient-profile");
      if (res.ok) {
        const { patient } = await res.json() as { patient: { age?: number; sexe?: string; taille?: number; poids?: number; pathologies?: string; allergies?: string; traitements?: string; objectif_clinique?: string; niveau_activite?: string; regime_specifique?: string } | null };
        if (patient) {
          setConfirmAge(patient.age ? String(patient.age) : "");
          setConfirmSexe(patient.sexe ?? "");
          setConfirmTaille(patient.taille ? String(patient.taille) : "");
          setConfirmPoids(patient.poids ? String(patient.poids) : "");
          setConfirmPathologies(patient.pathologies ?? "");
          setConfirmAllergies(patient.allergies ?? "");
          setConfirmTraitements(patient.traitements ?? "");
          setConfirmObjectifClinique(patient.objectif_clinique ?? "");
          setConfirmNiveauActivite(patient.niveau_activite ?? "");
          setConfirmRegime(patient.regime_specifique ?? "");
        }
      }
      loadCompleteRef.current = true;
    });
  }, []);

  // Sauvegarder dans localStorage à chaque changement de state
  // Le guard loadCompleteRef empêche d'écraser le localStorage avec des valeurs vides
  // au premier rendu, avant que le chargement API ait pu pré-remplir les champs.
  useEffect(() => {
    if (!loadCompleteRef.current) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        step,
        confirmAge, confirmSexe, confirmTaille, confirmPoids,
        confirmPathologies, confirmAllergies, confirmTraitements,
        confirmObjectifClinique, confirmNiveauActivite, confirmRegime,
        objectif, objectifCustom, mood, moodCustom, defi, defiCustom,
        equipement, tempsCuisine, budget, repasSautes, sommeil, digestif,
        alimentsAimes, alimentsDetestes, customAliments,
      }));
    } catch { /* ignore quota errors */ }
  }, [
    step, confirmAge, confirmSexe, confirmTaille, confirmPoids,
    confirmPathologies, confirmAllergies, confirmTraitements,
    confirmObjectifClinique, confirmNiveauActivite, confirmRegime,
    objectif, objectifCustom, mood, moodCustom, defi, defiCustom,
    equipement, tempsCuisine, budget, repasSautes, sommeil, digestif,
    alimentsAimes, alimentsDetestes, customAliments,
  ]);

  const toggleMultiple = (value: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(value) ? list.filter(x => x !== value) : [...list, value]);
  };

  const toggleAliment = (aliment: string) => {
    const aime = alimentsAimes.includes(aliment);
    const deteste = alimentsDetestes.includes(aliment);
    if (!aime && !deteste) {
      setAlimentsAimes(prev => [...prev, aliment]);
    } else if (aime) {
      setAlimentsAimes(prev => prev.filter(a => a !== aliment));
      setAlimentsDetestes(prev => [...prev, aliment]);
    } else {
      setAlimentsDetestes(prev => prev.filter(a => a !== aliment));
    }
  };

  const addAlimentCustom = () => {
    const val = alimentCustom.trim();
    if (!val) return;
    if (!ALIMENTS.includes(val) && !customAliments.includes(val)) {
      setCustomAliments(prev => [...prev, val]);
    }
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
        objectif_clinique: confirmObjectifClinique || null,
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
        onboarding_done: true,
      }).eq("user_id", user.id);

      if (error) throw new Error(error.message);

      // Succès - nettoyer le localStorage et rediriger
      try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
      router.push("/chat");
    } catch (err) {
      console.error("[onboarding] saveAndContinue error:", err);
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
    border: active ? "1px solid rgba(16,185,129,0.33)" : "1px solid rgba(255,255,255,0.08)",
    background: active ? "rgba(16,185,129,0.05)" : "transparent",
    padding: "14px 12px",
    minHeight: 52,
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.15s",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });
  const cardBtnText = (active: boolean): React.CSSProperties => ({
    margin: 0, fontSize: 12,
    fontWeight: active ? 500 : 400,
    color: active ? "#e2e8f0" : "#94a3b8",
  });

  const isDirty = useMemo(() => {
    if (!editOriginal) return false;
    return confirmAge !== editOriginal.age || confirmSexe !== editOriginal.sexe ||
      confirmTaille !== editOriginal.taille || confirmPoids !== editOriginal.poids ||
      confirmPathologies !== editOriginal.pathologies || confirmAllergies !== editOriginal.allergies ||
      confirmTraitements !== editOriginal.traitements || confirmObjectifClinique !== editOriginal.objectifClinique ||
      confirmNiveauActivite !== editOriginal.niveauActivite || confirmRegime !== editOriginal.regime;
  }, [editOriginal, confirmAge, confirmSexe, confirmTaille, confirmPoids, confirmPathologies, confirmAllergies, confirmTraitements, confirmObjectifClinique, confirmNiveauActivite, confirmRegime]);

  const enterEditMode = () => {
    setEditOriginal({ age: confirmAge, sexe: confirmSexe, taille: confirmTaille, poids: confirmPoids, pathologies: confirmPathologies, allergies: confirmAllergies, traitements: confirmTraitements, objectifClinique: confirmObjectifClinique, niveauActivite: confirmNiveauActivite, regime: confirmRegime });
    setEditMode(true);
  };

  const cancelEdit = () => {
    if (editOriginal) {
      setConfirmAge(editOriginal.age); setConfirmSexe(editOriginal.sexe);
      setConfirmTaille(editOriginal.taille); setConfirmPoids(editOriginal.poids);
      setConfirmPathologies(editOriginal.pathologies); setConfirmAllergies(editOriginal.allergies);
      setConfirmTraitements(editOriginal.traitements); setConfirmObjectifClinique(editOriginal.objectifClinique);
      setConfirmNiveauActivite(editOriginal.niveauActivite); setConfirmRegime(editOriginal.regime);
    }
    setEditMode(false); setEditOriginal(null);
  };

  const isAutre = (value: string, options: string[]) =>
    value !== "" && value !== "__autre__" && !options.includes(value) && value !== "Aucune" && value !== "Aucun" && value !== "Choisir";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'Inter', -apple-system, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto 16px" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(16,185,129,0.08)", filter: "blur(16px)" }} />
            <div style={{ position: "relative", width: 96, height: 96, borderRadius: "50%", border: "2px solid rgba(16,185,129,0.5)", boxShadow: "0 0 20px rgba(16,185,129,0.3), 0 0 40px rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <img src="/logo.png" alt="" style={{ width: 96, height: 96, padding: "18px", objectFit: "contain", boxSizing: "border-box" }} />
            </div>
          </div>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: "white" }}>
            Configurons votre <strong style={{ color: "#10b981" }}>espace</strong>
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>
            Quelques questions pour personnaliser au mieux{" "}
            <span style={{ whiteSpace: "nowrap" }}>votre expérience</span>
          </p>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < step ? "#10b981" : "rgba(255,255,255,0.08)", transition: "background 0.4s" }} />
          ))}
        </div>
        <p style={{ textAlign: "right", margin: "0 0 20px", fontSize: 12, color: "#4b5563" }}>Étape {step} sur {totalSteps}</p>

        {/* ═══ ÉTAPE 1 - Informations ═══ */}
        {step === 1 && (() => {
          const fieldBox: React.CSSProperties = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 14px" };
          const fieldLabel: React.CSSProperties = { margin: "0 0 2px", fontSize: 11, fontWeight: 600, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.06em" };
          const fieldValue = (): React.CSSProperties => ({ margin: 0, fontSize: 13, fontWeight: 500, color: "white" });

          const medicalFields = [
            { label: "Pathologies", value: confirmPathologies, setter: setConfirmPathologies, options: ["Diabète type 2", "Hypertension", "Hypothyroïdie", "SOPK", "Cholestérol", "TCA", "Surpoids"], none: "Aucune" },
            { label: "Allergies", value: confirmAllergies, setter: setConfirmAllergies, options: ["Gluten", "Lactose", "Fruits à coque", "Œufs", "Fruits de mer"], none: "Aucune" },
            { label: "Traitements", value: confirmTraitements, setter: setConfirmTraitements, options: ["Metformine", "Lévothyrox", "Pilule contraceptive", "Antidépresseurs", "Insuline"], none: "Aucun" },
            { label: "Objectif", value: confirmObjectifClinique, setter: setConfirmObjectifClinique, options: ["Perte de poids", "Prise de masse", "Équilibre glycémique", "Bien-être général", "Grossesse"], none: "Aucun" },
            { label: "Activité physique", value: confirmNiveauActivite, setter: setConfirmNiveauActivite, options: ["Sédentaire", "Légère", "Modérée", "Intense", "Athlète"], none: "Aucune" },
            { label: "Régime alimentaire", value: confirmRegime, setter: setConfirmRegime, options: ["Végétarien", "Vegan", "Sans gluten", "Halal", "Méditerranéen"], none: "Aucun" },
          ];

          return (
            <div style={{ background: "#111111", borderRadius: 20, padding: 24, border: "1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>Étape 1 - Votre profil</p>
              <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>Vérifiez vos informations</h2>
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Votre praticien a pré-rempli ces données. Modifiez-les si nécessaire.</p>

              {/* Section 1 */}
              <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Vos informations personnelles</p>
              {!editMode ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                  {[
                    { label: "Âge", display: confirmAge ? `${confirmAge} ans` : "Aucun" },
                    { label: "Taille", display: confirmTaille ? `${confirmTaille} cm` : "Aucune" },
                    { label: "Poids", display: confirmPoids ? `${confirmPoids} kg` : "Aucun" },
                    { label: "Sexe", display: confirmSexe || "Aucun" },
                  ].map(f => (
                    <div key={f.label} style={fieldBox}>
                      <p style={fieldLabel}>{f.label}</p>
                      <p style={fieldValue()}>{f.display}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                  {[
                    { label: "Âge", value: confirmAge, onChange: setConfirmAge, placeholder: "34", type: "number" },
                    { label: "Taille (cm)", value: confirmTaille, onChange: setConfirmTaille, placeholder: "168", type: "number" },
                    { label: "Poids (kg)", value: confirmPoids, onChange: setConfirmPoids, placeholder: "72", type: "number" },
                  ].map(f => (
                    <div key={f.label}>
                      <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{f.label}</p>
                      <input type="number" value={f.value} onChange={e => f.onChange(e.target.value)} placeholder={f.placeholder}
                        style={{ ...inputStyle, height: 40 }}
                        onFocus={e => e.target.style.borderColor = "#10b981"}
                        onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                    </div>
                  ))}
                  <div>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>Sexe</p>
                    <select value={confirmSexe} onChange={e => setConfirmSexe(e.target.value)} style={{ ...selectStyle, height: 40 }}>
                      <option value="">Choisir</option>
                      <option value="Femme">Femme</option>
                      <option value="Homme">Homme</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Section 2 */}
              <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Votre contexte médical</p>
              {!editMode ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                  {medicalFields.map(f => (
                    <div key={f.label} style={fieldBox}>
                      <p style={fieldLabel}>{f.label}</p>
                      <p style={fieldValue()}>{f.value || f.none}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                  {medicalFields.map(f => {
                    const other = isAutre(f.value, f.options);
                    return (
                      <div key={f.label}>
                        <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>{f.label}</p>
                        <select value={other ? "Autre" : f.value} onChange={e => { if (e.target.value === "Autre") f.setter("__autre__"); else f.setter(e.target.value); }}
                          style={{ ...selectStyle, height: 40 }}>
                          <option value="">—</option>
                          <option value={f.none}>{f.none}</option>
                          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                          <option value="Autre">Autre...</option>
                        </select>
                        {(f.value === "__autre__" || other) && (
                          <input type="text" value={f.value === "__autre__" ? "" : f.value} onChange={e => f.setter(e.target.value)} placeholder="Précisez..."
                            style={{ ...inputStyle, height: 36, marginTop: 6 }}
                            onFocus={e => e.target.style.borderColor = "#10b981"}
                            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Buttons */}
              {!editMode ? (
                <div style={{ display: "flex", gap: 12, paddingTop: 4 }}>
                  <button onClick={enterEditMode}
                    style={{ flex: 1, height: 50, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                    Modifier mes informations
                  </button>
                  <button onClick={() => setStep(2)}
                    style={{ flex: 1, height: 50, borderRadius: 12, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>
                    Confirmer et continuer →
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={cancelEdit}
                    style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>
                    ← Retour
                  </button>
                  {isDirty && (
                    <button onClick={() => setEditMode(false)}
                      style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>
                      Valider mes modifications
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ ÉTAPE 2 - Votre profil ═══ */}
        {step === 2 && (
          <div style={{ background: "#111111", borderRadius: 20, padding: 24, border: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>Étape 2 - Votre profil</p>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>Parlez-nous de vous</h2>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "#64748b" }}>Ces infos aident votre compagnon de suivi à adapter ses conseils.</p>

            {/* Levier de motivation */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#f1f5f9", borderLeft: "2px solid rgba(16,185,129,0.5)", paddingLeft: 10 }}>Qu&apos;est-ce qui vous motive le plus au quotidien ?</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { id: "progres",    label: "Voir des progrès concrets",      color: "#10b981" },
                  { id: "encourage",  label: "Me sentir encouragé(e)",          color: "#f472b6" },
                  { id: "comprendre", label: "Comprendre le fonctionnement",    color: "#60a5fa" },
                  { id: "routine",    label: "Avoir une routine stricte",        color: "#f59e0b" },
                  { id: "supervise",  label: "Savoir que je suis supervisé(e)", color: "#a78bfa" },
                  { id: "simplicite", label: "La simplicité des actions",        color: "#34d399" },
                  { id: "autre",      label: "Autre",                            color: "#64748b" },
                ].map(o => {
                  const sel = objectif === o.id;
                  return (
                    <button key={o.id} onClick={() => setObjectif(o.id)} style={{
                      background: sel ? o.color + "0d" : "transparent",
                      border: sel ? `1px solid ${o.color}55` : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12, padding: "16px 12px", minHeight: 56,
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: o.color, flexShrink: 0, opacity: sel ? 1 : 0.6 }} />
                      <p style={{ margin: 0, fontSize: 13, fontWeight: sel ? 500 : 400, color: sel ? "#e2e8f0" : "#94a3b8", lineHeight: 1.4 }}>{o.label}</p>
                    </button>
                  );
                })}
              </div>
              {objectif === "autre" && (
                <input type="text" value={objectifCustom} onChange={e => setObjectifCustom(e.target.value)}
                  placeholder="Décrivez votre levier..." style={{ ...inputStyle, marginTop: 8 }}
                  onFocus={e => e.target.style.borderColor = "#64748b"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              )}
            </div>

            {/* Mood */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#f1f5f9", borderLeft: "2px solid rgba(16,185,129,0.5)", paddingLeft: 10 }}>Comment vous sentez-vous face au changement ?</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { id: "abloc",     label: "Très motivé(e)",              color: "#10b981" },
                  { id: "optimiste", label: "Optimiste",                    color: "#f59e0b" },
                  { id: "anxieux",   label: "Un peu anxieux(se)",           color: "#60a5fa" },
                  { id: "sceptique", label: "Un peu sceptique",             color: "#94a3b8" },
                  { id: "perdu",     label: "Complètement perdu(e)",        color: "#a78bfa" },
                  { id: "fatigue",   label: "Volontaire, mais fatigué(e)",  color: "#818cf8" },
                  { id: "autre",     label: "Autre",                         color: "#64748b" },
                ].map(m => {
                  const sel = mood === m.id;
                  return (
                    <button key={m.id} onClick={() => setMood(m.id)} style={{
                      background: sel ? m.color + "0d" : "transparent",
                      border: sel ? `1px solid ${m.color}55` : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12, padding: "16px 12px", minHeight: 56,
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: m.color, flexShrink: 0, opacity: sel ? 1 : 0.45 }} />
                      <p style={{ margin: 0, fontSize: 13, fontWeight: sel ? 500 : 400, color: sel ? "#e2e8f0" : "#94a3b8", lineHeight: 1.4 }}>{m.label}</p>
                    </button>
                  );
                })}
              </div>
              {mood === "autre" && (
                <input type="text" value={moodCustom} onChange={e => setMoodCustom(e.target.value)}
                  placeholder="Décrivez comment vous vous sentez..." style={{ ...inputStyle, marginTop: 8 }}
                  onFocus={e => e.target.style.borderColor = "#64748b"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              )}
            </div>

            {/* Défi */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#f1f5f9", borderLeft: "2px solid rgba(16,185,129,0.5)", paddingLeft: 10 }}>Quel est votre plus gros défi ?</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { id: "temps",      label: "Manque de temps",                   color: "#fb923c" },
                  { id: "sucre",      label: "Pulsions sucrées",                  color: "#f472b6" },
                  { id: "restaurant", label: "Repas au restaurant",               color: "#fbbf24" },
                  { id: "motivation", label: "Manque de motivation",              color: "#94a3b8" },
                  { id: "cuisine",    label: "Manque d'organisation en cuisine",  color: "#60a5fa" },
                  { id: "stress",     label: "Manger sous le stress",             color: "#f87171" },
                  { id: "autre",      label: "Autre",                              color: "#64748b" },
                ].map(d => {
                  const sel = defi === d.id;
                  return (
                    <button key={d.id} onClick={() => setDefi(d.id)} style={{
                      background: sel ? d.color + "0d" : "transparent",
                      border: sel ? `1px solid ${d.color}55` : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12, padding: "16px 12px", minHeight: 56,
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: d.color, flexShrink: 0, opacity: sel ? 1 : 0.45 }} />
                      <p style={{ margin: 0, fontSize: 13, fontWeight: sel ? 500 : 400, color: sel ? "#e2e8f0" : "#94a3b8", lineHeight: 1.4 }}>{d.label}</p>
                    </button>
                  );
                })}
              </div>
              {defi === "autre" && (
                <input type="text" value={defiCustom} onChange={e => setDefiCustom(e.target.value)}
                  placeholder="Décrivez votre défi..." style={{ ...inputStyle, marginTop: 8 }}
                  onFocus={e => e.target.style.borderColor = "#64748b"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"} />
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>← Retour</button>
              {(() => {
                const step2Disabled = !objectif || !mood || !defi || (objectif === "autre" && !objectifCustom.trim()) || (mood === "autre" && !moodCustom.trim()) || (defi === "autre" && !defiCustom.trim());
                return (
                  <button onClick={() => setStep(3)} disabled={step2Disabled}
                    style={{ flex: 2, height: 44, borderRadius: 10, background: step2Disabled ? "rgba(255,255,255,0.05)" : "rgba(16,185,129,0.12)", border: `1px solid ${step2Disabled ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.3)"}`, color: step2Disabled ? "#374151" : "#10b981", fontSize: 14, fontWeight: 600, cursor: step2Disabled ? "not-allowed" : "pointer", transition: "all 0.2s" }}
                    onMouseEnter={e => { if (!step2Disabled) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; } }}
                    onMouseLeave={e => { if (!step2Disabled) { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; } }}>
                    Continuer →
                  </button>
                );
              })()}
            </div>
          </div>
        )}

        {/* ═══ ÉTAPE 3 - Quotidien ═══ */}
        {step === 3 && (
          <div style={{ background: "#111111", borderRadius: 20, padding: 24, border: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>Étape 3 - Votre quotidien</p>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>Votre mode de vie</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Pour des conseils vraiment adaptés à votre réalité.</p>

            {/* Équipement */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#f1f5f9", borderLeft: "2px solid rgba(16,185,129,0.5)", paddingLeft: 10 }}>Votre équipement cuisine</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {EQUIPEMENT.map(e => {
                  const active = equipement.includes(e.id);
                  return (
                    <button key={e.id} onClick={() => toggleMultiple(e.id, equipement, setEquipement)} style={cardBtn(active)}>
                      <p style={{ ...cardBtnText(active), textAlign: "center" }}>{e.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Temps cuisine */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#f1f5f9", borderLeft: "2px solid rgba(16,185,129,0.5)", paddingLeft: 10 }}>Temps disponible pour cuisiner le soir</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {["< 15 min", "15-30 min", "30-45 min", "45+ min"].map(t => {
                  const active = tempsCuisine === t;
                  return (
                    <button key={t} onClick={() => setTempsCuisine(t)} style={cardBtn(active)}>
                      <p style={{ ...cardBtnText(active), textAlign: "center" }}>{t}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Budget */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#f1f5f9", borderLeft: "2px solid rgba(16,185,129,0.5)", paddingLeft: 10 }}>Votre rapport au budget courses</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[{ id: "eco", label: "Petit budget" }, { id: "standard", label: "Budget moyen" }, { id: "premium", label: "Budget flexible" }].map(b => {
                  const active = budget === b.id;
                  return (
                    <button key={b.id} onClick={() => setBudget(b.id)} style={cardBtn(active)}>
                      <p style={{ ...cardBtnText(active), textAlign: "center" }}>{b.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Repas sautés */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#f1f5f9", borderLeft: "2px solid rgba(16,185,129,0.5)", paddingLeft: 10 }}>Sautez-vous souvent des repas ?</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {["Petit-déjeuner", "Déjeuner", "Dîner", "Jamais"].map(r => {
                  const active = repasSautes.includes(r);
                  return (
                    <button key={r} onClick={() => {
                      if (r === "Jamais") {
                        setRepasSautes(repasSautes.includes("Jamais") ? [] : ["Jamais"]);
                      } else {
                        const without = repasSautes.filter(x => x !== "Jamais");
                        setRepasSautes(without.includes(r) ? without.filter(x => x !== r) : [...without, r]);
                      }
                    }} style={cardBtn(active)}>
                      <p style={{ ...cardBtnText(active), textAlign: "center" }}>{r}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sommeil */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#f1f5f9", borderLeft: "2px solid rgba(16,185,129,0.5)", paddingLeft: 10 }}>Combien d&apos;heures dormez-vous en moyenne ?</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {SOMMEIL.map(s => {
                  const active = sommeil === s.id;
                  return (
                    <button key={s.id} onClick={() => setSommeil(s.id)} style={cardBtn(active)}>
                      <p style={{ ...cardBtnText(active), textAlign: "center" }}>{s.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {(() => {
              const step3Disabled = !tempsCuisine || !budget || !sommeil;
              return (
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep(2)} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>← Retour</button>
                  <button onClick={() => setStep(4)} disabled={step3Disabled}
                    style={{ flex: 2, height: 44, borderRadius: 10, background: step3Disabled ? "rgba(255,255,255,0.05)" : "rgba(16,185,129,0.12)", border: `1px solid ${step3Disabled ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.3)"}`, color: step3Disabled ? "#374151" : "#10b981", fontSize: 14, fontWeight: 600, cursor: step3Disabled ? "not-allowed" : "pointer", transition: "all 0.2s" }}
                    onMouseEnter={e => { if (!step3Disabled) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; } }}
                    onMouseLeave={e => { if (!step3Disabled) { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; } }}>
                    Continuer →
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══ ÉTAPE 4 - Aliments ═══ */}
        {step === 4 && (
          <div style={{ background: "#111111", borderRadius: 20, padding: 24, border: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#10b981", letterSpacing: "0.1em", textTransform: "uppercase" }}>Étape 4 - Vos goûts</p>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "white" }}>Vos préférences alimentaires</h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#64748b" }}>Cliquez une fois pour ❤️ aimer, deux fois pour ❌ ne pas aimer.</p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {[...ALIMENTS, ...customAliments].map(aliment => {
                const aime = alimentsAimes.includes(aliment);
                const deteste = alimentsDetestes.includes(aliment);
                return (
                  <button key={aliment} onClick={() => toggleAliment(aliment)} style={{ borderRadius: 20, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", border: `1px solid ${aime ? "rgba(16,185,129,0.4)" : deteste ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`, background: aime ? "rgba(16,185,129,0.1)" : deteste ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.03)", color: aime ? "#10b981" : deteste ? "#f87171" : "#94a3b8", transition: "all 0.15s" }}>
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

            {(() => {
              const step4Disabled = saving || (alimentsAimes.length + alimentsDetestes.length + customAliments.length === 0);
              return (
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setStep(3)} style={{ flex: 1, height: 44, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#94a3b8", cursor: "pointer", fontSize: 14, transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "white"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#94a3b8"; }}>← Retour</button>
                  <button onClick={() => void saveAndContinue()} disabled={step4Disabled}
                    style={{ flex: 2, height: 44, borderRadius: 10, background: step4Disabled ? "rgba(255,255,255,0.05)" : "rgba(16,185,129,0.12)", border: `1px solid ${step4Disabled ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.3)"}`, color: step4Disabled ? "#374151" : "#10b981", fontSize: 14, fontWeight: 600, cursor: step4Disabled ? "not-allowed" : "pointer", transition: "all 0.2s" }}
                    onMouseEnter={e => { if (!step4Disabled) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; } }}
                    onMouseLeave={e => { if (!step4Disabled) { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; } }}>
                    {saving ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(16,185,129,0.2)", borderTopColor: "#10b981", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Sauvegarde</span> : "Accéder à mon espace →"}
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}


