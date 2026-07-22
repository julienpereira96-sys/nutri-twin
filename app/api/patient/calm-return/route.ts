import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * POST /api/patient/calm-return
 *
 * RLS-2 — Retour au calme du patient, écrit SERVER-SIDE (service_role).
 * Le patient ne peut plus modifier `emotional_status` directement via PostgREST
 * (bloqué par le trigger DB protect_patient_clinical_fields) : cette route est le
 * seul chemin autorisé côté patient, et applique la règle clinique.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId } = await request.json() as { patientId: string };
  if (!patientId) return Response.json({ error: "patientId requis." }, { status: 400 });

  // Le patient n'apaise QUE son propre statut.
  if (user.id !== patientId) return forbidden();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Sécurité clinique : un red_critical n'est levé QUE par le praticien
  // (CARTOGRAPHIE §5.1). Le patient ne peut pas s'auto-sortir d'une urgence vitale.
  const { data: current } = await supabase
    .from("patients")
    .select("emotional_status")
    .eq("user_id", patientId)
    .single();

  const status = (current as { emotional_status?: string } | null)?.emotional_status;
  if (status === "red_critical") {
    return Response.json({ ok: false, reason: "red_critical", emotional_status: "red_critical" });
  }

  const { error } = await supabase
    .from("patients")
    .update({ emotional_status: "green", red_behavioral_until: null })
    .eq("user_id", patientId);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await redis.del(`patient_profile_v2:${patientId}`).catch(() => {});

  return Response.json({ ok: true, emotional_status: "green" });
}
