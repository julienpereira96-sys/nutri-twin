import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId, practitionerId, emotionalInsight, lastMessages, murmures } = await request.json() as {
    patientId: string;
    practitionerId: string;
    emotionalInsight?: string;
    lastMessages?: { role: string; content: string }[];
    murmures?: string[];
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

  const { data: profile } = await supabase
    .from("practitioner_profiles")
    .select("signature, tone_of_voice")
    .eq("user_id", practitionerId)
    .single();

  const signatureCtx = (profile as { signature?: string } | null)?.signature
    ? `Signature stylistique du praticien : "${(profile as { signature?: string }).signature?.slice(0, 300)}"`
    : "";

  const murmureCtx = murmures?.length
    ? `Consignes prioritaires du praticien pour ce patient : ${murmures.map(m => `"${m}"`).join(", ")}`
    : "";

  const conversationCtx = lastMessages?.length
    ? `Derniers échanges :\n${lastMessages.slice(-6).map(m => `${m.role === "user" ? firstName : "IA"}: ${m.content}`).join("\n")}`
    : "";

  const situationCtx = emotionalInsight ? `Situation détectée : "${emotionalInsight}"` : "";

  let message = `${firstName}, je voulais juste prendre un moment pour vous dire que je pense à vous. N'hésitez pas si vous avez besoin de me parler.`;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: { maxOutputTokens: 160, temperature: 0.75 },
    });
    const result = await model.generateContent(
      `Tu es le Jumeau IA d'un nutritionniste. Tu dois rédiger un message de soutien humain et sincère de la part du praticien, destiné directement au patient ${firstName} qui traverse un moment difficile.

${situationCtx}
${conversationCtx}
${murmureCtx}
${signatureCtx}

Rédige un message court (2-4 phrases), chaleureux, personnel, qui montre que le praticien a fait attention. Commence par le prénom. Le ton doit être celui d'un professionnel bienveillant, pas d'un chatbot. Sans markdown, sans emojis excessifs.`
    );
    const text = result.response.text().trim();
    if (text) message = text;
  } catch {
    // Silencieux - message par défaut
  }

  return NextResponse.json({ success: true, message });
}
