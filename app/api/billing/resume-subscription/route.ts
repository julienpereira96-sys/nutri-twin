import Stripe from "stripe";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
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
    return Response.json({ error: "Aucun abonnement trouvé." }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const customerId = practitioner.stripe_customer_id;

  const [activeSubs, trialSubs] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
    stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 }),
  ]);
  const subscription = activeSubs.data[0] ?? trialSubs.data[0] ?? null;

  if (!subscription) {
    return Response.json({ error: "Aucun abonnement actif trouvé." }, { status: 404 });
  }

  const updated = await stripe.subscriptions.update(subscription.id, {
    cancel_at_period_end: false,
  });

  return Response.json({
    success: true,
    cancel_at_period_end: false,
    current_period_end: updated.items.data[0]?.current_period_end ?? null,
  });
}
