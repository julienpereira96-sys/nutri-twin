import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "julien.pereira.96@gmail.com";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("first_name, last_name, email, specialty, plan")
    .eq("user_id", user.id)
    .single();

  if (!practitioner) {
    return Response.json({ error: "Praticien introuvable." }, { status: 404 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return Response.json({ error: "Email non configuré." }, { status: 500 });

  const requestDate = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  // Email à l'admin (Julien)
  const adminHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#f1f5f9;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="margin-bottom:24px;">
      <span style="font-size:20px;font-weight:800;color:#f1f5f9;">Nutri<span style="color:#10b981;">Twin</span></span>
    </div>
    <div style="background:#111111;border:1px solid rgba(239,68,68,0.25);border-radius:16px;padding:28px;margin-bottom:20px;">
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#f1f5f9;">🗑️ Demande de suppression de compte</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr><td style="padding:6px 0;color:#64748b;width:140px;">Date de la demande</td><td style="color:#f1f5f9;font-weight:500;">${requestDate}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Nom</td><td style="color:#f1f5f9;font-weight:500;">${practitioner.first_name ?? ""} ${practitioner.last_name ?? ""}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Email</td><td style="color:#10b981;font-weight:500;">${practitioner.email ?? user.email ?? "–"}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">UUID</td><td style="color:#94a3b8;font-size:11px;word-break:break-all;">${user.id}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Spécialité</td><td style="color:#f1f5f9;">${practitioner.specialty ?? "–"}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Plan</td><td style="color:#f1f5f9;">${practitioner.plan ?? "–"}</td></tr>
      </table>
    </div>
    <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:12px;padding:14px 18px;">
      <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
        À traiter dans les 30 jours (RGPD Art. 17).<br>
        Utiliser le script <strong style="color:#f1f5f9;">droit-a-loubli.sql</strong> avec l'UUID ci-dessus, puis supprimer le compte dans Supabase → Authentication → Users.
      </p>
    </div>
  </div>
</body>
</html>`;

  // Email de confirmation au praticien
  const practitionerHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#f1f5f9;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="margin-bottom:32px;">
      <span style="font-size:20px;font-weight:800;color:#f1f5f9;">Nutri<span style="color:#10b981;">Twin</span></span>
    </div>
    <div style="background:#111111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f1f5f9;">Demande de suppression reçue</p>
      <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
        Bonjour ${practitioner.first_name ?? ""},<br><br>
        Nous avons bien reçu votre demande de suppression de compte en date du <strong style="color:#f1f5f9;">${requestDate}</strong>. Conformément au RGPD (Article 17), votre demande sera traitée dans un délai de <strong style="color:#f1f5f9;">30 jours</strong>.
      </p>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px 20px;">
        <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
          Vous recevrez un email de confirmation lorsque votre compte et vos données auront été supprimés. Pour toute question, écrivez-nous à <a href="mailto:contact@nutritwin.fr" style="color:#10b981;">contact@nutritwin.fr</a>.
        </p>
      </div>
    </div>
    <p style="margin:0;font-size:11px;color:#374151;text-align:center;">NutriTwin · Cet email fait suite à votre demande de suppression de compte</p>
  </div>
</body>
</html>`;

  await Promise.all([
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "NutriTwin <contact@nutritwin.fr>",
        to: ADMIN_EMAIL,
        subject: `🗑️ Suppression compte — ${practitioner.first_name ?? ""} ${practitioner.last_name ?? ""} (${practitioner.email ?? user.email})`,
        html: adminHtml,
      }),
    }),
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "NutriTwin <contact@nutritwin.fr>",
        to: practitioner.email ?? user.email,
        subject: "Votre demande de suppression de compte a été reçue",
        html: practitionerHtml,
      }),
    }),
  ]);

  return Response.json({ success: true });
}
