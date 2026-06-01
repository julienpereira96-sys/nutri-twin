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

  // Insérer le message dans les conversations (rôle "assistant" = du côté Jumeau/praticien)
  await supabase.from("conversations").insert({
    patient_id: patientId,
    practitioner_id: practitionerId,
    role: "assistant",
    content: messageText,
  });

  // Effacer la victoire après envoi
  await supabase
    .from("patients")
    .update({ latest_victory: null, victory_detected_at: null })
    .eq("user_id", patientId);

  return NextResponse.json({ success: true });
}
