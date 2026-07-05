import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

// ─── Config des packs (identique à purchase-pack) ───────────────────────────
const PACK_CONFIG = {
  essentiel: {
    size: 5,
    priceId: process.env.STRIPE_PRICE_PACK_ESSENTIEL ?? "",
    maxPacks: 1,
    label: "+5 patients",
    amount: 39,
  },
  pro: {
    size: 10,
    priceId: process.env.STRIPE_PRICE_PACK_PRO ?? "",
    maxPacks: 2,
    label: "+10 patients",
    amount: 59,
  },
} as const;

type PlanKey = keyof typeof PACK_CONFIG;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { paymentMethodId } = (await request.json()) as { paymentMethodId: string };

  if (!paymentMethodId) {
    return NextResponse.json({ error: "paymentMethodId manquant." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Récupérer le profil du praticien
  const { data: practitioner, error } = await supabase
    .from("practitioners")
    .select("plan, stripe_customer_id, extra_patients")
    .eq("user_id", user.id)
    .single();

  if (error || !practitioner) {
    return NextResponse.json({ error: "Profil praticien introuvable." }, { status: 404 });
  }

  const plan = practitioner.plan as PlanKey | null;

  if (!plan || !(plan in PACK_CONFIG)) {
    return NextResponse.json(
      { error: "Aucun pack disponible pour votre plan actuel." },
      { status: 400 }
    );
  }

  const pack = PACK_CONFIG[plan];

  if (!pack.priceId) {
    return NextResponse.json(
      { error: `Variable d'environnement STRIPE_PRICE_PACK_${plan.toUpperCase()} manquante.` },
      { status: 500 }
    );
  }

  // Vérifier le plafond de packs
  const currentPacks = Math.floor((practitioner.extra_patients ?? 0) / pack.size);
  if (currentPacks >= pack.maxPacks) {
    return NextResponse.json(
      {
        error: `Vous avez atteint le maximum de ${pack.maxPacks} pack${pack.maxPacks > 1 ? "s" : ""} pour le plan ${plan}. Passez au plan supérieur pour accueillir davantage de patients.`,
      },
      { status: 403 }
    );
  }

  if (!practitioner.stripe_customer_id) {
    return NextResponse.json(
      { error: "Aucun customer Stripe associé à ce compte." },
      { status: 400 }
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  try {
    // Attacher la méthode de paiement au customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: practitioner.stripe_customer_id,
    });

    // Définir comme méthode par défaut
    await stripe.customers.update(practitioner.stripe_customer_id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Créer l'abonnement pack directement (sans passer par Stripe Checkout)
    const subscription = await stripe.subscriptions.create({
      customer: practitioner.stripe_customer_id,
      items: [{ price: pack.priceId, quantity: 1 }],
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      metadata: {
        type: "pack",
        packSize: String(pack.size),
        userId: user.id,
        plan,
      },
    });

    // Mettre à jour extra_patients et pack_subscription_id immédiatement
    const newTotal = (practitioner.extra_patients ?? 0) + pack.size;
    await supabase
      .from("practitioners")
      .update({
        extra_patients: newTotal,
        pack_subscription_id: subscription.id,
      })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      extraPatients: newTotal,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
