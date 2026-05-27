import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

type PrivateNote = { id: string; text: string; created_at: string };

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId, practitionerId, notes } = await request.json() as {
    patientId: string;
    practitionerId: string;
    notes: PrivateNote[];
  };

  if (!patientId || !practitionerId || !Array.isArray(notes)) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  // Le praticien connecté doit être celui qui modifie les notes
  if (user.id !== practitionerId) return forbidden();

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
