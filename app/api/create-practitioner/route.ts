import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { userId, firstName, lastName, specialty, email } = await request.json() as {
    userId: string;
    firstName: string;
    lastName: string;
    specialty: string;
    email: string;
  };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from("practitioners").upsert({
    user_id: userId,
    first_name: firstName,
    last_name: lastName,
    specialty,
    email,
  }, { onConflict: "user_id" });

  if (error) {
    console.error("Erreur upsert:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("practitioners")
    .update({ email })
    .eq("user_id", userId);

  return Response.json({ success: true });
}
