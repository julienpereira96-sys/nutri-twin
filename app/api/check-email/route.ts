import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email } = await request.json() as { email: string };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.auth.admin.listUsers();
  console.log("Total users:", data?.users?.length);
  console.log("Searching for:", email);
  console.log("Users emails:", data?.users?.map(u => u.email));
  
  const exists = data?.users?.some(
    (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
  );

  console.log("Exists:", exists);

  return NextResponse.json({ exists: !!exists });
}
