import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as XLSX from "xlsx";
import Papa from "papaparse";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

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

async function getGeminiEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
  const result = await model.embedContent({
    content: { parts: [{ text }], role: "user" },
    taskType: "RETRIEVAL_DOCUMENT",
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

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
    const pdf = await (pdfjsLib as unknown as {
      getDocument: (opts: { data: Uint8Array }) => { promise: Promise<{
        numPages: number;
        getPage: (n: number) => Promise<{
          getTextContent: () => Promise<{ items: { str: string }[] }>;
        }>;
      }> };
    }).getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return pages.join("\n\n");
  } catch {
    // Fallback : essayer avec pdf-parse
    const pdfModule = await import("pdf-parse");
    const parsePdf = (pdfModule as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default ?? pdfModule;
    const parsed = await parsePdf(Buffer.from(arrayBuffer));
    return parsed.text;
  }
}

export async function POST(request: Request) {
  try {
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

    // Upload vers Supabase Storage
    const storagePath = `${practitionerId}/${Date.now()}_${file.name}`;
    await supabase.storage.from("documents").upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

    // Extraction du texte selon le type
    let text = "";

    if (fileType === "txt") {
      text = buffer.toString("utf-8");
    } else if (fileType === "pdf") {
      text = await extractTextFromPDF(arrayBuffer);
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
      return Response.json({ error: "Impossible d'extraire le contenu du fichier." }, { status: 400 });
    }

    // Anonymisation
    const anonymizedText = await anonymizeText(text);

    // Chunking et indexation RAG avec embeddings Gemini
    const chunks = chunkText(anonymizedText, 500);

    for (const chunk of chunks) {
      const embedding = await getGeminiEmbedding(chunk);

      await supabase.from("documents").insert({
        practitioner_id: practitionerId,
        file_name: file.name,
        file_type: fileType,
        content: chunk,
        embedding,
        storage_path: storagePath,
      });
    }

    return Response.json({ success: true, chunks: chunks.length });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return Response.json({ error: msg }, { status: 500 });
  }
}
