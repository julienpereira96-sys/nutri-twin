import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { userId, firstName, lastName, specialty, email, marketingConsent } = await request.json() as {
    userId: string;
    firstName: string;
    lastName: string;
    specialty: string;
    email: string;
    marketingConsent?: boolean;
  };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();

  const { error } = await supabase.from("practitioners").upsert({
    user_id: userId,
    first_name: firstName,
    last_name: lastName,
    specialty,
    email,
    rgpd_accepted_at: now,
    rgpd_marketing: marketingConsent ?? false,
  }, { onConflict: "user_id" });

  if (error) {
    console.error("Erreur insert:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
