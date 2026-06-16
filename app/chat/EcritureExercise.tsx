"use client";

/**
 * EcritureExercise — Catharsis textuelle (Niveau 1)
 *
 * Architecture double-canal :
 *   1. intro_live  — WebSocket Gemini Live : accueil personnalisé, fermeture propre sur turn_complete
 *   2. writing     — Silence total. Textarea libre. Flou rétroactif par paragraphe.
 *                    Dictée vocale locale (Web Speech API, si détectée).
 *   3. analyzing   — Requête HTTP REST vers Gemini Flash (structuration TCC)
 *   4. tcc_mirror  — Affichage 3 blocs : Validation / Prise de distance / Pivot
 *   5. transition  — Injection dans le fil chat (1 bulle patient + 3 bulles Twin)
 *
 * Pas de token Gemini gaspillé pendant l'écriture : silence = intentionnel.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { getSelectedGeminiVoice } from "@/lib/therapeuticVoice";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const BG_PAPER       = "rgba(245,242,235,1)";      // beige papier premium
const BG_PAPER_DARK  = "rgba(238,234,224,1)";      // beige légèrement plus sombre
const ACCENT         = "#8B6F4E";                   // terre/sable — ancrage
const ACCENT_LIGHT   = "rgba(139,111,78,0.12)";
const ACCENT_BORDER  = "rgba(139,111,78,0.28)";
const ACCENT_GLOW    = "rgba(139,111,78,0.45)";
const TEXT_INK       = "rgba(30,22,12,0.85)";      // encre foncée
const TEXT_MUTED     = "rgba(30,22,12,0.38)";
const TEXT_FADED     = "rgba(30,22,12,0.22)";
const WAVE_COLOR     = ACCENT;

// ─── Gemini Live ───────────────────────────────────────────────────────────────
const GEMINI_WS_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const GEMINI_MODEL  = "models/gemini-3.1-flash-live-preview";
const GEMINI_REST   = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Status = "intro_live" | "writing" | "analyzing" | "tcc_mirror" | "transition";

interface TccBlock {
  label: string;   // "Validation", "Prise de distance", "Pivot"
  emoji: string;
  text: string;
}

export interface EcritureExerciseProps {
  patientId: string;
  practitionerId: string;
  firstName: string;
  sosContext?: string;
  onTransitionToChat: (patientText: string, tccBlocks: TccBlock[]) => void;
  onClose: () => void;
}

// ─── System prompt Gemini Live (intro) ────────────────────────────────────────
function buildIntroPrompt(firstName: string, sosContext: string): string {
  return `Tu es le Jumeau Numérique thérapeutique de ${firstName}. Tu vas prononcer UNE SEULE prise de parole, courte et enveloppante, pour ouvrir un espace d'écriture libre.

CONTEXTE : ${sosContext || "Le patient a besoin de déposer ses pensées."}

TON MESSAGE (réciter tel quel, adapté au contexte) :
Commence par accueillir ${firstName} par son prénom avec une voix douce et lente.
Explique que ce qu'il va écrire reste strictement entre lui et toi.
Invite-le à poser ses mains sur le clavier et à déposer tout ce qui lui pèse, sans filtre, sans jugement sur la qualité des phrases.
Conclus par une invitation au lâcher-prise.

RÈGLES ABSOLUES :
1. Une seule prise de parole — tu ne parleras plus après.
2. 3 à 4 phrases maximum. Voix lente, douce, rassurante.
3. Parle en français uniquement.
4. Après cette phrase, tu te tais. Le silence sera le cadre.
5. Réponse AUDIO uniquement — aucun texte visible.`;
}

// ─── Prompt TCC (REST) ────────────────────────────────────────────────────────
function buildTccPrompt(firstName: string, text: string): string {
  return `Tu es un thérapeute spécialisé en TCC (Thérapie Cognitive et Comportementale) et en troubles du comportement alimentaire.

${firstName} vient de faire un exercice de catharsis textuelle. Voici ce qu'il/elle a écrit :

---
${text}
---

Génère une réponse structurée en exactement 3 parties. Réponds UNIQUEMENT en JSON avec ce format :
{
  "validation": "...",
  "distance": "...",
  "pivot": "..."
}

Règles pour chaque partie :
- "validation" : Nomme et légitime l'émotion principale de manière chaleureuse et non-jugeante. 2-3 phrases. Cite des éléments concrets du texte sans les recopier mot pour mot.
- "distance" : Identifie la distorsion cognitive ou le schéma TCA sous-jacent. Propose une reformulation bienveillante qui crée de la distance avec la pensée automatique. 2-3 phrases.
- "pivot" : Propose UNE seule action concrète, petite et immédiate, déconnectée de la nourriture. Pose une question ouverte sur ce qui ferait du bien maintenant. 2-3 phrases.

Ton = thérapeute bienveillant, chaleureux, jamais condescendant. Tutoie ${firstName}.`;
}

// ─── Waveform animée (intro + analyse) ───────────────────────────────────────
function WaveBar({ active, color }: { active: boolean; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 28 }}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            background: color,
            opacity: active ? 0.7 : 0.2,
            height: active ? undefined : 6,
            animation: active ? `wave-bar 1.1s ease-in-out infinite` : "none",
            animationDelay: `${i * 0.13}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── TCC block card ───────────────────────────────────────────────────────────
function TccCard({ block, delay }: { block: TccBlock; delay: number }) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1.5px solid ${ACCENT_BORDER}`,
        borderRadius: 18,
        padding: "20px 22px",
        animation: `fadeUp 0.5s ease both`,
        animationDelay: `${delay}ms`,
        boxShadow: `0 2px 16px rgba(139,111,78,0.08)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 20 }}>{block.emoji}</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.2,
            color: ACCENT,
            textTransform: "uppercase",
          }}
        >
          {block.label}
        </span>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.75,
          color: TEXT_INK,
        }}
      >
        {block.text}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EcritureExercise({
  patientId,
  practitionerId,
  firstName,
  sosContext = "",
  onTransitionToChat,
  onClose,
}: EcritureExerciseProps) {
  const [status, setStatus] = useState<Status>("intro_live");
  const [waveActive, setWaveActive] = useState(true);

  // Writing state
  const [rawText, setRawText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // TCC result
  const [tccBlocks, setTccBlocks] = useState<TccBlock[]>([]);
  const [tccError, setTccError] = useState(false);

  // Speech recognition
  const [hasSpeechAPI, setHasSpeechAPI] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Gemini Live WS
  const wsRef        = useRef<WebSocket | null>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const audioQueue   = useRef<ArrayBuffer[]>([]);
  const isPlaying    = useRef(false);

  // Stale-closure safe ref for transition callback
  const onTransitionRef = useRef(onTransitionToChat);
  useEffect(() => { onTransitionRef.current = onTransitionToChat; }, [onTransitionToChat]);

  // ─── Detect Speech API ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setHasSpeechAPI(!!SpeechRec);
  }, []);

  // ─── Audio queue for Gemini Live output ───────────────────────────────────
  const playNext = useCallback(async () => {
    if (isPlaying.current || audioQueue.current.length === 0) return;
    isPlaying.current = true;
    const chunk = audioQueue.current.shift()!;

    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const ctx = audioCtxRef.current;
      const pcm = new Int16Array(chunk);
      const float32 = new Float32Array(pcm.length);
      for (let i = 0; i < pcm.length; i++) float32[i] = pcm[i] / 32768;

      const buf = ctx.createBuffer(1, float32.length, 24000);
      buf.copyToChannel(float32, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => {
        isPlaying.current = false;
        playNext();
      };
      src.start();
    } catch {
      isPlaying.current = false;
      playNext();
    }
  }, []);

  const enqueueAudio = useCallback((b64: string) => {
    const bin = atob(b64);
    const buf = new ArrayBuffer(bin.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
    audioQueue.current.push(buf);
    playNext();
  }, [playNext]);

  // ─── Close WS cleanly ─────────────────────────────────────────────────────
  const closeWs = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;
  }, []);

  // ─── Transition to writing after intro ────────────────────────────────────
  const goToWriting = useCallback(() => {
    closeWs();
    setWaveActive(false);
    setTimeout(() => {
      setStatus("writing");
      setTimeout(() => textareaRef.current?.focus(), 200);
    }, 400);
  }, [closeWs]);

  // ─── Open Gemini Live WebSocket (intro only) ──────────────────────────────
  useEffect(() => {
    if (status !== "intro_live") return;

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) { goToWriting(); return; }

    const ws = new WebSocket(`${GEMINI_WS_URL}?key=${apiKey}`);
    wsRef.current = ws;
    setWaveActive(true);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        config: {
          model: GEMINI_MODEL,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: getSelectedGeminiVoice() } },
            },
          },
          systemInstruction: {
            parts: [{ text: buildIntroPrompt(firstName, sosContext) }],
          },
        },
      }));
    };

    ws.onmessage = (evt) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(evt.data as string); } catch { return; }

      // Audio chunks
      const sc = (msg.serverContent as Record<string, unknown> | undefined);
      if (sc) {
        const parts = (sc.modelTurn as { parts?: { inlineData?: { data?: string } }[] } | undefined)?.parts ?? [];
        for (const p of parts) {
          if (p.inlineData?.data) enqueueAudio(p.inlineData.data);
        }
        // Turn complete → fermeture propre + bascule writing
        if (sc.turnComplete === true) {
          // Let audio drain before switching
          const drainCheck = setInterval(() => {
            if (!isPlaying.current && audioQueue.current.length === 0) {
              clearInterval(drainCheck);
              goToWriting();
            }
          }, 200);
          // Safety fallback: force switch after 8s anyway
          setTimeout(() => { clearInterval(drainCheck); goToWriting(); }, 8000);
        }
      }

      // setupComplete → trigger intro speech
      if (msg.setupComplete !== undefined) {
        ws.send(JSON.stringify({ realtimeInput: { text: "Commence l'introduction maintenant." } }));
      }
    };

    ws.onerror = () => goToWriting();
    ws.onclose = () => {};

    return () => { ws.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Full cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      closeWs();
      recognitionRef.current?.stop();
      audioCtxRef.current?.close().catch(() => {});
    };
  }, [closeWs]);

  // ─── Paragraphs for blur effect ───────────────────────────────────────────
  // Split by newline. Last paragraph = current (no blur). All previous = blurred.
  const paragraphs = rawText.split("\n");
  const lastIdx    = paragraphs.length - 1;

  // ─── Dictation (Web Speech API) ───────────────────────────────────────────
  const toggleDictation = useCallback(() => {
    if (!hasSpeechAPI) return;

    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SpeechRec() as any;
    rec.lang = "fr-FR";
    rec.continuous = true;
    rec.interimResults = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(e.results as any[])
        .slice(e.resultIndex as number)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript as string)
        .join(" ");
      setRawText((prev) => prev + (prev.endsWith("\n") || prev === "" ? "" : " ") + transcript);
    };

    rec.onerror = () => setIsDictating(false);
    rec.onend   = () => setIsDictating(false);

    rec.start();
    recognitionRef.current = rec;
    setIsDictating(true);
  }, [hasSpeechAPI, isDictating]);

  // ─── Analyze text (REST HTTP → Gemini Flash) ──────────────────────────────
  const analyzeText = useCallback(async () => {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    setStatus("analyzing");

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      const res = await fetch(`${GEMINI_REST}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildTccPrompt(firstName, trimmed) }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
          },
        }),
      });

      if (!res.ok) throw new Error("API error");

      const data = await res.json() as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };

      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      let parsed: { validation?: string; distance?: string; pivot?: string } = {};
      try {
        // Strip markdown code fences if present
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
        parsed = JSON.parse(cleaned) as typeof parsed;
      } catch {
        throw new Error("parse_error");
      }

      const blocks: TccBlock[] = [
        {
          label: "Validation",
          emoji: "🫶",
          text: parsed.validation ?? "Je lis beaucoup dans ces mots. Ce que tu ressens est réel et légitime.",
        },
        {
          label: "Prise de distance",
          emoji: "🔍",
          text: parsed.distance ?? "Cette pensée est une réaction de ton système d'alarme, pas la réalité.",
        },
        {
          label: "Pivot",
          emoji: "✨",
          text: parsed.pivot ?? "Tu as fait quelque chose de courageux. Qu'est-ce qui te ferait du bien là, maintenant ?",
        },
      ];

      setTccBlocks(blocks);
      setStatus("tcc_mirror");
    } catch {
      setTccError(true);
      // Fallback blocks on error
      setTccBlocks([
        { label: "Validation", emoji: "🫶", text: "Tu viens de faire quelque chose de courageux : mettre des mots sur ce qui te pèse. Ça compte vraiment." },
        { label: "Prise de distance", emoji: "🔍", text: "Ce que tu as écrit, c'est le reflet d'une tempête intérieure — pas la réalité permanente. Les pensées passent." },
        { label: "Pivot", emoji: "✨", text: "Ta seule mission maintenant : t'accorder 10 minutes sans écran. Qu'est-ce qui te ferait du bien là, tout de suite ?" },
      ]);
      setStatus("tcc_mirror");
    }
  }, [rawText, firstName]);

  // ─── Transition → inject in chat ──────────────────────────────────────────
  const handleTransition = useCallback(() => {
    setStatus("transition");
    onTransitionRef.current(rawText.trim(), tccBlocks);
  }, [rawText, tccBlocks]);

  // ─── Simulate intro (dev bypass) ──────────────────────────────────────────
  // Uncomment to skip WS in local dev:
  // useEffect(() => { setTimeout(goToWriting, 1500); }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: BG_PAPER,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflowY: "auto",
      }}
    >
      {/* ── Keyframes ──────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wave-bar {
          0%, 100% { height: 6px;  }
          50%       { height: 24px; }
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* ── Close button ───────────────────────────────────────────────────── */}
      {status !== "transition" && (
        <button
          onClick={() => { closeWs(); recognitionRef.current?.stop(); onClose(); }}
          aria-label="Fermer"
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: ACCENT_LIGHT,
            border: `1px solid ${ACCENT_BORDER}`,
            color: ACCENT,
            fontSize: 20,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          ×
        </button>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          INTRO_LIVE — écran épuré + waveform
      ════════════════════════════════════════════════════════════════════════ */}
      {status === "intro_live" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 32,
            padding: "40px 24px",
            animation: "fadeIn 0.6s ease",
          }}
        >
          {/* Curseur clignotant symbolique */}
          <div
            style={{
              width: 2,
              height: 44,
              background: ACCENT,
              borderRadius: 2,
              animation: "cursor-blink 1.2s ease-in-out infinite",
              opacity: 0.6,
            }}
          />

          <p
            style={{
              margin: 0,
              fontSize: 15,
              color: TEXT_MUTED,
              letterSpacing: 0.4,
              textAlign: "center",
            }}
          >
            Ton Jumeau prend la parole…
          </p>

          {/* Waveform */}
          <WaveBar active={waveActive} color={WAVE_COLOR} />

          {/* Bouton bypass (dev / fallback) */}
          <button
            onClick={goToWriting}
            style={{
              marginTop: 24,
              padding: "10px 24px",
              borderRadius: 12,
              background: "transparent",
              border: `1.5px solid ${ACCENT_BORDER}`,
              color: TEXT_MUTED,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Passer l'intro →
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          WRITING — textarea + flou rétroactif
      ════════════════════════════════════════════════════════════════════════ */}
      {status === "writing" && (
        <div
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 680,
            display: "flex",
            flexDirection: "column",
            padding: "60px 28px 24px",
            animation: "fadeIn 0.5s ease",
          }}
        >
          {/* ── Paragraphs avec flou rétroactif ──────────────────────────── */}
          <div
            style={{
              flex: 1,
              position: "relative",
              minHeight: 200,
            }}
          >
            {/* Rendu visuel des paragraphes floutés */}
            {paragraphs.length > 1 && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              >
                {paragraphs.slice(0, lastIdx).map((para, i) => {
                  // Plus le paragraphe est ancien, plus il est flouté
                  const age      = lastIdx - i;            // 1 = juste avant le courant
                  const maxAge   = Math.min(age, 5);       // cap à 5 niveaux
                  const opacity  = Math.max(0.08, 0.3 - (maxAge - 1) * 0.04);
                  const blur     = Math.min(4, 1.5 + (age - 1) * 0.5);

                  return (
                    <p
                      key={i}
                      style={{
                        margin: "0 0 8px",
                        fontSize: 18,
                        lineHeight: 1.85,
                        fontFamily: "'Georgia', serif",
                        color: TEXT_INK,
                        opacity,
                        filter: `blur(${blur}px)`,
                        transition: "opacity 0.8s ease, filter 0.8s ease",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {para || " "}
                    </p>
                  );
                })}
              </div>
            )}

            {/* Textarea transparent superposé */}
            <textarea
              ref={textareaRef}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`${firstName}, dépose ici tout ce qui tourne en boucle…`}
              autoFocus
              spellCheck={false}
              style={{
                position: "relative",
                zIndex: 1,
                width: "100%",
                minHeight: "60vh",
                background: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: 18,
                lineHeight: 1.85,
                fontFamily: "'Georgia', serif",
                color: TEXT_INK,
                caretColor: ACCENT,
                // Texte courant visible, le reste masqué par l'overlay flouté
                // On affiche uniquement le dernier paragraphe en clair
                // Le textarea affiche TOUT, mais les para précédents sont
                // visuellement écrasés par l'overlay qui est au-dessus (pointerEvents: none)
                // Trick : on colore toutes les lignes en transparent sauf la dernière
                // → Impossible en textarea natif : on montre le tout mais l'overlay masque le passé
                paddingTop: paragraphs.length > 1
                  ? `${(paragraphs.length - 1) * 1.85 * 18 + (paragraphs.length - 1) * 8}px`
                  : 0,
              }}
            />
          </div>

          {/* ── Barre basse ───────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              paddingTop: 16,
              borderTop: `1px solid ${ACCENT_BORDER}`,
              marginTop: 16,
            }}
          >
            {/* Dictée vocale (si disponible) */}
            {hasSpeechAPI && (
              <button
                onClick={toggleDictation}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 18px",
                  borderRadius: 10,
                  background: isDictating ? ACCENT_LIGHT : "transparent",
                  border: `1.5px solid ${isDictating ? ACCENT : ACCENT_BORDER}`,
                  color: isDictating ? ACCENT : TEXT_MUTED,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                {isDictating ? "Dicter… (tap pour arrêter)" : "Dicter à la voix"}
              </button>
            )}

            {/* CTA principal */}
            <button
              onClick={analyzeText}
              disabled={rawText.trim().length < 10}
              style={{
                padding: "15px 40px",
                borderRadius: 16,
                background: rawText.trim().length >= 10 ? ACCENT : BG_PAPER_DARK,
                border: "none",
                color: rawText.trim().length >= 10 ? "#fff" : TEXT_FADED,
                fontSize: 16,
                fontWeight: 700,
                cursor: rawText.trim().length >= 10 ? "pointer" : "default",
                transition: "all 0.25s ease",
                letterSpacing: 0.3,
              }}
            >
              J'ai tout sorti
            </button>

            <p style={{ margin: 0, fontSize: 12, color: TEXT_FADED, textAlign: "center" }}>
              Aucun compteur de mots. Écris autant que tu en as besoin.
            </p>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          ANALYZING — loader premium
      ════════════════════════════════════════════════════════════════════════ */}
      {status === "analyzing" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            padding: "40px 24px",
            animation: "fadeIn 0.4s ease",
          }}
        >
          {/* Spinner organique */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              border: `3px solid ${ACCENT_LIGHT}`,
              borderTopColor: ACCENT,
              animation: "spin 1s linear infinite",
            }}
          />
          <p
            style={{
              margin: 0,
              fontSize: 16,
              color: TEXT_MUTED,
              textAlign: "center",
              lineHeight: 1.7,
            }}
          >
            Ton Jumeau lit ce que tu as écrit…
            <br />
            <span style={{ fontSize: 13, color: TEXT_FADED }}>
              Quelques secondes de patience
            </span>
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TCC_MIRROR — 3 blocs structurés
      ════════════════════════════════════════════════════════════════════════ */}
      {status === "tcc_mirror" && (
        <div
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 640,
            display: "flex",
            flexDirection: "column",
            padding: "52px 24px 32px",
            gap: 0,
          }}
        >
          <p
            style={{
              margin: "0 0 28px",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 1.4,
              color: TEXT_MUTED,
              textTransform: "uppercase",
              textAlign: "center",
              animation: "fadeUp 0.4s ease",
            }}
          >
            Ce que ton Jumeau a entendu
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {tccError && (
              <p style={{ textAlign: "center", fontSize: 13, color: TEXT_FADED }}>
                (réponse de secours — connexion limitée)
              </p>
            )}
            {tccBlocks.map((block, i) => (
              <TccCard key={i} block={block} delay={i * 180} />
            ))}
          </div>

          {/* CTA transition → chat */}
          <button
            onClick={handleTransition}
            style={{
              marginTop: 36,
              padding: "15px 40px",
              borderRadius: 16,
              background: ACCENT,
              border: "none",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              animation: "fadeUp 0.5s ease 0.7s both",
              alignSelf: "center",
              letterSpacing: 0.3,
            }}
          >
            Continuer avec mon Jumeau →
          </button>

          <p
            style={{
              marginTop: 14,
              fontSize: 12,
              color: TEXT_FADED,
              textAlign: "center",
              animation: "fadeUp 0.5s ease 0.9s both",
            }}
          >
            Ce que tu as écrit et cette réponse seront ajoutés à ton journal.
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TRANSITION — bref feedback visuel
      ════════════════════════════════════════════════════════════════════════ */}
      {status === "transition" && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            animation: "fadeIn 0.4s ease",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: ACCENT_LIGHT,
              border: `2px solid ${ACCENT_BORDER}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: 16, color: TEXT_MUTED }}>
            Ajouté à ton journal…
          </p>
        </div>
      )}
    </div>
  );
}
