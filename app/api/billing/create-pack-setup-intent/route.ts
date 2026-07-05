import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: practitioner, error } = await supabase
    .from("practitioners")
    .select("stripe_customer_id, plan")
    .eq("user_id", user.id)
    .single();

  if (error || !practitioner) {
    return NextResponse.json({ error: "Profil praticien introuvable." }, { status: 404 });
  }

  if (!practitioner.stripe_customer_id) {
    return NextResponse.json(
      { error: "Aucun customer Stripe associé à ce compte. Vous devez d'abord souscrire à un plan." },
      { status: 400 }
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: practitioner.stripe_customer_id,
      payment_method_types: ["card"],
      metadata: {
        userId: user.id,
        type: "pack",
        plan: practitioner.plan ?? "",
      },
    });

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
