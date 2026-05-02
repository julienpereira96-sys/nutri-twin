import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

function chunkText(text: string, chunkSize = 500): string[] {
  const words = text.split(" ");
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().split(" ").length > chunkSize) {
      if (current.trim()) chunks.push(current.trim());
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export async function POST(request: Request) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const practitionerId = formData.get("practitionerId") as string;

    if (!file || !practitionerId) {
      return Response.json({ error: "Fichier ou practitionerId manquant." }, { status: 400 });
    }

    const fileType = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "txt"].includes(fileType ?? "")) {
      return Response.json({ error: "Format non supporté. PDF, DOCX ou TXT uniquement." }, { status: 400 });
    }

    let text = "";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (fileType === "txt") {
      text = buffer.toString("utf-8");
    } else if (fileType === "pdf") {
      const pdfModule = await import("pdf-parse");
      const parsePdf = (pdfModule as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default ?? pdfModule;
      const parsed = await parsePdf(buffer);
      text = parsed.text;
    } else if (fileType === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    }

    if (!text.trim()) {
      return Response.json({ error: "Impossible d'extraire le texte du document." }, { status: 400 });
    }

    const chunks = chunkText(text, 500);
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    for (const chunk of chunks) {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
      });
      const embedding = embeddingResponse.data[0]?.embedding;

      await supabase.from("documents").insert({
        practitioner_id: practitionerId,
        file_name: file.name,
        file_type: fileType,
        content: chunk,
        embedding,
      });
    }

    return Response.json({ success: true, chunks: chunks.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return Response.json({ error: msg }, { status: 500 });
  }
}
