import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * DELETE /api/test-mode/delete
 *
 * Supprime définitivement un patient test : supprime le compte Auth, la relation
 * praticien/patient, l'entrée dans patients, et remet test_patient_user_id à null
 * si c'était le patient actif.
 *
 * Contrairement à /api/remove-patient (qui bannit sans supprimer pour les obligations
 * RGPD), les comptes test sont des comptes internes @nutri-twin.internal sans valeur
 * de rétention — on les supprime vraiment.
 */
export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { testPatientUserId } = await request.json() as { testPatientUserId?: string };

  if (!testPatientUserId) {
    return NextResponse.json({ error: "testPatientUserId requis." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Vérifier que ce patient appartient bien à ce praticien
  const { data: relation } = await supabase
    .from("patient_practitioner")
    .select("patient_id")
    .eq("patient_id", testPatientUserId)
    .eq("practitioner_id", user.id)
    .single();

  if (!relation) return forbidden();

  // Vérifier que c'est bien un patient test (garde de sécurité)
  const { data: patient } = await supabase
    .from("patients")
    .select("is_test")
    .eq("user_id", testPatientUserId)
    .single();

  if (!(patient as { is_test?: boolean } | null)?.is_test) {
    return NextResponse.json(
      { error: "Ce patient n'est pas un patient test." },
      { status: 403 }
    );
  }

  // 1. Supprimer toutes les données enfant du patient test (même logique que /api/delete-account)
  await Promise.all([
    supabase.from("conversations").delete().eq("patient_id", testPatientUserId),
    supabase.from("conversations_sessions").delete().eq("patient_id", testPatientUserId),
    supabase.from("sos_events").delete().eq("patient_id", testPatientUserId),
    supabase.from("exercise_logs").delete().eq("patient_id", testPatientUserId),
    supabase.from("crisis_events").delete().eq("patient_id", testPatientUserId),
    supabase.from("documents").delete().eq("patient_id", testPatientUserId),
    supabase.from("journal_entries").delete().eq("patient_id", testPatientUserId),
    supabase.from("patient_practitioner").delete().eq("patient_id", testPatientUserId).eq("practitioner_id", user.id),
  ]);

  // 2. Supprimer le patient (toutes ses données — pas de valeur clinique pour un profil test)
  await supabase.from("patients").delete().eq("user_id", testPatientUserId);

  // 3. Si c'était le patient test actif, remettre test_patient_user_id à null
  await supabase
    .from("practitioners")
    .update({ test_patient_user_id: null })
    .eq("user_id", user.id)
    .eq("test_patient_user_id", testPatientUserId);

  // 4. Invalider le cache profil IA
  await redis.del(`patient_profile_v2:${testPatientUserId}`).catch(() => {});

  // 5. Supprimer le compte Auth en dernier (après avoir retiré toutes les FK qui le référencent)
  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(testPatientUserId);
  if (deleteAuthError) {
    console.error("[NutriTwin] test-mode/delete — deleteUser error:", deleteAuthError.message);
    // Non bloquant : les données sont déjà supprimées, le compte auth orphelin sera nettoyé manuellement si besoin
  }

  return NextResponse.json({ ok: true });
}
