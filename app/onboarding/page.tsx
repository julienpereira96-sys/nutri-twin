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

type IndexedFile = {
  name: string;
  fileName: string;
  type: "protocole" | "patient";
  indexedAt: string;
  fileType: "pdf" | "image" | "audio" | "spreadsheet" | "text" | "note";
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

const getFileType = (fileName: string): IndexedFile["fileType"] => {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["mp3", "wav", "m4a"].includes(ext) || fileName.startsWith("memo_")) return "audio";
  if (["jpg", "jpeg", "png"].includes(ext)) return "image";
  if (["xlsx", "csv"].includes(ext)) return "spreadsheet";
  if (fileName.startsWith("slot1_vision_") || fileName.startsWith("slot2_signature_")) return "note";
  return "pdf";
};

const getFileIcon = (fileType: IndexedFile["fileType"]) => {
  switch (fileType) {
    case "audio": return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    );
    case "image": return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
    );
    case "spreadsheet": return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
      </svg>
    );
    case "note": return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    );
    default: return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
    );
  }
};

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const saved = localStorage.getItem("onboarding_step");
    return saved ? parseInt(saved) : 0;
  });
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem("onboarding_answers");
      return saved ? JSON.parse(saved) as Record<string, string | string[]> : {};
    } catch { return {}; }
  });
  const [selected, setSelected] = useState<string | string[]>(() => {
    if (typeof window === "undefined") return "";
    try {
      const saved = localStorage.getItem("onboarding_selected");
      return saved ? JSON.parse(saved) as string | string[] : "";
    } catch { return ""; }
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [practitionerId, setPractitionerId] = useState<string | null>(null);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [showCertTooltip, setShowCertTooltip] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [genProgress, setGenProgress] = useState(0);
  const [genDone, setGenDone] = useState(false);
  const [genFlash, setGenFlash] = useState(false);
  const genTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const genIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [slot1Done, setSlot1Done] = useState(false);
  const [slot2Done, setSlot2Done] = useState(false);
  const [slot1IndexedFiles, setSlot1IndexedFiles] = useState<IndexedFile[]>([]);
  const [slot2IndexedFiles, setSlot2IndexedFiles] = useState<IndexedFile[]>([]);
  const [slot1TypeHover, setSlot1TypeHover] = useState<"protocole" | "patient" | null>(null);
  const [slot1Text, setSlot1Text] = useState("");
  const [slot2Text, setSlot2Text] = useState("");
  const [uploadingSlot1, setUploadingSlot1] = useState(false);
  const [uploadingSlot2, setUploadingSlot2] = useState(false);
  const [slot1Files, setSlot1Files] = useState<{ file: File; docType: "protocole" | "patient" }[]>([]);
  const [slot1ActiveRecording, setSlot1ActiveRecording] = useState(false);
  const [slot2ActiveRecording, setSlot2ActiveRecording] = useState(false);
  const [duplicateError, setDuplicateError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [activating, setActivating] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const total = questions.length;
  const isUploadStep = step === total;
  const currentQuestion = questions[step];
  const progress = genDone ? 100 : isUploadStep || isGenerating ? 95 : Math.round((step / total) * 100);
  const currentBlock = isUploadStep ? "" : currentQuestion?.block ?? "";
  const blockIndex = BLOCKS.indexOf(currentBlock);
  const filled = (slot1Done ? 1 : 0) + (slot2Done ? 1 : 0);
  const slotScore = filled === 0 ? 70 : filled === 1 ? 85 : 100;
  const slotColor = filled === 0 ? "#f59e0b" : filled === 1 ? "#06b6d4" : "#10b981";
  const missing = slot1Done ? "Signature" : "Vision";
  const slotMsg = filled === 0
    ? "⚠️ Jumeau initialisé — Votre jumeau connaît votre personnalité mais il lui manque encore votre expertise. Partagez votre vision et vos méthodes pour lui donner votre pleine précision."
    : filled === 1
    ? `🔹 Jumeau Personnalisé — Une première brique de votre expertise a été intégrée. Il ne vous reste plus qu'à transmettre votre ${missing} pour que votre double soit parfaitement opérationnel et certifié.`
    : "✅ Jumeau certifié — Précision maximale atteinte. Votre jumeau possède désormais votre expertise.";

    useEffect(() => {
      localStorage.setItem("onboarding_step", String(step));
    }, [step]);
    
    useEffect(() => {
      localStorage.setItem("onboarding_answers", JSON.stringify(answers));
    }, [answers]);
    
    useEffect(() => {
      localStorage.setItem("onboarding_selected", JSON.stringify(selected));
    }, [selected]);    

    useEffect(() => {
      const init = async () => {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

       // Vérifier si onboarding déjà fait
      const { data } = await supabase.from("practitioners").select("onboarding_done").eq("user_id", user.id).single();
      if (data?.onboarding_done) {
        setAlreadyDone(true);
      } else {
        // Toujours vider le localStorage si onboarding pas terminé en base
        localStorage.removeItem("onboarding_step");
        localStorage.removeItem("onboarding_answers");
        localStorage.removeItem("onboarding_selected");
        localStorage.removeItem("onboarding_user_id");
      }
  
        // Charger les documents indexés
        const { data: docs } = await supabase
          .from("practitioner_documents")
          .select("id, file_name, document_type, created_at")
          .eq("practitioner_id", user.id)
          .order("created_at", { ascending: false });
  
          if (docs && docs.length > 0) {
            const mapDoc = (d: { id: string; file_name: string; document_type: string; created_at: string }): IndexedFile => ({
              name: d.file_name,
              fileName: d.file_name,
              type: d.document_type as "protocole" | "patient",
              indexedAt: new Date(d.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }),
              fileType: getFileType(d.file_name),
            });
            setSlot1IndexedFiles(docs.filter(d => d.document_type === "protocole").map(mapDoc));
            setSlot2IndexedFiles(docs.filter(d => d.document_type === "patient").map(mapDoc));
            if (docs.filter(d => d.document_type === "protocole").length > 0) setSlot1Done(true);
            if (docs.filter(d => d.document_type === "patient").length > 0) setSlot2Done(true);
          }
      };
      void init();
    }, []);  

  useEffect(() => {
    const handlePopState = () => window.history.pushState(null, "", window.location.pathname);
    window.history.pushState(null, "", window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      genTimeoutsRef.current.forEach(t => clearTimeout(t));
      if (genIntervalRef.current) clearInterval(genIntervalRef.current);
    };
  }, []);

  const canGoNext = () => {
    if (currentQuestion?.type === "multiple") return Array.isArray(selected) && selected.length > 0;
    if (currentQuestion?.type === "free") return typeof selected === "string" && selected.trim().length > 0;
    return typeof selected === "string" && selected.length > 0;
  };

  const goNext = () => {
    if (!canGoNext() || isUploadStep) return;
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

  const startRecording = async (slot: "slot1" | "slot2") => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      await new Promise(r => setTimeout(r, 300));
    }
    setAudioBlob(null); setIsRecording(false); setRecordingTime(0);
    if (slot === "slot1") { setSlot1ActiveRecording(true); setSlot2ActiveRecording(false); }
    else { setSlot2ActiveRecording(true); setSlot1ActiveRecording(false); }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = () => { setAudioBlob(new Blob(chunks, { type: "audio/mp3" })); stream.getTracks().forEach(t => t.stop()); };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(); setIsRecording(true); setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch { alert("Impossible d'accéder au microphone."); }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop(); setIsRecording(false);
    if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const formatDate = () => new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const getPid = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    const pid = user?.id ?? "";
    setPractitionerId(pid);
    return pid;
  };

  const deleteFromSupabase = async (fileName: string) => {
    const pid = practitionerId ?? await getPid();
    try {
      await fetch("/api/delete-document", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName, practitionerId: pid }) });
    } catch { /* silencieux */ }
  };

  const uploadToSlot = async (file: File, slot: "slot1" | "slot2", docType: "protocole" | "patient") => {
    if (slot === "slot1") setUploadingSlot1(true); else setUploadingSlot2(true);
    const pid = await getPid();
    const formData = new FormData();
    formData.append("file", file); formData.append("practitionerId", pid); formData.append("documentType", docType);
    const isVision = file.name.startsWith("slot1_vision_");
    const isSignature = file.name.startsWith("slot2_signature_");
    const isNote = isVision || isSignature;
    const isAudio = file.name.startsWith("memo_");
    const displayName = isVision ? "Note de vision" : isSignature ? "Note de signature" : isAudio ? `Mémo vocal (${formatTime(recordingTime)})` : file.name;
    try {
      const res = await fetch("/api/upload-document", { method: "POST", body: formData });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        const fileType = isNote ? "note" : isAudio ? "audio" : getFileType(file.name);
        const indexedFile: IndexedFile = { name: displayName, fileName: file.name, type: docType, indexedAt: formatDate(), fileType };
        if (slot === "slot1") { setSlot1IndexedFiles(prev => [...prev, indexedFile]); setSlot1Done(true); }
        else { setSlot2IndexedFiles(prev => [...prev, indexedFile]); setSlot2Done(true); }
      } else { setUploadErrors(prev => [...prev, `${displayName} : ${data.error ?? "Erreur"}`]); }
    } catch { setUploadErrors(prev => [...prev, `${displayName} : Erreur réseau`]); }
    if (slot === "slot1") setUploadingSlot1(false); else setUploadingSlot2(false);
  };

  const handleSlotFile = (e: React.ChangeEvent<HTMLInputElement>, slot: "slot1" | "slot2", docType: "protocole" | "patient") => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setDuplicateError("");
    if (slot === "slot1") {
      const allNames = [...slot1Files.map(f => f.file.name), ...slot1IndexedFiles.map(f => f.fileName)];
      const duplicates = files.filter(f => allNames.includes(f.name));
      if (duplicates.length > 0) { setDuplicateError(`⚠️ Fichier déjà ajouté : ${duplicates.map(f => f.name).join(", ")}`); return; }
      setSlot1Files(prev => [...prev, ...files.map(f => ({ file: f, docType }))]);
    } else {
      const allNames = slot2IndexedFiles.map(f => f.fileName);
      const duplicates = files.filter(f => allNames.includes(f.name));
      if (duplicates.length > 0) { setDuplicateError(`⚠️ Fichier déjà ajouté : ${duplicates.map(f => f.name).join(", ")}`); return; }
      void uploadToSlot(files[0], slot, docType);
    }
    if (e.target) e.target.value = "";
  };

  const indexSlot1Files = async () => {
    if (slot1Files.length === 0) return;
    for (const { file, docType } of slot1Files) await uploadToSlot(file, "slot1", docType);
    setSlot1Files([]);
  };

  const saveSlotText = async (slot: "slot1" | "slot2", text: string) => {
    if (!text.trim()) return;
    const blob = new Blob([text], { type: "text/plain" });
    const label = slot === "slot1" ? "vision" : "signature";
    const file = new File([blob], `${slot}_${label}_${Date.now()}.txt`, { type: "text/plain" });
    await uploadToSlot(file, slot, "protocole");
    if (slot === "slot1") setSlot1Text(""); else setSlot2Text("");
  };

  const saveSlotAudio = async (slot: "slot1" | "slot2") => {
    if (!audioBlob) return;
    const file = new File([audioBlob], `memo_${slot}_${Date.now()}.mp3`, { type: "audio/mp3" });
    await uploadToSlot(file, slot, "protocole");
    setAudioBlob(null);
    if (slot === "slot1") setSlot1ActiveRecording(false); else setSlot2ActiveRecording(false);
  };

  const saveProfile = async (redirect = true) => {
    if (isSaving) return;
    setIsSaving(true); setSaveError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const formattedAnswers = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v]));
      const response = await fetch("/api/save-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: formattedAnswers, userId: user?.id ?? null }) });
      if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error ?? "Erreur lors de la sauvegarde."); }
      await supabase.from("practitioners").update({ onboarding_done: true }).eq("user_id", user?.id ?? "");
      localStorage.removeItem("onboarding_step");
      localStorage.removeItem("onboarding_answers");
      localStorage.removeItem("onboarding_selected");
      if (redirect) router.push("/dashboard");
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Impossible de sauvegarder votre profil.");
    } finally { setIsSaving(false); }
  };

  const startGeneration = () => {
    void saveProfile(false);
    setIsGenerating(true); setGenStep(0); setGenProgress(0);
    genTimeoutsRef.current = [];
    const totalDuration = 40000;
    const intervalMs = 100;
    const steps = totalDuration / intervalMs;
    let current = 0;
    genIntervalRef.current = setInterval(() => {
      current += 1;
      const pct = Math.min(Math.round((current / steps) * 99), 99);
      setGenProgress(pct);
      if (current >= steps) clearInterval(genIntervalRef.current!);
    }, intervalMs);
    const stepTimings = [0, 5000, 10000, 20000, 30000, 40000];
    stepTimings.forEach((timing, i) => {
      const t = setTimeout(() => setGenStep(i + 1), timing);
      genTimeoutsRef.current.push(t);
    });
    const t1 = setTimeout(() => {
      if (genIntervalRef.current) clearInterval(genIntervalRef.current);
      setGenProgress(100); setGenStep(7);
    }, 40000);
    genTimeoutsRef.current.push(t1);
    const t2 = setTimeout(() => {
      setGenFlash(true);
      const t3 = setTimeout(() => setGenDone(true), 800);
      genTimeoutsRef.current.push(t3);
    }, 43000);
    genTimeoutsRef.current.push(t2);
  };

  const TrashIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );

  const Spinner = () => (
    <svg style={{ animation: "spin 1s linear infinite" }} width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );

  const IndexedFileRow = ({ f, i, slot }: { f: IndexedFile; i: number; slot: "slot1" | "slot2" }) => (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex-shrink-0 text-zinc-400">{getFileIcon(f.fileType)}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{f.name}</p>
          <p className="text-xs text-zinc-500">Dernière mise à jour : {f.indexedAt}{f.type === "patient" && <span className="ml-2 text-blue-400">🔒 Anonymisé</span>}</p>
        </div>
      </div>
      <button type="button"
        onClick={() => {
          if (slot === "slot1") { setSlot1IndexedFiles(prev => { const next = prev.filter((_, j) => j !== i); if (next.length === 0) setSlot1Done(false); return next; }); }
          else { setSlot2IndexedFiles(prev => { const next = prev.filter((_, j) => j !== i); if (next.length === 0) setSlot2Done(false); return next; }); }
          void deleteFromSupabase(f.fileName);
        }}
        className="ml-3 flex-shrink-0 p-1.5 rounded-lg transition-all duration-200 cursor-pointer" style={{ color: "#64748b" }}
        onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
        onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
        <TrashIcon />
      </button>
    </div>
  );

  const btnStyle = {
    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "11px 12px", borderRadius: 12,
    background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))",
    border: "1px solid rgba(16,185,129,0.18)", cursor: "pointer", transition: "all 0.2s",
    boxShadow: "0 2px 12px rgba(0,0,0,0.3)", color: "#10b981", fontSize: 14, fontWeight: 600,
  };

  const btnHover = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!e.currentTarget.disabled) { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))"; e.currentTarget.style.transform = "translateY(-1px)"; }
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))";
      e.currentTarget.style.transform = "translateY(0)";
    },
  };
  return (
    <>
      {alreadyDone ? (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
          <div className="rounded-3xl border border-[#10b981]/30 bg-[#121212] p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)" }}>
              <span className="text-3xl">🌿</span>
            </div>
            <p className="text-xs font-mono font-bold tracking-widest text-[#10b981] uppercase mb-3">Jumeau opérationnel</p>
            <h1 className="text-xl font-bold text-white mb-3">Votre jumeau s'est finalisé<br />en arrière-plan.</h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-8">
              Même si vous avez quitté la page, votre profil a bien été enregistré. Votre Jumeau est prêt à prendre le relais auprès de vos patients.
            </p>
            <button type="button" onClick={() => { setNavigating(true); setTimeout(() => router.push("/dashboard"), 800); }}
              style={{ background: "#10b981", color: "black", borderRadius: 9999, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 0 20px rgba(16,185,129,0.3)" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 40px rgba(16,185,129,0.5)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 20px rgba(16,185,129,0.3)"; e.currentTarget.style.transform = "translateY(0)"; }}>
              {navigating ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTop: "2px solid black", animation: "spin 1s linear infinite", display: "inline-block" }} />Chargement...</span> : "Accéder à mon cabinet numérique →"}
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
          <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-300">Configuration de votre jumeau — {progress}%</p>
                {!isUploadStep && !isGenerating && <p className="text-xs text-zinc-500">{step + 1} / {total}</p>}
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#10b981] transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              {!isUploadStep && !isGenerating && (
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

            {!isUploadStep && !isGenerating && currentQuestion ? (
              <section className="rounded-3xl border border-white/10 bg-[#121212] p-6 sm:p-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#10b981]">{currentQuestion.block}</p>
                <h1 className="text-xl font-bold leading-tight sm:text-2xl">{currentQuestion.label}</h1>
                {currentQuestion.sublabel && <p className="mt-2 text-sm italic text-zinc-400">{currentQuestion.sublabel}</p>}
                <div className="mt-8">
                  {currentQuestion.type === "single" && (
                    <div className="grid gap-3">
                      {currentQuestion.options?.map(option => (
                        <button key={option} type="button" onClick={() => setSelected(option)}
                          className={`w-full rounded-2xl border px-4 py-4 text-left text-[15px] transition-all duration-200 cursor-pointer ${selected === option ? "border-[#10b981] bg-[#10b981]/15 text-white" : "border-white/10 bg-[#1a1a1a] text-zinc-300 hover:border-[#10b981]/50"}`}>
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
                            className={`w-full rounded-2xl border px-4 py-3 text-left text-[14px] transition-all duration-200 cursor-pointer ${isActive ? "border-[#10b981] bg-[#10b981]/15 text-white" : "border-white/10 bg-[#1a1a1a] text-zinc-300 hover:border-[#10b981]/50"}`}>
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
                    <button type="button" onClick={() => { setStep(prev => prev - 1); setSelected(""); }}
                      className="text-sm text-zinc-500 transition-all duration-200 hover:text-white cursor-pointer">← Retour</button>
                  ) : <div />}
                  <button type="button" onClick={goNext} disabled={!canGoNext()}
                    className="rounded-full bg-[#10b981] px-7 py-3 text-sm font-semibold text-black transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                    onMouseEnter={e => { if (canGoNext()) { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(16,185,129,0.5), 0 8px 30px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0) scale(1)"; }}>
                    Suivant →
                  </button>
                </div>
              </section>

            ) : isGenerating ? (
              <section className="rounded-3xl border border-[#10b981]/20 bg-[#0d0d0d] p-8 min-h-[520px] flex flex-col overflow-hidden">
                <div className="h-0.5 w-full bg-white/5 rounded-full mb-8 overflow-hidden">
                  <div className="h-full bg-[#10b981] rounded-full transition-all duration-300" style={{ width: `${genProgress}%` }} />
                </div>
                {genDone ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ animation: "fadeInUp 0.6s ease forwards" }}>
                    <div className="relative w-28 h-28 mb-8">
                      <div className="w-28 h-28 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(16,185,129,0.12)", border: "2px solid rgba(16,185,129,0.4)" }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="4 12 9 17 20 6" stroke="rgba(16,185,129,0.15)" strokeWidth="2"/>
                          <polyline points="4 12 9 17 20 6" stroke="#10b981" strokeWidth="2"
                            strokeDasharray="30" strokeDashoffset="30"
                            style={{ animation: "drawCheck 5s ease 0.3s forwards" }}/>
                          <polyline points="4 12 9 17 20 6" stroke="white" strokeWidth="3"
                            strokeDasharray="2 28" strokeDashoffset="30"
                            style={{ animation: "drawCheck 5s ease 0.3s forwards, fadeOut 0.5s ease 5.3s forwards", opacity: 0.8, filter: "blur(0.5px)" }}/>
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs font-mono font-bold tracking-widest text-[#10b981] uppercase mb-3">✅ Configuration terminée</p>
                    <h2 className="text-2xl font-bold text-white mb-3 leading-tight">Votre Jumeau est prêt.</h2>
                    <p className="text-sm text-zinc-400 max-w-sm leading-relaxed mb-2">
                      Votre double numérique est désormais capable de prendre le relais auprès de vos patients, avec votre philosophie, votre expertise et votre signature.
                    </p>
                    <p className="text-xs font-mono text-[#10b981]/50 mb-10">[NT-006] Certification validée — Jumeau opérationnel</p>
                    {saveError && <p className="mb-4 text-sm text-red-400">{saveError}</p>}
                    <button type="button" onClick={() => { setNavigating(true); setTimeout(() => router.push("/dashboard"), 800); }}
                      style={{ background: "#10b981", color: "black", borderRadius: 9999, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 0 30px rgba(16,185,129,0.3)" }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 40px rgba(16,185,129,0.5)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 30px rgba(16,185,129,0.3)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                      {navigating ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTop: "2px solid black", animation: "spin 1s linear infinite", display: "inline-block" }} />Chargement...</span> : "Accéder à mon cabinet numérique →"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-10" style={{ opacity: genFlash ? 0 : 1, transition: "opacity 0.4s ease" }}>
                      <div>
                        <p className="text-xs font-mono text-[#10b981]/60 tracking-widest uppercase mb-1">NutriTwin Engine v1.0</p>
                        <p className="text-xs font-mono text-zinc-600">Génération du profil jumeau en cours</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-mono font-bold" style={{ color: "#10b981" }}>{genProgress}%</p>
                        <p className="text-xs font-mono text-zinc-600">complété</p>
                      </div>
                    </div>
                    <div className="flex justify-center mb-10" style={{ opacity: genFlash ? 0 : 1, transition: "opacity 0.4s ease" }}>
                      <div className="relative w-32 h-32">
                        <div className="absolute inset-0 rounded-full border border-[#10b981]/10 animate-ping" style={{ animationDuration: "2s" }} />
                        <div className="absolute inset-2 rounded-full border border-[#10b981]/15 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.3s" }} />
                        <svg className="absolute inset-0 w-full h-full" style={{ animation: "spin 3s linear infinite" }} viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(16,185,129,0.08)" strokeWidth="1.5"/>
                          <circle cx="50" cy="50" r="46" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="80 210" strokeLinecap="round"/>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full flex items-center justify-center"
                            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                            <span className="text-2xl">🌿</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 font-mono flex-1" style={{ opacity: genFlash ? 0 : 1, transition: "opacity 0.4s ease" }}>
                      {[
                        { code: "NT-001", label: "Initialisation du profil praticien" },
                        { code: "NT-002", label: "Analyse des réponses comportementales" },
                        { code: "NT-003", label: "Calibration du ton et du style" },
                        { code: "NT-004", label: "Intégration de votre expertise" },
                        { code: "NT-005", label: "Injection de votre signature émotionnelle" },
                        { code: "NT-006", label: "Certification du Jumeau NutriTwin" },
                      ].map((s, i) => {
                        const isDone = genStep > i + 1;
                        const isActive = genStep === i + 1;
                        const isPending = genStep < i + 1;
                        return (
                          <div key={i} className="flex items-center gap-3 transition-all duration-500" style={{ opacity: isPending ? 0.25 : 1 }}>
                            <span className="text-xs flex-shrink-0" style={{ color: isDone ? "#10b981" : isActive ? "#f59e0b" : "#374151" }}>[{s.code}]</span>
                            <span className="text-xs flex-1 truncate" style={{ color: isDone ? "#10b981" : isActive ? "white" : "#374151" }}>{s.label}</span>
                            <span className="text-xs flex-shrink-0 w-20 text-right">
                              {isDone && <span className="text-[#10b981]">✓ OK</span>}
                              {isActive && <span className="text-[#f59e0b] flex items-center justify-end gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />en cours</span>}
                              {isPending && <span className="text-zinc-700">—</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-6 rounded-xl bg-black/40 border border-white/5 px-4 py-3" style={{ opacity: genFlash ? 0 : 1, transition: "opacity 0.4s ease" }}>
                      <p className="text-xs font-mono text-zinc-600 truncate">
                        {genStep === 0 && "› Démarrage du moteur NutriTwin..."}
                        {genStep === 1 && "› Chargement du modèle de personnalité [32 paramètres]..."}
                        {genStep === 2 && "› Vectorisation des réponses comportementales..."}
                        {genStep === 3 && "› Injection du profil stylistique dans le LLM..."}
                        {genStep === 4 && "› Fusion des documents d'expertise avec le profil..."}
                        {genStep === 5 && "› Application de la signature émotionnelle unique..."}
                        {genStep === 6 && "› Jumeau certifié — Lancement imminent..."}
                      </p>
                    </div>
                  </>
                )}
              </section>

            ) : isUploadStep ? (
              <section className="rounded-3xl border border-white/10 bg-[#121212] p-6 sm:p-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#10b981]">Votre expertise</p>
                <h1 className="text-xl font-bold leading-tight sm:text-2xl">Enrichissez votre jumeau avec votre expertise</h1>

                <div className="mt-5 rounded-2xl p-5 transition-all duration-500" style={{ background: `${slotColor}10`, border: `2px solid ${slotColor}40` }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-white">Score de fidélité du jumeau</p>
                    <span className="text-lg font-bold" style={{ color: slotColor }}>{slotScore}%</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${slotScore}%`, backgroundColor: slotColor }} />
                  </div>
                  <p className="mt-3 text-sm" style={{ color: slotColor }}>{slotMsg}</p>
                </div>

                {/* SLOT 1 */}
                <div className="mt-10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 border"
                      style={{ background: slot1Done ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)", color: slot1Done ? "#10b981" : "#64748b", borderColor: slot1Done ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)" }}>1</div>
                    <p className="text-base font-bold" style={{ color: slot1Done ? "#10b981" : "white" }}>Votre Vision</p>
                    {slot1Done && <span className="text-xs font-semibold text-emerald-400 ml-1">✓ Rempli</span>}
                  </div>
                  <p className="text-sm text-zinc-400 mb-6 leading-relaxed ml-0 sm:ml-10"> Uploadez vos plans alimentaires types, protocoles ou articles. Votre jumeau les intégrera pour répondre avec votre précision.</p>
                  <div className="ml-0 sm:ml-10 space-y-3">
                    {slot1IndexedFiles.map((f, i) => <IndexedFileRow key={i} f={f} i={i} slot="slot1" />)}
                    <div className="pt-2">
                      <p className="text-sm font-semibold text-white mb-1">Quel type de document uploadez-vous ?</p>
                      <p className="text-xs text-zinc-500 mb-4">Cela détermine si vos documents seront anonymisés ou non.</p>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <label className="relative rounded-2xl border-2 border-dashed p-4 text-left cursor-pointer transition-all duration-200 group"
                          style={{ borderColor: slot1TypeHover === "protocole" ? "#10b981" : "rgba(255,255,255,0.15)", background: slot1TypeHover === "protocole" ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.02)" }}
                          onMouseEnter={() => setSlot1TypeHover("protocole")} onMouseLeave={() => setSlot1TypeHover(null)}>
                          <input type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.csv,.mp3,.wav,.m4a" onChange={e => handleSlotFile(e, "slot1", "protocole")} className="hidden" />
                          <p className="text-2xl mb-2">📋</p>
                          <p className="text-sm font-bold text-white mb-1">Mes protocoles & méthodes</p>
                          <p className="text-xs text-zinc-500 mb-3">Articles, plans alimentaires types, guides nutritionnels</p>
                          <p className="text-xs font-medium text-emerald-400 mb-3">✓ Indexé tel quel</p>
                          <div className="rounded-xl border border-dashed border-white/15 group-hover:border-emerald-500/40 px-3 py-2 text-center transition-all duration-200">
                            <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition">Cliquez pour sélectionner</p>
                            <p className="text-xs text-zinc-600 mt-0.5">PDF, DOCX, TXT, JPG, PNG, Excel, CSV, MP3</p>
                          </div>
                        </label>
                        <label className="relative rounded-2xl border-2 border-dashed p-4 text-left cursor-pointer transition-all duration-200 group"
                          style={{ borderColor: slot1TypeHover === "patient" ? "#60a5fa" : "rgba(255,255,255,0.15)", background: slot1TypeHover === "patient" ? "rgba(96,165,250,0.08)" : "rgba(255,255,255,0.02)" }}
                          onMouseEnter={() => setSlot1TypeHover("patient")} onMouseLeave={() => setSlot1TypeHover(null)}>
                          <input type="file" multiple accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.xlsx,.csv,.mp3,.wav,.m4a" onChange={e => handleSlotFile(e, "slot1", "patient")} className="hidden" />
                          <p className="text-2xl mb-2">🗂️</p>
                          <p className="text-sm font-bold text-white mb-1">Données patients</p>
                          <p className="text-xs text-zinc-500 mb-3">Bilans, comptes-rendus, analyses sanguines</p>
                          <br />
                          <p className="text-xs font-medium text-blue-400 mb-3">✓ Anonymisé avant indexation</p>
                          <div className="rounded-xl border border-dashed border-white/15 group-hover:border-blue-500/40 px-3 py-2 text-center transition-all duration-200">
                            <p className="text-xs text-zinc-500 group-hover:text-zinc-400 transition">Cliquez pour sélectionner</p>
                            <p className="text-xs text-zinc-600 mt-0.5">PDF, DOCX, TXT, JPG, PNG, Excel, CSV, MP3</p>
                          </div>
                        </label>
                      </div>
                    </div>
                    {duplicateError && <p className="text-xs text-amber-400">{duplicateError}</p>}
                    {slot1Files.length > 0 && (
                      <div className="space-y-2">
                        {slot1Files.map((f, i) => (
                          <div key={i} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex-shrink-0 text-zinc-400">{getFileIcon(getFileType(f.file.name))}</span>
                              <span className="text-sm text-zinc-300 truncate">{f.file.name}</span>
                              <span className="text-xs flex-shrink-0" style={{ color: f.docType === "patient" ? "#60a5fa" : "#10b981" }}>{f.docType === "patient" ? "🔒 Anonymisé" : "✓ Tel quel"}</span>
                            </div>
                            <button type="button" onClick={() => setSlot1Files(prev => prev.filter((_, j) => j !== i))}
                              className="ml-3 flex-shrink-0 p-1.5 rounded-lg transition-all duration-200 cursor-pointer" style={{ color: "#64748b" }}
                              onMouseEnter={e => e.currentTarget.style.color = "#f87171"} onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                              <TrashIcon />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={() => void indexSlot1Files()} disabled={uploadingSlot1}
                          style={{ ...btnStyle, marginTop: 4, opacity: uploadingSlot1 ? 0.7 : 1, cursor: uploadingSlot1 ? "not-allowed" : "pointer" }} {...btnHover}>
                          {uploadingSlot1 ? <><Spinner />Indexation en cours...</> : `Indexer ${slot1Files.length} fichier${slot1Files.length > 1 ? "s" : ""} →`}
                        </button>
                      </div>
                    )}
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                      <p className="text-xs text-emerald-400 leading-relaxed">🔒 <strong>Vos documents sont automatiquement anonymisés par l'IA avant indexation.</strong> Aucune donnée personnelle n'est conservée. Tout est stocké sur des serveurs sécurisés en Europe.</p>
                    </div>
                    <div className="pt-2">
                      <p className="text-sm font-semibold text-white mb-1">Pas de documents prêts ou des nuances à apporter ?</p>
                      <p className="text-xs text-zinc-500 mb-3">Décrivez votre vision ou des détails non écrits dans vos protocoles.</p>
                      <div className="relative">
                        <textarea value={slot1Text} onChange={e => setSlot1Text(e.target.value)}
                          placeholder="Exemple : Je crois profondément que l’accompagnement nutritionnel doit d'abord être un espace de sécurité absolue, où le jugement n’a aucune place, peu importent les difficultés ou les écarts rencontrés. Pour moi, apaiser l’anxiété est le préalable indispensable à toute discussion technique ou calorique. Ma pratique repose sur la douceur, la validation systématique des émotions et la conviction qu'il faut toujours ouvrir sur une note d'espoir pour permettre au patient de se projeter durablement vers son mieux-être." rows={4}
                          className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-4 pr-14 text-sm text-white outline-none transition-all duration-200 placeholder:text-zinc-600 focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 resize-none" />
                        <div className="absolute bottom-6 right-3 group flex items-center justify-end">
                          <span className="mr-2 text-xs text-zinc-500 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 whitespace-nowrap pointer-events-none">Mémo vocal</span>
                          <button type="button"
                            onClick={() => isRecording && slot1ActiveRecording ? stopRecording() : void startRecording("slot1")}
                            className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 cursor-pointer"
                            style={{ background: isRecording && slot1ActiveRecording ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.15)", border: isRecording && slot1ActiveRecording ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(16,185,129,0.3)" }}>
                            {isRecording && slot1ActiveRecording ? <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" /> : <span className="text-sm">🎙️</span>}
                          </button>
                        </div>
                      </div>
                      {isRecording && slot1ActiveRecording && (
                        <p className="text-xs text-red-400 mt-2 ml-1 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />Enregistrement en cours — {formatTime(recordingTime)}</p>
                      )}
                      {audioBlob && slot1ActiveRecording && (
                        <div className="flex items-center gap-3 mt-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                          <p className="text-sm text-emerald-400 flex-1">✅ Mémo enregistré ({formatTime(recordingTime)})</p>
                          <button type="button" onClick={() => void saveSlotAudio("slot1")} disabled={uploadingSlot1}
                            style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 8, padding: "6px 14px", color: "#10b981", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}
                            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))"; e.currentTarget.style.transform = "translateY(0)"; }}>
                            {uploadingSlot1 ? <><Spinner />Indexation...</> : "Indexer ce mémo →"}
                          </button>
                          {!uploadingSlot1 && (
                            <button type="button" onClick={() => { setAudioBlob(null); setSlot1ActiveRecording(false); }}
                              className="p-1.5 rounded-lg transition-all duration-200 cursor-pointer" style={{ color: "#64748b" }}
                              onMouseEnter={e => e.currentTarget.style.color = "#f87171"} onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      )}
                      {slot1Text.trim() && !audioBlob && (
                        <button type="button" onClick={() => void saveSlotText("slot1", slot1Text)} disabled={uploadingSlot1}
                          style={{ ...btnStyle, marginTop: 12, opacity: uploadingSlot1 ? 0.7 : 1, cursor: uploadingSlot1 ? "not-allowed" : "pointer" }} {...btnHover}>
                          {uploadingSlot1 ? <><Spinner />Indexation en cours...</> : "Indexer ma vision →"}
                        </button>
                      )}
                      {uploadingSlot1 && <p className="text-xs text-amber-400 text-center mt-1">Patientez, l'indexation peut prendre quelques instants.</p>}
                    </div>
                  </div>
                </div>

                <div className="my-10 flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-zinc-600 font-medium px-2">et</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* SLOT 2 */}
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 border"
                      style={{ background: slot2Done ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)", color: slot2Done ? "#10b981" : "#64748b", borderColor: slot2Done ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)" }}>2</div>
                    <p className="text-base font-bold" style={{ color: slot2Done ? "#10b981" : "white" }}>Votre Signature</p>
                    {slot2Done && <span className="text-xs font-semibold text-emerald-400 ml-1">✓ Rempli</span>}
                  </div>
                  <p className="text-sm text-zinc-400 mb-6 leading-relaxed ml-10">L'étape finale pour passer de l'intelligence artificielle à votre intelligence émotionnelle.</p>
                  <div className="ml-0 sm:ml-10 space-y-3">
                    {slot2IndexedFiles.map((f, i) => <IndexedFileRow key={i} f={f} i={i} slot="slot2" />)}
                    <div className="pt-2">
                      <div className="relative">
                        <textarea value={slot2Text} onChange={e => setSlot2Text(e.target.value)}
                          placeholder="Partagez vos métaphores favorites, vos mots pour dédramatiser un écart et vos mantras de motivation. C'est ici que votre Jumeau capture votre intuition et ces nuances qui font votre signature unique."
                          rows={5}
                          className="w-full rounded-2xl border border-white/10 bg-[#1a1a1a] px-4 py-4 pr-14 text-sm text-white outline-none transition-all duration-200 placeholder:text-zinc-600 focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/20 resize-none" />
                        <div className="absolute bottom-6 right-3 group flex items-center justify-end">
                          <span className="mr-2 text-xs text-zinc-500 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 whitespace-nowrap pointer-events-none">Mémo vocal</span>
                          <button type="button"
                            onClick={() => isRecording && slot2ActiveRecording ? stopRecording() : void startRecording("slot2")}
                            className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 cursor-pointer"
                            style={{ background: isRecording && slot2ActiveRecording ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.15)", border: isRecording && slot2ActiveRecording ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(16,185,129,0.3)" }}>
                            {isRecording && slot2ActiveRecording ? <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" /> : <span className="text-sm">🎙️</span>}
                          </button>
                        </div>
                      </div>
                      {isRecording && slot2ActiveRecording && (
                        <p className="text-xs text-red-400 mt-2 ml-1 flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />Enregistrement en cours — {formatTime(recordingTime)}</p>
                      )}
                      {audioBlob && slot2ActiveRecording && (
                        <div className="flex items-center gap-3 mt-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                          <p className="text-sm text-emerald-400 flex-1">✅ Mémo enregistré ({formatTime(recordingTime)})</p>
                          <button type="button" onClick={() => void saveSlotAudio("slot2")} disabled={uploadingSlot2}
                            style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))", border: "1px solid rgba(16,185,129,0.18)", borderRadius: 8, padding: "6px 14px", color: "#10b981", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6 }}
                            onMouseEnter={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.22), rgba(16,185,129,0.08))"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))"; e.currentTarget.style.transform = "translateY(0)"; }}>
                            {uploadingSlot2 ? <><Spinner />Indexation...</> : "Indexer ce mémo →"}
                          </button>
                          {!uploadingSlot2 && (
                            <button type="button" onClick={() => { setAudioBlob(null); setSlot2ActiveRecording(false); }}
                              className="p-1.5 rounded-lg transition-all duration-200 cursor-pointer" style={{ color: "#64748b" }}
                              onMouseEnter={e => e.currentTarget.style.color = "#f87171"} onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      )}
                      {slot2Text.trim() && !audioBlob && (
                        <button type="button" onClick={() => void saveSlotText("slot2", slot2Text)} disabled={uploadingSlot2}
                          style={{ ...btnStyle, marginTop: 12, opacity: uploadingSlot2 ? 0.7 : 1, cursor: uploadingSlot2 ? "not-allowed" : "pointer" }} {...btnHover}>
                          {uploadingSlot2 ? <><Spinner />Indexation en cours...</> : "Indexer ma signature →"}
                        </button>
                      )}
                      {uploadingSlot2 && <p className="text-xs text-amber-400 text-center mt-1">Patientez, l'indexation peut prendre quelques instants.</p>}
                    </div>
                  </div>
                </div>

                {uploadErrors.length > 0 && (
                  <div className="mt-5 space-y-1">
                    {uploadErrors.map((e, i) => <p key={i} className="text-xs text-red-400">❌ {e}</p>)}
                  </div>
                )}

                  <div className="mt-10 flex items-center justify-between">
                  <button type="button" onClick={() => setStep(prev => prev - 1)}
                    className="text-sm text-zinc-500 transition-all duration-200 hover:text-white cursor-pointer">← Retour</button>

                    <div style={{ position: "relative", display: "inline-block" }}
                    onMouseEnter={() => { if (filled < 2) setShowCertTooltip(true); }}
                    onMouseLeave={() => setShowCertTooltip(false)}
                    onClick={() => { if (filled < 2) setShowCertTooltip(prev => !prev); }}>
                    {showCertTooltip && filled < 2 && (
                      <>
                        <div className="hidden sm:block" style={{ position: "absolute", top: "50%", right: "calc(100% + 12px)", transform: "translateY(-50%)", width: 280, borderRadius: 12, padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontSize: 12, textAlign: "center", pointerEvents: "none", whiteSpace: "normal", zIndex: 10 }}>
                          🔒 Certification requise — Complétez votre Vision et votre Signature pour activer votre Jumeau à 100%.
                        </div>
                        <div className="block sm:hidden" style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, width: 240, borderRadius: 12, padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontSize: 12, textAlign: "center", pointerEvents: "none", whiteSpace: "normal", zIndex: 10 }}>
                          🔒 Certification requise — Complétez votre Vision et votre Signature pour activer votre Jumeau à 100%.
                        </div>
                      </>
                    )}
                    <button type="button"
                      onClick={filled === 2 ? () => {
                        setActivating(true);
                        setTimeout(() => {
                          setActivating(false);
                          startGeneration();
                        }, 1500);
                      } : undefined}
                      style={{
                        background: filled === 2 ? "#10b981" : "transparent",
                        color: filled === 2 ? "black" : "#64748b",
                        border: filled === 2 ? "none" : "1px solid rgba(255,255,255,0.1)",
                        cursor: filled === 2 ? "pointer" : "not-allowed",
                        boxShadow: filled === 2 ? "0 0 20px rgba(16,185,129,0.4)" : "none",
                        borderRadius: 9999, padding: "14px 36px", fontSize: 15, fontWeight: 700, transition: "all 0.2s"
                      }}
                      onMouseEnter={e => { if (filled === 2) { e.currentTarget.style.background = "rgba(16,185,129,0.8)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                      onMouseLeave={e => { e.currentTarget.style.background = filled === 2 ? "#10b981" : "transparent"; e.currentTarget.style.transform = "translateY(0)"; }}>
                      {activating ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTop: "2px solid black", animation: "spin 1s linear infinite", display: "inline-block" }} />Activation...</span> : `Activer mon Jumeau ${filled === 2 ? "🌿" : ""}`}
                    </button>
                  </div>
                </div>
              </section>
            ) : null}
          </main>

          <style>{`
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes drawCheck { from { stroke-dashoffset: 30; } to { stroke-dashoffset: 0; } }
            @keyframes fadeOut { from { opacity: 0.8; } to { opacity: 0; } }
            @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
          `}</style>
        </div>
      )}
    </>
  );
}
