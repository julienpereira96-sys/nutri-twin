import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

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

  // Vérifier que ce patient appartient bien à ce praticien via patient_practitioner
  // (patient_practitioner.practitioner_id = auth user_id, pas l'UUID interne)
  const { data: relation } = await supabase
    .from("patient_practitioner")
    .select("patient_id")
    .eq("patient_id", testPatientUserId)
    .eq("practitioner_id", user.id)
    .single();

  if (!relation) {
    return NextResponse.json({ error: "Patient test introuvable." }, { status: 404 });
  }

  // Mettre à jour le patient test actif
  await supabase
    .from("practitioners")
    .update({ test_patient_user_id: testPatientUserId })
    .eq("user_id", user.id);

  // Invalider le cache profil IA du nouveau patient actif pour garantir des données fraîches
  await redis.del(`patient_profile_v2:${testPatientUserId}`).catch(() => {});

  return NextResponse.json({ ok: true });
}
