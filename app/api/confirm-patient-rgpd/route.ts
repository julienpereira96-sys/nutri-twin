import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

export async function POST(request: Request) {
  // Support Bearer token (client-side magic link sessions qui n'ont pas de cookie SSR)
  let user = null;
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const anonClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await anonClient.auth.getUser(token);
    user = data.user;
  } else {
    user = await getSessionUser();
  }
  if (!user) return unauthorized();

  const { userId, email } = await request.json() as {
    userId: string;
    email: string;
  };

  if (user.id !== userId) return forbidden();

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
