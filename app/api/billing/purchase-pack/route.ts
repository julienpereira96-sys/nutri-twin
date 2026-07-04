import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

// ─── Config des packs ────────────────────────────────────────────────────────
// Chaque plan a un pack avec taille fixe, prix Stripe, et plafond de packs achetables.

type PackConfig = {
  size: number;          // patients ajoutés
  priceId: string;       // Stripe Price ID (abonnement mensuel)
  maxPacks: number;      // max packs cumulables sur ce plan
  label: string;
  amount: number;        // prix en euros (pour affichage)
};

const PACK_CONFIG: Record<string, PackConfig> = {
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
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

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

  const plan = practitioner.plan as string;
  const pack = PACK_CONFIG[plan];

  if (!pack) {
    return NextResponse.json(
      { error: "Aucun pack disponible pour votre plan actuel." },
      { status: 400 }
    );
  }

  if (!pack.priceId) {
    return NextResponse.json(
      { error: `Variable d'environnement STRIPE_PRICE_PACK_${plan.toUpperCase()} manquante.` },
      { status: 500 }
    );
  }

  // Vérifier que le plafond de packs n'est pas atteint
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nutritwin.fr";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: practitioner.stripe_customer_id,
      line_items: [{ price: pack.priceId, quantity: 1 }],
      metadata: {
        type: "pack",
        packSize: String(pack.size),
        userId: user.id,
        plan,
      },
      success_url: `${appUrl}/dashboard?pack=success`,
      cancel_url: `${appUrl}/dashboard?pack=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── GET : retourne l'état du pack pour le dashboard ────────────────────────

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("plan, extra_patients")
    .eq("user_id", user.id)
    .single();

  const plan = practitioner?.plan as string | undefined;
  const extraPatients = practitioner?.extra_patients ?? 0;
  const pack = plan ? PACK_CONFIG[plan] : null;

  return NextResponse.json({
    plan,
    extraPatients,
    pack: pack
      ? {
          size: pack.size,
          amount: pack.amount,
          label: pack.label,
          maxPacks: pack.maxPacks,
          currentPacks: Math.floor(extraPatients / pack.size),
          canBuy: Math.floor(extraPatients / pack.size) < pack.maxPacks,
        }
      : null,
  });
}
