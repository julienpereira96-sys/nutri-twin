import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { Redis } from "@upstash/redis";

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

  const partialError = "La suppression a partiellement échoué. Réessayez ou contactez le support.";

  // 1. Supprimer toutes les données enfant — on collecte les erreurs plutôt que
  //    de les ignorer (L4 : éviter un état incohérent silencieux).
  const childResults = await Promise.all([
    adminClient.from("conversations").delete().eq("patient_id", userId),
    adminClient.from("conversations_sessions").delete().eq("patient_id", userId),
    adminClient.from("sos_events").delete().eq("patient_id", userId),
    adminClient.from("sos_closures").delete().eq("patient_id", userId),
    adminClient.from("exercise_logs").delete().eq("patient_id", userId),
    adminClient.from("crisis_events").delete().eq("patient_id", userId),
    adminClient.from("documents").delete().eq("patient_id", userId),
    adminClient.from("journal_entries").delete().eq("patient_id", userId),
    adminClient.from("patient_practitioner").delete().eq("patient_id", userId),
  ]);
  // Une table absente de ce schéma (feature non déployée sur cet environnement) ne
  // doit pas bloquer la suppression : on ignore les erreurs "relation introuvable"
  // et on n'abort que sur une vraie erreur (permission, contrainte…).
  const MISSING_TABLE_CODES = ["42P01", "PGRST205", "PGRST202"];
  const childErrors = childResults.filter((r) => r.error && !MISSING_TABLE_CODES.includes(r.error.code ?? ""));
  if (childErrors.length > 0) {
    console.error("[NutriTwin] delete-account — erreurs suppression enfant:", childErrors.map((r) => r.error?.message));
    // On n'efface PAS le compte Auth : mieux vaut un compte encore vivant qu'un
    // compte supprimé laissant des données médicales orphelines. L'user peut réessayer.
    return NextResponse.json({ error: partialError }, { status: 500 });
  }

  // 2. Supprimer le patient
  const { error: patientDelError } = await adminClient.from("patients").delete().eq("user_id", userId);
  if (patientDelError) {
    console.error("[NutriTwin] delete-account — suppression patients:", patientDelError.message);
    return NextResponse.json({ error: partialError }, { status: 500 });
  }

  // 3. Invalider le cache Redis
  await redis.del(`patient_profile_v2:${userId}`).catch(() => {});

  // 4. Supprimer le compte Auth en dernier — une fois toutes les données parties
  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    console.error("[NutriTwin] delete-account — deleteUser error:", deleteAuthError.message);
    return NextResponse.json({ error: "Données supprimées mais le compte n'a pas pu être clôturé. Contactez le support." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
