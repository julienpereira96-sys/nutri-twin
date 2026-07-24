import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { purgePatientData } from "@/lib/purgePatientData";
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

  // Vérifier le mot de passe via signInWithPassword (email de la session, pas du body)
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

  // L4 — cette route est le self-delete PATIENT. Si l'appelant est un praticien,
  // refuser : sinon on supprimerait son compte Auth en laissant la ligne
  // practitioners + l'abonnement Stripe orphelins (facturation continue).
  // Les praticiens passent par billing/delete-account-request.
  const { data: practitionerRow } = await adminClient
    .from("practitioners")
    .select("user_id")
    .eq("user_id", userId)
    .single();
  if (practitionerRow) {
    return NextResponse.json(
      { error: "Cette action concerne les comptes patients. Pour un compte praticien, contactez le support." },
      { status: 403 }
    );
  }

  // Récupérer le prénom avant la purge (la ligne patients sera supprimée)
  const { data: patientRow } = await adminClient
    .from("patients")
    .select("first_name")
    .eq("user_id", userId)
    .single();
  const firstName = patientRow?.first_name as string | null | undefined;

  // RGPD-4 — purge via le helper canonique (tables enfant + profil + avatar Storage),
  // source de vérité unique alignée avec droit-a-loubli.sql.
  const purge = await purgePatientData(adminClient, userId);
  if (!purge.ok) {
    console.error("[NutriTwin] delete-account — purge partielle:", purge.errors);
    // On n'efface PAS le compte Auth : mieux vaut un compte vivant que des données
    // médicales orphelines. L'utilisateur peut réessayer.
    return NextResponse.json({ error: "La suppression a partiellement échoué. Réessayez ou contactez le support." }, { status: 500 });
  }

  // Invalider le cache Redis
  await redis.del(`patient_profile_v2:${userId}`).catch(() => {});

  // Supprimer le compte Auth en dernier — une fois toutes les données parties
  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    console.error("[NutriTwin] delete-account — deleteUser error:", deleteAuthError.message);
    return NextResponse.json({ error: "Données supprimées mais le compte n'a pas pu être clôturé. Contactez le support." }, { status: 500 });
  }

  // Email de confirmation RGPD — non bloquant (échec silencieux)
  if (user.email) {
    const deletionDate = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
    const html = buildEmailHtml({
      preheader: "Vos données NutriTwin ont bien été supprimées.",
      greeting,
      headline: "Suppression de votre compte",
      body: `<p style="margin:0 0 16px;font-size:15px;color:#94a3b8;line-height:1.75;">
        Nous vous confirmons que votre compte NutriTwin ainsi que l'ensemble de vos données personnelles ont été <strong style="color:#f8fafc;">définitivement supprimés</strong> le ${deletionDate}, conformément à votre demande.
      </p>
      <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.75;">
        Aucune donnée vous concernant n'est conservée sur nos serveurs. Si vous avez des questions, contactez-nous à <a href="mailto:contact@nutritwin.fr" style="color:#10b981;text-decoration:none;">contact@nutritwin.fr</a>.
      </p>`,
      footerNote: "Conformément au Règlement Général sur la Protection des Données (RGPD, Art. 17).",
    });
    sendEmail({ to: user.email, subject: "Confirmation de suppression de votre compte NutriTwin", html }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
