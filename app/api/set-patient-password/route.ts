import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { userId, password } = await request.json() as { userId: string; password: string };

  // Le patient ne peut changer que son propre mot de passe
  if (user.id !== userId) return forbidden();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
