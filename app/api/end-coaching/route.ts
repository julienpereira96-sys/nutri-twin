import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { Redis } from "@upstash/redis";
import { buildEmailHtml, sendEmail } from "@/lib/email";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { password } = await request.json() as { password?: string };

  if (!password) {
    return NextResponse.json({ error: "Mot de passe requis." }, { status: 400 });
  }

  // Vérifier le mot de passe
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error: signInError } = await anonClient.auth.signInWithPassword({
    email: user.email!,
    password,
  });

  if (signInError) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const userId = user.id;

  // Récupérer le prénom et le praticien avant toute modification
  const [{ data: patientRow }, { data: relation }] = await Promise.all([
    adminClient.from("patients").select("first_name").eq("user_id", userId).single(),
    adminClient.from("patient_practitioner").select("practitioner_id").eq("patient_id", userId).single(),
  ]);

  const firstName = patientRow?.first_name as string | null | undefined;

  // Bannir le compte Auth — le patient ne peut plus se connecter
  // Les données sont conservées conformément aux obligations légales de rétention.
  const { error: banError } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: "876000h", // ~100 ans = banni indéfiniment
  });
  if (banError) {
    console.error("[NutriTwin] end-coaching — ban error:", banError.message);
    return NextResponse.json({ error: "Une erreur est survenue. Réessayez ou contactez le support." }, { status: 500 });
  }

  // Supprimer la relation praticien/patient → disparaît du dashboard
  if (relation?.practitioner_id) {
    await adminClient.from("patient_practitioner")
      .delete()
      .eq("patient_id", userId)
      .eq("practitioner_id", relation.practitioner_id);
  }

  // Invalider le cache Redis
  await redis.del(`patient_profile_v2:${userId}`).catch(() => {});

  // Email de confirmation — non bloquant
  if (user.email) {
    const closureDate = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
    const html = buildEmailHtml({
      preheader: "Votre accompagnement NutriTwin a été clôturé.",
      greeting,
      headline: "Clôture de votre accompagnement",
      body: `<p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.75;">
        Nous vous confirmons que votre accompagnement NutriTwin a été <strong style="color:#f8fafc;">clôturé le ${closureDate}</strong>. Votre compte est désactivé et votre praticien ne vous voit plus dans son tableau de bord.
      </p>
      <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.75;">
        Vos données sont conservées conformément à la loi. Pour toute question, contactez-nous à <a href="mailto:contact@nutritwin.fr" style="color:#10b981;text-decoration:none;">contact@nutritwin.fr</a>.
      </p>`,
      footerNote: "Conformément au Règlement Général sur la Protection des Données (RGPD, Art. 5.1.e).",
    });
    sendEmail({ to: user.email, subject: "Clôture de votre accompagnement NutriTwin", html }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
