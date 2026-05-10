import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { paymentMethodId, plan } = await request.json() as {
    paymentMethodId: string;
    plan: string;
  };

  const priceMap: Record<string, string> = {
    essentiel: process.env.STRIPE_PRICE_ESSENTIEL!,
    pro: process.env.STRIPE_PRICE_PRO!,
    cabinet: process.env.STRIPE_PRICE_CABINET!,
    fondateur: process.env.STRIPE_PRICE_FONDATEUR!,
  };

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
