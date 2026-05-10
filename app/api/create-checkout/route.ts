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
    // Créer ou récupérer le customer Stripe
    let customerId: string | undefined;
    const { data: practitioner } = await supabase
      .from("practitioners")
      .select("stripe_customer_id")
      .eq("user_id", userId || user?.id)
      .single();

      if (practitioner?.stripe_customer_id) {
        try {
          await stripe.customers.retrieve(practitioner.stripe_customer_id);
          customerId = practitioner.stripe_customer_id;
        } catch {
          customerId = undefined;
        }
      }
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user?.email,
          metadata: { userId: userId || user?.id || "" },
        });
        customerId = customer.id;
      
        await supabase
          .from("practitioners")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", userId || user?.id);
      }      

    // Créer un SetupIntent pour collecter la carte
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card", "link"],
      metadata: {
        userId: userId || user?.id || "",
        plan,
        priceId: priceMap[plan],
      },
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    console.error("Stripe error:", JSON.stringify(error, null, 2));
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


