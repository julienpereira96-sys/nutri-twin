"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type QuestionType = "single" | "multiple" | "free";

type Question = {
  id: string;
  block: string;
  label: string;
  sublabel?: string;
  type: QuestionType;
  options?: string[];
  placeholder?: string;
};

const questions: Question[] = [
  { id: "tone_of_voice", block: "Identité & Caractère", label: "Comment doit sonner votre jumeau ?", type: "single", options: ["Le Médical — factuel, précis, sobre, sans émojis", "Le Coach — énergique, motivant, direct", "Le Complice — chaleureux, empathique, humain", "Le Pédagogue — explique, vulgarise, rassure"] },
  { id: "tutoiement", block: "Identité & Caractère", label: "Comment vous adressez-vous à vos patients ?", type: "single", options: ["Vouvoiement strict", "Vouvoiement bienveillant", "Tutoiement naturel", "Je m'adapte selon le patient"] },
  { id: "technicite", block: "Identité & Caractère", label: "Quel niveau de langage utilisez-vous ?", type: "single", options: ["Très vulgarisé — zéro jargon", "Quelques termes techniques expliqués", "Scientifique et précis", "Je m'adapte selon le patient"] },
  { id: "longueur_reponses", block: "Identité & Caractère", label: "Votre style de communication ?", type: "single", options: ["Court et direct — l'essentiel en 2-3 phrases", "Détaillé et complet — j'explique tout", "Adapté à la complexité de la question"] },
  { id: "emojis", block: "Identité & Caractère", label: "Votre jumeau doit-il utiliser des émojis ?", type: "single", options: ["Jamais — je reste professionnel", "Avec modération — un ou deux maximum", "Souvent — ça humanise les échanges"] },
  { id: "approche_generale", block: "Philosophie Nutritionnelle", label: "Quelle est votre philosophie principale ?", type: "single", options: ["Rééquilibrage alimentaire progressif", "Alimentation intuitive", "Micronutrition fonctionnelle", "Protocoles structurés et mesurés"] },
  { id: "pathologies", block: "Philosophie Nutritionnelle", label: "Quel est votre cœur de métier ?", sublabel: "Vous pouvez en sélectionner plusieurs", type: "multiple", options: ["Perte de poids / obésité", "TCA (troubles du comportement alimentaire)", "Diabète / glycémie / métabolisme", "Performance sportive", "Inconfort digestif / FODMAP", "Fatigue / micronutrition", "Femme enceinte / post-partum", "Enfants / adolescents"] },
  { id: "position_regimes", block: "Philosophie Nutritionnelle", label: "Votre avis sur les régimes restrictifs ?", type: "single", options: ["Je les déconseille systématiquement", "Je les étudie cas par cas", "Certains sont utiles dans mon protocole", "Je reste neutre et m'adapte"] },
  { id: "position_glucides", block: "Philosophie Nutritionnelle", label: "Votre position sur les féculents et glucides ?", type: "single", options: ["Indispensables à chaque repas", "À moduler selon l'objectif", "Je les limite en général", "Dépend du patient et du moment"] },
  { id: "jejune", block: "Philosophie Nutritionnelle", label: "Votre approche du jeûne intermittent ?", type: "single", options: ["Je le recommande régulièrement", "Uniquement sur indication précise", "Je préfère éviter", "Je ne me prononce pas"] },
  { id: "complements", block: "Philosophie Nutritionnelle", label: "Votre position sur les compléments alimentaires ?", type: "single", options: ["J'en prescris régulièrement", "Seulement en cas de carence avérée", "Je préfère l'alimentation seule", "Cas par cas selon le bilan"] },
  { id: "petit_dejeuner", block: "Philosophie Nutritionnelle", label: "Votre philosophie sur le petit-déjeuner ?", type: "single", options: ["Indispensable, je l'optimise toujours", "Optionnel selon le patient", "Je ne l'impose jamais"] },
  { id: "lifestyle_budget", block: "Philosophie Nutritionnelle", label: "Votre approche lifestyle et budget ?", type: "single", options: ["Je prône le bio et le local", "Je m'adapte au budget du patient", "Je mise sur le moins transformé possible", "Je ne fais pas de distinction"] },
  { id: "jamais_dire", block: "Philosophie Nutritionnelle", label: "Y a-t-il des pratiques que vous refusez catégoriquement ?", sublabel: "Ex: régimes très hypocaloriques, détox, jeûne prolongé...", type: "free", placeholder: "Décrivez ce que votre jumeau ne doit jamais recommander..." },
  { id: "conviction", block: "Philosophie Nutritionnelle", label: "Quelle est votre règle d'or ?", sublabel: "Votre conviction la plus forte en tant que praticien", type: "free", placeholder: "Ex: Pas d'aliment interdit, Le plaisir avant tout, La régularité prime sur la perfection..." },
  { id: "gestion_ecarts", block: "Gestion Humaine & Émotions", label: "Un patient craque sur une pizza. Vous répondez comment ?", type: "single", options: ["Sans culpabilité, on repart de zéro", "On analyse pourquoi ça s'est passé", "On recadre doucement sur les objectifs", "L'équilibre se fait sur la durée, un écart ne compte pas"] },
  { id: "emotions", block: "Gestion Humaine & Émotions", label: "Un patient mange ses émotions. Votre approche ?", type: "single", options: ["Je travaille uniquement l'alimentation", "J'oriente vers un psy si besoin", "Je travaille les deux en parallèle", "C'est intégré dans mon suivi global"] },
  { id: "non_suivi", block: "Gestion Humaine & Émotions", label: "Un patient ne suit plus votre protocole. Votre réaction ?", type: "single", options: ["Bienveillance totale, on repart sans jugement", "On cherche ensemble pourquoi ça bloque", "Recadrage ferme mais bienveillant", "On remet en question le protocole ensemble"] },
  { id: "fetes_vacances", block: "Gestion Humaine & Émotions", label: "Votre position sur les fêtes et vacances ?", type: "single", options: ["On planifie à l'avance ensemble", "Liberté totale, on reprend après", "L'équilibre se fait sur le mois", "Je donne des guidelines souples"] },
  { id: "motivation_berne", block: "Gestion Humaine & Émotions", label: "Comment remotivez-vous un patient qui décroche ?", type: "single", options: ["Je rappelle ses objectifs initiaux", "Je valorise chaque petit progrès", "Je propose d'ajuster le protocole", "Je lui laisse de l'espace et j'attends son retour"] },
  { id: "posture", block: "Gestion Humaine & Émotions", label: "Comment définiriez-vous votre posture ?", type: "single", options: ["Expert qui guide et prescrit", "Coach qui encourage et challenge", "Partenaire qui co-construit", "Confident bienveillant"] },
  { id: "perimetre", block: "Sécurité & Limites", label: "Jusqu'où peut aller votre jumeau ?", type: "single", options: ["Autonomie totale sur nutrition et lifestyle", "Prudent sur les pathologies, il me redirige", "Questions simples uniquement, il m'alerte pour tout le reste"] },
  { id: "questions_medicales", block: "Sécurité & Limites", label: "Face à une question médicale complexe ?", type: "single", options: ["Il répond selon la littérature scientifique", "Il dit qu'il ne sait pas et m'alerte", "Il propose une piste et attend ma validation", "Il redirige systématiquement vers le médecin"] },
  { id: "urgence_detresse", block: "Sécurité & Limites", label: "Un patient exprime une vraie souffrance psychologique ?", type: "single", options: ["Il exprime de l'empathie et m'alerte immédiatement", "Il oriente vers une ligne d'écoute ou un professionnel", "Il gère avec bienveillance dans les limites de son périmètre"] },
  { id: "ligne_rouge", block: "Sécurité & Limites", label: "Votre ligne rouge absolue ?", sublabel: "Ce que votre jumeau ne doit JAMAIS dire ou faire", type: "free", placeholder: "Ex: Ne jamais culpabiliser, Ne jamais donner de calories précises, Ne jamais parler de médicaments..." },
  { id: "approche_libre", block: "Votre approche en vos mots", label: "Décrivez votre approche en quelques phrases", sublabel: "Parlez librement — comme si vous expliquiez votre méthode à un confrère", type: "free", placeholder: "Ma façon d'accompagner mes patients est..." },
  { id: "situation1", block: "Mises en situation", label: "Il est 22h. Un patient vous écrit :", sublabel: '"J\'ai craqué sur tout le frigo ce soir, je me déteste, je suis nul(le). Je vais jamais y arriver."', type: "free", placeholder: "Votre réponse exacte..." },
  { id: "situation2", block: "Mises en situation", label: "Un patient vous demande :", sublabel: '"Est-ce que je peux faire le régime Dukan ? Ma collègue a perdu 8kg en 1 mois."', type: "free", placeholder: "Votre réponse exacte..." },
  { id: "situation3", block: "Mises en situation", label: "Ça fait 3 semaines qu'un patient ne suit plus votre protocole.", sublabel: "Il ne répond plus à vos messages. Vous lui écrivez quoi ?", type: "free", placeholder: "Votre message de relance..." },
  { id: "situation4", block: "Mises en situation", label: "Un patient vous écrit :", sublabel: '"Mon médecin m\'a dit que j\'ai un prédiabète. Est-ce que je dois arrêter les féculents complètement ?"', type: "free", placeholder: "Votre réponse exacte..." },
  { id: "situation5", block: "Mises en situation", label: "Un patient vous annonce :", sublabel: '"J\'ai perdu 3kg ce mois-ci et je suis tellement fier(e) de moi !"', type: "free", placeholder: "Votre réponse exacte..." },
  { id: "situation6", block: "Mises en situation", label: "Un patient vous confie :", sublabel: '"Je mange mes émotions depuis l\'enfance. C\'est lié à un traumatisme familial."', type: "free", placeholder: "Comment vous gérez ça..." },
];

const BLOCKS = ["Identité & Caractère", "Philosophie Nutritionnelle", "Gestion Humaine & Émotions", "Sécurité & Limites", "Votre approche en vos mots", "Mises en situation", "Vos documents"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [selected, setSelected] = useState<string | string[]>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [practitionerId, setPractitionerId] = useState<string | null>(null);

  // Slots
  const [slot1Done, setSlot1Done] = useState(false);
  const [slot2Done, setSlot2Done] = useState(false);
  const [slot1Label, setSlot1Label] = useState("");
  const [slot2Label, setSlot2Label] = useState("");
  const [slot1Type, setSlot1Type] = useState<"protocole" | "patient" | null>(null);
  const [slot1Text, setSlot1Text] = useState("");
  const [slot1VocalMode, setSlot1VocalMode] = useState(false);
  const [slot2Text, setSlot2Text] = useState("");
  const [slot2VocalMode, setSlot2VocalMode] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState(false);

  // Mémo vocal
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const total = questions.length;
  const isUploadStep = step === total;
  const isFinal = step > total;
  const currentQuestion = questions[step];
  const progress = isFinal ? 100 : isUploadStep ? 95 : Math.round((step / total) * 100);
  const currentBlock = isUploadStep || isFinal ? "" : currentQuestion.block;
  const blockIndex = BLOCKS.indexOf(currentBlock);

  useEffect(() => {
    const handlePopState = () => window.history.pushState(null, "", window.location.pathname);
    window.history.pushState(null, "", window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const canGoNext = () => {
    if (currentQuestion?.type === "multiple") return Array.isArray(selected) && selected.length > 0;
    if (currentQuestion?.type === "free") return typeof selected === "string" && selected.trim().length > 0;
    return typeof selected === "string" && selected.length > 0;
  };

  const goNext = () => {
    if (!canGoNext() || isUploadStep || isFinal) return;
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: selected }));
    setSelected(currentQuestion.type === "multiple" ? [] : "");
    setStep(prev => prev + 1);
  };

  const toggleMultiple = (option: string) => {
    setSelected(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.includes(option) ? arr.filter(x => x !== option) : [...arr, option];
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = () => { setAudioBlob(new Blob(chunks, { type: "audio/mp3" })); stream.getTracks().forEach(t => t.stop()); };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch { alert("Impossible d'accéder au microphone."); }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const uploadToSlot = async (file: File, slot: "slot1" | "slot2", docType: "protocole" | "patient", label: string) => {
    setUploadingSlot(true);
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    const pid = user?.id ?? "";
    setPractitionerId(pid);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("practitionerId", pid);
    formData.append("documentType", docType);
    try {
      const res = await fetch("/api/upload-document", { method: "POST", body: formData });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        if (slot === "slot1") { setSlot1Done(true); setSlot1Label(label); }
        else { setSlot2Done(true); setSlot2Label(label); }
      } else {
        setUploadErrors(prev => [...prev, `${file.name} : ${data.error ?? "Erreur"}`]);
      }
    } catch { setUploadErrors(prev => [...prev, `${file.name} : Erreur réseau`]); }
    setUploadingSlot(false);
  };

  const handleSlotFile = async (e: React.ChangeEvent<HTMLInputElement>, slot: "slot1" | "slot2", docType: "protocole" | "patient") => {
    const file = Array.from(e.target.files ?? [])[0];
    if (!file) return;
    await uploadToSlot(file, slot, docType, `📄 ${file.name}`);
  };

  const saveSlotText = async (slot: "slot1" | "slot2", text: string) => {
    if (!text.trim()) return;
    const blob = new Blob([text], { type: "text/plain" });
    const file = new File([blob], `${slot}_${Date.now()}.txt`, { type: "text/plain" });
    await uploadToSlot(file, slot, "protocole", "✍️ Note indexée");
    if (slot === "slot1") setSlot1Text("");
    else setSlot2Text("");
  };

  const saveSlotAudio = async (slot: "slot1" | "slot2") => {
    if (!audioBlob) return;
    const file = new File([audioBlob], `memo_${slot}_${Date.now()}.mp3`, { type: "audio/mp3" });
    await uploadToSlot(file, slot, "protocole", `🎙️ Mémo vocal (${formatTime(recordingTime)})`);
    setAudioBlob(null);
    if (slot === "slot1") setSlot1VocalMode(false);
    else setSlot2VocalMode(false);
  };

  const saveProfile = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const formattedAnswers = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v]));
      const response = await fetch("/api/save-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: formattedAnswers, userId: user?.id ?? null }) });
      if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error ?? "Erreur lors de la sauvegarde."); }
      router.push("/dashboard");
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Impossible de sauvegarder votre profil.");
    } finally { setIsSaving(false); }
  };

  const filled = (slot1Done ? 1 : 0) + (slot2Done ? 1 : 0);
  const slotScore = filled === 0 ? 70 : filled === 1 ? 85 : 100;
  const slotColor = filled === 0 ? "#f59e0b" : filled === 1 ? "#06b6d4" : "#10b981";
  const slotLabel = filled === 0
    ? "⚠️ Jumeau initialisé — Votre jumeau connaît votre personnalité mais il lui manque encore votre expertise. Partagez votre vision et vos méthodes pour lui donner votre pleine précision."
    : filled === 1
    ? "🔹 Dernière étape : ajoutez un dernier élément pour finaliser votre Jumeau."
    : "✅ Jumeau certifié — Précision maximale atteinte.";
  const btnLabel = filled === 0 ? "Continuer avec un Jumeau à 70% →" : filled === 1 ? "Continuer avec un Jumeau à 85% →" : "Finaliser mon Jumeau à 100% 🌿";
  const btnBg = filled === 0 ? "#71717a" : filled === 1 ? "#06b6d4" : "#10b981";
  const btnGlow = filled === 2 ? "0 0 20px rgba(16,185,129,0.4)" : "none";

  const VocalBlock = ({ slot, vocalMode, setVocalMode }: { slot: "slot1" | "slot2"; vocalMode: boolean; setVocalMode: (v: boolean) => void }) => (
    !vocalMode ? null : !audioBlob ? (
      <div className="flex gap-3 items-center mt-3">
        <button type="button" onClick={isRecording ? stopRecording : startRecording}
          className="rounded-full px-6 py-2.5 text-sm font-semibold transition flex items-center gap-2"
          style={{ background: isRecording ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)", border: isRecording ? "1.5px solid rgba(239,68,68,0.5)" : "1.5px solid rgba(16,185,129,0.5)", color: isRecording ? "#f87171" : "#10b981" }}>
          {isRecording ? <><span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />Arrêter — {formatTime(recordingTime)}</> : <>🎙️ {slot === "slot1" ? "Enregistrer mon mémo" : "Enregistrer mon briefing"}</>}
        </button>
        <button type="button" onClick={() => setVocalMode(false)} className="text-xs text-zinc-500 hover:text-white transition">← Écrire à la place</button>
      </div>
    ) : (
      <div className="flex items-center gap-3 mt-3">
        <p className="text-sm text-emerald-400">✅ Mémo enregistré ({formatTime(recordingTime)})</p>
        <button type="button" onClick={() => void saveSlotAudio(slot)}
          className="rounded-full px-4 py-1.5 text-xs font-semibold text-black transition"
          style={{ background: "#10b981" }}>
          {uploadingSlot ? "Indexation..." : "Ajouter au jumeau"}
        </button>
        <button type="button" onClick={() => setAudioBlob(null)} className="text-xs text-zinc-500 hover:text-red-400">Supprimer</button>
      </div>
    )
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Barre de progression */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-300">Configuration de votre jumeau — {progress}%</p>
            {!isUploadStep && !isFinal && <p className="text-xs text-zinc-500">{step + 1} / {total}</p>}
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#10b981] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          {!isUploadStep && !isFinal && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {BLOCKS.map((block, i) => (
                <span key={block} className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition"
                  style={{ background: i === blockIndex ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)", color: i === blockIndex ? "#10b981" : "#52525b", border: i === blockIndex ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.06)" }}>
                  {block}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Questions */}
        {!isUploadStep && !isFinal && currentQuestion ? (
          <section className="rounded-3xl border border-white/10 bg-[#121212] p-6 sm:p-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#10b981]">{currentQuestion.block}</p>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">{currentQuestion.label}</h1>
            {currentQuestion.sublabel && <p className="mt-2 text-sm italic text-zinc-400">{currentQuestion.sublabel}</p>}

            <div className="mt-8">
              {currentQuestion.type === "single" && (
                <div className="grid gap-3">
                  {currentQuestion.options?.map(option => (
                    <button key={option} type="button" onClick={() => setSelected(option)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left text-[15px] transition ${selected === option ? "border-[#10b981] bg-[#10b981]/15 text-white" : "border-white/10 bg-[#1a1a1a] text-zinc-300 hover:border-[#10b981]/50"}`}>
                      {option}
                    </button>
                  ))}
                </div>
              )}

              {currentQuestion.type === "multiple" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {currentQuestion.options?.map(option => {
                    const arr = Array.isArray(selected) ? selected : [];
                    const isActive = arr.includes(option);
                    return (
                      <button key={option} type="button" onClick={() => toggleMultiple(option)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-[14px] transition ${isActive ? "border-[#10b981] bg-[#10b981]/15 text-white" : "border-white/10 bg-[#1a1a1a] text-zinc-300 hover:border-[#10b981]/50"}`}>
                        <span className="mr-2">{isActive ? "✓" : "+"}</span>{option}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === "free" && (
                <textarea value={typeof selected === "string" ? selected : ""} onChange={e => setSelected(e.target.value)}
                  placeholder={currentQuestion.placeholder} rows={5}
                  className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-4 text-[15px] text-white outline-none transition placeholder:text-zinc-600 focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25" />
              )}
            </div>

            <div className="mt-8 flex items-center justify-between">
              {step > 0 ? (
                <button type="button" onClick={() => { setStep(prev => prev - 1); setSelected(""); }} className="text-sm text-zinc-500 transition hover:text-white">← Retour</button>
              ) : <div />}
              <button type="button" onClick={goNext} disabled={!canGoNext()}
                className="rounded-full bg-[#10b981] px-7 py-3 text-sm font-semibold text-black transition hover:bg-[#0fb174] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300">
                Suivant →
              </button>
            </div>
          </section>

        ) : isUploadStep ? (
          <section className="rounded-3xl border border-white/10 bg-[#121212] p-6 sm:p-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#10b981]">Votre expertise</p>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">Enrichissez votre jumeau avec votre expertise</h1>

            {/* Score */}
            <div className="mt-5 rounded-2xl p-5" style={{ background: `${slotColor}10`, border: `2px solid ${slotColor}40` }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-white">Score de fidélité du jumeau</p>
                <span className="text-lg font-bold" style={{ color: slotColor }}>{slotScore}%</span>
              </div>
              <div className="h-3 w-full rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${slotScore}%`, backgroundColor: slotColor }} />
              </div>
              <p className="mt-3 text-sm" style={{ color: slotColor }}>{slotLabel}</p>
            </div>

            {/* ═══ SLOT 1 ═══ */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-1">
                <p className="text-base font-bold text-white">Slot 1 : Votre Vision</p>
                {slot1Done && <span className="text-xs font-bold text-emerald-400">✅ Rempli</span>}
              </div>
              <p className="text-sm text-zinc-400 mb-5 leading-relaxed">
                Uploadez vos plans alimentaires types, protocoles ou articles. Votre jumeau les intégrera pour répondre avec votre précision.
              </p>

              {slot1Done ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <p className="text-sm text-emerald-400">{slot1Label}</p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-white mb-1">Quel type de document uploadez-vous ?</p>
                  <p className="text-xs text-zinc-500 mb-4">Cela détermine si vos documents seront anonymisés ou non.</p>

                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <label className="rounded-2xl border-2 p-4 text-left transition cursor-pointer hover:border-emerald-500/50"
                      style={{ borderColor: slot1Type === "protocole" ? "#10b981" : "rgba(255,255,255,0.1)", background: slot1Type === "protocole" ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)" }}>
                      <input type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.csv,.mp3,.wav,.m4a"
                        onChange={e => { setSlot1Type("protocole"); void handleSlotFile(e, "slot1", "protocole"); }} className="hidden" />
                      <p className="text-2xl mb-2">📋</p>
                      <p className="text-sm font-bold text-white mb-1">Mes protocoles & méthodes</p>
                      <p className="text-xs text-zinc-500 mb-3">Articles, plans alimentaires types, guides nutritionnels</p>
                      <p className="text-xs font-medium text-emerald-400">✓ Indexé tel quel</p>
                      <p className="mt-2 text-xs text-zinc-600 border border-dashed border-white/10 rounded-xl px-3 py-2 text-center">
                        PDF, DOCX, TXT, JPG, PNG, Excel, CSV, MP3
                      </p>
                    </label>

                    <label className="rounded-2xl border-2 p-4 text-left transition cursor-pointer hover:border-blue-500/50"
                      style={{ borderColor: slot1Type === "patient" ? "#60a5fa" : "rgba(255,255,255,0.1)", background: slot1Type === "patient" ? "rgba(96,165,250,0.08)" : "rgba(255,255,255,0.02)" }}>
                      <input type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.csv,.mp3,.wav,.m4a"
                        onChange={e => { setSlot1Type("patient"); void handleSlotFile(e, "slot1", "patient"); }} className="hidden" />
                      <p className="text-2xl mb-2">🗂️</p>
                      <p className="text-sm font-bold text-white mb-1">Données patients</p>
                      <p className="text-xs text-zinc-500 mb-3">Bilans, comptes-rendus, analyses sanguines</p>
                      <p className="text-xs font-medium text-blue-400">✓ Anonymisé avant indexation</p>
                      <p className="mt-2 text-xs text-zinc-600 border border-dashed border-white/10 rounded-xl px-3 py-2 text-center">
                        PDF, DOCX, TXT, JPG, PNG, Excel, CSV, MP3
                      </p>
                    </label>
                  </div>

                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 mb-5">
                    <p className="text-xs text-emerald-400 leading-relaxed">
                      🔒 <strong>Vos documents sont automatiquement anonymisés par l'IA avant indexation.</strong> Aucune donnée personnelle n'est conservée. Tout est stocké sur des serveurs sécurisés en Europe.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-[#1a1a1a] p-5">
                    <p className="text-sm font-semibold text-white mb-1">Pas de documents encore prêts ou des nuances à apporter ?</p>
                    <p className="text-xs text-zinc-500 mb-4">Décrivez votre vision ou des détails non écrits dans vos protocoles.</p>

                    {!slot1VocalMode ? (
                      <>
                        <textarea value={slot1Text} onChange={e => setSlot1Text(e.target.value)}
                          placeholder="Ma vision de la nutrition est... Je traite mes patients en... Mes méthodes incluent..."
                          rows={4}
                          className="w-full rounded-2xl border border-white/10 bg-[#121212] px-4 py-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#10b981] mb-3" />
                        <div className="flex gap-3">
                          <button type="button" onClick={() => void saveSlotText("slot1", slot1Text)}
                            disabled={!slot1Text.trim() || uploadingSlot}
                            className="rounded-full px-6 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: "#10b981", color: "black" }}>
                            {uploadingSlot ? "Indexation..." : "Sauvegarder →"}
                          </button>
                          <button type="button" onClick={() => setSlot1VocalMode(true)}
                            className="rounded-full px-6 py-2.5 text-sm font-semibold transition"
                            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                            🎙️ Préférer un mémo vocal
                          </button>
                        </div>
                      </>
                    ) : (
                      <VocalBlock slot="slot1" vocalMode={slot1VocalMode} setVocalMode={setSlot1VocalMode} />
                    )}
                  </div>
                  <p className="mt-3 text-xs text-zinc-500 text-center">Un des deux doit être rempli — idéalement les deux pour une précision optimale.</p>
                </>
              )}
            </div>

            <div className="my-8 h-px bg-white/10" />

            {/* ═══ SLOT 2 ═══ */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-base font-bold text-white">Slot 2 : Votre Signature</p>
                {slot2Done && <span className="text-xs font-bold text-emerald-400">✅ Rempli</span>}
              </div>
              <p className="text-sm text-zinc-400 mb-5 leading-relaxed italic">
                L'étape finale pour passer de l'intelligence artificielle à votre intelligence émotionnelle.
              </p>

              {slot2Done ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <p className="text-sm text-emerald-400">{slot2Label}</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-[#1a1a1a] p-5">
                  <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                    Partagez vos métaphores favorites, vos mots pour dédramatiser un écart et vos mantras de motivation. C'est ici que votre Jumeau capture votre intuition et ces nuances qui font votre signature unique.
                  </p>

                  {!slot2VocalMode ? (
                    <>
                      <textarea value={slot2Text} onChange={e => setSlot2Text(e.target.value)}
                        placeholder="Quand un patient craque, je dis toujours... Ma métaphore préférée est... Pour remotiver, j'utilise souvent..."
                        rows={5}
                        className="w-full rounded-2xl border border-white/10 bg-[#121212] px-4 py-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[#10b981] mb-3" />
                      <div className="flex gap-3">
                        <button type="button" onClick={() => void saveSlotText("slot2", slot2Text)}
                          disabled={!slot2Text.trim() || uploadingSlot}
                          className="rounded-full px-6 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: "#10b981", color: "black" }}>
                          {uploadingSlot ? "Indexation..." : "Sauvegarder →"}
                        </button>
                        <button type="button" onClick={() => setSlot2VocalMode(true)}
                          className="rounded-full px-6 py-2.5 text-sm font-semibold transition"
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                          🎙️ Préférer un mémo vocal
                        </button>
                      </div>
                    </>
                  ) : (
                    <VocalBlock slot="slot2" vocalMode={slot2VocalMode} setVocalMode={setSlot2VocalMode} />
                  )}
                </div>
              )}
            </div>

            {uploadErrors.length > 0 && (
              <div className="mt-4 space-y-1">
                {uploadErrors.map((e, i) => <p key={i} className="text-xs text-red-400">❌ {e}</p>)}
              </div>
            )}

            <div className="mt-10 flex items-center justify-between">
              <button type="button" onClick={() => setStep(prev => prev - 1)} className="text-sm text-zinc-500 transition hover:text-white">← Retour</button>
              <button type="button" onClick={() => setStep(prev => prev + 1)}
                className="rounded-full px-7 py-3 text-sm font-semibold transition"
                style={{ background: btnBg, color: "black", boxShadow: btnGlow }}>
                {btnLabel}
              </button>
            </div>
          </section>

        ) : (
          <section className="rounded-3xl border border-[#10b981]/30 bg-[#121212] p-6 sm:p-8">
            <p className="mb-2 text-sm font-semibold text-[#10b981]">✅ Configuration terminée</p>
            <h1 className="text-2xl font-bold sm:text-3xl">Votre jumeau vous ressemble. Il est prêt.</h1>
            <p className="mt-3 text-sm text-zinc-400">Vos réponses ont été enregistrées. Votre jumeau est configuré selon votre vision et votre approche.</p>

            <div className="mt-6 flex flex-wrap gap-2">
              {Object.values(answers).flat().slice(0, 15).map((answer, index) => (
                typeof answer === "string" && answer.length < 60 ? (
                  <span key={index} className="rounded-full border border-[#10b981]/40 bg-[#10b981]/15 px-3 py-1 text-xs text-[#34d399]">{answer}</span>
                ) : null
              ))}
            </div>

            {saveError && <p className="mt-5 text-sm text-red-400">{saveError}</p>}

            <div className="mt-8">
              <button type="button" onClick={() => void saveProfile()} disabled={isSaving}
                className="rounded-full bg-[#10b981] px-8 py-3 text-sm font-semibold text-black transition hover:bg-[#0fb174] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300">
                {isSaving ? "Sauvegarde..." : "Accéder à mon espace →"}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
