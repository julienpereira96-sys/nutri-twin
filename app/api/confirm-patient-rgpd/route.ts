import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { userId, email } = await request.json() as {
    userId: string;
    email: string;
  };

  if (!userId || typeof userId !== "string") {
    return Response.json({ error: "userId requis." }, { status: 400 });
  }
  if (!email || typeof email !== "string") {
    return Response.json({ error: "email requis." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Valider que userId + email correspondent bien à un utilisateur réel dans Supabase Auth
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !user) {
    return Response.json({ error: "Utilisateur introuvable." }, { status: 401 });
  }
  if (user.email?.toLowerCase() !== email.trim().toLowerCase()) {
    return Response.json({ error: "Identifiants invalides." }, { status: 401 });
  }

  const now = new Date().toISOString();

  const { error } = await supabase.from("patients")
    .update({
      rgpd_accepted_at: now,
      rgpd_data_accepted_at: now,
      onboarding_status: "password_set",
    })
    .eq("user_id", userId);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
