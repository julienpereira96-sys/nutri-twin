import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

/**
 * GET /api/test-mode/session
 *
 * Retourne une session fraîche pour le patient test ACTIF du praticien.
 * "Actif" = test_patient_user_id sur la table practitioners, mis à jour par
 * PATCH /api/test-mode/active quand le praticien change de patient dans la sidebar.
 *
 * Stratégie : on reset le mot de passe du patient test à la volée (service_role),
 * puis on signe avec ce nouveau mot de passe. Permet de changer de patient test
 * sans stocker les credentials de chacun d'eux séparément.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Récupérer l'ID du patient test actif
  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("test_patient_user_id")
    .eq("user_id", user.id)
    .single();

  const testUserId = (practitioner as { test_patient_user_id?: string | null } | null)?.test_patient_user_id;

  if (!testUserId) {
    return NextResponse.json(
      { error: "Patient test non initialisé. Appelez d'abord /api/test-mode/setup." },
      { status: 404 }
    );
  }

  // Récupérer l'email du patient test depuis la table patients
  const { data: testPatient } = await supabase
    .from("patients")
    .select("email")
    .eq("user_id", testUserId)
    .single();

  if (!testPatient?.email) {
    return NextResponse.json(
      { error: "Patient test introuvable dans la table patients." },
      { status: 404 }
    );
  }

  // Reset du mot de passe à la volée — évite de stocker les credentials par patient.
  // Les comptes test (@nutri-twin.internal) sont des comptes internes sans valeur de sécurité.
  const newPassword = crypto.randomUUID();
  const { error: updateError } = await supabase.auth.admin.updateUserById(testUserId, {
    password: newPassword,
  });

  if (updateError) {
    console.error("[NutriTwin] test-mode/session updateUser error:", updateError.message);
    return NextResponse.json(
      { error: "Impossible de préparer la session patient test." },
      { status: 500 }
    );
  }

  // Connexion avec le mot de passe fraîchement généré
  const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: authData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
    email: testPatient.email,
    password: newPassword,
  });

  if (signInError || !authData.session) {
    console.error("[NutriTwin] test-mode/session signIn error:", signInError?.message);
    return NextResponse.json(
      { error: "Impossible de créer la session patient test." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
    patient_user_id: testUserId,
  });
}
