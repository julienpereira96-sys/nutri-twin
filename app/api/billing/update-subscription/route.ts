import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

// ─── Mapping plan → price_id ──────────────────────────────────────────────────

type SwitchablePlan = "essentiel" | "pro" | "cabinet";

const PLAN_PRICES: Record<SwitchablePlan, string | undefined> = {
  essentiel: process.env.STRIPE_PRICE_ESSENTIEL,
  pro:       process.env.STRIPE_PRICE_PRO,
  cabinet:   process.env.STRIPE_PRICE_CABINET,
};

const SWITCHABLE_PLANS: ReadonlyArray<string> = ["essentiel", "pro", "cabinet"];

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Auth
  const user = await getSessionUser();
  if (!user) return unauthorized();

  // Parse body
  const body = await request.json() as { newPlan?: string };
  const { newPlan } = body;

  if (!newPlan || !SWITCHABLE_PLANS.includes(newPlan)) {
    return NextResponse.json({ error: "Plan invalide." }, { status: 400 });
  }

  // Supabase client (lecture du profil praticien)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(list) {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );

  // Récupérer le praticien
  const { data: practitioner, error: dbErr } = await supabase
    .from("practitioners")
    .select("stripe_customer_id, plan")
    .eq("user_id", user.id)
    .single();

  if (dbErr || !practitioner) {
    return NextResponse.json({ error: "Profil praticien introuvable." }, { status: 404 });
  }

  if (!practitioner.stripe_customer_id) {
    return NextResponse.json({ error: "Aucun customer Stripe associé à ce compte." }, { status: 400 });
  }

  // Guard fondateur — plan spécial non modifiable
  if (practitioner.plan === "fondateur") {
    return forbidden();
  }

  const newPriceId = PLAN_PRICES[newPlan as SwitchablePlan];
  if (!newPriceId) {
    return NextResponse.json({ error: `Variable d'environnement manquante pour le plan "${newPlan}".` }, { status: 500 });
  }

  // ─── Appel Stripe ────────────────────────────────────────────────────────────

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  try {
    // Chercher l'abonnement actif (inclut les trials)
    const [activeSubs, trialSubs] = await Promise.all([
      stripe.subscriptions.list({
        customer: practitioner.stripe_customer_id,
        status: "active",
        limit: 1,
      }),
      stripe.subscriptions.list({
        customer: practitioner.stripe_customer_id,
        status: "trialing",
        limit: 1,
      }),
    ]);

    const subscription = activeSubs.data[0] ?? trialSubs.data[0] ?? null;

    if (!subscription) {
      return NextResponse.json({ error: "Aucun abonnement actif trouvé pour ce customer." }, { status: 404 });
    }

    const currentItem = subscription.items.data[0];
    if (!currentItem) {
      return NextResponse.json({ error: "Structure d'abonnement inattendue." }, { status: 500 });
    }

    // Mettre à jour l'abonnement avec prorata immédiat
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: currentItem.id, price: newPriceId }],
      proration_behavior: "always_invoice",
    });

    // Mise à jour optimiste en base — le webhook confirmera
    await supabase
      .from("practitioners")
      .update({ plan: newPlan })
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, newPlan });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
