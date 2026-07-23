import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-auth";
import { Redis } from "@upstash/redis";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { motivation, niveau_activite, defi, aliments_aimes, aliments_detestes } = await request.json() as {
    motivation?: string | null;
    niveau_activite?: string | null;
    defi?: string | null;
    aliments_aimes?: string | null;
    aliments_detestes?: string | null;
  };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const fields: Record<string, string | null> = {};
  if (motivation !== undefined) fields.motivation = motivation ?? null;
  if (niveau_activite !== undefined) fields.niveau_activite = niveau_activite ?? null;
  if (defi !== undefined) fields.defi = defi ?? null;
  if (aliments_aimes !== undefined) fields.aliments_aimes = aliments_aimes ?? null;
  if (aliments_detestes !== undefined) fields.aliments_detestes = aliments_detestes ?? null;

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour." }, { status: 400 });
  }

  const { error } = await supabase
    .from("patients")
    .update(fields)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Invalider le cache profil patient + le cache Vertex AI pour que le jumeau
  // voie les nouvelles préférences dès le prochain message.
  // Ordre important : del patient_profile_v2 d'abord (sinon getPatientProfile
  // rebuildrait le Vertex cache avec l'ancien profil en mémoire).
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    await redis.del(`patient_profile_v2:${user.id}`);
    await redis.incr(`patient_v:${user.id}`);
  } catch { /* silencieux */ }

  return NextResponse.json({ success: true });
}
