import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

// Appelée par le patient pour marquer le post-it praticien comme "Lu" et le masquer
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId } = await request.json() as { patientId: string };
  if (!patientId) return NextResponse.json({ error: "patientId requis." }, { status: 400 });

  // Seul le patient lui-même peut effacer son propre post-it
  if (user.id !== patientId) return forbidden();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.from("patients")
    .update({ practitioner_pinned_message: null })
    .eq("user_id", patientId);

  return NextResponse.json({ success: true });
}
