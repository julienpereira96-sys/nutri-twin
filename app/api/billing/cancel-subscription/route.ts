import Stripe from "stripe";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { createClient } from "@supabase/supabase-js";
import { buildEmailHtml, sendEmail } from "@/lib/email";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("stripe_customer_id, first_name, last_name, email")
    .eq("user_id", user.id)
    .single();

  if (!practitioner?.stripe_customer_id) {
    return Response.json({ error: "Aucun abonnement actif." }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const customerId = practitioner.stripe_customer_id;

  const [activeSubs, trialSubs] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "active", limit: 100 }),
    stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 100 }),
  ]);
  // Exclure les souscriptions pack — on ne doit agir que sur l'abonnement principal.
  const notPack = (s: Stripe.Subscription) => s.metadata?.type !== "pack";
  const subscription = activeSubs.data.find(notPack) ?? trialSubs.data.find(notPack) ?? null;

  if (!subscription) {
    return Response.json({ error: "Aucun abonnement actif trouvé." }, { status: 404 });
  }

  // Programmer l'annulation en fin de période (pas d'interruption immédiate)
  const updated = await stripe.subscriptions.update(subscription.id, {
    cancel_at_period_end: true,
  });

  const periodEndTs = updated.items.data[0]?.current_period_end ?? updated.cancel_at ?? Math.floor(Date.now() / 1000);
  const endDate = new Date(periodEndTs * 1000);
  const endDateStr = endDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  // Email de confirmation au praticien
  if (practitioner.email) {
    const html = buildEmailHtml({
      preheader: `Votre accès NutriTwin reste actif jusqu'au ${endDateStr}.`,
      greeting: `Bonjour ${practitioner.first_name ?? ""},`,
      headline: "Résiliation confirmée",
      body: `
        <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.75;">
          Votre demande de résiliation a bien été prise en compte.
        </p>
        <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.75;">
          Votre accès à NutriTwin reste actif jusqu'au&nbsp;<strong style="color:#f8fafc;">${endDateStr}</strong>,
          date à laquelle votre abonnement prendra fin automatiquement.
        </p>
      `,
      infoBox: `Vous avez changé d'avis&nbsp;? Vous pouvez annuler votre résiliation à tout moment avant le <strong style="color:#f8fafc;">${endDateStr}</strong> depuis <strong style="color:#f8fafc;">Paramètres&nbsp;→&nbsp;Abonnement</strong>.`,
      footerNote: `Cet email vous a été envoyé suite à votre demande de résiliation. Vos données patients restent conservées conformément à nos obligations légales. Pour toute question&nbsp;: <a href="mailto:contact@nutritwin.fr" style="color:#374151;">contact@nutritwin.fr</a>`,
    });

    await sendEmail({
      to: practitioner.email,
      subject: `Résiliation confirmée · accès actif jusqu'au ${endDateStr}`,
      html,
    });
  }

  return Response.json({
    success: true,
    cancel_at_period_end: true,
    current_period_end: updated.items.data[0]?.current_period_end ?? null,
  });
}
