import { createClient } from "@supabase/supabase-js";
import { vertexGenerate } from "@/lib/vertexai";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

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

  // L3 — guard IDOR : vérifier que ce patient appartient bien à ce praticien
  // (sinon fuite du prénom d'un patient arbitraire).
  const { data: relation } = await supabase
    .from("patient_practitioner")
    .select("patient_id")
    .eq("patient_id", patientId)
    .eq("practitioner_id", practitionerId)
    .single();
  if (!relation) return forbidden();

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
    const text = await vertexGenerate(
      "gemini-3.1-flash-lite",
      `Tu es le Jumeau IA d'un nutritionniste. Tu dois rédiger un message de soutien humain et sincère de la part du praticien, destiné directement au patient ${firstName} qui traverse un moment difficile.

${situationCtx}
${conversationCtx}
${murmureCtx}
${signatureCtx}

Rédige un message court (2-4 phrases), chaleureux, personnel, qui montre que le praticien a fait attention. Commence par le prénom. Le ton doit être celui d'un professionnel bienveillant, pas d'un chatbot. Sans markdown, sans emojis excessifs.`,
      { maxOutputTokens: 160, temperature: 0.75 }
    );
    if (text.trim()) message = text.trim();
  } catch {
    // Silencieux - message par défaut
  }

  return NextResponse.json({ success: true, message });
}
