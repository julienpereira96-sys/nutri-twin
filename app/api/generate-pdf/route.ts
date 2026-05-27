import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId, practitionerId, reportContent, patientName, practitionerName } = await request.json() as {
    patientId: string;
    practitionerId: string;
    reportContent: string;
    patientName: string;
    practitionerName: string;
  };

  if (user.id !== practitionerId) return forbidden();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', Arial, sans-serif; background: white; color: #0f172a; padding: 60px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
    .logo { font-size: 22px; font-weight: 800; color: #10b981; }
    .meta { text-align: right; font-size: 12px; color: #94a3b8; line-height: 1.8; }
    .title { font-size: 28px; font-weight: 300; color: #0f172a; margin-bottom: 8px; letter-spacing: -0.5px; }
    .subtitle { font-size: 14px; color: #64748b; margin-bottom: 48px; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 11px; font-weight: 600; color: #94a3b8; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 12px; }
    .content { font-size: 14px; color: #374151; line-height: 1.8; white-space: pre-wrap; }
    .footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
    .badge { display: inline-block; background: #f0fdf4; border: 1px solid #d1fae5; border-radius: 20px; padding: 4px 12px; font-size: 11px; color: #059669; font-weight: 600; margin-bottom: 32px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">NutriTwin</div>
    <div class="meta">
      <div>${practitionerName}</div>
      <div>Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</div>
    </div>
  </div>

  <div class="badge">Rapport IA · Confidentiel</div>

  <h1 class="title">Analyse comportementale</h1>
  <p class="subtitle">Patient : ${patientName}</p>

  <div class="section">
    <div class="section-title">Synthèse générée par l'IA</div>
    <div class="content">${reportContent}</div>
  </div>

  <div class="footer">
    <div>NutriTwin — Jumeau Numérique</div>
    <div>Document confidentiel — Usage médical uniquement</div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}
