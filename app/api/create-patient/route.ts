import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { userId, email } = await request.json() as {
    userId: string;
    email: string;
  };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();

  // Mettre à jour uniquement onboarding_status et rgpd sans toucher aux autres champs
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
