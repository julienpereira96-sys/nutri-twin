/**
 * lib/vertexai.ts
 *
 * Shared Vertex AI helpers for all API routes.
 * Replaces @google/generative-ai + GOOGLE_API_KEY with service-account
 * credentials that work on the GCP project where billing is enabled.
 */

import { GoogleAuth } from "google-auth-library";

// REST API: EU multi-region — hard-coded so env var changes never break the host.
// Gemini Live WebSocket uses a separate config in lib/geminiLiveClient.ts (us-central1).
export const VERTEX_LOCATION = "eu";
export const VERTEX_HOST     = "aiplatform.eu.rep.googleapis.com";
export const VERTEX_PROJECT  = process.env.GOOGLE_CLOUD_PROJECT_ID!;

export function vertexUrl(modelId: string, method: string): string {
  return (
    `https://${VERTEX_HOST}/v1/` +
    `projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/` +
    `publishers/google/models/${modelId}:${method}`
  );
}

// Per-module token cache — reused on warm starts, regenerated on cold starts.
// Each route file has its own module scope so the cache is per-route.
let _cachedToken: { value: string; exp: number } | null = null;

export async function getVertexToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.exp) return _cachedToken.value;
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!) as object;
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain Vertex AI access token");
  _cachedToken = { value: token, exp: Date.now() + 50 * 60 * 1000 };
  return token;
}

/** Non-streaming generateContent */
export async function vertexGenerate(
  modelId: string,
  prompt: string,
  opts?: { maxOutputTokens?: number; temperature?: number; location?: string }
): Promise<string> {
  const token = await getVertexToken();
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      ...(opts?.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
      ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
    },
  };
  // Si une région spécifique est demandée, on construit l'URL régionale.
  // Format régional : https://{region}-aiplatform.googleapis.com/v1/...
  // Format multi-région (défaut) : https://aiplatform.eu.rep.googleapis.com/v1/...
  const url = opts?.location
    ? `https://${opts.location}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${opts.location}/publishers/google/models/${modelId}:generateContent`
    : vertexUrl(modelId, "generateContent");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Vertex AI ${res.status}: ${await res.text()}`);
  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Non-streaming multimodal generateContent (text + inlineData parts) */
export async function vertexGenerateMultipart(
  modelId: string,
  parts: ({ text: string } | { inlineData: { data: string; mimeType: string } })[],
  opts?: { maxOutputTokens?: number; temperature?: number }
): Promise<string> {
  const token = await getVertexToken();
  const body = {
    contents: [{ role: "user", parts }],
    ...(opts ? { generationConfig: opts } : {}),
  };
  const res = await fetch(vertexUrl(modelId, "generateContent"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Vertex AI ${res.status}: ${await res.text()}`);
  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** Compute text embeddings via text-multilingual-embedding-002 (EU, europe-west1).
 *  Accepts up to 250 texts per call — all batched in a single API request.
 *  Returns one embedding vector per input text (same order). */
export async function vertexEmbed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const token = await getVertexToken();
  // Embeddings use a regional endpoint (not the multiregion EU host used for generation).
  const url = `https://europe-west1-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/europe-west1/publishers/google/models/text-multilingual-embedding-002:predict`;
  const body = {
    instances: texts.map((content) => ({ task_type: "SEMANTIC_SIMILARITY", content })),
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Vertex Embed ${res.status}: ${await res.text()}`);
  const data = await res.json() as {
    predictions?: { embeddings?: { values?: number[] } }[];
  };
  return (data.predictions ?? []).map((p) => p.embeddings?.values ?? []);
}

/** Streaming generateContent — yields text chunks via Server-Sent Events */
export async function* vertexStreamGenerate(
  modelId: string,
  contents: { role: string; parts: unknown[] }[],
  systemInstruction: string,
  generationConfig: { maxOutputTokens?: number; temperature?: number }
): AsyncGenerator<string> {
  const token = await getVertexToken();
  const body = {
    contents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig,
  };
  const res = await fetch(vertexUrl(modelId, "streamGenerateContent") + "?alt=sse", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Vertex AI stream ${res.status}: ${await res.text()}`);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (!json || json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch { /* ignore malformed SSE line */ }
    }
  }
}
