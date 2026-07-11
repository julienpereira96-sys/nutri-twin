import { createClient } from "@supabase/supabase-js";
import { buildEmailHtml } from "@/lib/email";

// Couleur alerte comportementale — alignée avec ORANGE_BEHAVIORAL du dashboard
const BEHAVIORAL_AMBER = "#f59e0b";
const BEHAVIORAL_AMBER_DARK = "#d97706";

export async function POST(request: Request) {
  // Auth : Bearer JWT (dashboard praticien connecté)
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Non autorisé" }, { status: 401 });

  const supabaseAuth = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) return Response.json({ error: "Token invalide" }, { status: 401 });

  const { patientId, practitionerId } = await request.json() as {
    patientId: string;
    practitionerId: string;
  };

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [patientResult, practitionerResult] = await Promise.all([
    supabase.from("patients").select("first_name, last_name, admin_alerts").eq("user_id", patientId).single(),
    supabase.from("practitioners").select("first_name, last_name, email, notify_behavioral").eq("user_id", practitionerId).single(),
  ]);

  const patient = patientResult.data as { first_name?: string; last_name?: string; admin_alerts?: { type: string; alert_type?: string; date: string; email_sent?: boolean }[] } | null;
  const practitioner = practitionerResult.data as { first_name?: string; last_name?: string; email?: string; notify_behavioral?: boolean } | null;

  if (!practitioner?.email) return Response.json({ error: "Email praticien introuvable" }, { status: 400 });
  if (practitioner.notify_behavioral === false) return Response.json({ skipped: true, reason: "notify_behavioral désactivé" });

  // Trouver la dernière alerte comportementale non encore notifiée par email
  const alerts = patient?.admin_alerts ?? [];
  const latestBehavioral = alerts
    .filter(a => a.alert_type === "behavioral" || a.alert_type === "behavioral_sos_intake")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  if (!latestBehavioral) return Response.json({ skipped: true, reason: "Aucune alerte comportementale" });
  if (latestBehavioral.email_sent) return Response.json({ skipped: true, reason: "Email déjà envoyé" });

  const alertAgeMs = Date.now() - new Date(latestBehavioral.date).getTime();
  const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
  if (alertAgeMs < TWELVE_HOURS_MS) {
    return Response.json({ skipped: true, reason: "Alerte trop récente (< 12h)" });
  }

  const patientName = `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() || "Un patient";
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`;

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#94a3b8;line-height:1.65;">
      Votre patient <strong style="color:#f8fafc;">${patientName}</strong> est en alerte comportementale depuis plus de 12 heures sans retour au vert dans votre Jumeau Numérique.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:16px;">
      <tr>
        <td style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px 20px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;">Ce que cela signifie</p>
          <p style="margin:0;font-size:13px;color:#e2e8f0;line-height:1.7;">Une détresse comportementale a été détectée. Votre patient n'a pas encore signalé de mieux-être. Un contact proactif peut faire la différence.</p>
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-bottom:28px;">
      <tr>
        <td style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px 20px;">
          <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#10b981;">Étapes suggérées</p>
          <p style="margin:0 0 7px;font-size:13px;color:#94a3b8;">1. Consultez la fiche patient dans votre dashboard.</p>
          <p style="margin:0 0 7px;font-size:13px;color:#94a3b8;">2. Pensez à reprendre contact avec ${patientName} lors de votre prochaine séance.</p>
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

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return Response.json({ error: "Resend non configuré" }, { status: 500 });

  const emailHtml = buildEmailHtml({
    preheader: `${patientName} est en alerte comportementale depuis plus de 12h sans retour au vert.`,
    greeting: "Alerte comportementale — 12h sans retour au vert",
    headline: "Votre attention est requise",
    body,
    footerNote: `Cet email est confidentiel et destiné uniquement à ${practitioner.first_name ?? ""} ${practitioner.last_name ?? ""}. Vous pouvez désactiver ces alertes dans Paramètres → Notifications.`,
    accentColor: BEHAVIORAL_AMBER,
    accentColorDark: BEHAVIORAL_AMBER_DARK,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: "NutriTwin Alertes <alertes@nutritwin.fr>",
      to: practitioner.email,
      subject: `Alerte comportementale — ${patientName} n'est pas revenu au vert depuis 12h`,
      html: emailHtml,
    }),
  });

  if (!res.ok) return Response.json({ error: "Erreur envoi email" }, { status: 500 });

  // Marquer l'alerte comme notifiée pour éviter les doublons
  const updatedAlerts = alerts.map(a =>
    a === latestBehavioral ? { ...a, email_sent: true } : a
  );
  await supabase.from("patients").update({ admin_alerts: updatedAlerts }).eq("user_id", patientId);

  return Response.json({ success: true });
}
