import Stripe from "stripe";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (!practitioner?.stripe_customer_id) {
    return Response.json({ invoices: [], subscription: null });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const customerId = practitioner.stripe_customer_id;

  // Récupérer abonnement actif + infos carte
  const [activeSubs, trialSubs, invoicesList] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "active", limit: 100, expand: ["data.default_payment_method"] }),
    stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 100, expand: ["data.default_payment_method"] }),
    stripe.invoices.list({ customer: customerId, limit: 12 }),
  ]);

  // Exclure les souscriptions pack — l'encart abonnement affiche le principal.
  const notPack = (s: Stripe.Subscription) => s.metadata?.type !== "pack";
  const subscription = activeSubs.data.find(notPack) ?? trialSubs.data.find(notPack) ?? null;

  // Infos carte (depuis PM de l'abonnement ou du customer)
  let cardLast4: string | null = null;
  let cardBrand: string | null = null;
  if (subscription) {
    const pm = subscription.default_payment_method as Stripe.PaymentMethod | null;
    if (pm?.card) {
      cardLast4 = pm.card.last4;
      cardBrand = pm.card.brand;
    }
  }
  if (!cardLast4) {
    // Fallback: PM par défaut du customer
    const customer = await stripe.customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] });
    if (!("deleted" in customer)) {
      const pm = customer.invoice_settings?.default_payment_method as Stripe.PaymentMethod | null;
      if (pm?.card) {
        cardLast4 = pm.card.last4;
        cardBrand = pm.card.brand;
      }
    }
  }

  const subscriptionInfo = subscription ? {
    id: subscription.id,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    current_period_end: subscription.items.data[0]?.current_period_end ?? null, // timestamp Unix (Stripe v22: moved to SubscriptionItem)
    cancel_at: subscription.cancel_at ?? null,
  } : null;

  const invoices = invoicesList.data.map((inv) => ({
    id: inv.id,
    number: inv.number,
    amount_paid: inv.amount_paid,
    currency: inv.currency,
    status: inv.status,
    created: inv.created,
    invoice_pdf: inv.invoice_pdf,
    hosted_invoice_url: inv.hosted_invoice_url,
  }));

  return Response.json({ invoices, subscription: subscriptionInfo, cardLast4, cardBrand });
}
