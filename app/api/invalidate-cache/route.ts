import { Redis } from "@upstash/redis";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

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
    await redis.del(`patient_profile:${patientId}`);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}