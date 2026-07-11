import Stripe from "stripe";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { paymentMethodId } = await request.json() as { paymentMethodId: string };
  if (!paymentMethodId) {
    return Response.json({ error: "paymentMethodId requis." }, { status: 400 });
  }

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
    return Response.json({ error: "Aucun compte Stripe associé." }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const customerId = practitioner.stripe_customer_id;

  // 1. Attacher le PM au customer si pas déjà fait
  await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });

  // 2. Définir comme PM par défaut du customer
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  // 3. Définir comme PM par défaut de l'abonnement actif
  const [activeSubs, trialSubs] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
    stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 }),
  ]);
  const subscription = activeSubs.data[0] ?? trialSubs.data[0] ?? null;
  if (subscription) {
    await stripe.subscriptions.update(subscription.id, {
      default_payment_method: paymentMethodId,
    });
  }

  return Response.json({ success: true });
}
