import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

type Murmure = { id: string; text: string; expires_at?: string | null; created_at: string };

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId, practitionerId, murmures } = await request.json() as {
    patientId: string;
    practitionerId: string;
    murmures: Murmure[];
  };

  if (!patientId || !practitionerId || !Array.isArray(murmures)) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  if (user.id !== practitionerId) return forbidden();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Guard IDOR — vérifier que ce patient appartient bien à ce praticien.
  // Ce client utilise la service_role (bypass RLS) : ce check est l'unique garde.
  const { data: relation } = await supabase
    .from("patient_practitioner")
    .select("patient_id")
    .eq("patient_id", patientId)
    .eq("practitioner_id", practitionerId)
    .single();

  if (!relation) return forbidden();

  const { error } = await supabase
    .from("patients")
    .update({ practitioner_instruction: murmures })
    .eq("user_id", patientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Invalider le cache profil patient — le Murmure doit être actif au prochain message
  await redis.del(`patient_profile_v2:${patientId}`).catch(() => {});

  return NextResponse.json({ success: true });
}
