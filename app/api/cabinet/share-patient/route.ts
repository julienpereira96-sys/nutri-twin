import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

// ── POST /api/cabinet/share-patient ───────────────────────────────────
// Rend un dossier patient visible en lecture par tous les praticiens du
// même cabinet. Le patient reste assigné à son praticien d'origine.
//
// Body : { patientId: string, practitionerId: string }
// Règles :
//  - L'appelant doit être le praticien assignataire du patient.
//  - Le praticien doit appartenir à un cabinet.
// ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId, practitionerId } = await request.json() as {
    patientId: string;
    practitionerId: string;
  };

  if (!patientId || !practitionerId) {
    return NextResponse.json({ error: "patientId et practitionerId requis." }, { status: 400 });
  }

  if (user.id !== practitionerId) return forbidden();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── 1. Guard IDOR — vérifier que le praticien est bien l'assignataire ──
  const { data: relation } = await supabase
    .from("patient_practitioner")
    .select("patient_id")
    .eq("patient_id", patientId)
    .eq("practitioner_id", practitionerId)
    .single();

  if (!relation) return forbidden();

  // ── 2. Vérifier que le praticien appartient à un cabinet ──────────────
  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("cabinet_id")
    .eq("user_id", practitionerId)
    .single();

  const cabinetId = (practitioner as { cabinet_id?: string | null } | null)?.cabinet_id;
  if (!cabinetId) {
    return NextResponse.json(
      { error: "Vous ne faites pas partie d'un cabinet. Contactez le support pour activer cette fonctionnalité." },
      { status: 403 }
    );
  }

  // ── 3. Passer le statut à 'shared' et rattacher le cabinet_id ─────────
  const { error } = await supabase
    .from("patients")
    .update({ sharing_status: "shared", cabinet_id: cabinetId })
    .eq("user_id", patientId);

  if (error) {
    console.error("share-patient error:", error.message);
    return NextResponse.json({ error: "Erreur lors du partage du dossier." }, { status: 500 });
  }

  // ── 4. Log audit trail ────────────────────────────────────────────────
  await supabase.from("cabinet_transfers").insert({
    patient_id:           patientId,
    from_practitioner_id: practitionerId,
    to_practitioner_id:   practitionerId, // reste assigné au même praticien
    cabinet_id:           cabinetId,
    action:               "share",
  });

  return NextResponse.json({ success: true });
}
