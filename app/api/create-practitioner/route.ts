import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { userId, firstName, lastName, specialty } = await request.json() as {
    userId: string;
    firstName: string;
    lastName: string;
    specialty: string;
  };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from("practitioners").insert({
    user_id: userId,
    first_name: firstName,
    last_name: lastName,
    specialty,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
