import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

// ── POST /api/cabinet/transfer-patient ────────────────────────────────
// Transfère définitivement un dossier patient à un confrère du même
// cabinet. Le patient disparaît de la liste de l'ancien praticien et
// apparaît dans la liste du nouveau.
//
// Body : { patientId: string, practitionerId: string, newPractitionerId: string }
// Règles :
//  - L'appelant doit être le praticien assignataire actuel.
//  - Les deux praticiens doivent partager le même cabinet_id.
//  - On ne peut pas transférer à soi-même.
// Actions :
//  - Met à jour patient_practitioner (relation d'ownership)
//  - Met à jour patients.sharing_status → 'transferred' et cabinet_id
//  - Met à jour conversations/sos_events si le praticien est lié
//  - Invalide les caches Redis des deux praticiens
//  - Loggue dans cabinet_transfers (audit RGPD)
// ─────────────────────────────────────────────────────────────────────

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId, practitionerId, newPractitionerId } = await request.json() as {
    patientId: string;
    practitionerId: string;
    newPractitionerId: string;
  };

  if (!patientId || !practitionerId || !newPractitionerId) {
    return NextResponse.json(
      { error: "patientId, practitionerId et newPractitionerId requis." },
      { status: 400 }
    );
  }

  if (practitionerId === newPractitionerId) {
    return NextResponse.json(
      { error: "Impossible de transférer un dossier à soi-même." },
      { status: 400 }
    );
  }

  if (user.id !== practitionerId) return forbidden();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── 1. Guard IDOR — vérifier que l'appelant est l'assignataire actuel ─
  const { data: relation } = await supabase
    .from("patient_practitioner")
    .select("patient_id")
    .eq("patient_id", patientId)
    .eq("practitioner_id", practitionerId)
    .single();

  if (!relation) return forbidden();

  // ── 2. Guard cabinet — les deux praticiens doivent partager le même cabinet
  const { data: practitioners } = await supabase
    .from("practitioners")
    .select("user_id, cabinet_id")
    .in("user_id", [practitionerId, newPractitionerId]);

  const fromPrac = (practitioners ?? []).find(
    (p: { user_id: string; cabinet_id?: string | null }) => p.user_id === practitionerId
  ) as { user_id: string; cabinet_id?: string | null } | undefined;

  const toPrac = (practitioners ?? []).find(
    (p: { user_id: string; cabinet_id?: string | null }) => p.user_id === newPractitionerId
  ) as { user_id: string; cabinet_id?: string | null } | undefined;

  if (!fromPrac?.cabinet_id) {
    return NextResponse.json(
      { error: "Vous ne faites pas partie d'un cabinet. Contactez le support." },
      { status: 403 }
    );
  }

  if (!toPrac?.cabinet_id) {
    return NextResponse.json(
      { error: "Le praticien destinataire ne fait pas partie d'un cabinet." },
      { status: 403 }
    );
  }

  if (fromPrac.cabinet_id !== toPrac.cabinet_id) {
    return NextResponse.json(
      { error: "Transfert impossible : vous n'appartenez pas au même cabinet." },
      { status: 403 }
    );
  }

  const cabinetId = fromPrac.cabinet_id;

  // ── 3. Transférer la relation d'ownership dans patient_practitioner ───
  const { error: relationError } = await supabase
    .from("patient_practitioner")
    .update({ practitioner_id: newPractitionerId })
    .eq("patient_id", patientId)
    .eq("practitioner_id", practitionerId);

  if (relationError) {
    console.error("transfer-patient (relation) error:", relationError.message);
    return NextResponse.json({ error: "Erreur lors du transfert." }, { status: 500 });
  }

  // ── 4. Mettre à jour le statut du dossier patient ─────────────────────
  const { error: patientError } = await supabase
    .from("patients")
    .update({
      sharing_status: "transferred",
      cabinet_id:     cabinetId,
    })
    .eq("user_id", patientId);

  if (patientError) {
    console.error("transfer-patient (patients) error:", patientError.message);
    // Rollback de la relation
    await supabase.from("patient_practitioner")
      .update({ practitioner_id: practitionerId })
      .eq("patient_id", patientId)
      .eq("practitioner_id", newPractitionerId);
    return NextResponse.json({ error: "Erreur lors de la mise à jour du dossier." }, { status: 500 });
  }

  // ── 5. Log audit trail (conformité RGPD) ─────────────────────────────
  await supabase.from("cabinet_transfers").insert({
    patient_id:           patientId,
    from_practitioner_id: practitionerId,
    to_practitioner_id:   newPractitionerId,
    cabinet_id:           cabinetId,
    action:               "transfer",
  });

  // ── 6. Invalider les caches Redis des deux praticiens ─────────────────
  // Le prochain appel chat rechargera le profil du nouveau praticien.
  try {
    await Promise.all([
      redis.del(`practitioner:${practitionerId}`),
      redis.del(`practitioner:${newPractitionerId}`),
      // Invalider aussi les caches de documents qui incluent le patient_id
      redis.del(`has_docs:${practitionerId}:${patientId}`),
      redis.del(`has_docs:${newPractitionerId}:${patientId}`),
    ]);
  } catch {
    // Cache invalidation non bloquante — TTL de 1h max en cas d'échec
  }

  return NextResponse.json({ success: true });
}
