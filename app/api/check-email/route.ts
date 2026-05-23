import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email } = await request.json() as { email: string };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Chercher dans auth.users via admin API avec filtre direct
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  
  if (error) return NextResponse.json({ exists: false, hasPlan: false, isConfirmed: false });
  
  const user = users?.find(
    (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
  );

  if (!user) return NextResponse.json({ exists: false, hasPlan: false, isConfirmed: false });

  const isConfirmed = !!user.email_confirmed_at;

  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("plan")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    exists: true,
    hasPlan: !!practitioner?.plan,
    isConfirmed,
  });
}
