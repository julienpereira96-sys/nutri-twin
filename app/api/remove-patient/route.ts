import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId, practitionerId } = await request.json() as {
    patientId: string;
    practitionerId: string;
  };

  if (!patientId || !practitionerId) {
    return Response.json({ error: "patientId et practitionerId requis." }, { status: 400 });
  }

  if (user.id !== practitionerId) return forbidden();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Vérifier que la relation praticien/patient existe (IDOR guard)
  const { data: relation } = await supabase
    .from("patient_practitioner")
    .select("patient_id")
    .eq("patient_id", patientId)
    .eq("practitioner_id", practitionerId)
    .single();

  if (!relation) return forbidden();

  // RGPD — droit à l'oubli : supprimer toutes les données liées en parallèle
  await Promise.all([
    supabase.from("conversations").delete().eq("patient_id", patientId).eq("practitioner_id", practitionerId),
    supabase.from("conversations_sessions").delete().eq("patient_id", patientId).eq("practitioner_id", practitionerId),
    supabase.from("sos_events").delete().eq("patient_id", patientId).eq("practitioner_id", practitionerId),
    supabase.from("sos_closures").delete().eq("patient_id", patientId),
    supabase.from("exercise_logs").delete().eq("patient_id", patientId),
    supabase.from("crisis_events").delete().eq("patient_id", patientId),
    supabase.from("documents").delete().eq("patient_id", patientId),
    supabase.from("journal_entries").delete().eq("patient_id", patientId),
  ]);

  // Supprimer la relation praticien/patient
  await supabase.from("patient_practitioner").delete()
    .eq("patient_id", patientId)
    .eq("practitioner_id", practitionerId);

  // Supprimer le profil patient
  await supabase.from("patients").delete().eq("user_id", patientId);

  // Supprimer le compte Auth → révoque définitivement l'accès au chat
  const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(patientId);
  if (deleteAuthError) {
    console.error("Erreur suppression Auth user:", deleteAuthError.message);
    // Non bloquant : les données sont supprimées, l'accès est de facto coupé
  }

  return Response.json({ success: true });
}
