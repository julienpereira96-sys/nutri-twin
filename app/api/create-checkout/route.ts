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

  const { plan, userId } = await request.json() as {
    plan: "essentiel" | "pro" | "cabinet" | "fondateur";
    userId: string;
  };

  const priceMap: Record<string, string> = {
    essentiel: process.env.STRIPE_PRICE_ESSENTIEL!,
    pro: process.env.STRIPE_PRICE_PRO!,
    cabinet: process.env.STRIPE_PRICE_CABINET!,
    fondateur: process.env.STRIPE_PRICE_FONDATEUR!,
  };

  try {
    console.log("Plan reçu:", plan);
    console.log("Price ID:", priceMap[plan]);

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page" as any,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceMap[plan], quantity: 1 }],
      subscription_data: { trial_period_days: 14 },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        userId: userId || user?.id || "",
        plan,
      },
    });

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (error) {
    console.error("Stripe error complète:", JSON.stringify(error, null, 2));
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
