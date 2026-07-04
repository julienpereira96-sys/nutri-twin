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
  if (!user) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { plan } = await request.json() as {
    plan: "essentiel" | "pro" | "cabinet";
  };

  const priceMap: Record<string, string> = {
    essentiel: process.env.STRIPE_PRICE_ESSENTIEL!,
    pro: process.env.STRIPE_PRICE_PRO!,
    cabinet: process.env.STRIPE_PRICE_CABINET!,
  };

  try {
    // Créer ou récupérer le customer Stripe
    let customerId: string | undefined;
    const { data: practitioner } = await supabase
      .from("practitioners")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

      if (practitioner?.stripe_customer_id) {
        try {
          const retrieved = await stripe.customers.retrieve(practitioner.stripe_customer_id);
          // retrieve() ne throw pas si le customer est supprimé — il retourne { deleted: true }
          if (!retrieved.deleted) {
            customerId = practitioner.stripe_customer_id;
          }
        } catch {
          customerId = undefined;
        }
      }
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user?.email,
          metadata: { userId: user.id || "" },
        });
        customerId = customer.id;
      
        await supabase
          .from("practitioners")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", user.id);
      }      

    // Créer un SetupIntent pour collecter la carte
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        userId: user.id || "",
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


