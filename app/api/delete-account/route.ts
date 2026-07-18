import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { password } = await request.json() as { password?: string };

  if (!password) {
    return NextResponse.json({ error: "Mot de passe requis." }, { status: 400 });
  }

  // Vérifier le mot de passe via signInWithPassword (email de la session, pas du body)
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error: signInError } = await anonClient.auth.signInWithPassword({
    email: user.email!,
    password,
  });

  if (signInError) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const userId = user.id;

  // 1. Supprimer toutes les données enfant
  await Promise.all([
    adminClient.from("conversations").delete().eq("patient_id", userId),
    adminClient.from("conversations_sessions").delete().eq("patient_id", userId),
    adminClient.from("sos_events").delete().eq("patient_id", userId),
    adminClient.from("sos_closures").delete().eq("patient_id", userId),
    adminClient.from("exercise_logs").delete().eq("patient_id", userId),
    adminClient.from("crisis_events").delete().eq("patient_id", userId),
    adminClient.from("documents").delete().eq("patient_id", userId),
    adminClient.from("journal_entries").delete().eq("patient_id", userId),
    adminClient.from("patient_practitioner").delete().eq("patient_id", userId),
  ]);

  // 2. Supprimer le patient
  await adminClient.from("patients").delete().eq("user_id", userId);

  // 3. Invalider le cache Redis
  await redis.del(`patient_profile_v2:${userId}`).catch(() => {});

  // 4. Supprimer le compte Auth en dernier
  const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
  if (deleteAuthError) {
    console.error("[NutriTwin] delete-account — deleteUser error:", deleteAuthError.message);
  }

  return NextResponse.json({ success: true });
}
