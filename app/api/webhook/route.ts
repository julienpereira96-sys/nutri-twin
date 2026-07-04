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

  // Ancien flow - Checkout Sessions
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = session.customer as string;
    const userId = session.metadata?.userId;

    // ─── Pack upsell ─────────────────────────────────────────────────────────
    if (session.metadata?.type === "pack") {
      const packSize = parseInt(session.metadata?.packSize ?? "0", 10);
      const packSubscriptionId = session.subscription as string | null;

      if (userId && packSize > 0) {
        // Récupère la valeur actuelle pour incrémenter
        const { data: current } = await supabase
          .from("practitioners")
          .select("extra_patients")
          .eq("user_id", userId)
          .single();

        const newTotal = (current?.extra_patients ?? 0) + packSize;

        await supabase
          .from("practitioners")
          .update({
            extra_patients: newTotal,
            ...(packSubscriptionId ? { pack_subscription_id: packSubscriptionId } : {}),
          })
          .eq("user_id", userId);
      }
      return new Response("OK", { status: 200 });
    }

    // ─── Flow abonnement principal ────────────────────────────────────────────
    const plan = session.metadata?.plan ?? "pro";

    if (userId) {
      await supabase
        .from("practitioners")
        .update({
          stripe_customer_id: customerId,
          plan,
          subscription_status: "active",
        })
        .eq("user_id", userId);
    }

  }

  // Nouveau flow - SetupIntent + Subscription
  if (event.type === "customer.subscription.created") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    const plan = subscription.metadata?.plan ?? "pro";
    const status = subscription.status;

    await supabase
      .from("practitioners")
      .update({
        plan,
        subscription_status: status,
      })
      .eq("stripe_customer_id", customerId);
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    const status = subscription.status;

    // Inversion du mapping price_id → plan
    // Les env vars peuvent être undefined si la variable n'est pas définie — on filtre.
    const priceToplan: Record<string, string> = Object.fromEntries(
      (
        [
          [process.env.STRIPE_PRICE_ESSENTIEL, "essentiel"],
          [process.env.STRIPE_PRICE_PRO,       "pro"],
          [process.env.STRIPE_PRICE_CABINET,   "cabinet"],
        ] as [string | undefined, string][]
      ).filter((entry): entry is [string, string] => Boolean(entry[0]))
    );

    const priceId = subscription.items.data[0]?.price.id;
    const resolvedPlan = priceId ? priceToplan[priceId] : undefined;

    const updatePayload: Record<string, string> = { subscription_status: status };

    if (resolvedPlan) {
      updatePayload.plan = resolvedPlan;
    }

    await supabase
      .from("practitioners")
      .update(updatePayload)
      .eq("stripe_customer_id", customerId);
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    // Si c'est un abonnement pack (pack_subscription_id correspond), retirer les slots
    const { data: practitioner } = await supabase
      .from("practitioners")
      .select("plan, extra_patients, pack_subscription_id")
      .eq("stripe_customer_id", customerId)
      .single();

    if (practitioner?.pack_subscription_id === subscription.id) {
      // Identifier la taille du pack annulé selon le plan
      const packSizes: Record<string, number> = { essentiel: 5, pro: 10 };
      const packSize = packSizes[practitioner.plan ?? ""] ?? 0;
      const newTotal = Math.max(0, (practitioner.extra_patients ?? 0) - packSize);

      await supabase
        .from("practitioners")
        .update({ extra_patients: newTotal, pack_subscription_id: null })
        .eq("stripe_customer_id", customerId);
    } else {
      // Annulation de l'abonnement principal
      await supabase
        .from("practitioners")
        .update({ subscription_status: "cancelled", plan: null })
        .eq("stripe_customer_id", customerId);
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;
  
    await supabase
      .from("practitioners")
      .update({ subscription_status: "past_due" })
      .eq("stripe_customer_id", customerId);
  }

  return new Response("OK", { status: 200 });
}