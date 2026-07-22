import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { patientId } = await request.json() as { patientId: string };
    if (!patientId) return Response.json({ error: "patientId requis" }, { status: 400 });

    // L2 — seul le patient lui-même ou un praticien lié peut invalider ce cache.
    if (user.id !== patientId) {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: rel } = await supabase
        .from("patient_practitioner")
        .select("patient_id")
        .eq("patient_id", patientId)
        .eq("practitioner_id", user.id)
        .single();
      if (!rel) return forbidden();
    }

    await redis.del(`patient_profile:${patientId}`);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}