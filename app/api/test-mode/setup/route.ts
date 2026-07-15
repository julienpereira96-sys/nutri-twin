import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

/**
 * POST /api/test-mode/setup
 *
 * Crée un nouveau patient test lié au praticien avec un profil complet.
 * Non idempotent — crée toujours un nouveau patient.
 * Appelé explicitement depuis la modale "Ajouter un patient test".
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Accepter le profil complet depuis le body (tous les champs optionnels)
  const body = await request.json().catch(() => ({})) as {
    firstName?: string;
    lastName?: string;
    age?: number | null;
    taille?: number | null;
    poids?: number | null;
    sexe?: string | null;
    pathologies?: string | null;
    allergies?: string | null;
    traitements?: string | null;
    objectifClinique?: string | null;
    activite?: string | null;
    regime?: string | null;
    // Champs profil patient (étape 3 — fidélité du jumeau)
    sommeil?: string | null;
    humeur?: string | null;
    defiPrincipal?: string | null;
    digestif?: string | null;
    alimentsDetestes?: string | null;
  };

  // Générer un email unique pour ce compte interne (pas de mot de passe stocké —
  // /api/test-mode/session fait un reset à la volée à chaque ouverture de session)
  const uniqueId = crypto.randomUUID();
  const tempPassword = crypto.randomUUID();
  const email = `test-${uniqueId}@nutri-twin.internal`;

  // Créer le compte Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: "Impossible de créer le compte patient test." },
      { status: 500 }
    );
  }

  const testUserId = authData.user.id;

  // Construire la colonne notes à partir des inconforts digestifs et du sommeil
  const notesParts: string[] = [];
  if (body.digestif) notesParts.push(`Digestif: ${body.digestif}`);
  if (body.sommeil) notesParts.push(`Sommeil: ${body.sommeil}`);
  const notesStr = notesParts.length > 0 ? notesParts.join("; ") : null;

  // Créer le patient test dans la table patients avec le profil complet
  // Note : la relation praticien↔patient passe par patient_practitioner, pas par une
  // colonne practitioner_id sur la table patients.
  await supabase.from("patients").insert({
    user_id: testUserId,
    first_name: body.firstName || "Patient",
    last_name: body.lastName || "Test",
    email,
    age: body.age ?? null,
    taille: body.taille ?? null,
    poids: body.poids ?? null,
    sexe: body.sexe ?? null,
    pathologies: body.pathologies ?? null,
    allergies: body.allergies ?? null,
    traitements: body.traitements ?? null,
    objectif_clinique: body.objectifClinique ?? null,
    niveau_activite: body.activite ?? null,
    regime_specifique: body.regime ?? null,
    // Profil patient (étape 3) — mêmes colonnes que patient-onboarding/page.tsx
    motivation: body.humeur ?? null,
    defi: body.defiPrincipal ?? null,
    aliments_detestes: body.alimentsDetestes ?? null,
    notes: notesStr,
    onboarding_completed: true,
    onboarding_status: "completed",
    onboarding_done: true,
    is_test: true,
  });

  // Lier le patient test au praticien via patient_practitioner
  // (practitioner_id = auth user_id, cohérent avec invite-patient/route.ts)
  await supabase.from("patient_practitioner").insert({
    patient_id: testUserId,
    practitioner_id: user.id,
  });

  // Mettre à jour le patient test actif sur le praticien
  // Note : on ne stocke ni email ni mot de passe — session/route.ts génère
  // un nouveau mot de passe à la volée à chaque ouverture de session.
  await supabase
    .from("practitioners")
    .update({ test_patient_user_id: testUserId })
    .eq("user_id", user.id);

  return NextResponse.json({ testPatientUserId: testUserId, created: true });
}
