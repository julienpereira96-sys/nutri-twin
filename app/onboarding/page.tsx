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

type DocumentType = "protocole" | "patient" | null;

const questions: Question[] = [
  {
    id: "tone_of_voice",
    block: "Identité & Caractère",
    label: "Comment doit sonner votre jumeau ?",
    type: "single",
    options: [
      "Le Médical — factuel, précis, sobre, sans émojis",
      "Le Coach — énergique, motivant, direct",
      "Le Complice — chaleureux, empathique, humain",
      "Le Pédagogue — explique, vulgarise, rassure",
    ],
  },
  {
    id: "tutoiement",
    block: "Identité & Caractère",
    label: "Comment vous adressez-vous à vos patients ?",
    type: "single",
    options: [
      "Vouvoiement strict",
      "Vouvoiement bienveillant",
      "Tutoiement naturel",
      "Je m'adapte selon le patient",
    ],
  },
  {
    id: "technicite",
    block: "Identité & Caractère",
    label: "Quel niveau de langage utilisez-vous ?",
    type: "single",
    options: [
      "Très vulgarisé — zéro jargon",
      "Quelques termes techniques expliqués",
      "Scientifique et précis",
      "Je m'adapte selon le patient",
    ],
  },
  {
    id: "longueur_reponses",
    block: "Identité & Caractère",
    label: "Votre style de communication ?",
    type: "single",
    options: [
      "Court et direct — l'essentiel en 2-3 phrases",
      "Détaillé et complet — j'explique tout",
      "Adapté à la complexité de la question",
    ],
  },
  {
    id: "emojis",
    block: "Identité & Caractère",
    label: "Votre jumeau doit-il utiliser des émojis ?",
    type: "single",
    options: [
      "Jamais — je reste professionnel",
      "Avec modération — un ou deux maximum",
      "Souvent — ça humanise les échanges",
    ],
  },
  {
    id: "approche_generale",
    block: "Philosophie Nutritionnelle",
    label: "Quelle est votre philosophie principale ?",
    type: "single",
    options: [
      "Rééquilibrage alimentaire progressif",
      "Alimentation intuitive",
      "Micronutrition fonctionnelle",
      "Protocoles structurés et mesurés",
    ],
  },
  {
    id: "pathologies",
    block: "Philosophie Nutritionnelle",
    label: "Quel est votre cœur de métier ?",
    sublabel: "Vous pouvez en sélectionner plusieurs",
    type: "multiple",
    options: [
      "Perte de poids / obésité",
      "TCA (troubles du comportement alimentaire)",
      "Diabète / glycémie / métabolisme",
      "Performance sportive",
      "Inconfort digestif / FODMAP",
      "Fatigue / micronutrition",
      "Femme enceinte / post-partum",
      "Enfants / adolescents",
    ],
  },
  {
    id: "position_regimes",
    block: "Philosophie Nutritionnelle",
    label: "Votre avis sur les régimes restrictifs ?",
    type: "single",
    options: [
      "Je les déconseille systématiquement",
      "Je les étudie cas par cas",
      "Certains sont utiles dans mon protocole",
      "Je reste neutre et m'adapte",
    ],
  },
  {
    id: "position_glucides",
    block: "Philosophie Nutritionnelle",
    label: "Votre position sur les féculents et glucides ?",
    type: "single",
    options: [
      "Indispensables à chaque repas",
      "À moduler selon l'objectif",
      "Je les limite en général",
      "Dépend du patient et du moment",
    ],
  },
  {
    id: "jejune",
    block: "Philosophie Nutritionnelle",
    label: "Votre approche du jeûne intermittent ?",
    type: "single",
    options: [
      "Je le recommande régulièrement",
      "Uniquement sur indication précise",
      "Je préfère éviter",
      "Je ne me prononce pas",
    ],
  },
  {
    id: "complements",
    block: "Philosophie Nutritionnelle",
    label: "Votre position sur les compléments alimentaires ?",
    type: "single",
    options: [
      "J'en prescris régulièrement",
      "Seulement en cas de carence avérée",
      "Je préfère l'alimentation seule",
      "Cas par cas selon le bilan",
    ],
  },
  {
    id: "petit_dejeuner",
    block: "Philosophie Nutritionnelle",
    label: "Votre philosophie sur le petit-déjeuner ?",
    type: "single",
    options: [
      "Indispensable, je l'optimise toujours",
      "Optionnel selon le patient",
      "Je ne l'impose jamais",
    ],
  },
  {
    id: "lifestyle_budget",
    block: "Philosophie Nutritionnelle",
    label: "Votre approche lifestyle et budget ?",
    type: "single",
    options: [
      "Je prône le bio et le local",
      "Je m'adapte au budget du patient",
      "Je mise sur le moins transformé possible",
      "Je ne fais pas de distinction",
    ],
  },
  {
    id: "jamais_dire",
    block: "Philosophie Nutritionnelle",
    label: "Y a-t-il des pratiques que vous refusez catégoriquement ?",
    sublabel: "Ex: régimes très hypocaloriques, détox, jeûne prolongé...",
    type: "free",
    placeholder: "Décrivez ce que votre jumeau ne doit jamais recommander...",
  },
  {
    id: "conviction",
    block: "Philosophie Nutritionnelle",
    label: "Quelle est votre règle d'or ?",
    sublabel: "Votre conviction la plus forte en tant que praticien",
    type: "free",
    placeholder: "Ex: Pas d'aliment interdit, Le plaisir avant tout, La régularité prime sur la perfection...",
  },
  {
    id: "gestion_ecarts",
    block: "Gestion Humaine & Émotions",
    label: "Un patient craque sur une pizza. Vous répondez comment ?",
    type: "single",
    options: [
      "Sans culpabilité, on repart de zéro",
      "On analyse pourquoi ça s'est passé",
      "On recadre doucement sur les objectifs",
      "L'équilibre se fait sur la durée, un écart ne compte pas",
    ],
  },
  {
    id: "emotions",
    block: "Gestion Humaine & Émotions",
    label: "Un patient mange ses émotions. Votre approche ?",
    type: "single",
    options: [
      "Je travaille uniquement l'alimentation",
      "J'oriente vers un psy si besoin",
      "Je travaille les deux en parallèle",
      "C'est intégré dans mon suivi global",
    ],
  },
  {
    id: "non_suivi",
    block: "Gestion Humaine & Émotions",
    label: "Un patient ne suit plus votre protocole. Votre réaction ?",
    type: "single",
    options: [
      "Bienveillance totale, on repart sans jugement",
      "On cherche ensemble pourquoi ça bloque",
      "Recadrage ferme mais bienveillant",
      "On remet en question le protocole ensemble",
    ],
  },
  {
    id: "fetes_vacances",
    block: "Gestion Humaine & Émotions",
    label: "Votre position sur les fêtes et vacances ?",
    type: "single",
    options: [
      "On planifie à l'avance ensemble",
      "Liberté totale, on reprend après",
      "L'équilibre se fait sur le mois",
      "Je donne des guidelines souples",
    ],
  },
  {
    id: "motivation_berne",
    block: "Gestion Humaine & Émotions",
    label: "Comment remotivez-vous un patient qui décroche ?",
    type: "single",
    options: [
      "Je rappelle ses objectifs initiaux",
      "Je valorise chaque petit progrès",
      "Je propose d'ajuster le protocole",
      "Je lui laisse de l'espace et j'attends son retour",
    ],
  },
  {
    id: "posture",
    block: "Gestion Humaine & Émotions",
    label: "Comment définiriez-vous votre posture ?",
    type: "single",
    options: [
      "Expert qui guide et prescrit",
      "Coach qui encourage et challenge",
      "Partenaire qui co-construit",
      "Confident bienveillant",
    ],
  },
  {
    id: "perimetre",
    block: "Sécurité & Limites",
    label: "Jusqu'où peut aller votre jumeau ?",
    type: "single",
    options: [
      "Autonomie totale sur nutrition et lifestyle",
      "Prudent sur les pathologies, il me redirige",
      "Questions simples uniquement, il m'alerte pour tout le reste",
    ],
  },
  {
    id: "questions_medicales",
    block: "Sécurité & Limites",
    label: "Face à une question médicale complexe ?",
    type: "single",
    options: [
      "Il répond selon la littérature scientifique",
      "Il dit qu'il ne sait pas et m'alerte",
      "Il propose une piste et attend ma validation",
      "Il redirige systématiquement vers le médecin",
    ],
  },
  {
    id: "urgence_detresse",
    block: "Sécurité & Limites",
    label: "Un patient exprime une vraie souffrance psychologique ?",
    type: "single",
    options: [
      "Il exprime de l'empathie et m'alerte immédiatement",
      "Il oriente vers une ligne d'écoute ou un professionnel",
      "Il gère avec bienveillance dans les limites de son périmètre",
    ],
  },
  {
    id: "ligne_rouge",
    block: "Sécurité & Limites",
    label: "Votre ligne rouge absolue ?",
    sublabel: "Ce que votre jumeau ne doit JAMAIS dire ou faire",
    type: "free",
    placeholder: "Ex: Ne jamais culpabiliser, Ne jamais donner de calories précises, Ne jamais parler de médicaments...",
  },
  {
    id: "approche_libre",
    block: "Votre approche en vos mots",
    label: "Décrivez votre approche en quelques phrases",
    sublabel: "Parlez librement — comme si vous expliquiez votre méthode à un confrère",
    type: "free",
    placeholder: "Ma façon d'accompagner mes patients est...",
  },
  {
    id: "situation1",
    block: "Mises en situation",
    label: "Il est 22h. Un patient vous écrit :",
    sublabel: '"J\'ai craqué sur tout le frigo ce soir, je me déteste, je suis nul(le). Je vais jamais y arriver."',
    type: "free",
    placeholder: "Votre réponse exacte...",
  },
  {
    id: "situation2",
    block: "Mises en situation",
    label: "Un patient vous demande :",
    sublabel: '"Est-ce que je peux faire le régime Dukan ? Ma collègue a perdu 8kg en 1 mois."',
    type: "free",
    placeholder: "Votre réponse exacte...",
  },
  {
    id: "situation3",
    block: "Mises en situation",
    label: "Ça fait 3 semaines qu'un patient ne suit plus votre protocole.",
    sublabel: "Il ne répond plus à vos messages. Vous lui écrivez quoi ?",
    type: "free",
    placeholder: "Votre message de relance...",
  },
  {
    id: "situation4",
    block: "Mises en situation",
    label: "Un patient vous écrit :",
    sublabel: '"Mon médecin m\'a dit que j\'ai un prédiabète. Est-ce que je dois arrêter les féculents complètement ?"',
    type: "free",
    placeholder: "Votre réponse exacte...",
  },
  {
    id: "situation5",
    block: "Mises en situation",
    label: "Un patient vous annonce :",
    sublabel: '"J\'ai perdu 3kg ce mois-ci et je suis tellement fier(e) de moi !"',
    type: "free",
    placeholder: "Votre réponse exacte...",
  },
  {
    id: "situation6",
    block: "Mises en situation",
    label: "Un patient vous confie :",
    sublabel: '"Je mange mes émotions depuis l\'enfance. C\'est lié à un traumatisme familial."',
    type: "free",
    placeholder: "Comment vous gérez ça...",
  },
];

const BLOCKS = [
  "Identité & Caractère",
  "Philosophie Nutritionnelle",
  "Gestion Humaine & Émotions",
  "Sécurité & Limites",
  "Votre approche en vos mots",
  "Mises en situation",
  "Vos documents",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [selected, setSelected] = useState<string | string[]>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState<string[]>([]);
  const [practitionerId, setPractitionerId] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>(null);

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

  // Bloquer le retour navigateur
  useEffect(() => {
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.pathname);
    };
    window.history.pushState(null, "", window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const canGoNext = () => {
    if (currentQuestion?.type === "multiple") {
      return Array.isArray(selected) && selected.length > 0;
    }
    if (currentQuestion?.type === "free") {
      return typeof selected === "string" && selected.trim().length > 0;
    }
    return typeof selected === "string" && selected.length > 0;
  };

  const goNext = () => {
    if (!canGoNext() || isUploadStep || isFinal) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: selected }));
    setSelected(currentQuestion.type === "multiple" ? [] : "");
    setStep((prev) => prev + 1);
  };

  const toggleMultiple = (option: string) => {
    setSelected((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.includes(option)
        ? arr.filter((x) => x !== option)
        : [...arr, option];
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid = files.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ["pdf", "docx", "txt", "jpg", "jpeg", "png", "xlsx", "csv", "mp3", "wav", "m4a"].includes(ext ?? "");
    });
    setUploadedFiles((prev) => [...prev, ...valid]);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/mp3" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch {
      alert("Impossible d'accéder au microphone.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
  };

  const uploadAudioMemo = async () => {
    if (!audioBlob) return;
    const file = new File([audioBlob], `memo_vocal_${Date.now()}.mp3`, { type: "audio/mp3" });
    setUploadedFiles((prev) => [...prev, file]);
    setAudioBlob(null);
  };

  const uploadFiles = async () => {
    if (uploadedFiles.length === 0) return;
    if (!documentType) {
      alert("Veuillez choisir le type de document avant d'indexer.");
      return;
    }
    setUploading(true);
    setUploadErrors([]);
    setUploadSuccess([]);

    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    const pid = user?.id ?? practitionerId ?? "";
    setPractitionerId(pid);

    for (const file of uploadedFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("practitionerId", pid);
      formData.append("documentType", documentType);

      try {
        const res = await fetch("/api/upload-document", {
          method: "POST",
          body: formData,
        });
        const data = await res.json() as { success?: boolean; error?: string };
        if (res.ok && data.success) {
          setUploadSuccess((prev) => [...prev, file.name]);
        } else {
          setUploadErrors((prev) => [...prev, `${file.name} : ${data.error ?? "Erreur"}`]);
        }
      } catch {
        setUploadErrors((prev) => [...prev, `${file.name} : Erreur réseau`]);
      }
    }
    setUploading(false);
    setUploadedFiles([]);
    setDocumentType(null);
  };

  const saveProfile = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      const formattedAnswers = Object.fromEntries(
        Object.entries(answers).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.join(", ") : v,
        ])
      );

      const response = await fetch("/api/save-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: formattedAnswers,
          userId: user?.id ?? null,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Erreur lors de la sauvegarde.");
      }

      router.push("/dashboard");
    } catch (error: unknown) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Impossible de sauvegarder votre profil.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-300">
              Configuration de votre jumeau — {progress}%
            </p>
            {!isUploadStep && !isFinal && (
              <p className="text-xs text-zinc-500">{step + 1} / {total}</p>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#10b981] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {!isUploadStep && !isFinal && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {BLOCKS.map((block, i) => (
                <span
                  key={block}
                  className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition"
                  style={{
                    background: i === blockIndex ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                    color: i === blockIndex ? "#10b981" : "#52525b",
                    border: i === blockIndex ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {block}
                </span>
              ))}
            </div>
          )}
        </div>

        {!isUploadStep && !isFinal && currentQuestion ? (
          <section className="rounded-3xl border border-white/10 bg-[#121212] p-6 sm:p-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#10b981]">
              {currentQuestion.block}
            </p>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">
              {currentQuestion.label}
            </h1>
            {currentQuestion.sublabel && (
              <p className="mt-2 text-sm italic text-zinc-400">{currentQuestion.sublabel}</p>
            )}

            <div className="mt-8">
              {currentQuestion.type === "single" && (
                <div className="grid gap-3">
                  {currentQuestion.options?.map((option) => {
                    const isActive = selected === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSelected(option)}
                        className={`w-full rounded-2xl border px-4 py-4 text-left text-[15px] transition ${
                          isActive
                            ? "border-[#10b981] bg-[#10b981]/15 text-white"
                            : "border-white/10 bg-[#1a1a1a] text-zinc-300 hover:border-[#10b981]/50"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === "multiple" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {currentQuestion.options?.map((option) => {
                    const arr = Array.isArray(selected) ? selected : [];
                    const isActive = arr.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleMultiple(option)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-[14px] transition ${
                          isActive
                            ? "border-[#10b981] bg-[#10b981]/15 text-white"
                            : "border-white/10 bg-[#1a1a1a] text-zinc-300 hover:border-[#10b981]/50"
                        }`}
                      >
                        <span className="mr-2">{isActive ? "✓" : "+"}</span>
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === "free" && (
                <textarea
                  value={typeof selected === "string" ? selected : ""}
                  onChange={(e) => setSelected(e.target.value)}
                  placeholder={currentQuestion.placeholder}
                  rows={5}
                  className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-4 text-[15px] text-white outline-none transition placeholder:text-zinc-600 focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25"
                />
              )}
            </div>

            <div className="mt-8 flex items-center justify-between">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => { setStep((prev) => prev - 1); setSelected(""); }}
                  className="text-sm text-zinc-500 transition hover:text-white"
                >
                  ← Retour
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext()}
                className="rounded-full bg-[#10b981] px-7 py-3 text-sm font-semibold text-black transition hover:bg-[#0fb174] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
              >
                Suivant →
              </button>
            </div>
          </section>

        ) : isUploadStep ? (
          <section className="rounded-3xl border border-white/10 bg-[#121212] p-6 sm:p-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#10b981]">
              Vos documents
            </p>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">
              Enrichissez votre jumeau avec vos documents
            </h1>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Uploadez vos plans alimentaires types, protocoles ou articles. Votre jumeau les intégrera pour répondre avec votre précision.
            </p>

            {/* Score de fidélité — mis en avant */}
            <div className="mt-5 rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-white">Score de fidélité du jumeau</p>
                <span className="text-lg font-bold" style={{ color: uploadSuccess.length > 0 ? "#10b981" : "#f59e0b" }}>
                  {uploadSuccess.length > 0 ? "100%" : "70%"}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: uploadSuccess.length > 0 ? "100%" : "70%",
                    backgroundColor: uploadSuccess.length > 0 ? "#10b981" : "#f59e0b",
                  }}
                />
              </div>
              <p className="mt-3 text-sm font-medium" style={{ color: uploadSuccess.length > 0 ? "#10b981" : "#f59e0b" }}>
                {uploadSuccess.length > 0
                  ? "✅ Jumeau Fidèle — Votre jumeau est prêt à vous représenter parfaitement."
                  : "⚠️ Jumeau Personnalisé — Votre jumeau connaît votre philosophie mais répond de manière générique. Importez au moins un document pour qu'il devienne vraiment vous."}
              </p>
            </div>

            {/* Avertissement sécurité */}
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <p className="text-xs text-emerald-400 leading-relaxed">
                🔒 <strong>Vos documents sont automatiquement anonymisés par l'IA avant indexation.</strong> Aucune donnée personnelle n'est conservée. Tout est stocké sur des serveurs sécurisés en Europe.
              </p>
            </div>

            {/* Classification UI */}
            <div className="mt-6">
              <p className="text-sm font-semibold text-white mb-1">Quel type de document uploadez-vous ?</p>
              <p className="text-xs text-zinc-500 mb-4">Cela détermine si vos documents seront anonymisés ou non.</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => setDocumentType("protocole")}
                  className="rounded-2xl border-2 p-4 text-left transition"
                  style={{
                    borderColor: documentType === "protocole" ? "#10b981" : "rgba(255,255,255,0.1)",
                    background: documentType === "protocole" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <p className="text-2xl mb-2">📋</p>
                  <p className="text-sm font-bold text-white mb-1">Mes protocoles & méthodes</p>
                  <p className="text-xs text-zinc-500 mb-3">Articles, plans alimentaires types, guides nutritionnels, approches thérapeutiques</p>
                  <p className="text-xs font-medium text-emerald-400">✓ Indexé tel quel — pas de données personnelles</p>
                </button>

                <button
                  type="button"
                  onClick={() => setDocumentType("patient")}
                  className="rounded-2xl border-2 p-4 text-left transition"
                  style={{
                    borderColor: documentType === "patient" ? "#10b981" : "rgba(255,255,255,0.1)",
                    background: documentType === "patient" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <p className="text-2xl mb-2">🗂️</p>
                  <p className="text-sm font-bold text-white mb-1">Données patients</p>
                  <p className="text-xs text-zinc-500 mb-3">Bilans, comptes-rendus, analyses sanguines, fiches patients</p>
                  <p className="text-xs font-medium text-blue-400">✓ Anonymisé automatiquement avant indexation</p>
                </button>
              </div>

              {!documentType && uploadedFiles.length > 0 && (
                <p className="text-xs text-amber-400 mb-3">⚠️ Veuillez sélectionner le type de document avant d'indexer.</p>
              )}
            </div>

            {/* Zone upload */}
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-[#1a1a1a] px-6 py-8 transition hover:border-[#10b981]/50">
              <span className="text-4xl mb-3">📄</span>
              <span className="text-sm font-medium text-zinc-300">Cliquez pour sélectionner vos fichiers</span>
              <span className="mt-1 text-xs text-zinc-500">PDF, DOCX, TXT, JPG, PNG, Excel, CSV, MP3, WAV, M4A</span>
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.csv,.mp3,.wav,.m4a"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {/* Mémo vocal — mis en avant */}
            <div className="mt-4 rounded-2xl border-2 border-[#10b981]/30 bg-[#10b981]/5 px-5 py-5">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🎙️</span>
                <div>
                  <p className="text-sm font-bold text-white">Pas de document prêt ?</p>
                  <p className="text-xs text-zinc-400">Enregistrez un mémo vocal pour expliquer votre philosophie. Votre jumeau le transcrit et l'intègre automatiquement.</p>
                </div>
              </div>

              {!audioBlob ? (
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className="mt-3 flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition cursor-pointer"
                  style={{
                    background: isRecording ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                    border: isRecording ? "1.5px solid rgba(239,68,68,0.5)" : "1.5px solid rgba(16,185,129,0.5)",
                    color: isRecording ? "#f87171" : "#10b981",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                >
                  {isRecording ? (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400 animate-pulse" />
                      Arrêter l'enregistrement — {formatTime(recordingTime)}
                    </>
                  ) : (
                    <>🎙️ Enregistrer un mémo vocal</>
                  )}
                </button>
              ) : (
                <div className="mt-3 flex items-center gap-3">
                  <p className="text-sm text-emerald-400">✅ Mémo enregistré ({formatTime(recordingTime)})</p>
                  <button
                    type="button"
                    onClick={() => void uploadAudioMemo()}
                    className="rounded-full bg-[#10b981] px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-[#0fb174]"
                  >
                    Ajouter au jumeau
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioBlob(null)}
                    className="text-xs text-zinc-500 hover:text-red-400 transition"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>

            {/* Liste fichiers */}
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-2">
                    <span className="text-sm text-zinc-300 truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setUploadedFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="ml-3 text-zinc-500 hover:text-red-400 transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {/* Message durée d'indexation */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                  <p className="text-xs text-amber-400">
                    ⏳ L'indexation peut prendre 30 secondes à 2 minutes selon la taille de vos fichiers. Ne fermez pas cette page.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void uploadFiles()}
                  disabled={uploading || !documentType}
                  className="mt-2 w-full rounded-full border border-[#10b981] px-6 py-3 text-sm font-semibold text-[#10b981] transition hover:bg-[#10b981]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading
                    ? "⏳ Anonymisation et indexation en cours... Patientez"
                    : `Indexer ${uploadedFiles.length} fichier${uploadedFiles.length > 1 ? "s" : ""} →`}
                </button>
              </div>
            )}

            {uploadSuccess.length > 0 && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-sm font-semibold text-emerald-400 mb-2">✅ Documents indexés avec succès :</p>
                {uploadSuccess.map((s, i) => (
                  <p key={i} className="text-xs text-emerald-400">• {s}</p>
                ))}
              </div>
            )}

            {uploadErrors.length > 0 && (
              <div className="mt-4 space-y-1">
                {uploadErrors.map((e, i) => (
                  <p key={i} className="text-xs text-red-400">❌ {e}</p>
                ))}
              </div>
            )}

            <div className="mt-8 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setStep((prev) => prev + 1)}
                className="rounded-full bg-[#10b981] px-7 py-3 text-sm font-semibold text-black transition hover:bg-[#0fb174]"
              >
                {uploadedFiles.length === 0 && uploadSuccess.length === 0 ? "Passer cette étape →" : "Continuer →"}
              </button>
            </div>
          </section>

        ) : (
          <section className="rounded-3xl border border-[#10b981]/30 bg-[#121212] p-6 sm:p-8">
            <p className="mb-2 text-sm font-semibold text-[#10b981]">✅ Configuration terminée</p>
            <h1 className="text-2xl font-bold sm:text-3xl">
              Votre jumeau vous ressemble. Il est prêt.
            </h1>
            <p className="mt-3 text-sm text-zinc-400">
              Vos réponses ont été enregistrées. Votre jumeau est configuré selon votre vision et votre approche.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {Object.values(answers).flat().slice(0, 15).map((answer, index) => (
                typeof answer === "string" && answer.length < 60 ? (
                  <span
                    key={index}
                    className="rounded-full border border-[#10b981]/40 bg-[#10b981]/15 px-3 py-1 text-xs text-[#34d399]"
                  >
                    {answer}
                  </span>
                ) : null
              ))}
            </div>

            {saveError && <p className="mt-5 text-sm text-red-400">{saveError}</p>}​​​​​​​​​​​​​​​​
            <div className="mt-8">
              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={isSaving}
                className="rounded-full bg-[#10b981] px-8 py-3 text-sm font-semibold text-black transition hover:bg-[#0fb174] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
              >
                {isSaving ? "Sauvegarde..." : "Accéder à mon espace →"}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
