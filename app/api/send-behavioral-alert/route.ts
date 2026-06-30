import { createClient } from "@supabase/supabase-js";

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

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,sans-serif;color:#f1f5f9;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <div style="margin-bottom:32px;">
      <span style="font-size:20px;font-weight:800;color:#f1f5f9;">Nutri<span style="color:#10b981;">Twin</span></span>
    </div>

    <div style="background:#1a1200;border:1px solid rgba(245,158,11,0.35);border-radius:16px;padding:28px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#f59e0b;letter-spacing:0.1em;text-transform:uppercase;">Alerte comportementale — 12h sans retour au vert</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9;">Votre attention est requise</h1>
      <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.6;">Votre patient <strong style="color:#f1f5f9;">${patientName}</strong> est en alerte comportementale depuis plus de 12 heures sans retour au vert dans votre Jumeau Numérique.</p>
    </div>

    <div style="background:#0d1512;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;">Ce que cela signifie</p>
      <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.7;">Une crise ou une détresse comportementale a été détectée (alerte orange). Votre patient n'a pas encore signalé de mieux-être. Un contact proactif peut faire la différence.</p>
    </div>

    <div style="background:#0d1512;border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:20px;margin-bottom:32px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#10b981;">Étapes suggérées</p>
      <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">1. Consultez la fiche patient dans votre dashboard.</p>
      <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">2. Pensez à reprendre contact avec ${patientName} lors de votre prochaine séance.</p>
      <p style="margin:0;font-size:13px;color:#94a3b8;">3. Levez l'alerte depuis la fiche patient une fois la situation gérée.</p>
    </div>

    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display:block;text-align:center;background:#10b981;color:black;font-size:14px;font-weight:700;padding:14px 24px;border-radius:12px;text-decoration:none;margin-bottom:32px;">Accéder au Dashboard →</a>

    <p style="margin:0;font-size:11px;color:#374151;text-align:center;">NutriTwin · Cet email est confidentiel et destiné uniquement à ${practitioner.first_name ?? ""} ${practitioner.last_name ?? ""}</p>
    <p style="margin:8px 0 0;font-size:11px;color:#374151;text-align:center;">Vous pouvez désactiver ces alertes dans vos Paramètres → Notifications.</p>
  </div>
</body>
</html>`;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return Response.json({ error: "Resend non configuré" }, { status: 500 });

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
