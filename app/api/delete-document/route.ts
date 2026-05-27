import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(request: Request) {
  const { fileName, practitionerId } = await request.json() as { fileName: string; practitionerId: string };
  if (!fileName || !practitionerId) return Response.json({ error: "Données manquantes" }, { status: 400 });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  await supabase.from("documents").delete().eq("practitioner_id", practitionerId).eq("file_name", fileName);

  try { await redis.del(`has_docs:${practitionerId}`); } catch { /* silencieux */ }

  return Response.json({ success: true });
}
