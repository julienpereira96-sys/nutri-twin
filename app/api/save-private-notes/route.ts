import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { patientId, notes } = await request.json() as { patientId: string; notes: string };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase
    .from("patients")
    .update({ private_notes: notes })
    .eq("user_id", patientId);

  return NextResponse.json({ success: true });
}
