import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { email, practitionerId } = await request.json() as { email: string; practitionerId: string };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Chercher directement dans la table patients par email — 1 requête ciblée
  const { data: patient } = await supabase
    .from("patients")
    .select("user_id, onboarding_completed")
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
      // Compte actif — vraiment bloqué
      return Response.json({ exists: true, canResend: false });
    } else {
      // Pas encore activé — on peut renvoyer
      return Response.json({ exists: true, canResend: true });
    }
  }

  return Response.json({ exists: false });
}
