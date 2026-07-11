import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { createClient } from "@supabase/supabase-js";
import { buildEmailHtml, buildAdminAlertHtml, sendEmail } from "@/lib/email";

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

  const requestDate = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const practitionerEmail = practitioner.email ?? user.email ?? "";
  const fullName = `${practitioner.first_name ?? ""} ${practitioner.last_name ?? ""}`.trim();

  // Email à l'admin (alerte interne)
  const adminHtml = buildAdminAlertHtml({
    title: "Demande de suppression de compte",
    rows: [
      { label: "Date de la demande", value: requestDate },
      { label: "Nom", value: fullName || "–" },
      { label: "Email", value: practitionerEmail || "–" },
      { label: "UUID", value: user.id },
      { label: "Spécialité", value: practitioner.specialty ?? "–" },
      { label: "Plan", value: practitioner.plan ?? "–" },
    ],
    note: `À traiter dans les 30 jours (RGPD Art. 17).<br>Utiliser le script <strong style="color:#f1f5f9;">droit-a-loubli.sql</strong> avec l'UUID ci-dessus, puis supprimer le compte dans Supabase → Authentication → Users.`,
  });

  // Email de confirmation au praticien
  const practitionerHtml = buildEmailHtml({
    preheader: "Votre demande de suppression de compte NutriTwin a bien été reçue.",
    greeting: `Bonjour ${practitioner.first_name ?? ""},`,
    headline: "Demande de suppression reçue",
    body: `
      <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.75;">
        Nous avons bien reçu votre demande de suppression de compte, enregistrée le
        <strong style="color:#f8fafc;">${requestDate}</strong>.
      </p>
      <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.75;">
        Votre compte et l'ensemble de vos données seront supprimés dans un délai de
        <strong style="color:#f8fafc;">30 jours</strong>.
        Votre abonnement sera résilié automatiquement.
        Vous recevrez un email de confirmation une fois la suppression effectuée.
      </p>
    `,
    infoBox: `Vous avez changé d'avis&nbsp;? Écrivez-nous à <strong style="color:#f8fafc;">contact@nutritwin.fr</strong> avant l'expiration du délai de 30 jours pour annuler votre demande.`,
    footerNote: `Cet email fait suite à votre demande de suppression de compte NutriTwin.`,
  });

  await Promise.all([
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `🗑️ Suppression compte — ${fullName} (${practitionerEmail})`,
      html: adminHtml,
    }),
    sendEmail({
      to: practitionerEmail,
      subject: "Votre demande de suppression de compte a été reçue",
      html: practitionerHtml,
    }),
  ]);

  return Response.json({ success: true });
}
