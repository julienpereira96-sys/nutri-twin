import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email } = await request.json() as { email: string };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase.auth.admin.listUsers();
  const exists = data?.users?.some(
    (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
  );

  return NextResponse.json({ exists: !!exists });
}
