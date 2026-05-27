import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";
import * as XLSX from "xlsx";
import Papa from "papaparse";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(" ");
  const chunks: string[] = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.trim()) chunks.push(chunk.trim());
    i += chunkSize - overlap;
  }
  return chunks;
}

async function getGeminiEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
  const result = await model.embedContent({
    content: { parts: [{ text }], role: "user" },
    taskType: "RETRIEVAL_DOCUMENT",
    outputDimensionality: 768,
  } as never);
  return result.embedding.values;
}

async function anonymizeText(text: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const result = await model.generateContent(
      `Anonymise ce document médical/nutritionnel en remplaçant toutes les données personnelles identifiables par [ANONYMISÉ] :
      - Noms et prénoms de patients
      - Dates de naissance
      - Numéros de sécurité sociale
      - Adresses
      - Numéros de téléphone
      - Emails personnels
      
      Garde intact tout le contenu médical et nutritionnel.
      
      Document :
      ${text}`
    );
    return result.response.text();
  } catch {
    return text;
  }
}

async function extractTextFromImage(buffer: Buffer, mimeType: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  const result = await model.generateContent([
    {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType,
      },
    },
    "Extrais tout le texte et les informations nutritionnelles de cette image. Sois exhaustif.",
  ]);
  return result.response.text();
}

async function extractTextFromAudio(buffer: Buffer, mimeType: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  const result = await model.generateContent([
    {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType,
      },
    },
    "Transcris cet audio et extrais toutes les informations importantes sur l'approche nutritionnelle du praticien.",
  ]);
  return result.response.text();
}

export async function POST(request: Request) {
  try {
    const { getSessionUser, unauthorized, forbidden } = await import("@/lib/api-auth");
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const practitionerId = formData.get("practitionerId") as string;

    if (!file || !practitionerId) {
      return Response.json({ error: "Fichier ou practitionerId manquant." }, { status: 400 });
    }

    if (user.id !== practitionerId) return forbidden();
    }

    const { count } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("practitioner_id", practitionerId)
      .eq("file_name", file.name);

    if ((count ?? 0) > 0) {
      return Response.json({ error: `${file.name} est déjà indexé. Supprimez-le d'abord si vous voulez le remplacer.` }, { status: 400 });
    }

    const fileType = file.name.split(".").pop()?.toLowerCase();
    const allowedTypes = ["pdf", "docx", "txt", "jpg", "jpeg", "png", "xlsx", "csv", "mp3", "wav", "m4a"];

    if (!allowedTypes.includes(fileType ?? "")) {
      return Response.json({ error: "Format non supporté." }, { status: 400 });
    }

    const maxSizes: Record<string, number> = {
      pdf: 10, docx: 10, txt: 10,
      jpg: 5, jpeg: 5, png: 5,
      xlsx: 5, csv: 5,
      mp3: 25, wav: 25, m4a: 25,
    };
    const maxMB = maxSizes[fileType ?? ""] ?? 10;
    if (file.size > maxMB * 1024 * 1024) {
      return Response.json({ error: `Fichier trop volumineux. Maximum ${maxMB}MB.` }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const storagePath = `${practitionerId}/${Date.now()}_${file.name}`;
    await supabase.storage.from("documents").upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

    let text = "";

    if (fileType === "txt") {
      text = buffer.toString("utf-8");
    } else if (fileType === "pdf") {
      const { extractText } = await import("unpdf");
      const { text: pdfText } = await extractText(new Uint8Array(arrayBuffer), { mergePages: true });
      text = pdfText;
    } else if (fileType === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (["jpg", "jpeg", "png"].includes(fileType ?? "")) {
      const mimeType = fileType === "png" ? "image/png" : "image/jpeg";
      text = await extractTextFromImage(buffer, mimeType);
    } else if (fileType === "xlsx") {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheets = workbook.SheetNames.map((name) =>
        XLSX.utils.sheet_to_csv(workbook.Sheets[name])
      );
      text = sheets.join("\n\n");
    } else if (fileType === "csv") {
      const csvText = buffer.toString("utf-8");
      const parsed = Papa.parse(csvText, { header: true });
      text = JSON.stringify(parsed.data, null, 2);
    } else if (["mp3", "wav", "m4a"].includes(fileType ?? "")) {
      const mimeTypes: Record<string, string> = {
        mp3: "audio/mpeg",
        wav: "audio/wav",
        m4a: "audio/mp4",
      };
      text = await extractTextFromAudio(buffer, mimeTypes[fileType ?? "mp3"]);
    }

    if (!text.trim()) {
      return Response.json({ error: "Impossible de lire ce fichier. Vérifiez qu'il n'est pas corrompu." }, { status: 400 });
    }
    
    const MIN_CHARS = 50;
    if (text.trim().length < MIN_CHARS) {
      return Response.json({ 
        error: "Le contenu est trop court pour être indexé. Ajoutez plus de texte." 
      }, { status: 400 });
    }

    const documentType = formData.get("documentType") as string | null;
    const shouldAnonymize = documentType === "patient";
    const anonymizedText = shouldAnonymize ? await anonymizeText(text) : text;

    const chunks = chunkText(anonymizedText, 500);

    for (const chunk of chunks) {
      const embedding = await getGeminiEmbedding(chunk);

      const { error: insertError } = await supabase.from("documents").insert({
        practitioner_id: practitionerId,
        file_name: file.name,
        file_type: fileType,
        content: chunk,
        embedding,
        storage_path: storagePath,
      });

      if (insertError) {
        console.error("Erreur insert document:", insertError.message);
      }
    }

    // Invalider le cache has_docs
    try {
      await redis.del(`has_docs:${practitionerId}`);
    } catch { /* silencieux */ }

    return Response.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return Response.json({ error: msg }, { status: 500 });
  }
}
