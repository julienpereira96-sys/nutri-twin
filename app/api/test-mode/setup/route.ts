import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

/**
 * POST /api/test-mode/setup
 *
 * Crée silencieusement un patient test lié au praticien.
 * Idempotent : si le patient test existe déjà, retourne ses infos sans rien créer.
 * Appelé une fois au chargement du dashboard.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Vérifier si le patient test existe déjà
  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("test_patient_user_id, test_patient_email, test_patient_password")
    .eq("user_id", user.id)
    .single();

  if (practitioner?.test_patient_user_id) {
    return NextResponse.json({
      testPatientUserId: practitioner.test_patient_user_id,
      created: false,
    });
  }

  // Générer des credentials uniques
  const password = crypto.randomUUID();
  const email = `test-${user.id}@nutri-twin.internal`;

  // Créer le compte Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Impossible de créer le compte patient test." },
      { status: 500 }
    );
  }

  const testUserId = authData.user.id;

  // Récupérer l'ID du praticien dans la table practitioners
  const { data: practData } = await supabase
    .from("practitioners")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const practitionerId = (practData as { id: string } | null)?.id;

  // Créer le patient test dans la table patients
  await supabase.from("patients").insert({
    user_id: testUserId,
    practitioner_id: practitionerId,
    first_name: "Patient",
    last_name: "Test",
    email,
    onboarding_completed: true,
    onboarding_status: "completed",
    onboarding_done: true,
    is_test: true,
  });

  // Sauvegarder les credentials sur le praticien
  await supabase
    .from("practitioners")
    .update({
      test_patient_user_id: testUserId,
      test_patient_email: email,
      test_patient_password: password,
    })
    .eq("user_id", user.id);

  return NextResponse.json({ testPatientUserId: testUserId, created: true });
}

/**
 * PATCH /api/test-mode/setup
 *
 * Met à jour le profil du patient test existant.
 * Accepte : firstName, age, sexe, objective, pathologies
 */
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json() as {
    firstName?: string;
    age?: number | null;
    sexe?: string | null;
    objective?: string | null;
    pathologies?: string | null;
  };

  // Récupérer l'id du patient test
  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("test_patient_user_id")
    .eq("user_id", user.id)
    .single();

  const testUserId = (practitioner as { test_patient_user_id?: string | null } | null)?.test_patient_user_id;
  if (!testUserId) {
    return NextResponse.json({ error: "Patient test introuvable." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body.firstName !== undefined) updates.first_name = body.firstName;
  if (body.age !== undefined) updates.age = body.age;
  if (body.sexe !== undefined) updates.sexe = body.sexe;
  if (body.objective !== undefined) updates.objective = body.objective;
  if (body.pathologies !== undefined) updates.pathologies = body.pathologies;

  await supabase.from("patients").update(updates).eq("user_id", testUserId);

  return NextResponse.json({ ok: true });
}
