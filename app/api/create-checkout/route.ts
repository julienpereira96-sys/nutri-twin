import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

export async function POST(request: Request) {
  // M6 — Utiliser getSessionUser() au lieu de createServerClient + supabase.auth.getUser()
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const { plan } = await request.json() as {
    plan: "essentiel" | "pro" | "cabinet";
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


