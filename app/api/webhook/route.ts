import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return new Response("Webhook signature invalide", { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const plan = session.metadata?.plan ?? "pro";
    const customerId = session.customer as string;

    if (session.customer_email) {
      await supabase
        .from("practitioners")
        .update({
          stripe_customer_id: customerId,
          plan,
          subscription_status: "active",
        })
        .eq("email", session.customer_email);
    }

    // Décrémenter le compteur si plan Fondateur
    if (plan === "fondateur") {
      await supabase.rpc("decrement_founder_counter");
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    await supabase
      .from("practitioners")
      .update({ subscription_status: "cancelled" })
      .eq("stripe_customer_id", customerId);
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    const status = subscription.status;

    await supabase
      .from("practitioners")
      .update({ subscription_status: status })
      .eq("stripe_customer_id", customerId);
  }

  return new Response("OK", { status: 200 });
}
