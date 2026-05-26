import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { userId, password } = await request.json() as { userId: string; password: string };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
