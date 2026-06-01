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

  // Insérer le message (role "assistant" = visible côté patient comme message du Jumeau/praticien)
  await supabase.from("conversations").insert({
    patient_id: patientId,
    practitioner_id: practitionerId,
    role: "assistant",
    content: messageText,
  });

  // Marquer toutes les alertes de ce patient comme vues + passer le statut en vert
  await supabase
    .from("patients")
    .update({ emotional_status: "green" })
    .eq("user_id", patientId);

  await supabase
    .from("admin_alerts")
    .update({ seen: true })
    .eq("patient_id", patientId)
    .eq("seen", false);

  return NextResponse.json({ success: true });
}
