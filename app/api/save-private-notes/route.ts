import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type PrivateNote = { id: string; text: string; created_at: string };

export async function POST(request: Request) {
  const { patientId, notes } = await request.json() as {
    patientId: string;
    notes: PrivateNote[];
  };

  if (!patientId || !Array.isArray(notes)) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("patients")
    .update({ private_notes: notes })
    .eq("user_id", patientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
