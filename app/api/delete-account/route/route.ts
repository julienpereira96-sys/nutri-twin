import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { patientId, password, email } = await request.json() as { patientId: string; password: string; email: string };
  if (!patientId || !password || !email) return Response.json({ error: "Données manquantes" }, { status: 400 });

  // Vérifier le mot de passe
  const supabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (authError) return Response.json({ error: "Mot de passe incorrect" }, { status: 401 });

  // Supprimer les données + le compte Auth
  const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  await supabaseAdmin.from("patients").delete().eq("user_id", patientId);
  await supabaseAdmin.auth.admin.deleteUser(patientId);

  return Response.json({ success: true });
}