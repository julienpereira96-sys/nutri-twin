import Stripe from "stripe";

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const { plan, userId } = await request.json() as {
    plan: "essentiel" | "pro" | "cabinet";
    userId: string;
  };

  const priceMap = {
    essentiel: process.env.STRIPE_PRICE_ESSENTIEL!,
    pro: process.env.STRIPE_PRICE_PRO!,
    cabinet: process.env.STRIPE_PRICE_CABINET!,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceMap[plan],
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 14,
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/signup?plan=${plan}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/#tarifs`,
    metadata: { userId, plan },
  });

  return Response.json({ url: session.url });
}
