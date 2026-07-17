/**
 * /api/tts
 * Google Cloud Text-to-Speech Neural2 proxy.
 *
 * POST { text, voiceId, ssml?, rate? }
 * → { audioBase64: string, durationMs: number }
 *
 * Requires GOOGLE_CLOUD_TTS_API_KEY in environment.
 * Returns 503 if the key is missing so the client can fall back to Web Speech API.
 */

import { NextRequest } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

const TTS_ENDPOINT =
  "https://texttospeech.googleapis.com/v1/text:synthesize";

type TTSRequest = {
  /** Plain text (will be auto-wrapped in SSML server-side) */
  text?: string;
  /** Pre-built SSML string — used when the client provides SSML directly */
  ssml?: string;
  /** Google Cloud voice name, e.g. "fr-FR-Neural2-C" */
  voiceId: string;
  /** Speaking rate (0.25–4.0). Defaults to 0.92. */
  rate?: number;
};

type GoogleTTSPayload = {
  input: { text: string } | { ssml: string };
  voice: {
    languageCode: string;
    name: string;
  };
  audioConfig: {
    audioEncoding: "MP3";
    speakingRate: number;
    volumeGainDb: number;
    effectsProfileId: string[];
  };
};

/** Extract BCP-47 lang code from voice name (e.g. "fr-FR-Neural2-C" → "fr-FR") */
function langFromVoiceId(voiceId: string): string {
  const parts = voiceId.split("-");
  return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : "fr-FR";
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "tts_unavailable", message: "GOOGLE_CLOUD_TTS_API_KEY not configured" },
      { status: 503 }
    );
  }

  let body: TTSRequest;
  try {
    body = await request.json() as TTSRequest;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { text, ssml, voiceId, rate = 0.92 } = body;

  if (!voiceId) {
    return Response.json({ error: "voiceId_required" }, { status: 400 });
  }
  if (!text && !ssml) {
    return Response.json({ error: "text_or_ssml_required" }, { status: 400 });
  }

  const langCode = langFromVoiceId(voiceId);

  // Build the input — prefer pre-built SSML, otherwise use plain text
  const input: GoogleTTSPayload["input"] = ssml
    ? { ssml }
    : { text: text! };

  const payload: GoogleTTSPayload = {
    input,
    voice: {
      languageCode: langCode,
      name: voiceId,
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: Math.min(4.0, Math.max(0.25, rate)),
      // Slight volume boost so it cuts through ambient noise on mobile
      volumeGainDb: 1.5,
      // Optimised for small speakers (phones, tablets)
      effectsProfileId: ["small-bluetooth-speaker-class-device"],
    },
  };

  try {
    const res = await fetch(`${TTS_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[/api/tts] Google Cloud error:", res.status, errText);
      return Response.json(
        { error: "upstream_error", status: res.status },
        { status: 502 }
      );
    }

    const data = await res.json() as { audioContent: string };
    const audioBase64: string = data.audioContent;

    // Estimate duration from base64 MP3 size.
    // MP3 at 24 kbps (Google default for Neural2): ~3000 bytes / second
    // This is a rough estimate; good enough for karaoke timer scheduling.
    const byteLength = Math.floor((audioBase64.length * 3) / 4);
    const durationMs = Math.round((byteLength / 3000) * 1000);

    return Response.json({ audioBase64, durationMs });
  } catch (err) {
    console.error("[/api/tts] Unexpected error:", err);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
