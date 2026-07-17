import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

export async function POST(request: Request) {
  // M6 — Utiliser getSessionUser() au lieu de createServerClient + supabase.auth.getUser()
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const { paymentMethodId, plan } = await request.json() as {
    paymentMethodId: string;
    plan: string;
  };

  const priceMap: Record<string, string> = {
    essentiel: process.env.STRIPE_PRICE_ESSENTIEL!,
    pro: process.env.STRIPE_PRICE_PRO!,
    cabinet: process.env.STRIPE_PRICE_CABINET!,
  };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: practitioner } = await supabase
      .from("practitioners")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!practitioner?.stripe_customer_id) {
      return NextResponse.json({ error: "Customer Stripe introuvable" }, { status: 400 });
    }

    // Attacher la carte au customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: practitioner.stripe_customer_id,
    });

    // Définir comme méthode par défaut
    await stripe.customers.update(practitioner.stripe_customer_id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Créer l'abonnement avec période d'essai
    const subscription = await stripe.subscriptions.create({
      customer: practitioner.stripe_customer_id,
      items: [{ price: priceMap[plan] }],
      trial_period_days: 14,
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      metadata: { userId: user.id, plan },
    });

    return NextResponse.json({ subscriptionId: subscription.id, status: subscription.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
