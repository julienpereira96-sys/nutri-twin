import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

type Murmure = { id: string; text: string; expires_at?: string | null; created_at: string };

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId, practitionerId, murmures } = await request.json() as {
    patientId: string;
    practitionerId: string;
    murmures: Murmure[];
  };

  if (!patientId || !practitionerId || !Array.isArray(murmures)) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  if (user.id !== practitionerId) return forbidden();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from("patients")
    .update({ practitioner_instruction: murmures })
    .eq("user_id", patientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
