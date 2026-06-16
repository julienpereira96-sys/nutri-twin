import { createClient } from "@supabase/supabase-js";
import { vertexGenerate } from "@/lib/vertexai";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

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

  const { data: patient } = await supabase
    .from("patients")
    .select("first_name")
    .eq("user_id", patientId)
    .single();

  const firstName = (patient as { first_name?: string } | null)?.first_name ?? "vous";

  // Récupérer la signature du praticien pour personnaliser le message
  const { data: profile } = await supabase
    .from("practitioner_profiles")
    .select("signature, tone_of_voice")
    .eq("user_id", practitionerId)
    .single();

  const signatureContext = (profile as { signature?: string; tone_of_voice?: string } | null)?.signature
    ? `Signature stylistique du praticien : "${(profile as { signature?: string }).signature?.slice(0, 300)}"`
    : "";

  let message = `${firstName}, votre praticien a remarqué votre belle victoire. Continuez comme ça ! 🌿`;
  try {
    const text = await vertexGenerate(
      "gemini-3.1-flash-lite",
      `Tu es le Jumeau IA d'un nutritionniste qui transmet un message de félicitations de la part du praticien. La victoire du patient : "${victoryText}". ${signatureContext} Génère un message chaleureux, court (2-3 phrases max), personnel et non générique. Le message est envoyé directement par le praticien via son Jumeau — le ton doit être humain et sincère. Commence par le prénom ${firstName}. Sans markdown, sans emojis excessifs.`,
      { maxOutputTokens: 150, temperature: 0.8 }
    );
    if (text.trim()) message = text.trim();
  } catch {
    // Silencieux - on garde le message par défaut
  }

  return NextResponse.json({ success: true, message });
}
