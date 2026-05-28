import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId, practitionerId, victoryText } = await request.json() as {
    patientId: string;
    practitionerId: string;
    victoryText: string;
  };

  if (user.id !== practitionerId) return forbidden();

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

  // Générer un message d'encouragement via Gemini directement (pas d'appel HTTP interne)
  let message = `${firstName}, votre praticien a remarqué votre belle victoire. Continuez comme ça ! 🌿`;
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: { maxOutputTokens: 150, temperature: 0.7 },
    });
    const result = await model.generateContent(
      `Le praticien a remarqué une victoire importante pour ce patient et veut lui envoyer un message d'encouragement personnalisé. La victoire : "${victoryText}". Génère un message chaleureux, court (2-3 phrases max), comme si le jumeau transmettait les félicitations du praticien. Commence par le prénom ${firstName}. Sans markdown.`
    );
    const text = result.response.text().trim();
    if (text) message = text;
  } catch {
    // Silencieux - on garde le message par défaut
  }

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
