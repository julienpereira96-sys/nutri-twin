"use client";

/**
 * useMicPermission — Lit l'état courant de la permission microphone.
 *
 * NE déclenche JAMAIS de dialog native.
 * Retourne :
 *   "unknown"  → vérification en cours (bref flash initial)
 *   "granted"  → permission déjà accordée → on peut appeler getUserMedia sans dialog
 *   "prompt"   → permission pas encore demandée → un dialog apparaîtra
 *   "denied"   → permission refusée → getUserMedia échouera
 *
 * `statusRef` est utilisable dans les closures / useCallback sans dépendance réactive.
 */

import { useEffect, useRef, useState } from "react";

export type MicStatus = "unknown" | "granted" | "prompt" | "denied";

export interface MicPermissionResult {
  status: MicStatus;
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

    // navigator.permissions n'est pas dispo sur tous les browsers (Firefox Android partiel)
    if (typeof navigator.permissions?.query !== "function") {
      update("prompt"); // fallback prudent : on supposera qu'il faut demander
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
