import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email } = await request.json() as { email: string };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase.auth.admin.listUsers();
  const user = data?.users?.find(
    (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
  );

  if (!user) return NextResponse.json({ exists: false, hasPlan: false });

  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("plan")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    exists: true,
    hasPlan: !!practitioner?.plan,
  });
}
