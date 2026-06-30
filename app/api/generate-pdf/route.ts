import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

const SECTIONS = [
  { key: "synthese",       label: "Synthèse",               accent: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
  { key: "patterns",       label: "Patterns observés",       accent: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
  { key: "victoires",      label: "Victoires de la période", accent: "#10b981", bg: "#f0fdf4", border: "#a7f3d0" },
  { key: "murmures_bilan", label: "Points à approfondir",    accent: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
] as const;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { practitionerId, reportContent, patientName, practitionerName } = await request.json() as {
    patientId: string;
    practitionerId: string;
    reportContent: string;
    patientName: string;
    practitionerName: string;
  };

  if (user.id !== practitionerId) return forbidden();

  // Parser le JSON du rapport — fallback texte brut si parsing échoue
  let parsed: Record<string, string> = {};
  try {
    parsed = JSON.parse(reportContent) as Record<string, string>;
  } catch {
    parsed = { synthese: reportContent };
  }

  const sectionsHtml = SECTIONS
    .filter(s => parsed[s.key])
    .map(s => `
      <div class="section" style="border-left: 3px solid ${s.accent}; background: ${s.bg};">
        <div class="section-title" style="color: ${s.accent};">${s.label}</div>
        <div class="content">${(parsed[s.key] ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
      </div>`)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      background: white;
      color: #0f172a;
      padding: 56px 64px;
      max-width: 820px;
      margin: 0 auto;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 1px solid #e2e8f0;
    }
    .logo { font-size: 22px; font-family: 'Plus Jakarta Sans', Arial, sans-serif; letter-spacing: -0.03em; line-height: 1; }
    .logo-nutri { font-weight: 400; color: #0f172a; }
    .logo-twin  { font-weight: 800; color: #10b981; }
    .meta { text-align: right; font-size: 11px; color: #94a3b8; line-height: 1.9; }

    /* ── Badge ── */
    .badge {
      display: inline-block;
      background: #f0fdf4;
      border: 1px solid #a7f3d0;
      border-radius: 20px;
      padding: 3px 12px;
      font-size: 11px;
      color: #059669;
      font-weight: 600;
      margin-bottom: 20px;
      letter-spacing: 0.02em;
    }

    /* ── Title block ── */
    .title { font-size: 26px; font-weight: 300; color: #0f172a; margin-bottom: 4px; letter-spacing: -0.5px; }
    .subtitle { font-size: 13px; color: #64748b; margin-bottom: 40px; }

    /* ── Sections ── */
    .section {
      margin-bottom: 24px;
      border-radius: 10px;
      padding: 18px 22px;
    }
    .section-title {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .content {
      font-size: 13.5px;
      color: #374151;
      line-height: 1.85;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      color: #94a3b8;
    }

    @media print {
      body { padding: 40px 48px; }
      .section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo"><span class="logo-nutri">Nutri</span><span class="logo-twin">Twin</span></div>
    <div class="meta">
      <div>${practitionerName ?? ""}</div>
      <div>Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
    </div>
  </div>

  <div class="badge">Rapport IA · Confidentiel</div>

  <h1 class="title">Analyse comportementale</h1>
  <p class="subtitle">Patient : ${patientName ?? ""}</p>

  ${sectionsHtml}

  <div class="footer">
    <div>NutriTwin - Jumeau Numérique</div>
    <div>Document confidentiel · Usage médical uniquement</div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
