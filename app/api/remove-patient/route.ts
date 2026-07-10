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

  // Fin de suivi — archivage : on conserve toutes les données (obligation RGPD)
  // mais on coupe l'accès et on retire le patient du dashboard.

  // 1. Bannir le compte Auth → le patient ne peut plus se connecter
  const { error: banError } = await supabase.auth.admin.updateUserById(patientId, {
    ban_duration: "876000h", // ~100 ans = banni indéfiniment
  });
  if (banError) {
    console.error("Erreur ban Auth user:", banError.message);
    // Non bloquant
  }

  // 2. Supprimer uniquement la relation praticien/patient → disparaît du dashboard
  await supabase.from("patient_practitioner").delete()
    .eq("patient_id", patientId)
    .eq("practitioner_id", practitionerId);

  // Les données (conversations, SOS, documents, profil…) sont conservées.
  // Pour un droit à l'oubli explicite du patient, utiliser le script SQL dédié.

  return Response.json({ success: true });
}
