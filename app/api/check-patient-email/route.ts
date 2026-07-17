import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

export async function POST(request: Request) {
  // M3 — Exiger une session praticien pour éviter l'énumération d'emails patients
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { email, practitionerId } = await request.json() as { email: string; practitionerId: string };

  // Le praticien authentifié ne peut interroger que sa propre liste
  if (user.id !== practitionerId) return forbidden();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Chercher directement dans la table patients par email - 1 requête ciblée
  const { data: patient } = await supabase
    .from("patients")
    .select("user_id, onboarding_completed, onboarding_status")
    .ilike("email", email.trim())
    .single();

  if (!patient) {
    return Response.json({ exists: false });
  }

  // Vérifier la relation avec ce praticien
  const { data: existingRelation } = await supabase
    .from("patient_practitioner")
    .select("patient_id")
    .eq("patient_id", patient.user_id)
    .eq("practitioner_id", practitionerId)
    .single();

  if (existingRelation) {
    if (patient.onboarding_completed) {
      // Onboarding terminé - bloqué
      return Response.json({ exists: true, canResend: false });
    }
    if (patient.onboarding_status) {
      // Mot de passe déjà créé (onboarding_status = "password_set") - pas de lien à renvoyer
      return Response.json({ exists: true, canResend: false });
    }
    // Lien jamais cliqué - on peut renvoyer
    return Response.json({ exists: true, canResend: true });
  }

  return Response.json({ exists: false });
}
