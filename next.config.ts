import type { NextConfig } from "next";

const securityHeaders = [
  // Empêche le chargement dans un iframe (protection clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Empêche le navigateur de deviner le type MIME d'un fichier
  { key: "X-Content-Type-Options", value: "nosniff" },
  // N'envoie l'URL de référence qu'aux origines identiques
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Force HTTPS pendant 1 an (inclus sous-domaines)
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Désactive les anciennes APIs de détection XSS du navigateur (remplacé par CSP)
  { key: "X-XSS-Protection", value: "0" },
  // Limite les APIs du navigateur accessibles (géoloc, caméra non requises)
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
];

const nextConfig: NextConfig = {
  // Désactiver la barre Vercel (visible quand connecté à Vercel dans le navigateur)
  devIndicators: false,
  async headers() {
    return [
      {
        // Headers de sécurité appliqués à toutes les routes
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Le chat est chargé dans une iframe same-origin pour le mode test praticien
        // → on surcharge X-Frame-Options pour autoriser uniquement la même origine
        source: "/chat(.*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
      {
        // Le Service Worker doit être servi sans cache et avec la bonne scope
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
