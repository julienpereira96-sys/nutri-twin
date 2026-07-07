import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId, practitionerId, messageText } = await request.json() as {
    patientId: string;
    practitionerId: string;
    messageText: string;
  };

  if (user.id !== practitionerId) return forbidden();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Épingler le bravo comme message praticien (bandeau côté patient, pas dans le chat)
  await supabase
    .from("patients")
    .update({
      practitioner_pinned_message: { text: messageText, sent_at: new Date().toISOString(), practitioner_id: practitionerId },
      latest_victory: null,
      victory_detected_at: null,
    })
    .eq("user_id", patientId);

  return NextResponse.json({ success: true });
}
