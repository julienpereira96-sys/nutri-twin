import Stripe from "stripe";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { buildEmailHtml, sendEmail } from "@/lib/email";

// ─── Helper ───────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPractitionerInfo(
  supabase: SupabaseClient<any, any, any>,
  customerId: string
): Promise<{ email: string; firstName: string | null } | null> {
  const { data } = await supabase
    .from("practitioners")
    .select("user_id, first_name")
    .eq("stripe_customer_id", customerId)
    .single();
  const row = data as { user_id: string; first_name: string | null } | null;
  if (!row?.user_id) return null;
  const { data: authData } = await supabase.auth.admin.getUserById(row.user_id);
  const email = authData?.user?.email;
  if (!email) return null;
  return { email, firstName: row.first_name ?? null };
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function POST(request: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return new Response("Webhook signature invalide", { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Ancien flow - Checkout Sessions
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = session.customer as string;
    const userId = session.metadata?.userId;

    // ─── Pack upsell ─────────────────────────────────────────────────────────
    if (session.metadata?.type === "pack") {
      const packSize = parseInt(session.metadata?.packSize ?? "0", 10);
      const packSubscriptionId = session.subscription as string | null;

      if (userId && packSize > 0) {
        // Récupère la valeur actuelle pour incrémenter
        const { data: current } = await supabase
          .from("practitioners")
          .select("extra_patients")
          .eq("user_id", userId)
          .single();

        const newTotal = (current?.extra_patients ?? 0) + packSize;

        await supabase
          .from("practitioners")
          .update({
            extra_patients: newTotal,
            ...(packSubscriptionId ? { pack_subscription_id: packSubscriptionId } : {}),
          })
          .eq("user_id", userId);
      }
      return new Response("OK", { status: 200 });
    }

    // ─── Flow abonnement principal ────────────────────────────────────────────
    const plan = session.metadata?.plan ?? "pro";

    if (userId) {
      await supabase
        .from("practitioners")
        .update({
          stripe_customer_id: customerId,
          plan,
          subscription_status: "active",
        })
        .eq("user_id", userId);
    }

  }

  // Nouveau flow - SetupIntent + Subscription
  if (event.type === "customer.subscription.created") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    const plan = subscription.metadata?.plan ?? "pro";
    const status = subscription.status;

    await supabase
      .from("practitioners")
      .update({
        plan,
        subscription_status: status,
      })
      .eq("stripe_customer_id", customerId);
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    const status = subscription.status;

    // Inversion du mapping price_id → plan
    // Les env vars peuvent être undefined si la variable n'est pas définie — on filtre.
    const priceToplan: Record<string, string> = Object.fromEntries(
      (
        [
          [process.env.STRIPE_PRICE_ESSENTIEL, "essentiel"],
          [process.env.STRIPE_PRICE_PRO,       "pro"],
          [process.env.STRIPE_PRICE_CABINET,   "cabinet"],
        ] as [string | undefined, string][]
      ).filter((entry): entry is [string, string] => Boolean(entry[0]))
    );

    const priceId = subscription.items.data[0]?.price.id;
    const resolvedPlan = priceId ? priceToplan[priceId] : undefined;

    const updatePayload: Record<string, string> = { subscription_status: status };

    if (resolvedPlan) {
      updatePayload.plan = resolvedPlan;
    }

    await supabase
      .from("practitioners")
      .update(updatePayload)
      .eq("stripe_customer_id", customerId);
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    // Si c'est un abonnement pack (pack_subscription_id correspond), retirer les slots
    const { data: practitioner } = await supabase
      .from("practitioners")
      .select("plan, extra_patients, pack_subscription_id")
      .eq("stripe_customer_id", customerId)
      .single();

    if (practitioner?.pack_subscription_id === subscription.id) {
      // Identifier la taille du pack annulé selon le plan
      const packSizes: Record<string, number> = { essentiel: 5, pro: 10 };
      const packSize = packSizes[practitioner.plan ?? ""] ?? 0;
      const newTotal = Math.max(0, (practitioner.extra_patients ?? 0) - packSize);

      await supabase
        .from("practitioners")
        .update({ extra_patients: newTotal, pack_subscription_id: null })
        .eq("stripe_customer_id", customerId);
    } else {
      // Annulation de l'abonnement principal
      await supabase
        .from("practitioners")
        .update({ subscription_status: "cancelled", plan: null })
        .eq("stripe_customer_id", customerId);

      const info = await getPractitionerInfo(supabase, customerId);
      if (info) {
        await sendEmail({
          to: info.email,
          subject: "Votre abonnement NutriTwin a été résilié",
          html: buildEmailHtml({
            preheader: "Votre abonnement NutriTwin est maintenant résilié.",
            greeting: `Bonjour ${info.firstName ?? ""},`,
            headline: "Abonnement résilié",
            body: `<p style="margin:0 0 16px;font-size:15px;color:#cbd5e1;line-height:1.75;">
              Votre abonnement NutriTwin a bien été résilié. Votre accès est maintenant terminé.
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#cbd5e1;line-height:1.75;">
              Si cette résiliation est une erreur ou si vous souhaitez réactiver votre compte, contactez-nous à <a href="mailto:contact@nutritwin.fr" style="color:#10b981;text-decoration:none;">contact@nutritwin.fr</a>.
            </p>
            <p style="margin:0;font-size:15px;color:#cbd5e1;line-height:1.75;">
              Merci de nous avoir fait confiance pour accompagner vos patients.
            </p>`,
            footerNote: `Vous recevez cet email suite à la résiliation de votre abonnement NutriTwin.`,
          }),
        });
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = invoice.customer as string;

    await supabase
      .from("practitioners")
      .update({ subscription_status: "past_due" })
      .eq("stripe_customer_id", customerId);

    const info = await getPractitionerInfo(supabase, customerId);
    if (info) {
      const amount = invoice.amount_due
        ? `${(invoice.amount_due / 100).toFixed(2)} €`
        : null;
      await sendEmail({
        to: info.email,
        subject: "Problème de paiement sur votre abonnement NutriTwin",
        html: buildEmailHtml({
          preheader: "Un problème est survenu lors du prélèvement de votre abonnement.",
          greeting: `Bonjour ${info.firstName ?? ""},`,
          headline: "Échec du paiement",
          body: `<p style="margin:0 0 16px;font-size:15px;color:#cbd5e1;line-height:1.75;">
            Nous n'avons pas pu débiter votre moyen de paiement${amount ? ` pour un montant de <strong style="color:#f8fafc;">${amount}</strong>` : ""}.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#cbd5e1;line-height:1.75;">
            Votre accès à NutriTwin reste actif pour l'instant. Pour éviter toute interruption, mettez à jour votre carte directement depuis votre espace praticien.
          </p>
          <table cellpadding="0" cellspacing="0" border="0" role="presentation">
            <tr>
              <td style="border-radius:10px;background:linear-gradient(135deg,#f59e0b,#d97706);">
                <a href="https://nutritwin.fr/dashboard?settings=abonnement" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                  Mettre à jour ma carte →
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.75;">
            Un problème ? Contactez-nous à <a href="mailto:contact@nutritwin.fr" style="color:#10b981;text-decoration:none;">contact@nutritwin.fr</a>.
          </p>`,
          accentColor: "#f59e0b",
          accentColorDark: "#d97706",
          footerNote: `Vous recevez cet email suite à un problème de prélèvement sur votre abonnement NutriTwin.`,
        }),
      });
    }
  }

  // ─── Fin de période d'essai imminente ────────────────────────────────────────
  if (event.type === "customer.subscription.trial_will_end") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;
    const trialEndDate = subscription.trial_end ? formatDate(subscription.trial_end) : null;

    const info = await getPractitionerInfo(supabase, customerId);
    if (info && trialEndDate) {
      await sendEmail({
        to: info.email,
        subject: "Votre période d'essai NutriTwin se termine bientôt",
        html: buildEmailHtml({
          preheader: `Votre essai gratuit se termine le ${trialEndDate}. Continuez sans interruption.`,
          greeting: `Bonjour ${info.firstName ?? ""},`,
          headline: "Votre période d'essai touche à sa fin",
          body: `<p style="margin:0 0 16px;font-size:15px;color:#cbd5e1;line-height:1.75;">
            Votre accès gratuit à NutriTwin expire le <strong style="color:#f8fafc;">${trialEndDate}</strong>.
          </p>
          <p style="margin:0;font-size:15px;color:#cbd5e1;line-height:1.75;">
            Pour continuer à accompagner vos patients sans interruption, votre abonnement sera activé automatiquement après la date d'expiration de votre essai. Vous avez la possibilité de résilier ce dernier à tout moment directement sur votre dashboard ou en nous contactant par mail à <a href="mailto:contact@nutritwin.fr" style="color:#10b981;text-decoration:none;">contact@nutritwin.fr</a>.
          </p>`,
          infoBox: `<strong style="color:#f8fafc;">Fin d'essai :</strong> ${trialEndDate}<br/>Votre abonnement sera activé automatiquement à cette date.`,
          footerNote: `Vous recevez cet email car vous avez souscrit à un essai gratuit NutriTwin.`,
        }),
      });
    }
  }

  // ─── Activation de l'abonnement (après essai ou premier paiement) ─────────
  // "subscription_cycle" = renouvellement mensuel → pas d'email
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;
    const billingReason = invoice.billing_reason;

    // amount_paid === 0 = démarrage d'essai gratuit → pas d'email (trial_will_end s'en charge)
    if ((billingReason === "subscription_create" || billingReason === "subscription_update") && invoice.amount_paid > 0) {
      const customerId = invoice.customer as string;
      const info = await getPractitionerInfo(supabase, customerId);
      if (info) {
        const amount = invoice.amount_paid
          ? `${(invoice.amount_paid / 100).toFixed(2)} €`
          : null;
        await sendEmail({
          to: info.email,
          subject: "Votre abonnement NutriTwin est activé",
          html: buildEmailHtml({
            preheader: "Votre abonnement est actif. Bienvenue dans NutriTwin.",
            greeting: `Bonjour ${info.firstName ?? ""},`,
            headline: "Abonnement activé",
            body: `<p style="margin:0 0 16px;font-size:15px;color:#cbd5e1;line-height:1.75;">
              Votre abonnement NutriTwin est désormais actif.
            </p>
            <p style="margin:0;font-size:15px;color:#cbd5e1;line-height:1.75;">
              Profitez pleinement de toutes les fonctionnalités de NutriTwin pour accompagner au mieux vos patients. Pour toute question, notre équipe est disponible à <a href="mailto:contact@nutritwin.fr" style="color:#10b981;text-decoration:none;">contact@nutritwin.fr</a>.
            </p>
            <p style="margin:0;font-size:15px;color:#cbd5e1;line-height:1.75;">
              Merci pour votre confiance.
            </p>`,
            footerNote: `Vous recevez cet email suite à l'activation de votre abonnement NutriTwin.`,
          }),
        });
      }
    }
  }

  return new Response("OK", { status: 200 });
}