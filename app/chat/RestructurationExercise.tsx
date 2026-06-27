"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PulseOrb from "./PulseOrb";

// ─── Couleurs ─────────────────────────────────────────────────────────────────
const VIOLET      = "#8b5cf6";
const VIOLET_DIM  = "rgba(139,92,246,0.10)";
const VIOLET_BDR  = "rgba(139,92,246,0.22)";
const BG          = "#07050f";
const TEXT_PRI    = "rgba(255,255,255,0.92)";
const TEXT_SEC    = "rgba(255,255,255,0.45)";
const TEXT_MUT    = "rgba(255,255,255,0.28)";

// ─── OchreWave — réagit à la voix réelle du patient ──────────────────────────
function VioletWave({ active, analyser }: { active: boolean; analyser?: AnalyserNode | null }) {
  const barsRef   = useRef<(HTMLDivElement | null)[]>([]);
  const activeRef = useRef(active);
  const anRef     = useRef<AnalyserNode | null | undefined>(analyser);
  activeRef.current = active;
  anRef.current     = analyser;

  useEffect(() => {
    const buf      = new Uint8Array(32);
    const energies = new Array(8).fill(0.1) as number[];
    let t = 0, raf: number;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      t  += 0.016;
      const isActive = activeRef.current;
      const an       = anRef.current;

      if (isActive && an) {
        an.getByteFrequencyData(buf);
        for (let i = 0; i < 8; i++) {
          let sum = 0;
          for (let j = i * 4; j < i * 4 + 4 && j < buf.length; j++) sum += buf[j];
          const raw = (sum / 4) / 255;
          energies[i] += (raw - energies[i]) * 0.3;
        }
      } else if (isActive) {
        for (let i = 0; i < 8; i++) {
          const target = 0.28 + 0.22 * Math.sin(t * 2.5 + i * 0.75);
          energies[i] += (target - energies[i]) * 0.15;
        }
      } else {
        for (let i = 0; i < 8; i++) energies[i] += (0 - energies[i]) * 0.1;
      }

      for (let i = 0; i < 8; i++) {
        const bar = barsRef.current[i];
        if (!bar) continue;
        bar.style.height  = `${(3 + energies[i] * 30).toFixed(1)}px`;
        bar.style.opacity = (isActive ? 0.15 + energies[i] * 0.75 : Math.max(0, energies[i] * 0.5)).toFixed(3);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, height: 40 }}>
      {[0,1,2,3,4,5,6,7].map(i => (
        <div key={i} ref={el => { barsRef.current[i] = el; }}
          style={{ width: 3.5, borderRadius: 2, background: VIOLET, height: "3px", opacity: 0, willChange: "height, opacity" }}
        />
      ))}
    </div>
  );
}

// ─── Prompt système ───────────────────────────────────────────────────────────
function buildPrompt(firstName: string, sosContext: string) {
  return `Tu es un thérapeute bienveillant qui accompagne ${firstName} dans un exercice de restructuration cognitive. Parle en français, voix calme et chaleureuse, phrases courtes.

${sosContext ? `CONTEXTE : ${sosContext}\n` : ""}
TON SEUL OBJECTIF : aider ${firstName} à arriver lui-même à une pensée plus équilibrée. Ne la formule jamais à sa place.

Commence par lui demander quelle pensée tourne en ce moment. Une fois qu'il l'a formulée, reformule-la pour être sûr d'avoir bien compris sa pensée.

Ensuite tu as plusieurs angles selon ce qui émerge — tu choisis :
— explorer sur quoi il s'appuie pour y croire
— chercher des moments où c'était différent
— lui demander ce qu'il dirait à un ami qui aurait cette pensée

Quand ${firstName} arrive à formuler une pensée plus juste par lui-même, tu l'ancres en la lui faisant répéter, puis tu appelles valider_restructuration avec la pensée originale et la pensée reformulée.

INTERDITS ABSOLUS :
— formuler toi-même la pensée alternative
— contredire directement ("c'est faux", "tu as tort")
— minimiser ("c'est pas grave")
— poser deux questions à la fois
— dépasser 3-4 échanges d'exploration avant de guider vers la reformulation`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface RestructurationExerciseProps {
  patientId:        string;
  practitionerId:   string;
  firstName:        string;
  sosContext?:      string;
  onTransitionToChat: (original: string, reformulated: string, closing: string) => void;
  onClose:          () => void;
}

type Status = "loading" | "active" | "complete";

// ─── Component ────────────────────────────────────────────────────────────────
export default function RestructurationExercise({
  patientId,
  practitionerId,
  firstName,
  sosContext = "",
  onTransitionToChat,
  onClose,
}: RestructurationExerciseProps) {
  const [status,            setStatus]            = useState<Status>("loading");
  const [isAiSpeaking,      setIsAiSpeaking]      = useState(false);
  const [isListening,       setIsListening]       = useState(false);
  const [loadError,         setLoadError]         = useState<string | null>(null);
  const [originalThought,   setOriginalThought]   = useState("");
  const [reformulatedThought, setReformulatedThought] = useState("");

  const statusRef        = useRef<Status>("loading");
  const wsRef            = useRef<WebSocket | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const processorRef     = useRef<ScriptProcessorNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const inputAnalyserRef  = useRef<AnalyserNode | null>(null);
  const audioQueueRef    = useRef<ArrayBuffer[]>([]);
  const isPlayingRef     = useRef(false);
  const turnCompleteRef  = useRef(false);
  const pendingAdvanceRef = useRef<(() => void) | null>(null);
  const patientSpokeRef  = useRef(false);
  const outputTransRef   = useRef("");

  const onTransitionRef  = useRef(onTransitionToChat);
  const onCloseRef       = useRef(onClose);
  useEffect(() => { onTransitionRef.current  = onTransitionToChat; }, [onTransitionToChat]);
  useEffect(() => { onCloseRef.current       = onClose;            }, [onClose]);
  useEffect(() => { statusRef.current        = status;             }, [status]);

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    try { wsRef.current?.close(); }            catch { /* noop */ }
    try { processorRef.current?.disconnect(); } catch { /* noop */ }
    try { audioCtxRef.current?.close(); }      catch { /* noop */ }
    wsRef.current         = null;
    processorRef.current  = null;
    audioCtxRef.current   = null;
    inputAnalyserRef.current  = null;
    outputAnalyserRef.current = null;
    audioQueueRef.current = [];
    isPlayingRef.current  = false;
  }, []);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  // ─── Audio playback ───────────────────────────────────────────────────────
  const playNextChunk = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsAiSpeaking(false);

      if (turnCompleteRef.current && pendingAdvanceRef.current) {
        const advance = pendingAdvanceRef.current;
        pendingAdvanceRef.current  = null;
        turnCompleteRef.current    = false;
        advance();
        return;
      }

      if (statusRef.current === "active") {
        turnCompleteRef.current = false;
        setIsListening(true);
        patientSpokeRef.current = false;
      }
      return;
    }

    isPlayingRef.current = true;
    setIsAiSpeaking(true);
    setIsListening(false);

    const buf    = audioQueueRef.current.shift()!;
    const source = ctx.createBufferSource();

    ctx.decodeAudioData(buf.slice(0), decoded => {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      outputAnalyserRef.current = analyser;
      source.buffer = decoded;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      source.start();
      source.onended = () => playNextChunk();
    }, () => { playNextChunk(); });
  }, []);

  // ─── WS message handler ───────────────────────────────────────────────────
  const handleWSMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      audioQueueRef.current.push(event.data);
      if (!isPlayingRef.current) playNextChunk();
      return;
    }

    let msg: Record<string, unknown>;
    try { msg = JSON.parse(event.data as string) as Record<string, unknown>; }
    catch { return; }

    if (msg.inputTranscription) {
      patientSpokeRef.current = true;
    }

    if (msg.outputTranscription) {
      const part = (msg.outputTranscription as Record<string,unknown>)?.text;
      if (typeof part === "string") outputTransRef.current += part;
    }

    if (msg.turnComplete) {
      turnCompleteRef.current = true;
      if (!isPlayingRef.current && pendingAdvanceRef.current) {
        const advance          = pendingAdvanceRef.current;
        pendingAdvanceRef.current = null;
        turnCompleteRef.current   = false;
        advance();
      }
    }

    if (statusRef.current === "loading" && (msg.serverContent || msg.outputTranscription)) {
      setStatus("active");
      statusRef.current = "active";
    }

    // ── Tool call : valider_restructuration ──────────────────────────────────
    const toolCallMsg = msg.toolCall as { functionCalls?: Array<{ name: string; id: string; args?: Record<string,unknown> }> } | undefined;
    if (toolCallMsg?.functionCalls) {
      for (const fc of toolCallMsg.functionCalls) {
        if (fc.name === "valider_restructuration") {
          const original     = typeof fc.args?.original     === "string" ? fc.args.original     : "";
          const reformulated = typeof fc.args?.reformulated === "string" ? fc.args.reformulated : "";

          wsRef.current?.send(JSON.stringify({
            toolResponse: {
              functionResponses: [{ id: fc.id, response: { output: "ok" } }],
            },
          }));

          if (!original || !reformulated) break;

          pendingAdvanceRef.current = () => {
            setOriginalThought(original);
            setReformulatedThought(reformulated);
            setStatus("complete");
            statusRef.current = "complete";
            setIsListening(false);
          };
        }
      }
      return;
    }
  }, [playNextChunk]);

  // ─── Connect ──────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    try {
      const ctx    = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const micSrc = ctx.createMediaStreamSource(stream);

      const inputAnalyser = ctx.createAnalyser();
      inputAnalyser.fftSize = 256;
      inputAnalyserRef.current = inputAnalyser;
      micSrc.connect(inputAnalyser);

      const proc = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = proc;
      micSrc.connect(proc);
      proc.connect(ctx.destination);

      const tokenRes = await fetch("/api/gemini-live");
      if (!tokenRes.ok) throw new Error("Token error");
      const { token, wsUrl } = await tokenRes.json() as { token: string; wsUrl: string };

      const ws = new WebSocket(`${wsUrl}?token=${token}`);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        const systemPrompt = buildPrompt(firstName, sosContext);
        ws.send(JSON.stringify({
          setup: {
            model: "models/gemini-2.0-flash-live-001",
            generationConfig: { responseModalities: ["AUDIO"] },
            outputAudioTranscription: {},
            inputAudioTranscription:  {},
            systemInstruction: { parts: [{ text: systemPrompt }] },
            tools: [{
              functionDeclarations: [{
                name: "valider_restructuration",
                description: "Appelle cet outil quand le patient a formulé et validé sa propre pensée alternative. Passe la pensée originale et la pensée reformulée par le patient.",
                parameters: {
                  type: "object",
                  properties: {
                    original:     { type: "string", description: "La pensée négative de départ telle que formulée par le patient." },
                    reformulated: { type: "string", description: "La pensée plus équilibrée formulée par le patient lui-même." },
                  },
                  required: ["original", "reformulated"],
                },
              }],
            }],
          },
        }));

        proc.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const raw    = e.inputBuffer.getChannelData(0);
          const int16  = new Int16Array(raw.length);
          for (let i = 0; i < raw.length; i++) int16[i] = Math.max(-32768, Math.min(32767, raw[i] * 32768));
          ws.send(int16.buffer);
        };
      };

      ws.onmessage = handleWSMessage;
      ws.onerror   = () => setLoadError("Connexion Gemini Live échouée.");
      ws.onclose   = (evt) => {
        if (evt.code !== 1000 && statusRef.current !== "complete") {
          setLoadError(`Connexion fermée (${evt.code})`);
        }
      };
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erreur de connexion");
    }
  }, [firstName, sosContext, handleWSMessage]);

  useEffect(() => { void connect(); }, [connect]);

  // ─── Clôture ──────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    if (statusRef.current === "complete") {
      const closing = outputTransRef.current.trim();
      onTransitionRef.current(originalThought, reformulatedThought, closing);
    } else {
      onCloseRef.current();
    }
    cleanup();
  }, [originalThought, reformulatedThought, cleanup]);

  const waveActive = isListening && !isAiSpeaking;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: BG,
      display: "flex", flexDirection: "column",
      fontFamily: "system-ui, sans-serif",
    }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px",
        borderBottom: `1px solid ${VIOLET_BDR}`,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: status === "loading" ? TEXT_MUT : VIOLET,
            boxShadow: status !== "loading" ? `0 0 8px ${VIOLET}` : "none",
            transition: "all 0.4s",
          }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: TEXT_PRI }}>
            Défier une pensée négative
          </span>
        </div>
        <button onClick={handleClose} style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          cursor: "pointer", color: TEXT_SEC, fontSize: 18, lineHeight: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>×</button>
      </div>

      {/* ── Corps ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 20px", gap: 32 }}>
        <AnimatePresence mode="wait">

          {/* Erreur */}
          {loadError && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center" }}>
              <p style={{ color: "#f87171", fontSize: 14, marginBottom: 16 }}>{loadError}</p>
              <button onClick={onClose} style={{ padding: "10px 24px", borderRadius: 10, background: VIOLET_DIM, border: `1px solid ${VIOLET_BDR}`, color: VIOLET, cursor: "pointer", fontSize: 13 }}>Fermer</button>
            </motion.div>
          )}

          {/* Loading */}
          {!loadError && status === "loading" && !isAiSpeaking && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", border: `2px solid ${VIOLET_BDR}`, borderTop: `2px solid ${VIOLET}`, animation: "spin 1s linear infinite" }} />
              <p style={{ fontSize: 14, color: TEXT_SEC, margin: 0 }}>Connexion en cours…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </motion.div>
          )}

          {/* Orb Gemini (loading ou active) */}
          {!loadError && status !== "complete" && isAiSpeaking && (
            <motion.div key="orb-speaking" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
              <PulseOrb speaking={true} analyser={outputAnalyserRef.current} color={VIOLET} size={160} />
            </motion.div>
          )}

          {/* Orb silencieux quand Gemini attend (active) */}
          {!loadError && status === "active" && !isAiSpeaking && (
            <motion.div key="orb-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PulseOrb speaking={false} analyser={null} color={VIOLET} size={160} />
            </motion.div>
          )}

          {/* Écran de fin */}
          {status === "complete" && (
            <motion.div key="complete"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>

              {/* Pensée originale */}
              <div style={{
                width: "100%", padding: "16px 18px", borderRadius: 14,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: TEXT_MUT, letterSpacing: "0.1em", textTransform: "uppercase" }}>Pensée de départ</p>
                <p style={{ margin: 0, fontSize: 15, color: TEXT_SEC, textDecoration: "line-through", textDecorationColor: "rgba(255,255,255,0.2)", lineHeight: 1.5 }}>
                  {originalThought}
                </p>
              </div>

              {/* Flèche */}
              <svg width="20" height="28" viewBox="0 0 20 28" fill="none">
                <path d="M10 0 L10 20 M4 14 L10 22 L16 14" stroke={VIOLET} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>

              {/* Pensée reformulée */}
              <div style={{
                width: "100%", padding: "16px 18px", borderRadius: 14,
                background: VIOLET_DIM,
                border: `1px solid ${VIOLET_BDR}`,
              }}>
                <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 600, color: `${VIOLET}99`, letterSpacing: "0.1em", textTransform: "uppercase" }}>Pensée plus équilibrée</p>
                <p style={{ margin: 0, fontSize: 15, color: TEXT_PRI, lineHeight: 1.5, fontWeight: 500 }}>
                  {reformulatedThought}
                </p>
              </div>

              <button onClick={handleClose} style={{
                marginTop: 8, padding: "12px 32px", borderRadius: 12,
                background: VIOLET_DIM, border: `1px solid ${VIOLET_BDR}`,
                color: VIOLET, fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}>
                Terminer
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Bas — OchreWave + Je t'écoute ── */}
      {status === "active" && (
        <div style={{
          flexShrink: 0, display: "flex", flexDirection: "column",
          alignItems: "center", gap: 8, paddingBottom: 36,
        }}>
          <VioletWave
            active={waveActive}
            analyser={waveActive ? inputAnalyserRef.current : undefined}
          />
          {waveActive && (
            <p style={{ margin: 0, fontSize: 12, color: TEXT_MUT, letterSpacing: "0.05em" }}>
              Je t&apos;écoute
            </p>
          )}
        </div>
      )}
    </div>
  );
}
