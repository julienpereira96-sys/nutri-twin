import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

// Requires Supabase column: patients.practitioner_pinned_message JSONB NULL
// Schema: { text: string, sent_at: string, practitioner_id: string } | null

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId, practitionerId, messageText } = await request.json() as {
    patientId: string;
    practitionerId: string;
    messageText: string;
  };

  if (!patientId || !practitionerId || !messageText?.trim()) {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }

  if (user.id !== practitionerId) return forbidden();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Guard IDOR — vérifier que ce patient appartient bien à ce praticien.
  // Ce client utilise la service_role (bypass RLS) : ce check est l'unique garde.
  const { data: relation } = await supabase
    .from("patient_practitioner")
    .select("patient_id")
    .eq("patient_id", patientId)
    .eq("practitioner_id", practitionerId)
    .single();

  if (!relation) return forbidden();

  // Stocker le message comme post-it épinglé côté patient — pas dans le fil du chat IA
  await supabase.from("patients").update({
    practitioner_pinned_message: {
      text: messageText.trim(),
      sent_at: new Date().toISOString(),
      practitioner_id: practitionerId,
    },
  }).eq("user_id", patientId);

  return NextResponse.json({ success: true });
}
