import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

/**
 * PATCH /api/test-mode/active
 *
 * Change le patient test actif (test_patient_user_id sur la table practitioners).
 * Appelé quand le praticien clique sur un patient test dans la sidebar.
 */
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await request.json() as { testPatientUserId?: string };
  const { testPatientUserId } = body;

  if (!testPatientUserId) {
    return NextResponse.json({ error: "testPatientUserId requis." }, { status: 400 });
  }

  // Récupérer l'ID DB du praticien
  const { data: practData } = await supabase
    .from("practitioners")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const practDbId = (practData as { id: string } | null)?.id;
  if (!practDbId) {
    return NextResponse.json({ error: "Praticien introuvable." }, { status: 404 });
  }

  // Vérifier que ce patient test appartient bien à ce praticien
  const { data: patient } = await supabase
    .from("patients")
    .select("user_id, is_test")
    .eq("user_id", testPatientUserId)
    .eq("practitioner_id", practDbId)
    .single();

  if (!patient) {
    return NextResponse.json({ error: "Patient test introuvable." }, { status: 404 });
  }

  // Mettre à jour le patient test actif
  await supabase
    .from("practitioners")
    .update({ test_patient_user_id: testPatientUserId })
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
