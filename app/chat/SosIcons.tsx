/**
 * SosIcons — Minimal stroke-based SVG icons for SOS exercises.
 * All icons: fill="none", stroke="currentColor", strokeWidth default 1.5px.
 * Import named exports as needed per exercise.
 */

import React from "react";

export type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
  className?: string;
};

const base = (props: IconProps) => ({
  width: props.size ?? 24,
  height: props.size ?? 24,
  fill: "none" as const,
  stroke: props.color ?? "currentColor",
  strokeWidth: props.strokeWidth ?? 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  style: props.style,
  className: props.className,
});

// ─── BREATHING ───────────────────────────────────────────────────────────────
export function IconWave(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M2 10c1.5-3 3-4.5 4.5-4.5S9 7 10.5 7s3-1.5 4.5-1.5S18 7 19.5 7 22 5.5 22 5.5" />
      <path d="M2 17c1.5-3 3-4.5 4.5-4.5S9 14 10.5 14s3-1.5 4.5-1.5S18 14 19.5 14s2.5-1.5 2.5-1.5" opacity="0.6" />
      <path d="M2 13.5c1.5-3 3-4.5 4.5-4.5S9 11 10.5 11s3-1.5 4.5-1.5S18 11 19.5 11s2.5-1.5 2.5-1.5" opacity="0.35" />
    </svg>
  );
}

// ─── ANCRAGE ─────────────────────────────────────────────────────────────────
export function IconAnchor(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <circle cx="12" cy="5" r="3" />
      <line x1="12" y1="8" x2="12" y2="22" />
      <path d="M5 15H3a9 9 0 0 0 18 0h-2" />
    </svg>
  );
}

// ─── BODYSCAN ────────────────────────────────────────────────────────────────
export function IconBodyScan(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M12 2a5 5 0 0 1 5 5v2H7V7a5 5 0 0 1 5-5z" />
      <rect x="7" y="9" width="10" height="13" rx="2" />
      <line x1="4" y1="13" x2="7" y2="13" />
      <line x1="17" y1="13" x2="20" y2="13" />
    </svg>
  );
}

// ─── MANGER ──────────────────────────────────────────────────────────────────
export function IconForkKnife(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M3 11l2-7 2 7M3 11h4M5 11v10" />
      <path d="M12 3v18M19 3v6a3 3 0 0 1-3 3v6" />
    </svg>
  );
}

// ─── ECRITURE ────────────────────────────────────────────────────────────────
export function IconPen(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

// ─── DEFUSION ────────────────────────────────────────────────────────────────
export function IconThoughtBubble(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M9.5 9.5h.01M12.5 9.5h.01M15.5 9.5h.01" strokeWidth="2" />
    </svg>
  );
}

// ─── MARCHE ──────────────────────────────────────────────────────────────────
export function IconWalker(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <circle cx="13" cy="4" r="2" />
      <path d="M10.5 8.5L8 14l3 1-2 6" />
      <path d="M10.5 8.5L14 11l3 2" />
      <path d="M11 14l-2 3 3 1" />
    </svg>
  );
}

// ─── ADAPTIVE COACHING ───────────────────────────────────────────────────────
export function IconSparkle(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m5.64 5.64 2.83 2.83M15.54 15.54l2.83 2.83M5.64 18.36l2.83-2.83M15.54 8.46l2.83-2.83" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ─── COMPLETED / SUCCESS (used across all exercises) ─────────────────────────
export function IconCheckRing(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

// ─── SENSE ICONS (Ancrage 5-4-3-2-1) ────────────────────────────────────────
export function IconEye(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconTouch(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="5.5" opacity="0.55" />
      <circle cx="12" cy="12" r="8.5" opacity="0.25" />
    </svg>
  );
}

export function IconEar(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M6 8.5A6 6 0 0 1 18 9v3c0 3.3-2.7 6-6 6v0a4 4 0 0 1-4-4v-1" />
      <path d="M10.5 13a2.5 2.5 0 0 0 2.5 2.5" />
    </svg>
  );
}

export function IconWind(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M9.59 4.59A2 2 0 1 1 11 8H2" />
      <path d="M12.59 19.41A2 2 0 1 0 14 16H2" />
      <path d="M6.59 11.41A2 2 0 1 0 8 8H2" />
    </svg>
  );
}

export function IconDroplet(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M12 2C9.5 6 6 10.5 6 15a6 6 0 0 0 12 0c0-4.5-3.5-9-6-13z" />
    </svg>
  );
}

// ─── BODYSCAN ZONE ICONS ─────────────────────────────────────────────────────
export function IconHeadZone(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M9 9h.01M15 9h.01" />
      <path d="M8 13s1.5 2 4 2 4-2 4-2" />
      <path d="M20 13c0 5-3.58 9-8 9s-8-4-8-9a8 8 0 0 1 16 0z" />
    </svg>
  );
}

export function IconChestZone(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function IconBellyZone(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <ellipse cx="12" cy="13" rx="8" ry="6" />
      <path d="M12 7c0-2 1.5-3.5 3-3.5" />
      <circle cx="12" cy="13" r="2" opacity="0.45" />
    </svg>
  );
}

// ─── MANGER PHASE ICONS ───────────────────────────────────────────────────────
export function IconObserve(p: IconProps) {
  return <IconEye {...p} />;
}

export function IconMouth(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M3 11.5C3 16.19 7.03 20 12 20s9-3.81 9-8.5" />
      <path d="M3 11.5a9 9 0 0 1 18 0" opacity="0.5" />
    </svg>
  );
}

export function IconSpiral(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M12 12c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-6-2.7-6-6 2.7-6 6-6 8 3.6 8 8-3.6 8-8 8-10-4.5-10-10" />
    </svg>
  );
}

export function IconSwallow(p: IconProps) {
  return <IconDroplet {...p} />;
}

// ─── ECRITURE RITUALS ────────────────────────────────────────────────────────
export function IconFlame(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

export function IconScissors(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

// ─── DEFUSION RITUALS ────────────────────────────────────────────────────────
export function IconBalloon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M12 2a7 7 0 0 1 7 7c0 5-5 9-7 11-2-2-7-6-7-11a7 7 0 0 1 7-7z" />
      <path d="M12 20v2" />
      <path d="M10 22h4" />
    </svg>
  );
}

export function IconStars(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M12 3l1.5 4.5H18l-3.75 2.75L15.75 15 12 12.25 8.25 15l1.5-4.75L6 7.5h4.5z" />
      <path d="M5 3l.75 2H8L6.25 6.25l.75 2.5L5 7.5 3 8.75l.75-2.5L2 5h2.25z" opacity="0.6" />
      <path d="M19 14l.75 2H22l-1.75 1.25.75 2.5L19 18.5l-2 1.25.75-2.5L16 16h2.25z" opacity="0.6" />
    </svg>
  );
}

export function IconBurst(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <path d="m5.64 5.64 2.12 2.12M16.24 16.24l2.12 2.12M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ─── MARCHE SPECIFIC ─────────────────────────────────────────────────────────
export function IconHeadphones(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );
}

export function IconAlertTriangle(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="m10.29 3.86-8.43 14.58A2 2 0 0 0 3.72 21h16.56a2 2 0 0 0 1.86-2.56L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function IconFootprint(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M8 4c0-1.1.9-2 2-2s2 .9 2 2v5c0 2.5 2 4.5 2 7a5 5 0 0 1-10 0c0-2.5 2-4.5 2-7V4z" />
      <path d="M14 7c0-1.1.9-2 2-2s2 .9 2 2v3c0 2 1.5 3.5 1.5 5.5a3.5 3.5 0 0 1-7 0c0-2 1.5-3.5 1.5-5.5V7z" opacity="0.55" />
    </svg>
  );
}

export function IconSensorDot(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M6.3 6.3a8 8 0 0 0 0 11.4" />
      <path d="M17.7 6.3a8 8 0 0 1 0 11.4" />
    </svg>
  );
}

// ─── ADAPTIVE COACHING ───────────────────────────────────────────────────────
export function IconSprout(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5.8-6.4 3-10" />
      <path d="M9.5 9.4c1.1.8 1.8 2 2 3.1C10 10 8 8.4 5 9c0 3.3 3 6 5 8c.5.5 1.2.8 2 .8" />
      <path d="M14.5 9.4C13.4 10.2 12.7 11.4 12.5 12.5 14 10 16 8.4 19 9c0 3.3-3 6-5 8" />
    </svg>
  );
}

// ─── DASHBOARD ICONS ─────────────────────────────────────────────────────────
export function IconAward(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <circle cx="12" cy="9" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

export function IconSiren(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M12 4H5a3 3 0 0 0-3 3v9h18V7a3 3 0 0 0-3-3h-5z" />
      <path d="M2 16h20v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2z" />
      <line x1="12" y1="4" x2="12" y2="16" />
      <path d="M12 7a3 3 0 0 1 3 3" opacity="0.6" />
    </svg>
  );
}

export function IconPin(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function IconLock(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function IconRefresh(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export function IconX(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...base(p)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
