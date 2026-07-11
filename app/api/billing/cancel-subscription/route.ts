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
    .select("stripe_customer_id, first_name, last_name, email")
    .eq("user_id", user.id)
    .single();

  if (!practitioner?.stripe_customer_id) {
    return Response.json({ error: "Aucun abonnement actif." }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const customerId = practitioner.stripe_customer_id;

  const [activeSubs, trialSubs] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
    stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 }),
  ]);
  const subscription = activeSubs.data[0] ?? trialSubs.data[0] ?? null;

  if (!subscription) {
    return Response.json({ error: "Aucun abonnement actif trouvé." }, { status: 404 });
  }

  // Programmer l'annulation en fin de période (pas d'interruption immédiate)
  const updated = await stripe.subscriptions.update(subscription.id, {
    cancel_at_period_end: true,
  });

  const periodEndTs = updated.items.data[0]?.current_period_end ?? updated.cancel_at ?? Math.floor(Date.now() / 1000);
  const endDate = new Date(periodEndTs * 1000);
  const endDateStr = endDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  // Email de confirmation au praticien
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && practitioner.email) {
    const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#f1f5f9;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="margin-bottom:32px;">
      <span style="font-size:20px;font-weight:800;color:#f1f5f9;">Nutri<span style="color:#10b981;">Twin</span></span>
    </div>
    <div style="background:#111111;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f1f5f9;">Résiliation confirmée</p>
      <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
        Bonjour ${practitioner.first_name ?? ""},<br><br>
        Votre demande de résiliation a bien été prise en compte. Votre accès à NutriTwin reste actif jusqu'au <strong style="color:#f1f5f9;">${endDateStr}</strong>, date à laquelle votre abonnement prendra fin.
      </p>
      <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.15);border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
          Vous avez changé d'avis ? Vous pouvez annuler votre résiliation à tout moment avant le <strong style="color:#f1f5f9;">${endDateStr}</strong> depuis <strong style="color:#f1f5f9;">Paramètres → Abonnement</strong>.
        </p>
      </div>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
        Vos données patients restent conservées conformément à nos obligations RGPD. Si vous souhaitez les supprimer, contactez-nous à <a href="mailto:contact@nutritwin.fr" style="color:#10b981;">contact@nutritwin.fr</a>.
      </p>
    </div>
    <p style="margin:0;font-size:11px;color:#374151;text-align:center;">NutriTwin · Cet email vous a été envoyé suite à votre demande de résiliation</p>
  </div>
</body>
</html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "NutriTwin <contact@nutritwin.fr>",
        to: practitioner.email,
        subject: "Résiliation confirmée — accès actif jusqu'au " + endDateStr,
        html: emailHtml,
      }),
    });
  }

  return Response.json({
    success: true,
    cancel_at_period_end: true,
    current_period_end: updated.items.data[0]?.current_period_end ?? null,
  });
}
