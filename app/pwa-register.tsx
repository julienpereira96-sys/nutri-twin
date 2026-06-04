"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Enregistrer le service worker après que la page soit chargée
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          // Vérifier les mises à jour toutes les 60s
          setInterval(() => registration.update(), 60_000);
        })
        .catch(() => {
          // Silencieux — le SW n'est pas critique
        });
    });
  }, []);

  return null;
}
