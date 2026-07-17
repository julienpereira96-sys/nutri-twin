import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { password, email } = await request.json() as { patientId: string; password: string; email: string };
  if (!password || !email) return Response.json({ error: "Données manquantes" }, { status: 400 });

  // Vérifier le mot de passe - l'ID réel vient de la réponse Auth, jamais du body
  const supabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (authError || !authData.user) return Response.json({ error: "Mot de passe incorrect" }, { status: 401 });

  // Utiliser l'ID retourné par Auth, jamais celui du body
  const verifiedUserId = authData.user.id;

  const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // RGPD — droit à l'oubli : supprimer toutes les données liées en parallèle
  await Promise.all([
    supabaseAdmin.from("conversations").delete().eq("patient_id", verifiedUserId),
    supabaseAdmin.from("conversations_sessions").delete().eq("patient_id", verifiedUserId),
    supabaseAdmin.from("sos_events").delete().eq("patient_id", verifiedUserId),
    supabaseAdmin.from("exercise_logs").delete().eq("patient_id", verifiedUserId),
    supabaseAdmin.from("crisis_events").delete().eq("patient_id", verifiedUserId),
    supabaseAdmin.from("documents").delete().eq("patient_id", verifiedUserId),
    supabaseAdmin.from("journal_entries").delete().eq("patient_id", verifiedUserId),
    supabaseAdmin.from("patient_practitioner").delete().eq("patient_id", verifiedUserId),
  ]);

  // Supprimer le profil patient
  await supabaseAdmin.from("patients").delete().eq("user_id", verifiedUserId);

  // Supprimer le compte Auth → révoque définitivement tout accès
  await supabaseAdmin.auth.admin.deleteUser(verifiedUserId);

  return Response.json({ success: true });
}
