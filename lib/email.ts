// ─── NutriTwin — Email utilities ─────────────────────────────────────────────
//
// buildEmailHtml  → template utilisateur (narrative, branded)
// buildAdminAlertHtml → template interne admin (tableau de données, bordure rouge)
// sendEmail       → wrapper Resend

const EMERALD = "#10b981";
const EMERALD_DARK = "#059669";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmailOptions {
  /** Texte de prévisualisation dans le client mail (invisible dans le body) */
  preheader: string;
  /** Petit label au-dessus du titre, ex. "Bonjour Marie," */
  greeting?: string;
  /** Titre principal */
  headline: string;
  /** Contenu principal en HTML */
  body: string;
  /** Bloc info vert (optionnel) — HTML */
  infoBox?: string;
  /** Note de bas de page (optionnel) — HTML */
  footerNote?: string;
  /** Couleur d'accent de la barre supérieure (défaut: émeraude) */
  accentColor?: string;
  accentColorDark?: string;
}

interface AdminAlertOptions {
  title: string;
  rows: Array<{ label: string; value: string }>;
  note?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

// ─── Template utilisateur ─────────────────────────────────────────────────────

export function buildEmailHtml({
  preheader,
  greeting,
  headline,
  body,
  infoBox,
  footerNote,
  accentColor,
  accentColorDark,
}: EmailOptions): string {
  const accent = accentColor ?? EMERALD;
  const accentDark = accentColorDark ?? EMERALD_DARK;
  const greetingBlock = greeting
    ? `<p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.09em;">${greeting}</p>`
    : "";

  const infoBoxBlock = infoBox
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:24px;">
        <tr>
          <td style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.14);border-radius:12px;padding:16px 20px;">
            <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.75;">${infoBox}</p>
          </td>
        </tr>
      </table>`
    : "";

  const footerNoteBlock = footerNote
    ? `<p style="margin:6px 0 0;font-size:10px;color:#4b5563;line-height:1.6;">${footerNote}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#060606;font-family:'Inter',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e8f0;-webkit-font-smoothing:antialiased;">

  <!-- Preheader invisible -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#060606;">${preheader}&nbsp;‌​‍‎‏‌​‍‎‏‌​‍‎‏</div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#060606;">
    <tr>
      <td align="center" style="padding:52px 16px 64px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="max-width:540px;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:36px;">
              <span style="font-size:22px;font-weight:800;color:#f8fafc;letter-spacing:-0.5px;">
                Nutri<span style="color:${EMERALD};">Twin</span>
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#0e0e0e;border:1px solid rgba(255,255,255,0.07);border-radius:20px;overflow:hidden;">

              <!-- Barre accent -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,${accent} 0%,${accentDark} 100%);"></td>
                </tr>
              </table>

              <!-- Contenu -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="padding:40px 40px 36px;">

                    ${greetingBlock}
                    <h1 style="margin:0 0 24px;font-size:26px;font-weight:700;color:#f8fafc;line-height:1.2;letter-spacing:-0.4px;">${headline}</h1>

                    <!-- Séparateur -->
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:24px;">
                      <tr><td style="height:1px;background:rgba(255,255,255,0.06);"></td></tr>
                    </table>

                    ${body}
                    ${infoBoxBlock}

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;color:#64748b;line-height:1.6;">
                NutriTwin&nbsp;·&nbsp;<a href="mailto:contact@nutritwin.fr" style="color:#10b981;text-decoration:none;">contact@nutritwin.fr</a>
              </p>
              ${footerNoteBlock}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ─── Template admin (alertes internes) ───────────────────────────────────────

export function buildAdminAlertHtml({ title, rows, note }: AdminAlertOptions): string {
  const rowsHtml = rows
    .map(
      ({ label, value }) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);color:#64748b;font-size:13px;width:140px;vertical-align:top;">${label}</td>
          <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);color:#f1f5f9;font-size:13px;font-weight:500;word-break:break-all;">${value}</td>
        </tr>`
    )
    .join("");

  const noteBlock = note
    ? `<div style="margin-top:20px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:12px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.65;">${note}</p>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#060606;font-family:'Inter',ui-sans-serif,system-ui,sans-serif;color:#e2e8f0;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <!-- Logo + badge admin -->
    <div style="margin-bottom:28px;display:flex;align-items:center;gap:10px;">
      <span style="font-size:20px;font-weight:800;color:#f8fafc;">Nutri<span style="color:#10b981;">Twin</span></span>
      <span style="font-size:10px;font-weight:700;color:#ef4444;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:4px;padding:2px 8px;letter-spacing:0.08em;text-transform:uppercase;">Admin</span>
    </div>

    <!-- Card -->
    <div style="background:#0e0e0e;border:1px solid rgba(239,68,68,0.2);border-radius:16px;overflow:hidden;">
      <div style="height:3px;background:linear-gradient(90deg,#ef4444,#dc2626);"></div>
      <div style="padding:28px 28px 24px;">
        <p style="margin:0 0 20px;font-size:17px;font-weight:700;color:#f8fafc;">${title}</p>
        <table style="width:100%;border-collapse:collapse;">${rowsHtml}</table>
        ${noteBlock}
      </div>
    </div>

    <p style="margin:24px 0 0;font-size:10px;color:#1f2937;text-align:center;">NutriTwin · Alerte interne — ne pas transférer</p>
  </div>
</body>
</html>`;
}

// ─── Sender ───────────────────────────────────────────────────────────────────

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      from: "NutriTwin <contact@nutritwin.fr>",
      to,
      subject,
      html,
    }),
  });
}
