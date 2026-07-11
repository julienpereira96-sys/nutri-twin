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
    return Response.json({ error: "Aucun compte Stripe associé." }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const setupIntent = await stripe.setupIntents.create({
    customer: practitioner.stripe_customer_id,
    payment_method_types: ["card"],
    usage: "off_session",
  });

  return Response.json({ clientSecret: setupIntent.client_secret });
}
