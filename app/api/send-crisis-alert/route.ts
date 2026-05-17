import { createClient } from "@supabase/supabase-js";

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
    supabase.from("practitioners").select("first_name, last_name, email").eq("user_id", practitionerId).single(),
  ]);

  const patient = patientResult.data as { first_name?: string; last_name?: string } | null;
  const practitioner = practitionerResult.data as { first_name?: string; last_name?: string; email?: string } | null;

  if (!practitioner?.email) return Response.json({ error: "Email praticien introuvable" }, { status: 400 });

  const alertLabels: Record<string, string> = {
    suicide: "🚨 Idées suicidaires exprimées",
    medical: "🚨 Urgence médicale signalée",
    threat: "🚨 Menace envers autrui exprimée",
  };

  const patientName = `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() || "Un patient";
  const alertLabel = alertLabels[alertType] ?? "🚨 Alerte critique";

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,sans-serif;color:#f1f5f9;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px;">
      <span style="font-size:20px;font-weight:800;color:#f1f5f9;">Nutri<span style="color:#10b981;">Twin</span></span>
    </div>

    <div style="background:#1a0a0a;border:1px solid rgba(244,63,94,0.4);border-radius:16px;padding:28px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#f43f5e;letter-spacing:0.1em;text-transform:uppercase;">${alertLabel}</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9;">Action immédiate requise</h1>
      <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.6;">Votre patient <strong style="color:#f1f5f9;">${patientName}</strong> a exprimé un signal de détresse critique via votre Jumeau Numérique.</p>
    </div>

    <div style="background:#0d1512;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;">Message du patient</p>
      <p style="margin:0;font-size:14px;color:#e2e8f0;line-height:1.7;font-style:italic;">"${message}"</p>
    </div>

    <div style="background:#0d1512;border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:20px;margin-bottom:32px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#10b981;">Étapes recommandées</p>
      <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">1. Contactez directement ${patientName} dès que possible.</p>
      <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">2. Connectez-vous à votre dashboard pour voir la conversation complète.</p>
      <p style="margin:0;font-size:13px;color:#94a3b8;">3. Levez l'alerte depuis la fiche patient une fois la situation gérée.</p>
    </div>

    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display:block;text-align:center;background:#10b981;color:black;font-size:14px;font-weight:700;padding:14px 24px;border-radius:12px;text-decoration:none;margin-bottom:32px;">Accéder au Dashboard →</a>

    <p style="margin:0;font-size:11px;color:#374151;text-align:center;">NutriTwin · Cet email est confidentiel et destiné uniquement à ${practitioner.first_name} ${practitioner.last_name}</p>
  </div>
</body>
</html>`;

  // Envoi via Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return Response.json({ error: "Resend non configuré" }, { status: 500 });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: "NutriTwin Alertes <alertes@nutritwin.fr>",
      to: practitioner.email,
      subject: `🚨 ${alertLabel} — ${patientName}`,
      html: emailHtml,
    }),
  });

  if (!res.ok) return Response.json({ error: "Erreur envoi email" }, { status: 500 });
  return Response.json({ success: true });
}
