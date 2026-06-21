"use client";

/**
 * SOSExercise V2 — Refonte complète
 *
 * Flow: loading → intake → ready → tracing → reveal
 *
 * Phase loading  : WS ouvert, Gemini accueille, setup avec outputAudioTranscription
 * Phase intake   : Patient parle, RMS silence detection, inputTranscription capturé
 * Phase tracing  : Gemini muet, tracé lettre par lettre time-driven, TTS respiratoire
 * Phase reveal   : Mot révélé + félicitation, PUIS — dans la même scène, mot
 *                  toujours illuminé, pas de second décor — question de clôture.
 *                  outputAudioTranscription accumulé → un seul write Supabase sur close WS
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTherapeuticVoice } from "@/hooks/useTherapeuticVoice";
import { GeminiLiveClient, toVertexModelPath } from "@/lib/geminiLiveClient";
import ParticleCanvas from "./ParticleCanvas";

// ─── Design tokens ────────────────────────────────────────────────────────────
const TEXT_MUTED   = "rgba(255,255,255,0.38)";
const TEXT_PRIMARY = "rgba(255,255,255,0.88)";

// Per-letter colors (up to 8 letters)
const LETTER_COLORS = [
  "#00e5b4", // emerald
  "#818cf8", // indigo
  "#f472b6", // pink
  "#fbbf24", // amber
  "#38bdf8", // sky
  "#34d399", // green
  "#fb923c", // orange
  "#a78bfa", // violet
];

// ─── Constants ────────────────────────────────────────────────────────────────
const GEMINI_MODEL    = "models/gemini-live-2.5-flash-native-audio";
const INSPIRE_MS      = 4500;
const EXPIRE_MS       = 5500;
const CYCLE_MS        = INSPIRE_MS + EXPIRE_MS; // 10s per letter
const HARD_TIMER_MS   = 6 * 60 * 1000;           // 6 min hard stop
// ─── AudioWorklet — VAD + capture PCM (Blob URL pour éviter les galères Next.js) ──
// Tourne sur le thread audio dédié : RMS, compteurs, streaming — zéro main thread.
// Messages vers le main thread :
//   { type: 'start' }                    → patient commence à parler
//   { type: 'chunk', buffer: ArrayBuffer } → chunk PCM Float32 (zero-copy transfer)
//   { type: 'end' }                      → patient a fini de parler
// Messages DEPUIS le main thread :
//   { type: 'reset' }                       → vide l'état (changement de phase)
//   { type: 'aiSpeaking', value: boolean }  → seuil RMS durci pendant que l'IA parle
//                                              (évite que le retour haut-parleur déclenche
//                                              une fausse parole — voir _RMS_THR_AI)
const MIC_WORKLET_CODE = `
class MicCapture extends AudioWorkletProcessor {
  constructor () {
    super();
    this._buf   = [];          // accumulateur de samples
    this._state = 'silent';    // 'silent' | 'speaking'
    this._spCnt = 0;           // frames consécutifs avec parole
    this._siCnt = 0;           // frames consécutifs de silence (en mode speaking)

    // ── Paramètres (synchro avec le main thread) ─────────────────────────────
    this._FRAME        = 512;   // samples par frame (16kHz → 32ms)
    this._RMS_THR_BASE = 0.018; // seuil parole/respiration — IA silencieuse
    this._RMS_THR_AI   = 0.028; // seuil durci pendant que l'IA parle (anti-écho)
    this._RMS_THR      = this._RMS_THR_BASE;
    this._SP_MIN  = 3;     // frames pour confirmer début de parole
    // 41 frames ≈ 1.3s — volontairement plus tolérant qu'une simple respiration
    // courte : à 800ms (ancienne valeur), une pause naturelle en pleine phrase
    // (le patient qui reprend son souffle en racontant une détresse) était
    // déjà interprétée comme une fin de tour → Gemini répondait à une phrase
    // inachevée, puis se faisait couper quand le patient reprenait la parole
    // (faux barge-in en cascade). Voir échange du 2026-06-21.
    this._SI_MAX  = 41;    // frames pour confirmer fin (~1.3s)

    this.port.onmessage = (e) => {
      if (e.data?.type === 'reset') {
        this._state = 'silent';
        this._spCnt = 0;
        this._siCnt = 0;
        this._buf   = [];
      } else if (e.data?.type === 'aiSpeaking') {
        this._RMS_THR = e.data.value ? this._RMS_THR_AI : this._RMS_THR_BASE;
      }
    };
  }

  static _rms (samples) {
    let s = 0;
    for (let i = 0; i < samples.length; i++) s += samples[i] * samples[i];
    return Math.sqrt(s / samples.length);
  }

  process (inputs) {
    const ch = inputs[0]?.[0];
    if (!ch || ch.length === 0) return true;

    for (let i = 0; i < ch.length; i++) this._buf.push(ch[i]);

    while (this._buf.length >= this._FRAME) {
      const frame   = new Float32Array(this._buf.splice(0, this._FRAME));
      const rms     = MicCapture._rms(frame);
      const isSnd   = rms >= this._RMS_THR;

      if (this._state === 'silent') {
        if (isSnd) {
          this._spCnt++;
          if (this._spCnt >= this._SP_MIN) {
            this._state = 'speaking';
            this._spCnt = 0;
            this._siCnt = 0;
            this.port.postMessage({ type: 'start' });
          }
        } else {
          this._spCnt = 0;
        }

      } else { // speaking
        // Envoyer TOUS les frames (y compris les silences courts au milieu d'une phrase)
        this.port.postMessage({ type: 'chunk', buffer: frame.buffer }, [frame.buffer]);

        if (!isSnd) {
          this._siCnt++;
          if (this._siCnt >= this._SI_MAX) {
            this._state = 'silent';
            this._siCnt = 0;
            this.port.postMessage({ type: 'end' });
          }
        } else {
          this._siCnt = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('mic-capture', MicCapture);
`;

// ─── Phrases d'ancrage — murmurées en fin d'expire, alternées par lettre ──────
// IMPORTANT : reste sur le même canal vocal dédié (useTherapeuticVoice), accolé
// au cue "Expire...". On n'ouvre PAS de tour sur la connexion Gemini principale
// pendant le tracé — risque de chevauchement audio (flushAudio() coupe la file
// Gemini à chaque nouvelle lettre) et de coupure en plein murmure. Voir échange
// du 2026-06-20 : un seul canal, prévisible, zéro aller-retour réseau.
const ANCHOR_PHRASES = [
  "Laisse aller.",
  "Installe le calme.",
  "Tu es en sécurité.",
  "Reste avec ton souffle.",
  "Tout doucement.",
];

// ─── Word bank (4–8 letters, 4 intensity levels) ──────────────────────────────
const WORD_BANK = {
  /** 4 letters — crisis léger (~40s) */
  mild: [
    "DOUX", "PAIX", "BIEN", "FORT", "LIEN", "SOIN", "VRAI", "POSE",
    "SAIN", "BEAU", "CIEL", "REVE",
  ],
  /** 5–6 letters — crisis modérée (~50–60s) */
  moderate: [
    "CALME", "LIBRE", "FORCE", "REPOS", "ANCRE", "DIGNE",
    "APAISE", "SEREIN", "SOLIDE", "LIBERE", "VIVANT", "SOURIS",
  ],
  /** 7–8 letters — crisis sévère (~70–80s) */
  intense: [
    "APAISER", "LIBERER", "SOULAGE", "CALMONS", "RESPIRE", "LIBERTE",
    "SERENITE", "SOLIDITE", "SOULAGER", "APAISONS", "LUMIERE",
  ],
};

const CRISIS_KEYWORDS = [
  "craquer", "étouffer", "etouffer", "mourir", "panique",
  "urgence", "crise", "pleurer", "hurler", "souffre", "peur",
  "effroi", "terreur", "impossible", "plus",
];
const CALM_KEYWORDS = [
  "fatigué", "fatigue", "lasse", "las", "pas bien", "un peu",
  "légèrement", "legèrement",
];

function selectWord(transcript: string): string {
  const lower = transcript.toLowerCase();
  let level: keyof typeof WORD_BANK = "moderate";
  if (CRISIS_KEYWORDS.some(k => lower.includes(k))) level = "intense";
  else if (CALM_KEYWORDS.some(k => lower.includes(k)))  level = "mild";
  const list = WORD_BANK[level];
  return list[Math.floor(Math.random() * list.length)];
}

// ─── Audio helpers ────────────────────────────────────────────────────────────
function float32ToPCM16Base64(f32: Float32Array): string {
  const i16 = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++)
    i16[i] = Math.max(-32768, Math.min(32767, f32[i] * 32768));
  const bytes = new Uint8Array(i16.buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function pcm16Base64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const i16 = new Int16Array(bytes.buffer);
  const f32 = new Float32Array(i16.length);
  for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;
  return f32;
}

// ─── Wave Orb (remplace AiBlob) ──────────────────────────────────────────────
// Couches idle/speaking interpolées en douceur — jamais de saut brutal d'amplitude.
const WAVE_IDLE_LAYERS: [number, number, number, number][] = [
  [3,   1.7, 0,              0.18],
  [2,   1.3, Math.PI * 0.65, 0.11],
  [1.2, 1.0, Math.PI * 1.35, 0.06],
];
const WAVE_SPEAK_LAYERS: [number, number, number, number][] = [
  [13, 2.8, 0,              0.28],
  [8,  2.0, Math.PI * 0.65, 0.16],
  [5,  1.4, Math.PI * 1.35, 0.09],
];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function WaveOrb({
  speaking, firstName, analyser,
}: { speaking: boolean; firstName?: string; analyser?: AnalyserNode | null }) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const speakRef    = useRef(speaking);
  const analyserRef = useRef<AnalyserNode | null | undefined>(analyser);
  speakRef.current    = speaking;
  analyserRef.current = analyser;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const S   = 220;
    c.width   = S * 2; c.height = S * 2;
    const ctx = c.getContext("2d")!;
    let raf: number, t = 0;

    // Lissage : transition idle ↔ speaking (intensité) + énergie audio réelle de
    // Gemini (si un analyser est fourni) — tout est ease, jamais de saut net.
    const intensity = { current: 0 };
    const energy    = { current: 0 };
    const freqBuf   = new Uint8Array(128); // fftSize 256 côté analyser → 128 bins

    const draw = () => {
      raf = requestAnimationFrame(draw);
      t  += 0.016;
      ctx.clearRect(0, 0, S * 2, S * 2);
      ctx.save();
      ctx.beginPath();
      ctx.arc(S, S, S - 1, 0, Math.PI * 2);
      ctx.clip();

      // Fond uniforme sombre — pas de dégradé décentré qui crée un "cercle intérieur"
      ctx.fillStyle = "rgb(8,14,40)";
      ctx.fillRect(0, 0, S * 2, S * 2);
      // Lueur centrale subtile et CENTRÉE
      const bg = ctx.createRadialGradient(S, S, 0, S, S, S * 0.8);
      bg.addColorStop(0,   "rgba(6,182,212,0.07)");
      bg.addColorStop(1,   "rgba(6,182,212,0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, S * 2, S * 2);

      // ── Lissage de l'intensité idle ↔ speaking (ease, pas de saut) ────────────
      const spk = speakRef.current;
      intensity.current += ((spk ? 1 : 0) - intensity.current) * 0.08;

      // ── Énergie réelle de la voix de Gemini (analyser branché sur sa sortie) ──
      // Plancher idle à 0.32 : jamais totalement figé au repos (pulsation douce,
      // effet "assistant en veille"), et suit le volume réel dès que l'IA parle.
      let rawEnergy = 0.32;
      const an = analyserRef.current;
      if (spk) {
        if (an) {
          an.getByteFrequencyData(freqBuf);
          let sum = 0;
          for (let i = 0; i < freqBuf.length; i++) sum += freqBuf[i];
          rawEnergy = (sum / freqBuf.length) / 255; // 0..1, suit le volume réel
        } else {
          rawEnergy = 0.55; // pas d'analyser dispo → amplitude "parlante" générique
        }
      }
      energy.current += (rawEnergy - energy.current) * 0.16;

      // Couches de vagues remplies — interpolées entre idle et speaking
      // (l'énergie réelle est appliquée directement dans la formule de l'onde,
      // pas ici, pour ne jamais la compter deux fois)
      const k = intensity.current;
      const layers = WAVE_IDLE_LAYERS.map((idle, i) => {
        const spkL = WAVE_SPEAK_LAYERS[i];
        return [
          lerp(idle[0], spkL[0], k),
          lerp(idle[1], spkL[1], k),
          idle[2], // phaseOff identique idle/speak
          lerp(idle[3], spkL[3], k),
        ] as [number, number, number, number];
      });

      const yBase = S * 1.12;

      for (const [amp, freq, phaseOff, alpha] of layers) {
        ctx.beginPath();
        for (let x = 0; x <= S * 2; x += 3) {
          // Onde STATIONNAIRE (effet "studio d'enregistrement Jarvis") :
          // - enveloppe de position : fixe les bords gauche/droite à zéro, jamais
          //   de mélange x/t dans le même sinus (sinon ça redevient une onde
          //   progressive qui défile).
          // - oscillation temporelle pure : la ligne oscille SUR PLACE.
          // - l'énergie lissée module l'amplitude du produit des deux → l'onde
          //   "monte" avec la voix sans jamais se mettre à voyager latéralement.
          const envelope    = Math.sin((Math.PI * x) / (S * 2));
          const oscillation = Math.sin(t * freq * 4 + phaseOff);
          const y = yBase - amp * energy.current * envelope * oscillation;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(S * 2, S * 2);
        ctx.lineTo(0, S * 2);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, yBase - amp, 0, S * 2);
        grad.addColorStop(0, `rgba(6,182,212,${alpha})`);
        grad.addColorStop(1, `rgba(6,182,212,0.01)`);
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.restore();
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []); // lancé une seule fois

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div style={{ position: "relative" }}>
        <div style={{
          position: "absolute", inset: -32,
          background: "radial-gradient(circle, rgba(6,182,212,0.11) 0%, transparent 68%)",
          borderRadius: "50%", pointerEvents: "none",
        }} />
        <canvas
          ref={canvasRef}
          style={{
            width: 220, height: 220,
            borderRadius: "50%",
            border: "1px solid rgba(6,182,212,0.18)",
            boxShadow: speaking
              ? "0 0 32px rgba(6,182,212,0.22), 0 0 64px rgba(6,182,212,0.08)"
              : "0 0 14px rgba(6,182,212,0.08)",
            display: "block",
            transition: "box-shadow 0.6s ease",
          }}
        />
      </div>
      <p style={{
        color: TEXT_MUTED, fontSize: 12,
        letterSpacing: "0.16em", fontWeight: 300,
        textTransform: "uppercase",
      }}>
        {firstName}
      </p>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
// "reveal" couvre tout : illumination du mot, félicitation, ET question de
// clôture — une seule scène continue, sans changement de décor ni second blob.
// "safety" : garde-fou critique déclenché pendant l'intake vocal (red_critical) —
// interrompt tout le reste, écran dédié, message de sécurité scripté récité.
type SOSPhase   = "loading" | "intake" | "ready" | "tracing" | "reveal" | "safety";
type BreathPhase = "inspire" | "expire";

export interface SOSExerciseProps {
  patientId:       string;
  practitionerId:  string;
  firstName:       string;
  sosContext?:     string;
  // word : le mot tracé pendant l'exercice. intake : ce que le patient a dit
  // avant de toucher l'écran (figé dans intakeTranscriptRef à l'entrée en
  // phase "ready"). Transmis avec le texte de clôture pour que page.tsx
  // puisse construire la carte "Exercice SOS terminé" avec la vision globale
  // (motif + ressenti final) sans aller-retour serveur — tout est déjà connu
  // côté client au moment de la fermeture.
  onTransitionToChat: (closingText: string, word: string, intake: string) => void;
  // Appelé uniquement si le garde-fou critique se déclenche pendant l'intake
  // vocal (red_critical) — distinct de onTransitionToChat car le texte ici est
  // déjà la réponse de sécurité du serveur, pas ce que le patient a dit ; il ne
  // doit surtout pas repasser par le pipeline isPostExercise (déjà traité côté
  // serveur dans isSosIntakeCheck).
  onCriticalSafety: (safetyText: string) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SOSExercise({
  patientId,
  practitionerId,
  firstName,
  sosContext = "",
  onTransitionToChat,
  onCriticalSafety,
  onClose,
}: SOSExerciseProps) {
  const { speakTherapeutic, cancelSpeech } = useTherapeuticVoice();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [phase,           setPhase]           = useState<SOSPhase>("loading");
  const [loadError,       setLoadError]       = useState<string | null>(null);
  const [wsError,         setWsError]         = useState<string | null>(null);
  const [isAiSpeaking,    setIsAiSpeaking]    = useState(false);
  const [isPatientSpeaking, setIsPatientSpeaking] = useState(false);
  const [breathPhase,      setBreathPhase]      = useState<BreathPhase>("inspire");
  const [inspireStart,     setInspireStart]     = useState<number | null>(null);
  const [currentLetterIdx, setCurrentLetterIdx] = useState(0);
  const [chosenWord,       setChosenWord]       = useState("CALME");
  const [expireStart,      setExpireStart]      = useState<number | null>(null);
  const [litLetters,       setLitLetters]       = useState<boolean[]>([]);
  const [closingMsg,       setClosingMsg]       = useState<string | null>(null);
  const [closingQuestionAsked, setClosingQuestionAsked] = useState(false);
  // Garde-fou critique sur l'intake vocal — texte de sécurité à réciter/afficher
  // si analyzeCrisisWithLLM (ou le pré-filtre mots-clés) détecte du red_critical
  // pendant que le patient parle, en phase "loading" ou "intake".
  const [safetyText,       setSafetyText]       = useState<string | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const phaseRef            = useRef<SOSPhase>("loading");
  const wsRef               = useRef<GeminiLiveClient | null>(null);
  const audioCtxRef         = useRef<AudioContext | null>(null);
  // Branché sur la sortie audio de Gemini (voir playNextChunk) — lit l'énergie
  // réelle de sa voix pour moduler l'amplitude du WaveOrb, pas de valeur fictive.
  const outputAnalyserRef   = useRef<AnalyserNode | null>(null);
  const mediaStreamRef      = useRef<MediaStream | null>(null);
  const workletNodeRef      = useRef<AudioWorkletNode | null>(null);

  // Timers
  const hardTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const breathTimerRef      = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Audio queue
  const audioQueueRef       = useRef<{ data: Float32Array; rate: number }[]>([]);
  const isPlayingRef        = useRef(false);
  const currentSourceRef    = useRef<AudioBufferSourceNode | null>(null);
  const onQueueEmptyRef     = useRef<(() => void) | null>(null);

  // Transcription
  const inputTranscriptRef  = useRef("");
  const outputTranscriptRef = useRef("");
  // Snapshot de inputTranscriptRef figé à l'entrée en phase "ready" (avant que
  // la clôture ne vienne s'ajouter au même accumulateur) — ce que le patient a
  // dit pendant l'intake, distinct de ce qu'il dit en réponse à la question de
  // clôture. Envoyé à /api/sos/log pour donner au praticien la vision globale
  // de l'exercice (ce qui l'a motivé + comment le patient se sent après).
  const intakeTranscriptRef = useRef("");

  // Tracing
  const chosenWordRef       = useRef("CALME");
  const currentLetterIdxRef = useRef(0);
  const letterStartTimeRef  = useRef(0);
  const breathPhaseRef      = useRef<BreathPhase>("inspire");
  // isTracingMutedRef supprimé — Gemini peut parler pendant le tracé

  // Flow control
  const greetingDoneRef        = useRef(false);   // first AI turn complete
  const intakeSignalSentRef    = useRef(false);   // TCC validation signal sent
  const patientHasSpokenRef    = useRef(false);   // patient said something
  const repromptSentRef        = useRef(false);   // gentle re-prompt sent after first silence
  const isAiSpeakingRef        = useRef(false);   // mirrors isAiSpeaking for use in callbacks
  // En phase "intake", le micro reste ouvert en continu (voir gate du
  // Worklet) — donc chaque pause naturelle du patient (silence ≥ seuil VAD)
  // ferme un activityEnd, et Gemini Live génère AUTOMATIQUEMENT une réponse à
  // ce qu'il a entendu jusque-là, indépendamment de nos tours scriptés
  // (accueil / relance 6s / validation TCC). Si le patient reprend sa phrase,
  // le barge-in coupe cette réponse spontanée — et comme le contenu n'a pas
  // vraiment changé entre deux pauses, Gemini tend à revalider la même chose
  // ("c'est tout à fait normal de ressentir cette pression...") à plusieurs
  // reprises. expectingReplyRef ne vaut true que pendant la fenêtre où NOUS
  // avons explicitement invité Gemini à parler — toute audio reçue hors de
  // cette fenêtre (réponse spontanée non sollicitée) est ignorée à la
  // lecture (voir handleWSMessage), sans toucher à la transcription d'entrée
  // ni au garde-fou de crise, qui continuent de fonctionner normalement.
  const expectingReplyRef      = useRef(false);
  // Clôture (intégrée dans la phase "reveal", pas de scène séparée)
  // closingQuestionSentRef : le tour fusionné félicitation+question est RÉELLEMENT
  // parti sur le WS (ouvre le micro) — posé en synchrone au moment de l'envoi,
  // un seul tour, plus de mécanique à deux étages (voir startLetterAt).
  const closingQuestionSentRef      = useRef(false);  // question ouverte déjà envoyée à Gemini
  const closingTurnCountRef         = useRef(0);     // nb de turnComplete depuis l'envoi de la question
  const patientRespondedInTransRef  = useRef(false);  // patient a répondu à la question de clôture
  const transitionPatientTextRef    = useRef("");     // ce que le patient a dit en réponse
  const closingTimerARef            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingTimerBRef            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingFallbackRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bargeInTimerRef             = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChunksRef            = useRef<string[]>([]); // chunks b64 en attente de validation barge-in
  // true entre le moment où activityStart est RÉELLEMENT envoyé à Gemini (parole
  // confirmée, pas un écho) et celui où activityEnd part en retour. Permet de
  // laisser passer la clôture d'un tour déjà ouvert même si la phase a changé
  // entre-temps (ex: barge-in qui force enterReadyPhase() avant que le patient
  // ait fini de parler) — sinon le tour Gemini reste ouvert indéfiniment.
  const activityOpenRef             = useRef(false);
  // Garde-fou critique vocal : tourne pendant l'intake ET la clôture (phase
  // "reveal", une fois la question de clôture envoyée) — toute la partie orale
  // de l'exercice, jamais seulement l'ancien échange écrit (supprimé).
  // checkedIntakeTextRef retient ce qui a déjà été envoyé à /api/chat
  // (isSosIntakeCheck) pour ne renvoyer que le delta à chaque nouvelle
  // vérification (évite de spammer `conversations` avec des messages qui se
  // chevauchent) ; criticalDetectedRef empêche tout double déclenchement une
  // fois le garde-fou critique parti.
  const checkedIntakeTextRef        = useRef("");
  const criticalDetectedRef         = useRef(false);

  // Stable message handler ref (avoids stale closure on WS onmessage)
  const handleWSMessageRef  = useRef<((evt: { data: string }) => void) | null>(null);

  // Keep refs in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { breathPhaseRef.current = breathPhase; }, [breathPhase]);
  useEffect(() => {
    isAiSpeakingRef.current = isAiSpeaking;
    // Durcit dynamiquement le seuil RMS du Worklet pendant que l'IA parle :
    // évite que le retour haut-parleur (écho) ne soit confondu avec une vraie
    // intention d'interruption du patient (sécurité clinique : le micro reste
    // toujours ouvert, on ne fait que rendre le VAD plus exigeant).
    workletNodeRef.current?.port.postMessage({ type: "aiSpeaking", value: isAiSpeaking });
  }, [isAiSpeaking]);

  // ── Audio queue ─────────────────────────────────────────────────────────────
  const playNextChunk = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsAiSpeaking(false);
      const cb = onQueueEmptyRef.current;
      if (cb) { onQueueEmptyRef.current = null; cb(); }
      return;
    }
    isPlayingRef.current = true;
    setIsAiSpeaking(true);
    const { data, rate } = audioQueueRef.current.shift()!;
    const buf = ctx.createBuffer(1, data.length, rate);
    buf.getChannelData(0).set(data);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    // Passe par l'analyser (si dispo) avant les haut-parleurs — WaveOrb lit
    // l'énergie réelle de cette sortie pour moduler son amplitude.
    src.connect(outputAnalyserRef.current ?? ctx.destination);
    src.onended = playNextChunk;
    currentSourceRef.current = src;
    src.start(0);
  }, []);

  const enqueueAudio = useCallback((b64: string, sr = 24000) => {
    audioQueueRef.current.push({ data: pcm16Base64ToFloat32(b64), rate: sr });
    if (!isPlayingRef.current) playNextChunk();
  }, [playNextChunk]);

  // `invokePending` : si une interruption patient VALIDÉE (vraie parole, pas écho)
  // coupe l'IA en plein vol, le callback qui attendait la fin naturelle de l'audio
  // (onQueueEmptyRef — ex. enterReadyPhase / sendClosingQuestion) ne doit pas être
  // perdu en silence : on l'exécute immédiatement pour ne jamais bloquer le patient.
  const flushAudio = useCallback((invokePending: boolean = false) => {
    // Stop immédiat du chunk en cours — évite le "son fantôme" après interruption
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch { /* déjà terminé */ }
      currentSourceRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current  = false;
    setIsAiSpeaking(false);

    if (invokePending) {
      const cb = onQueueEmptyRef.current;
      if (cb) {
        onQueueEmptyRef.current = null;
        cb();
      }
    }
  }, []);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    cancelSpeech();
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    outputAnalyserRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    if (hardTimerRef.current) clearTimeout(hardTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    breathTimerRef.current.forEach(clearTimeout);
    breathTimerRef.current = [];
    if (closingTimerARef.current)   { clearTimeout(closingTimerARef.current);   closingTimerARef.current   = null; }
    if (closingTimerBRef.current)   { clearTimeout(closingTimerBRef.current);   closingTimerBRef.current   = null; }
    if (closingFallbackRef.current) { clearTimeout(closingFallbackRef.current); closingFallbackRef.current = null; }
    if (bargeInTimerRef.current)    { clearTimeout(bargeInTimerRef.current);    bargeInTimerRef.current    = null; }
    pendingChunksRef.current = [];
    activityOpenRef.current = false;
    flushAudio();
  }, [cancelSpeech, flushAudio]);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Garde-fou critique sur l'intake vocal ────────────────────────────────────
  // Coupe immédiatement tout ce qui est en cours (Gemini Live, timers, audio) et
  // bascule sur un écran de sécurité dédié, qui récite le texte renvoyé par le
  // serveur via le canal TTS local déterministe — jamais Gemini qui improvise sa
  // propre réponse à une disclosure aussi grave que celle qui vient d'être
  // détectée (idées suicidaires, urgence vitale).
  const handleCriticalSafety = useCallback((text: string) => {
    if (criticalDetectedRef.current) return;
    criticalDetectedRef.current = true;

    if (hardTimerRef.current) clearTimeout(hardTimerRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    breathTimerRef.current.forEach(clearTimeout);
    breathTimerRef.current = [];
    if (closingTimerARef.current)   { clearTimeout(closingTimerARef.current);   closingTimerARef.current   = null; }
    if (closingTimerBRef.current)   { clearTimeout(closingTimerBRef.current);   closingTimerBRef.current   = null; }
    if (closingFallbackRef.current) { clearTimeout(closingFallbackRef.current); closingFallbackRef.current = null; }
    if (bargeInTimerRef.current)    { clearTimeout(bargeInTimerRef.current);    bargeInTimerRef.current    = null; }
    pendingChunksRef.current = [];
    activityOpenRef.current = false;

    // Coupe l'audio Gemini en cours et ferme la connexion — tout le reste passe
    // désormais exclusivement par le canal TTS local.
    flushAudio();
    wsRef.current?.close();
    wsRef.current = null;

    setPhase("safety");
    phaseRef.current = "safety";
    setSafetyText(text);
    speakTherapeutic(text, { skipPrep: true, rate: 0.62, volume: 0.6 });

    // Pas de callback de fin de lecture exposé par useTherapeuticVoice — délai
    // fixe généreux (plancher 9s, ~380ms/mot) pour laisser le message de
    // sécurité être lu et entendu avant de transitionner vers le chat.
    const readDelayMs = Math.max(9000, text.split(/\s+/).length * 380);
    setTimeout(() => {
      void fetch("/api/sos/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          practitionerId,
          closingMessage: text,
          word: null,
          emergencyExit: true,
          // Tout ce que le patient a verbalisé jusqu'au déclenchement — qu'il
          // s'agisse de l'intake pur ou d'intake+clôture si la disclosure est
          // arrivée pendant la phase reveal (inputTranscriptRef n'est jamais
          // remis à zéro en cours d'exercice).
          intakeMessage: inputTranscriptRef.current.trim(),
        }),
      }).catch(() => {});
      onCriticalSafety(text);
      cleanup();
    }, readDelayMs);
  }, [flushAudio, speakTherapeutic, patientId, practitionerId, onCriticalSafety, cleanup]);

  // Vérifie s'il y a du nouveau depuis le dernier check (delta non-vide), mais
  // envoie le texte CUMULÉ complet à /api/chat (isSosIntakeCheck) — jamais le
  // simple delta. Un delta isolé est un fragment de streaming arbitrairement
  // découpé (ex: "besoin de m'aider à attendre"), sans le début de la phrase ;
  // analyzeCrisisWithLLM jugeait donc hors contexte, et si un niveau était
  // détecté, c'est ce fragment incohérent qui finissait sauvegardé. Le texte
  // complet donne un vrai contexte à l'analyse ET, si quelque chose est
  // détecté, une trace écrite lisible plutôt qu'un bout de phrase. Tourne en
  // arrière-plan, sans jamais bloquer ni couper la conversation Gemini Live
  // en cours. Appelé pendant l'intake ET pendant la clôture (handleWSMessage).
  const runVoiceCrisisCheck = useCallback(() => {
    if (criticalDetectedRef.current) return;
    const full = inputTranscriptRef.current.trim();
    const delta = full.slice(checkedIntakeTextRef.current.length).trim();
    if (!delta) return;
    checkedIntakeTextRef.current = full;

    void (async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: full,
            patientId,
            practitionerId,
            isSosIntakeCheck: true,
          }),
        });
        if (!res.ok) return;
        const data = await res.json() as { level?: string; safetyText?: string };
        if (data.level === "red_critical" && data.safetyText) {
          handleCriticalSafety(data.safetyText);
        }
        // "red_behavioral"/"none" : déjà géré côté serveur (statut + alerte praticien
        // en arrière-plan) — rien à changer dans l'exercice en cours.
      } catch { /* silencieux — ne doit jamais perturber l'exercice en cours */ }
    })();
  }, [patientId, practitionerId, handleCriticalSafety]);

  // ── Begin tracing ────────────────────────────────────────────────────────────
  const startLetterAt = useCallback((idx: number, word: string) => {
    if (phaseRef.current !== "tracing") return;
    currentLetterIdxRef.current = idx;
    setCurrentLetterIdx(idx);
    letterStartTimeRef.current = Date.now();

    // Breathing cues via TTS — vider la file Gemini d'abord pour éviter tout chevauchement
    flushAudio();
    setBreathPhase("inspire");
    breathPhaseRef.current = "inspire";
    setInspireStart(Date.now());
    speakTherapeutic("Inspire... deux... trois... quatre...", { skipPrep: true, rate: 0.62, volume: 0.55 });

    const t1 = setTimeout(() => {
      setBreathPhase("expire");
      breathPhaseRef.current = "expire";
      setExpireStart(Date.now());
      // Murmure d'ancrage discret accolé au cue — jamais sur la 1ère lettre (encore
      // en train de se poser) ni sur la dernière (transition directe vers le reveal)
      const isFirst = idx === 0;
      const isLast  = idx + 1 >= word.length;
      const anchor  = (!isFirst && !isLast)
        ? ` ${ANCHOR_PHRASES[(idx - 1) % ANCHOR_PHRASES.length]}`
        : "";
      speakTherapeutic(`Expire... deux... trois... quatre... cinq...${anchor}`, { skipPrep: true, rate: 0.60, volume: 0.55 });
    }, INSPIRE_MS);
    breathTimerRef.current.push(t1);

    const t2 = setTimeout(() => {
      if (phaseRef.current !== "tracing") return;

      if (idx + 1 < word.length) {
        startLetterAt(idx + 1, word);
      } else {
        // All letters done → reveal
        breathTimerRef.current.forEach(clearTimeout);
        breathTimerRef.current = [];
        cancelSpeech();
        setPhase("reveal");
        phaseRef.current = "reveal";
        // Illuminate SVG letters after 600ms
        setTimeout(() => setLitLetters(Array(word.length).fill(true)), 600);

        // Félicitation + question de clôture FUSIONNÉES en un seul tour — le
        // micro s'ouvre dès cet envoi (closingQuestionSentRef posé en
        // synchrone ici, pas après un second tour différé). Plus de pause
        // fixe de 2.6s : "enchaîne directement, sans pause" est porté par le
        // prompt lui-même. Voir handleWSMessage, branche "reveal" pour la
        // suite (relance 5s, fallback 40s sans réponse, fermeture).
        setTimeout(() => {
          if (phaseRef.current !== "reveal") return;
          closingQuestionSentRef.current = true; // micro autorisé dès maintenant
          setClosingQuestionAsked(true);
          wsRef.current?.send(JSON.stringify({
            clientContent: {
              turns: [{
                role: "user",
                parts: [{ text: `[Le tracé silencieux est terminé et le mot "${word}" est entièrement illuminé à l'écran. Formule une intervention unique en deux temps, d'un ton bas, ancré et enveloppant : 1) Valide sobrement la fin de l'effort et la présence du mot. 2) Enchaîne directement, sans pause, avec une unique question ouverte et extrêmement douce pour mesurer son état par rapport au début de la crise. Reste très concis, voix murmurée, et attends sa réponse.]` }],
              }],
              turnComplete: true,
            },
          }));
          // Fallback sécurisé : si jamais aucune réponse n'arrive, fermer après 40s
          closingFallbackRef.current = setTimeout(() => {
            if (phaseRef.current !== "reveal" || patientRespondedInTransRef.current) return;
            const patientText = transitionPatientTextRef.current.trim();
            const text = patientText || "[Le patient n'a pas répondu à la question de clôture]";
            void fetch("/api/sos/log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                patientId,
                practitionerId,
                closingMessage: text,
                word: chosenWordRef.current,
                intakeMessage: intakeTranscriptRef.current,
              }),
            }).catch(() => {});
            onTransitionToChat(text, chosenWordRef.current, intakeTranscriptRef.current);
            cleanup();
          }, 40000);
        }, 1600);
      }
    }, CYCLE_MS);
    breathTimerRef.current.push(t2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelSpeech, flushAudio, speakTherapeutic, firstName, patientId, practitionerId, onTransitionToChat, cleanup]);

  // Phase "ready" — Gemini a fini de parler, patient doit toucher l'écran
  const enterReadyPhase = useCallback(() => {
    // Sélection du mot ici (avant le tap) pour ne pas recalculer au tap
    const word = selectWord(inputTranscriptRef.current);
    chosenWordRef.current = word;
    setChosenWord(word);
    // Figer l'intake ICI, avant que la clôture ne s'ajoute au même accumulateur
    intakeTranscriptRef.current = inputTranscriptRef.current.trim();
    setPhase("ready");
    phaseRef.current = "ready";
  }, []);

  const beginTracing = useCallback(() => {
    // Le mot est déjà sélectionné dans enterReadyPhase
    const word = chosenWordRef.current;
    setLitLetters([]);
    setExpireStart(null);

    setPhase("tracing");
    phaseRef.current = "tracing";

    // Paradoxe du "mute gate" : si le patient parlait encore juste avant le
    // tap (reliquat de phrase en cours d'envoi via activityOpenRef), ce tour
    // reste ouvert côté serveur Gemini si on ne le ferme jamais explicitement
    // — on espérerait alors un "end" du worklet qui n'arrivera peut-être
    // qu'après coup. Fermeture immédiate et sans ambiguïté ici.
    if (activityOpenRef.current) {
      wsRef.current?.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
      activityOpenRef.current = false;
    }

    // Purge le worklet : évite que des chunks accumulés pendant l'intake
    // soient envoyés à Gemini dès le début de la phase transition
    workletNodeRef.current?.port.postMessage({ type: "reset" });
    setInspireStart(null);

    // Gemini reste silencieux pendant le tracé — le TTS local gère les cues
    // (Inspire/Expire à chaque lettre). On ne lui envoie rien pour éviter tout
    // chevauchement audio qui ferait disparaître les instructions de respiration.

    // Délai 800ms avant la première lettre — laisse le patient souffler après le tap
    const t0 = setTimeout(() => startLetterAt(0, word), 800);
    breathTimerRef.current.push(t0);
  }, [startLetterAt]);

  // ── Signal patient silence → Gemini TCC validation ──────────────────────────
  const triggerIntakeTransition = useCallback(() => {
    if (intakeSignalSentRef.current) return;
    if (phaseRef.current !== "intake") return;
    intakeSignalSentRef.current = true;
    expectingReplyRef.current = true; // ce tour est sollicité — laisser jouer sa réponse

    const signal = patientHasSpokenRef.current
      // Patient a parlé → validation empathique intégrée + transition vers l'exercice
      ? `[${firstName} vient de s'exprimer. Applique la validation empathique TCC de manière totalement intégrée et naturelle, sans formulation scolaire visible : reflète l'émotion ou la tension exprimée avec des mots justes, et normalise la réaction de manière sobre. Enchaîne immédiatement sur la proposition de l'exercice : une respiration guidée par un point de lumière qui va tracer un mot à l'écran pour l'aider à calmer sa crise. Il peut appuyer quand il veut sur l'écran pour démarrer l'exercice et se laisser guider. Ne révèle jamais le mot lui-même, tu ne le connais pas encore.]`
      // Patient n'a pas répondu → ne suppose aucune émotion précise, mais le simple
      // fait d'avoir déclenché ce mode SOS est déjà un signal : il en avait besoin.
      // Formulation libre pour Gemini — jamais la même phrase mot pour mot d'une
      // session à l'autre, garde uniquement l'esprit de l'instruction.
      : `[${firstName} n'a pas encore parlé — ne suppose aucune émotion précise, mais pars du principe qu'avoir lancé ce mode était déjà le bon geste, qu'il en avait besoin sur l'instant. Dis-le-lui avec tes propres mots, de manière naturelle et sans structure scolaire visible. Rassure-le : c'est tout à fait bien, aucune réponse n'est attendue. Enchaîne sur la proposition de l'exercice : une respiration guidée par un point de lumière qui va tracer un mot à l'écran. Il peut appuyer quand il veut sur l'écran pour démarrer et se laisser guider. Ne révèle jamais le mot, tu ne le connais pas encore. Pas de question, formulation différente à chaque fois.]`;

    wsRef.current?.send(JSON.stringify({
      clientContent: {
        turns: [{ role: "user", parts: [{ text: signal }] }],
        turnComplete: true,
      },
    }));
  }, [firstName]);

  // ── WS message handler ───────────────────────────────────────────────────────
  const handleWSMessage = useCallback((event: { data: string }) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(event.data) as Record<string, unknown>; }
    catch { return; }

    // ── setupComplete: send greeting ──────────────────────────────────────────
    if (msg.setupComplete !== undefined) {
      wsRef.current?.send(JSON.stringify({
        clientContent: {
          turns: [{
            role: "user",
            parts: [{ text: `[Core SOS activé pour ${firstName}. Commence l'accueil immédiatement. Adopte une posture de thérapeute TCC en position d'écoute active d'urgence. Ta voix doit être posée, feutrée, basse et descendante pour induire le calme par synchronisation. Ton unique objectif ici est de créer un espace de sécurité pour que le patient dépose sa souffrance. Ne propose aucun exercice, ne parle pas de respiration, et ne pose aucune question fermée. Formule une intervention très courte et ouverte, basée sur son profil contextuel si pertinent, qui appelle uniquement à la confidence et lui permet de livrer librement ce qui ne va pas maintenant.]` }],
          }],
          turnComplete: true,
        },
      }));
      return;
    }

    const sc = msg.serverContent as Record<string, unknown> | undefined;
    if (!sc) return;

    // ── Audio chunks ──────────────────────────────────────────────────────────
    const modelTurn = sc.modelTurn as Record<string, unknown> | undefined;
    const parts = modelTurn?.parts as Array<Record<string, unknown>> | undefined;
    // "ready"/"tracing" sont des fenêtres volontairement silencieuses côté Gemini
    // (le patient regarde l'écran "toucher pour commencer", ou écoute les cues de
    // respiration du canal TTS local) — avant le fix activityOpenRef, rien ne
    // pouvait atteindre Gemini pendant ces phases, donc cette garde n'avait
    // jamais lieu d'être. Depuis ce fix, un barge-in confirmé juste avant un
    // enterReadyPhase() forcé peut laisser la suite de l'énoncé du patient partir
    // vers Gemini APRÈS le changement de phase ; sa réponse à ce tour ne doit
    // jamais être jouée — ni audible (orphelin, sans retour visuel de l'orbe sur
    // l'écran "ready"), ni risquer de chevaucher les cues TTS pendant "tracing".
    // "intake" : silencieux par défaut aussi — voir expectingReplyRef plus
    // haut. Seules les réponses aux tours qu'on a explicitement sollicités
    // (accueil, relance 6s, validation TCC) doivent être entendues ; toute
    // réponse spontanée de Gemini à une simple pause de respiration du
    // patient est ignorée ici, sans toucher à inputTranscription ni au
    // garde-fou de crise (qui tournent indépendamment de l'audio joué).
    const isSilentPhase = phaseRef.current === "ready" || phaseRef.current === "tracing"
      || (phaseRef.current === "intake" && !expectingReplyRef.current);
    if (parts && !isSilentPhase) {
      for (const part of parts) {
        const id = part.inlineData as Record<string, unknown> | undefined;
        if (id?.mimeType && typeof id.mimeType === "string" && id.mimeType.startsWith("audio/pcm")) {
          const sr = parseInt((id.mimeType.match(/rate=(\d+)/)?.[1]) ?? "24000", 10);
          enqueueAudio(id.data as string, sr);
        }
      }
    }

    // ── outputAudioTranscription (what Gemini said) ───────────────────────────
    const outTrans = sc.outputAudioTranscription as Record<string, unknown> | undefined;
    if (outTrans?.text && typeof outTrans.text === "string") {
      if (phaseRef.current === "reveal") {
        outputTranscriptRef.current += outTrans.text as string;
      }
    }

    // ── inputTranscription (what patient said) ────────────────────────────────
    const inTrans = sc.inputTranscription as Record<string, unknown> | undefined;
    if (inTrans?.text && typeof inTrans.text === "string") {
      inputTranscriptRef.current += " " + (inTrans.text as string);
      // Seul un contenu RÉELLEMENT transcrit par Gemini prouve que le patient a
      // parlé — pas la simple détection RMS du Worklet (qui peut être un souffle,
      // un raclement de gorge, ou le bruit d'une interruption sans contenu verbal).
      // C'est ce flag qui décide, dans triggerIntakeTransition, entre "valider
      // l'émotion exprimée" et "ne suppose aucune émotion, juste accompagner".
      // Inclut "loading" : le patient peut parler dès le tout début de l'accueil,
      // avant même le premier turnComplete qui bascule la phase sur "intake".
      if (
        (phaseRef.current === "intake" || phaseRef.current === "loading") &&
        inTrans.text.trim().length > 0
      ) {
        patientHasSpokenRef.current = true;
      }
      // Garde-fou critique : vérifie en arrière-plan, à chaque nouveau bout de
      // transcription, qu'aucune disclosure grave ne vient de passer sous le
      // radar — sans jamais bloquer ni couper Gemini Live, qui continue de
      // répondre normalement en parallèle. Couvre toute la partie orale de
      // l'exercice : intake (avant l'exo) ET clôture (phase "reveal", une fois
      // la question de clôture envoyée) — plus seulement l'intake, depuis que
      // l'ancien échange écrit (isPostExercise) a été supprimé côté SOSExercise.
      if (
        inTrans.text.trim().length > 0 &&
        (phaseRef.current === "intake" ||
          phaseRef.current === "loading" ||
          (phaseRef.current === "reveal" && closingQuestionSentRef.current))
      ) {
        runVoiceCrisisCheck();
      }
      // La question de clôture a déjà été posée → le patient vient de répondre,
      // on annule les timers de relance
      if (phaseRef.current === "reveal" && closingQuestionSentRef.current) {
        patientRespondedInTransRef.current = true;
        transitionPatientTextRef.current  += " " + (inTrans.text as string);
        if (closingTimerARef.current) { clearTimeout(closingTimerARef.current); closingTimerARef.current = null; }
        if (closingTimerBRef.current) { clearTimeout(closingTimerBRef.current); closingTimerBRef.current = null; }
      }
    }

    // ── Interrupted by patient ────────────────────────────────────────────────
    // Si ce signal arrive, c'est forcément une interruption déjà validée côté
    // client (on n'envoie de l'audio à Gemini qu'après confirmation anti-écho
    // locale) — on force donc aussi l'exécution du callback en attente.
    if (sc.interrupted === true) flushAudio(true);

    // ── Turn complete ─────────────────────────────────────────────────────────
    if (sc.turnComplete === true) {
      const p = phaseRef.current;
      // Ce tour (sollicité ou spontané) est terminé — on referme la fenêtre
      // d'écoute. Le prochain tour ne sera audible que si on le sollicite à
      // nouveau explicitement (voir expectingReplyRef plus haut).
      expectingReplyRef.current = false;

      if (p === "loading" && !greetingDoneRef.current) {
        // Accueil terminé côté WS — les timers de silence démarreront
        // uniquement quand l'audio aura fini de jouer (useEffect isAiSpeaking)
        greetingDoneRef.current = true;
        setPhase("intake");
        phaseRef.current = "intake";
      } else if (p === "intake" && intakeSignalSentRef.current) {
        // Validation TCC terminée → attendre fin audio, puis écran "ready" (tap patient)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (!isPlayingRef.current) {
          enterReadyPhase();
        } else {
          onQueueEmptyRef.current = enterReadyPhase;
        }
      } else if (p === "reveal" && closingQuestionSentRef.current) {
        // Le tour fusionné félicitation+question de clôture (envoyé depuis
        // startLetterAt) est désormais le SEUL tour Gemini de cette phase —
        // ce turnComplete est donc forcément le sien (turnN === 1), et la
        // suite (relance 5s, fermeture) s'enchaîne normalement ci-dessous.
        closingTurnCountRef.current += 1;
        const turnN = closingTurnCountRef.current;

        if (patientRespondedInTransRef.current) {
          // Le patient a parlé et Gemini vient de lui répondre → fermer
          if (closingFallbackRef.current) { clearTimeout(closingFallbackRef.current); closingFallbackRef.current = null; }
          const patientText = transitionPatientTextRef.current.trim();
          const doClose = () => {
            void fetch("/api/sos/log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                patientId,
                practitionerId,
                closingMessage: patientText,
                word: chosenWordRef.current,
                intakeMessage: intakeTranscriptRef.current,
              }),
            }).catch(() => {});
            onTransitionToChat(patientText, chosenWordRef.current, intakeTranscriptRef.current);
            cleanup();
          };
          if (!isPlayingRef.current) doClose();
          else onQueueEmptyRef.current = doClose;

        } else if (turnN === 1) {
          // Gemini vient de poser la question → démarrer le timer 5s (relance si silence)
          const timerA = setTimeout(() => {
            if (phaseRef.current !== "reveal" || patientRespondedInTransRef.current) return;
            wsRef.current?.send(JSON.stringify({
              clientContent: {
                turns: [{ role: "user", parts: [{ text: "[Le patient n'a pas encore répondu à la question de clôture. Relance-le très doucement, de manière courte, avec un ton bienveillant et sans aucune pression. Formule-la avec tes propres mots. N'utilise pas de cliché comme \"prends ton temps\". Contente-toi d'offrir une présence rassurante. Varie ta formulation.]" }] }],
                turnComplete: true,
              },
            }));
            // Timer 10s après la relance — fermeture si toujours pas de réponse
            const timerB = setTimeout(() => {
              if (phaseRef.current !== "reveal" || patientRespondedInTransRef.current) return;
              if (closingFallbackRef.current) { clearTimeout(closingFallbackRef.current); closingFallbackRef.current = null; }
              setClosingMsg("C'est tout à fait bien. Prends soin de toi.");
              setTimeout(() => {
                if (phaseRef.current !== "reveal") return;
                const text = "[Le patient n'a pas répondu à la question de clôture]";
                void fetch("/api/sos/log", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    patientId,
                    practitionerId,
                    closingMessage: text,
                    word: chosenWordRef.current,
                    intakeMessage: intakeTranscriptRef.current,
                  }),
                }).catch(() => {});
                onTransitionToChat(text, chosenWordRef.current, intakeTranscriptRef.current);
                cleanup();
              }, 4000);
            }, 10000);
            closingTimerBRef.current = timerB;
          }, 5000);
          closingTimerARef.current = timerA;

        }
        // turnN >= 2 et pas de réponse patient → c'était le nudge de Gemini → timer B déjà lancé
      }
    }
  }, [
    enqueueAudio, flushAudio, firstName,
    triggerIntakeTransition, runVoiceCrisisCheck,
    patientId, practitionerId, onTransitionToChat, cleanup,
  ]);

  // Keep handler ref in sync
  useEffect(() => {
    handleWSMessageRef.current = handleWSMessage;
    if (wsRef.current) wsRef.current.onmessage = handleWSMessage;
  }, [handleWSMessage]);

  // ── Silence detection — piloté par isAiSpeaking + isPatientSpeaking ──────────
  //
  // Règle fondamentale : on ne démarre JAMAIS un timer de silence pendant que
  // Gemini parle. turnComplete arrive avant la fin de l'audio → on attend que
  // la file audio soit vide (isAiSpeaking → false) pour commencer à compter.
  //
  // Cas 1 — AI vient de finir de parler en intake
  //   → Si patient n'a pas encore parlé : 6s → relance douce
  //   → Si patient a parlé puis s'est tu (et AI aussi) : 5s → transition TCC
  // Cas 2 — Patient parle → suspendre les timers (ne pas le couper), MAIS ne PAS
  //   en déduire qu'il "a parlé" : un son qui dépasse le seuil RMS du Worklet
  //   (souffle, raclement de gorge, bruit d'une interruption) n'est pas une preuve
  //   de contenu verbal. La preuve réelle vient de la transcription Gemini
  //   (inputTranscription, voir handleWSMessage) — patientHasSpokenRef n'est posé
  //   à true que là-bas, jamais ici.
  //   (guard : ne compter que si AI ne parle pas — évite le feedback micro/haut-parleur)
  useEffect(() => {
    if (phase !== "intake") return;

    // Patient speaking — ne compter que si l'IA ne parle pas (feedback micro)
    if (isPatientSpeaking && !isAiSpeakingRef.current) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      return;
    }

    // AI vient de finir de parler (isAiSpeaking passe de true à false)
    if (!isAiSpeaking) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      if (patientHasSpokenRef.current) {
        // Patient a parlé + silence → 5s → transition TCC
        silenceTimerRef.current = setTimeout(() => {
          if (phaseRef.current === "intake") triggerIntakeTransition();
        }, 5000);
      } else if (!repromptSentRef.current && !intakeSignalSentRef.current) {
        // Patient n'a pas encore parlé → 6s → relance douce
        silenceTimerRef.current = setTimeout(() => {
          if (phaseRef.current !== "intake" || patientHasSpokenRef.current || repromptSentRef.current) return;
          repromptSentRef.current = true;
          expectingReplyRef.current = true; // ce tour est sollicité — laisser jouer sa réponse
          wsRef.current?.send(JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: "[Le patient n'a pas encore répondu. Relance-le très doucement de manière courte et toujours avec un ton bienveillant et sans aucune pression. Formule-la avec tes propres mots. N'utilise pas de cliché comme \"prends ton temps\". Contente-toi d'offrir une présence rassurante et déculpabilisante. Varie impérativement ta formulation.]" }] }],
              turnComplete: true,
            },
          }));
        }, 6000);
      } else if (repromptSentRef.current && !patientHasSpokenRef.current && !intakeSignalSentRef.current) {
        // Re-prompt terminé, toujours pas de réponse → 8s → exercice
        silenceTimerRef.current = setTimeout(() => {
          if (phaseRef.current === "intake") triggerIntakeTransition();
        }, 8000);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAiSpeaking, isPatientSpeaking, phase]);

  // Note : il n'y a plus de timer "reveal → transition" ni d'effet séparé pour
  // poser la question de clôture — tout se passe désormais dans le handler
  // turnComplete (voir handleWSMessage, branche p === "reveal"), pour rester
  // dans une seule et même scène continue, sans changement de décor.

  // ── Init session ─────────────────────────────────────────────────────────────
  const initSession = useCallback(async () => {
    // 1. Build system prompt
    let systemPrompt =
      `Tu es le Jumeau Numérique de ${firstName}. Mode SOS actif. ` +
      `Parle exclusivement en français, voix douce, lente, bienveillante. ` +
      `Restes concis (2-3 phrases max par tour). Approche TCC.`;
    try {
      const res = await fetch("/api/gemini-live/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, practitionerId }),
      });
      if (res.ok) {
        const d = await res.json() as { systemPrompt?: string };
        if (d.systemPrompt) systemPrompt = d.systemPrompt;
      }
    } catch { /* use default */ }

    if (sosContext?.trim()) {
      systemPrompt += `\n\nCONTEXTE DÉCLENCHEUR :\n${sosContext}`;
    }

    // 2. Mic permission
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,   // filtre l'écho des hauts-parleurs → évite que Gemini se coupe lui-même
          noiseSuppression: true,
          autoGainControl: false,   // on gère le gain nous-mêmes via le seuil RMS du worklet
        },
        video: false,
      });
      mediaStreamRef.current = stream;
    } catch {
      setLoadError("Accès au microphone refusé. Active le micro pour cet exercice.");
      return;
    }

    // 3. AudioContext
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;
    const micSrc = audioCtx.createMediaStreamSource(stream);

    // Analyser sur la sortie audio de Gemini (voix du Jumeau) — lu en direct par
    // WaveOrb pour moduler l'amplitude des vagues selon l'énergie réelle de la voix.
    const outAnalyser = audioCtx.createAnalyser();
    outAnalyser.fftSize = 256;
    outAnalyser.connect(audioCtx.destination);
    outputAnalyserRef.current = outAnalyser;

    // ── AudioWorklet — VAD + capture PCM sur thread audio dédié ─────────────
    // Blob URL : évite de servir un fichier statique depuis /public avec Next.js
    const blob    = new Blob([MIC_WORKLET_CODE], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    try {
      await audioCtx.audioWorklet.addModule(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl); // libérer immédiatement après chargement
    }

    const workletNode = new AudioWorkletNode(audioCtx, "mic-capture");
    workletNodeRef.current = workletNode;
    micSrc.connect(workletNode);
    // NE PAS connecter workletNode à destination : évite l'écho micro → hauts-parleurs

    workletNode.port.onmessage = (e: MessageEvent<{ type: string; buffer?: ArrayBuffer }>) => {
      const { type, buffer } = e.data;

      // Piloter l'état "patient parle" depuis le worklet — remplace la boucle analyser FFT
      if (type === "start") setIsPatientSpeaking(true);
      else if (type === "end") setIsPatientSpeaking(false);

      // Gate WS : micro actif dès "loading" (le patient peut parler dès le tout
      // début de l'accueil — Gemini doit pouvoir rebondir sur ce qu'il a dit,
      // pas l'ignorer), pendant tout "intake", et en reveal seulement une fois la
      // question de clôture envoyée (avant ça, on est encore dans la félicitation
      // silencieuse côté patient — pas de scène "transition" séparée désormais).
      const p  = phaseRef.current;
      const ws = wsRef.current;
      // Si un tour Gemini est déjà ouvert (activityStart réellement envoyé pour
      // cette prise de parole), on ne bloque JAMAIS chunk/end même si la phase a
      // changé entre-temps — ex: un barge-in confirmé déclenche enterReadyPhase()
      // (via flushAudio(true) → onQueueEmptyRef) avant que le patient ait fini de
      // parler ; sans ce bypass, le gate ci-dessous aurait avalé le "end" et
      // laissé le tour ouvert indéfiniment côté Gemini. "start" ne peut pas se
      // représenter ici tant que activityOpenRef est vrai (le Worklet reste en
      // état 'speaking' jusqu'au prochain "end").
      if (!activityOpenRef.current) {
        if (p === "ready" || p === "tracing") return;
        if (p === "reveal" && !closingQuestionSentRef.current) return;
      }

      if (type === "start") {
        if (isAiSpeakingRef.current) {
          // Validation anti-écho : l'IA parle → on NE PRÉVIENT PAS le serveur
          // tout de suite. L'écho dure < 150ms, la vraie parole dure > 400ms.
          // Les chunks captés pendant ces 400ms sont bufferisés localement —
          // rien ne part vers Gemini avant d'être sûr qu'il s'agit bien d'une
          // interruption réelle (sinon le serveur coupe l'IA sur un faux positif).
          // Important clinique : on NE COUPE JAMAIS le micro pendant que l'IA
          // parle (le patient doit pouvoir interrompre à tout moment) — on
          // durcit seulement la validation (délai + seuil RMS dynamique côté
          // Worklet) pour ne pas confondre écho et vraie intention. Le seuil RMS
          // durci (_RMS_THR_AI) est désormais la défense principale contre
          // l'écho — ce délai redescend donc de 700ms à 400ms pour ne pas faire
          // attendre inutilement un patient qui interrompt vraiment (ex: pour
          // signaler une urgence), surtout combiné au seuil dynamique.
          pendingChunksRef.current = [];
          bargeInTimerRef.current = setTimeout(() => {
            bargeInTimerRef.current = null;
            // "Barge-in fantôme" : ce timer a été créé 400ms plus tôt, sur la
            // base de la phase d'ALORS. Si un tap (beginTracing) ou une autre
            // transition de phase a eu lieu pendant ce délai, envoyer
            // activityStart maintenant briserait le silence sacré du tracé
            // (ou parasiterait reveal/safety). Liste blanche : on ne laisse
            // passer que si on est encore dans une phase où cette activité a
            // un sens — "ready" inclus volontairement (cas où le patient
            // n'a pas encore tapé, c'est justement ce que activityOpenRef
            // sert à couvrir). On abandonne proprement sinon, sans toucher au WS.
            const p = phaseRef.current;
            if (p !== "loading" && p !== "intake" && p !== "ready") {
              pendingChunksRef.current = [];
              return;
            }
            // 400ms de parole continue sans "end" → interruption confirmée (pas un écho)
            // → on coupe l'IA en cours ET on force le callback en attente
            //   (enterReadyPhase / sendClosingQuestion) à s'exécuter immédiatement,
            //   au lieu de le perdre en silence (sinon le patient reste bloqué).
            if (isAiSpeakingRef.current) flushAudio(true);
            ws?.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
            activityOpenRef.current = true;
            for (const b64 of pendingChunksRef.current) {
              ws?.send(JSON.stringify({
                realtimeInput: { audio: { data: b64, mimeType: "audio/pcm;rate=16000" } },
              }));
            }
            pendingChunksRef.current = [];
          }, 400);
        } else {
          // IA silencieuse → aucune ambiguïté possible, démarrage immédiat
          ws?.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
          activityOpenRef.current = true;
        }

      } else if (type === "chunk" && buffer) {
        // Chunk PCM propre (filtré + validé par le worklet) → encoder
        const b64 = float32ToPCM16Base64(new Float32Array(buffer));
        if (bargeInTimerRef.current) {
          // Validation en cours → on bufferise, rien n'est envoyé à Gemini pour l'instant
          pendingChunksRef.current.push(b64);
        } else {
          ws?.send(JSON.stringify({
            realtimeInput: { audio: { data: b64, mimeType: "audio/pcm;rate=16000" } },
          }));
        }

      } else if (type === "end") {
        if (bargeInTimerRef.current) {
          // Le silence est revenu avant 400ms → c'était un écho, pas de la parole.
          // On annule tout : aucun activityStart n'a été envoyé, donc rien à clôturer.
          clearTimeout(bargeInTimerRef.current);
          bargeInTimerRef.current = null;
          pendingChunksRef.current = [];
        } else {
          activityOpenRef.current = false;
          ws?.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
        }
      }
    };

    // 4. Open WS
    const ws = new GeminiLiveClient();
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        setup: {
          model: toVertexModelPath(GEMINI_MODEL),
          generationConfig: {
            responseModalities: ["AUDIO"],
          },
          // VAD manuel : on gère nous-mêmes activityStart / activityEnd
          // → évite que la respiration ou les sons ambiants déclenchent un tour Gemini
          realtimeInputConfig: {
            automaticActivityDetection: { disabled: true },
          },
          // Transcription fields at setup level (not inside generationConfig)
          outputAudioTranscription: {},
          inputAudioTranscription:  {},
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
        },
      }));
    };

    ws.onmessage = (evt) => handleWSMessageRef.current?.(evt);

    ws.onerror = () => {
      if (phaseRef.current === "loading") {
        setLoadError("Connexion Gemini Live échouée.");
      } else {
        setWsError("Connexion interrompue.");
      }
    };

    ws.onclose = (evt) => {
      const p = phaseRef.current;
      if (p === "loading") {
        setLoadError(`Connexion fermée (${evt.code}). Vérifie ta connexion.`);
      } else if (p !== "reveal" && p !== "safety") {
        // Pas d'erreur pendant reveal : l'exercice est visuellement terminé,
        // le mot est affiché — afficher une bannière gâcherait le moment.
        // Pas d'erreur pendant safety non plus : c'est handleCriticalSafety
        // lui-même qui ferme délibérément le WS — une bannière de déconnexion
        // viendrait parasiter l'écran de sécurité.
        setWsError(`Connexion interrompue (${evt.code}). Tu peux continuer sans la voix.`);
      }
    };

    // Hard timer — 6 min max
    hardTimerRef.current = setTimeout(() => cleanup(), HARD_TIMER_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, practitionerId, firstName, sosContext]);

  // ── Mount ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    void initSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────
  const showOrb    = phase === "loading" || phase === "intake";
  const showReady  = phase === "ready";
  const showTrace  = phase === "tracing";
  const showReveal = phase === "reveal";
  const showSafety = phase === "safety";

  // Référence stable — évite de recréer le tableau à chaque render ce qui
  // réinitialiserait les 300 particules (dépendance [word, letterColors] dans ParticleCanvas)
  const letterColors = useMemo(
    () => LETTER_COLORS.slice(0, chosenWord.length),
    [chosenWord],
  );

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "#060810",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        // Pas d'animation opacity ici — le fond doit couvrir instantanément le chat
        // L'animation est sur le contenu interne uniquement
      }}
    >
      {/* ── ParticleCanvas — toujours monté pendant l'exercice ─────────────────── */}
      <ParticleCanvas
        // Le mot reste affiché (SVG illuminé) pendant tout le reveal, félicitation
        // ET question de clôture incluses — une seule scène continue, jamais coupée.
        word={showTrace || showReveal ? chosenWord : null}
        letterColors={letterColors}
        letterIdx={currentLetterIdx}
        breathPhase={breathPhase}
        expireStart={expireStart}
        inspireStart={inspireStart}
        isReveal={showReveal}
        litLetters={litLetters}
        INSPIRE_MS={INSPIRE_MS}
        EXPIRE_MS={EXPIRE_MS}
      />

      {/* Bouton fermer — toujours visible */}
      <button
        onClick={() => { cleanup(); onClose(); }}
        aria-label="Fermer"
        style={{
          position: "absolute", top: 18, right: 18, zIndex: 20,
          width: 36, height: 36, borderRadius: "50%",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: TEXT_MUTED, fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >×</button>

      {/* Bannière d'erreur WS (déconnexion en cours d'exercice) */}
      {wsError && (
        <div style={{
          position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)",
          zIndex: 20, maxWidth: 300, textAlign: "center",
          background: "rgba(248,113,113,0.10)",
          border: "1px solid rgba(248,113,113,0.28)",
          borderRadius: 12, padding: "10px 16px",
        }}>
          <p style={{ margin: 0, color: "#f87171", fontSize: 13, lineHeight: 1.5 }}>
            {wsError}
          </p>
          <button
            onClick={() => { setWsError(null); void initSession(); }}
            style={{
              marginTop: 8, fontSize: 12,
              background: "none", border: "none",
              color: "#f87171", cursor: "pointer", textDecoration: "underline",
            }}
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {loadError && (
        <div style={{ maxWidth: 320, textAlign: "center", padding: 28 }}>
          <p style={{ color: "#f87171", fontSize: 15, lineHeight: 1.7, marginBottom: 22 }}>
            {loadError}
          </p>
          <button
            onClick={() => { cleanup(); onClose(); }}
            style={{
              padding: "10px 28px", borderRadius: 10,
              background: "rgba(0,229,180,0.08)",
              border: "1px solid rgba(0,229,180,0.20)",
              color: TEXT_PRIMARY, cursor: "pointer", fontSize: 14,
            }}
          >
            Fermer
          </button>
        </div>
      )}

      {/* ══ SAFETY — garde-fou critique, écran dédié, aucun autre élément ═══════ */}
      {showSafety && safetyText && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          textAlign: "center", padding: 32,
          background: "#060810",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(248,113,113,0.10)",
            border: "1px solid rgba(248,113,113,0.30)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 24,
          }}>
            <span style={{ fontSize: 26 }}>🌿</span>
          </div>
          <p style={{
            color: "rgba(255,255,255,0.92)", fontSize: 17, lineHeight: 1.8,
            maxWidth: 360, fontWeight: 400,
            animation: "sos-fade 0.6s ease",
          }}>
            {safetyText}
          </p>
        </div>
      )}

      {/* ══ INTAKE — Wave Orb ═══════════════════════════════════════════════════ */}
      {showOrb && !loadError && (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 36,
          position: "relative", zIndex: 5,
        }}>
          <WaveOrb speaking={isAiSpeaking || isPatientSpeaking} firstName={firstName} analyser={outputAnalyserRef.current} />

          <div style={{ textAlign: "center", minHeight: 24 }}>
            {phase === "intake" && !isAiSpeaking && (
              <p style={{
                color: "#00e5b4",
                fontSize: 14, letterSpacing: "0.05em",
                animation: "sos-fade 0.8s ease",
              }}>
                Je t'écoute…
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══ READY — Tap to start ═════════════════════════════════════════════════ */}
      {showReady && (
        <div
          onClick={beginTracing}
          style={{
            position: "absolute", inset: 0, zIndex: 5,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 48, cursor: "pointer",
            animation: "sos-fade 0.6s ease",
          }}
        >
          <WaveOrb speaking={false} firstName={firstName} analyser={outputAnalyserRef.current} />

          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 20,
          }}>
            {/* Dot pulsant */}
            <div style={{
              width: 18, height: 18,
              borderRadius: "50%",
              background: "#00e5b4",
              boxShadow: "0 0 0 0 rgba(0,229,180,0.5)",
              animation: "sos-dot-pulse 2s ease-in-out infinite",
            }} />
            <p style={{
              color: TEXT_PRIMARY,
              fontSize: 15,
              letterSpacing: "0.07em",
              textAlign: "center",
              fontWeight: 300,
            }}>
              Toucher l'écran pour commencer
            </p>
          </div>
        </div>
      )}

      {/* ══ TRACING — overlays uniquement (ParticleCanvas gère le visuel) ════════ */}
      {showTrace && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 }}>
          {/* Breath label */}
          <div style={{
            position: "absolute", bottom: 56, left: 0, right: 0,
            textAlign: "center",
          }}>
            <p style={{
              fontSize: 20, fontWeight: 300, letterSpacing: "0.20em",
              textTransform: "uppercase",
              // Couleur de la lettre en cours — plus vive à l'inspire, atténuée à l'expire
              color: breathPhase === "inspire"
                ? `${LETTER_COLORS[currentLetterIdx % LETTER_COLORS.length]}dd`
                : `${LETTER_COLORS[currentLetterIdx % LETTER_COLORS.length]}66`,
              transition: "color 0.9s ease",
            }}>
              {breathPhase === "inspire" ? "Inspire" : "Expire"}
            </p>
          </div>

          {/* Barre de progression — keyframe avec key unique pour reset garanti */}
          <div style={{
            position: "absolute", bottom: 32, left: "50%",
            transform: "translateX(-50%)",
            width: 180, height: 2,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 2,
            overflow: "hidden",
          }}>
            <div
              key={`bar-${currentLetterIdx}-${breathPhase}`}
              style={{
                height: "100%",
                background: LETTER_COLORS[currentLetterIdx % LETTER_COLORS.length],
                borderRadius: 2,
                // Inspire : 0 → 100% (poumons qui se remplissent)
                // Expire  : 100 → 0% (poumons qui se vident, particules qui forment la lettre)
                opacity: breathPhase === "inspire" ? 0.62 : 0.80,
                animation: breathPhase === "inspire"
                  ? `bar-fill-fwd ${INSPIRE_MS}ms linear forwards`
                  : `bar-fill-bwd ${EXPIRE_MS}ms linear forwards`,
              }}
            />
          </div>

          {/* Letter counter */}
          <div style={{
            position: "absolute", top: 24, left: 0, right: 0,
            textAlign: "center",
          }}>
            <p style={{ color: TEXT_MUTED, fontSize: 11, letterSpacing: "0.12em" }}>
              Lettre {currentLetterIdx + 1} / {chosenWord.length}
            </p>
          </div>
        </div>
      )}

      {/* ══ REVEAL — une seule scène continue : mot illuminé (SVG géré par
          ParticleCanvas) → félicitation → enchaîné directement sur la question
          de clôture. Pas de second décor, pas de blob qui apparaît. ══ */}
      {showReveal && litLetters.some(Boolean) && (
        <div style={{
          position: "absolute", bottom: 64, left: 0, right: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 14,
          zIndex: 6, pointerEvents: "none",
        }}>
          {!closingQuestionAsked && !closingMsg && (
            <p style={{
              color: TEXT_MUTED, fontSize: 13, letterSpacing: "0.09em",
              animation: "sos-fade 0.5s ease 1.6s both",
            }}>
              Tu l'as tracé toi-même
            </p>
          )}

          {closingQuestionAsked && (
            closingMsg ? (
              <p style={{
                color: "#a0e4c8", fontSize: 15, fontWeight: 500,
                textAlign: "center", maxWidth: 260, lineHeight: 1.75,
                animation: "sos-fade 0.6s ease",
              }}>
                {closingMsg}
              </p>
            ) : (
              <p style={{
                color: TEXT_MUTED, fontSize: 13,
                textAlign: "center", maxWidth: 240, lineHeight: 1.75,
                animation: "sos-fade 0.6s ease",
              }}>
                {isAiSpeaking ? "…" : "Partage en quelques mots comment tu te sens"}
              </p>
            )
          )}
        </div>
      )}

      {/* Keyframes */}
      <style>{`
        @keyframes sos-fade {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sos-pulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.80; }
        }
        @keyframes sos-dot-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(0,229,180,0.55); }
          70%  { box-shadow: 0 0 0 14px rgba(0,229,180,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,229,180,0); }
        }
        /* Barre de progression lettre — forward (expire) et backward (inspire) */
        @keyframes bar-fill-fwd {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes bar-fill-bwd {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
