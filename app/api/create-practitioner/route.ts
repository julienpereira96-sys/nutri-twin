import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { userId, firstName, lastName, specialty, email, marketingConsent, pendingPlan } = await request.json() as {
    userId: string;
    firstName: string;
    lastName: string;
    specialty: string;
    email: string;
    marketingConsent?: boolean;
    pendingPlan?: string;
  };

  if (!userId || !email) {
    return Response.json({ error: "Paramètres manquants." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Vérifier que l'utilisateur existe dans Supabase Auth (pas de session dispo juste après signUp)
  const { data: authData, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError || !authData.user) {
    return Response.json({ error: "Utilisateur introuvable." }, { status: 403 });
  }

  // Vérifier que l'email correspond bien à cet userId (anti-IDOR)
  if (authData.user.email?.toLowerCase() !== email.trim().toLowerCase()) {
    return Response.json({ error: "Email non concordant." }, { status: 403 });
  }

  const now = new Date().toISOString();

  const { error } = await supabase.from("practitioners").upsert({
    user_id: userId,
    first_name: firstName,
    last_name: lastName,
    specialty,
    email,
    rgpd_accepted_at: now,
    rgpd_marketing: marketingConsent ?? false,
    pending_plan: pendingPlan ?? "pro",
  }, { onConflict: "user_id" });

  if (error) {
    console.error("Erreur insert:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
