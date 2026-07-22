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
    .select("stripe_customer_id, first_name, last_name, email, plan")
    .eq("user_id", user.id)
    .single();

  if (!practitioner?.stripe_customer_id) {
    return Response.json({ error: "Aucun abonnement trouvé." }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const customerId = practitioner.stripe_customer_id;

  const [activeSubs, trialSubs] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "active", limit: 100 }),
    stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 100 }),
  ]);
  // Exclure les souscriptions pack — on ne réactive que l'abonnement principal.
  const notPack = (s: Stripe.Subscription) => s.metadata?.type !== "pack";
  const subscription = activeSubs.data.find(notPack) ?? trialSubs.data.find(notPack) ?? null;

  if (!subscription) {
    return Response.json({ error: "Aucun abonnement actif trouvé." }, { status: 404 });
  }

  const updated = await stripe.subscriptions.update(subscription.id, {
    cancel_at_period_end: false,
  });

  const periodEndTs = updated.items.data[0]?.current_period_end ?? Math.floor(Date.now() / 1000);
  const periodEndStr = new Date(periodEndTs * 1000).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const planLabel =
    practitioner.plan === "essentiel" ? "Essentiel" :
    practitioner.plan === "pro" ? "Professionnel" :
    practitioner.plan === "cabinet" ? "Cabinet" :
    "NutriTwin";

  // Email de confirmation au praticien
  if (practitioner.email) {
    const html = buildEmailHtml({
      preheader: `Votre abonnement ${planLabel} NutriTwin continue normalement.`,
      greeting: `Bonjour ${practitioner.first_name ?? ""},`,
      headline: "Résiliation annulée",
      body: `
        <p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.75;">
          Votre demande de résiliation a bien été annulée. Votre abonnement
          <strong style="color:#f8fafc;">${planLabel}</strong> continue normalement.
        </p>
        <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.75;">
          Votre prochain renouvellement est prévu le <strong style="color:#f8fafc;">${periodEndStr}</strong>.
        </p>
      `,
      footerNote: `Cet email vous a été envoyé suite à l'annulation de votre résiliation NutriTwin.`,
    });

    await sendEmail({
      to: practitioner.email,
      subject: `Résiliation annulée · votre abonnement ${planLabel} continue`,
      html,
    });
  }

  return Response.json({
    success: true,
    cancel_at_period_end: false,
    current_period_end: updated.items.data[0]?.current_period_end ?? null,
  });
}
