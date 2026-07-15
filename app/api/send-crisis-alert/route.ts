import { createClient } from "@supabase/supabase-js";
import { buildEmailHtml } from "@/lib/email";

// Couleurs crise — alignées avec RED_CRITICAL_COLOR du dashboard
const CRISIS_RED = "#f43f5e";
const CRISIS_RED_DARK = "#e11d48";

export async function POST(request: Request) {

  const authHeader = request.headers.get("x-crisis-token");
  if (authHeader !== process.env.CRISIS_SECRET_TOKEN) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { patientId, practitionerId, alertType, message } = await request.json() as {
    patientId: string; practitionerId: string; alertType: string; message: string;
  };

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [patientResult, practitionerResult] = await Promise.all([
    supabase.from("patients").select("first_name, last_name").eq("user_id", patientId).single(),
    supabase.from("practitioners").select("first_name, last_name, email, notify_critical").eq("user_id", practitionerId).single(),
  ]);

  const patient = patientResult.data as { first_name?: string; last_name?: string } | null;
  const practitioner = practitionerResult.data as { first_name?: string; last_name?: string; email?: string; notify_critical?: boolean } | null;

  if (!practitioner?.email) return Response.json({ error: "Email praticien introuvable" }, { status: 400 });

  // Respecter le choix du praticien — les alertes dashboard restent toujours actives côté app
  if (practitioner.notify_critical === false) {
    return Response.json({ skipped: true, reason: "notify_critical désactivé" });
  }

  const alertLabels: Record<string, string> = {
    suicide: "🚨 Idées suicidaires exprimées",
    medical: "🚨 Urgence médicale signalée",
    threat: "🚨 Menace envers autrui exprimée",
  };

  const patientName = `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() || "Un patient";
  const alertLabel = alertLabels[alertType] ?? "🚨 Alerte critique";
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#94a3b8;line-height:1.65;">
      Votre patient <strong style="color:#f8fafc;">${patientName}</strong> a exprimé un signal de détresse critique via votre Jumeau Numérique.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:16px;">
      <tr>
        <td style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px 20px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;">Message du patient</p>
          <p style="margin:0;font-size:13px;color:#e2e8f0;line-height:1.7;">Une alerte critique a été détectée. Connectez-vous pour voir la conversation et intervenir.</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:28px;">
      <tr>
        <td style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px 20px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#10b981;">Étapes recommandées</p>
          <p style="margin:0 0 7px;font-size:13px;color:#94a3b8;">1. Contactez directement ${patientName} dès que possible.</p>
          <p style="margin:0 0 7px;font-size:13px;color:#94a3b8;">2. Connectez-vous à votre dashboard pour voir la conversation complète.</p>
          <p style="margin:0;font-size:13px;color:#94a3b8;">3. Levez l'alerte depuis la fiche patient une fois la situation gérée.</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
      <tr>
        <td align="center">
          <a href="${dashboardUrl}" style="display:inline-block;background:#10b981;color:#000000;font-size:14px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;">Accéder au Dashboard →</a>
        </td>
      </tr>
    </table>`;

  const emailHtml = buildEmailHtml({
    preheader: `${alertLabel} — Action immédiate requise pour ${patientName}.`,
    greeting: alertLabel,
    headline: "Action immédiate requise",
    body,
    footerNote: `Cet email est confidentiel et destiné uniquement à ${practitioner.first_name ?? ""} ${practitioner.last_name ?? ""}.`,
    accentColor: CRISIS_RED,
    accentColorDark: CRISIS_RED_DARK,
  });

  // Envoi via Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return Response.json({ error: "Resend non configuré" }, { status: 500 });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: "NutriTwin Alertes <alertes@nutritwin.fr>",
      to: practitioner.email,
      subject: `🚨 ${alertLabel} - ${patientName}`,
      html: emailHtml,
    }),
  });

  if (!res.ok) return Response.json({ error: "Erreur envoi email" }, { status: 500 });
  return Response.json({ success: true });
}
