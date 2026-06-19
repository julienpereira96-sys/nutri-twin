"use client";

/**
 * useMicPermission — Gestion du consentement microphone.
 *
 * Stratégie localStorage (sans race condition) :
 *   - La première fois qu'un exercice vocal est lancé, on montre notre overlay
 *     d'explication AVANT le dialog natif du navigateur.
 *   - Dès que l'utilisateur clique "Commencer", on marque le consentement dans
 *     localStorage → l'overlay ne réapparaît plus jamais.
 *   - On lit aussi l'état réel via navigator.permissions pour détecter "denied"
 *     (et afficher les instructions pour réactiver dans les réglages).
 */

import { useEffect, useRef, useState } from "react";

export type MicStatus = "unknown" | "granted" | "prompt" | "denied";

const MIC_CONSENT_KEY = "nutritwin_mic_consent_v1";

/** L'utilisateur a-t-il déjà vu et validé l'écran d'explication ? */
export function hasMicConsent(): boolean {
  try { return !!localStorage.getItem(MIC_CONSENT_KEY); } catch { return false; }
}

/** Marquer l'écran d'explication comme vu (appelé au clic "Commencer"). */
export function markMicConsent(): void {
  try { localStorage.setItem(MIC_CONSENT_KEY, "1"); } catch {}
}

export interface MicPermissionResult {
  /** État lu via navigator.permissions (peut être "unknown" brièvement). */
  status: MicStatus;
  /** Ref lisible dans les closures sans dépendance réactive. */
  statusRef: React.RefObject<MicStatus>;
}

export function useMicPermission(): MicPermissionResult {
  const [status, setStatus] = useState<MicStatus>("unknown");
  const statusRef = useRef<MicStatus>("unknown");

  const update = (s: MicStatus) => {
    statusRef.current = s;
    setStatus(s);
  };

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (typeof navigator.permissions?.query !== "function") {
      update("prompt");
      return;
    }
    let perm: PermissionStatus | null = null;
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then(r => {
        perm = r;
        update(r.state as MicStatus);
        r.onchange = () => update(r.state as MicStatus);
      })
      .catch(() => update("prompt"));
    return () => { if (perm) perm.onchange = null; };
  }, []);

  return { status, statusRef };
}
