import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { patientId, practitionerId, victoryText } = await request.json() as {
    patientId: string;
    practitionerId: string;
    victoryText: string;
  };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Récupérer le prénom du patient
  const { data: patient } = await supabase
    .from("patients")
    .select("first_name")
    .eq("user_id", patientId)
    .single();

  const firstName = (patient as { first_name?: string } | null)?.first_name ?? "vous";

  // Générer un message d'encouragement via Gemini
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Le praticien a remarqué une victoire importante pour ce patient et veut lui envoyer un message d'encouragement personnalisé. La victoire : "${victoryText}". Génère un message chaleureux, court (2-3 phrases max), comme si le jumeau transmettait les félicitations du praticien. Commence par le prénom ${firstName}. Sans markdown.`,
      practitionerId,
    }),
  });

  const data = await res.json() as { response?: string };
  const message = data.response ?? `${firstName}, votre praticien a remarqué votre belle victoire. Continuez comme ça ! 🌿`;

  // Insérer le message dans les conversations
  await supabase.from("conversations").insert({
    patient_id: patientId,
    practitioner_id: practitionerId,
    role: "assistant",
    content: message,
  });

  // Effacer la victoire après envoi
  await supabase
    .from("patients")
    .update({ latest_victory: null, victory_detected_at: null })
    .eq("user_id", patientId);

  return NextResponse.json({ success: true, message });
}
