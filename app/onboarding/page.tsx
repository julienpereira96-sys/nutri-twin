"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type QuestionType = "single" | "multiple" | "multiple_with_free" | "free" | "single_with_free";

type Question = {
  id: string;
  block: string;
  label: string;
  sublabel?: string;
  type: QuestionType;
  options?: string[];
  placeholder?: string;
  optional?: boolean;
};

const questions: Question[] = [
  // BLOC 1 — IDENTITÉ & CARACTÈRE
  { id: "tone_of_voice", block: "Identité & Caractère", label: "Quelle posture relationnelle votre jumeau doit-il adopter ?", sublabel: "Le ton qu'il devra adopter par défaut avec vos patients", type: "single_with_free", options: ["Le Médical : factuel, précis, sobre, sans émojis", "Le Coach : énergique, motivant, direct, ça bouge", "Le Complice : chaleureux, empathique, très humain", "Le Pédagogue : explique, vulgarise, rassure", "Autre (Précisez...)"] },
  { id: "tutoiement", block: "Identité & Caractère", label: "Votre jumeau doit-il tutoyer ou vouvoyer vos patients ?", type: "single", options: ["Vouvoiement strict", "Vouvoiement bienveillant", "Tutoiement naturel", "Il s'adapte selon le patient"] },
  { id: "technicite", block: "Identité & Caractère", label: "Quel niveau de langage votre jumeau doit-il utiliser ?", type: "single", options: ["Très vulgarisé, zéro jargon", "Quelques termes techniques expliqués simplement", "Scientifique et précis", "Il s'adapte selon le patient"] },
  { id: "longueur_reponses", block: "Identité & Caractère", label: "Quel style de réponse votre jumeau doit-il privilégier ?", type: "single", options: ["Court et direct, l'essentiel en 2-3 phrases", "Détaillé et complet, il explique tout", "Empathique d'abord, il valide l'émotion avant le conseil", "Adapté à la complexité de la question"] },
  { id: "emojis", block: "Identité & Caractère", label: "Votre jumeau doit-il utiliser des émojis ?", type: "single", options: ["Jamais, ça fait peu professionnel", "Avec modération, quand nécessaire", "Souvent, ça humanise les échanges"] },

  // BLOC 2 — PHILOSOPHIE NUTRITIONNELLE
  { id: "approche_generale", block: "Philosophie Nutritionnelle", label: "Quelle est votre philosophie principale ?", type: "single_with_free", options: ["Rééquilibrage alimentaire progressif", "Alimentation intuitive et anti-régime strict", "Micronutrition fonctionnelle", "Contrôle des macros (déficit calorique mesuré)", "Autre (Précisez...)"] },
  { id: "pathologies", block: "Philosophie Nutritionnelle", label: "Quel est votre cœur de métier ?", sublabel: "Vous pouvez en sélectionner plusieurs", type: "multiple_with_free", options: ["Perte de poids / obésité", "TCA (troubles du comportement alimentaire)", "Diabète / glycémie / métabolisme", "Performance sportive", "Inconfort digestif / FODMAP", "Fatigue / micronutrition", "Femme enceinte / post-partum", "Enfants / adolescents", "Autre (Précisez...)"] },
  { id: "position_regimes", block: "Philosophie Nutritionnelle", label: "Votre avis sur les régimes restrictifs ?", type: "single", options: ["Je les déconseille systématiquement", "Je les étudie cas par cas", "Certains sont utiles dans mon protocole", "Je reste neutre et m'adapte"] },
  { id: "position_glucides", block: "Philosophie Nutritionnelle", label: "Votre position sur les glucides ?", type: "single", options: ["Indispensables à chaque repas", "À moduler selon l'objectif et le profil", "Je les limite en général", "Dépend du patient et du moment"] },
  { id: "position_jeune", block: "Philosophie Nutritionnelle", label: "Votre position sur le jeûne intermittent ?", type: "single", options: ["Je le déconseille", "Utile dans des cas précis, sur indication", "Outil intéressant si bien adapté à la personne", "Je le pratique moi-même et l'intègre souvent"] },
  { id: "position_complements", block: "Philosophie Nutritionnelle", label: "Votre position sur les compléments alimentaires ?", type: "single", options: ["Inutiles en général, une bonne alimentation suffit", "Utiles ponctuellement selon les carences identifiées", "Partie intégrante de mon protocole régulier", "Systématiquement prescrits selon bilan biologique"] },
  { id: "position_petit_dejeuner", block: "Philosophie Nutritionnelle", label: "Votre position sur le petit-déjeuner ?", type: "single", options: ["Obligatoire pour bien démarrer la journée", "Optionnel, certains fonctionnent très bien sans", "Recommandé mais adapté au patient", "Je ne l'impose jamais, liberté totale"] },
  { id: "sensibilite_budget", block: "Philosophie Nutritionnelle", label: "Quelle est votre approche face au budget alimentaire de vos patients ?", type: "single", options: ["Priorité absolue à l'accessibilité : je m'adapte toujours au budget et valide les marques distributeurs ou le surgelé.", "Équilibre souple : je propose des alternatives économiques tout en encourageant la qualité quand c'est possible.", "Priorité à la qualité brute : je pousse vers le moins transformé, quitte à ce que le panier d'achat soit plus sélectif."] },
  { id: "orientation_produits", block: "Philosophie Nutritionnelle", label: "Quels types de produits encouragez-vous en priorité ?", sublabel: "Vous pouvez en sélectionner plusieurs", type: "multiple_with_free", options: ["Le bio, le local et les circuits courts", "Le fait-maison et les produits bruts / non transformés", "La flexibilité totale : l'important c'est l'équilibre et les portions, peu importe la provenance", "L'alimentation à dominante végétale (végétarien / flexitarien)", "Autre (Précisez...)"] },
  { id: "jamais_dire", block: "Philosophie Nutritionnelle", label: "Y a-t-il des pratiques que vous refusez catégoriquement ?", sublabel: "Exemple : régimes très hypocaloriques, détox, jeûne prolongé de plus de 24h...", type: "free", placeholder: "Décrivez ce que votre jumeau ne doit jamais recommander..." },
  { id: "conviction", block: "Philosophie Nutritionnelle", label: "Quelle est votre règle d'or ?", sublabel: "Votre conviction la plus forte en tant que praticien, celle qui guide tout le reste", type: "free", placeholder: "Exemple : Pas d'aliment interdit, le plaisir avant tout. Ou : la régularité prime toujours sur la perfection..." },

  // BLOC 3 — GESTION HUMAINE & ÉMOTIONS
  { id: "alimentation_emotionnelle", block: "Gestion Humaine & Émotions", label: "Un patient mange ses émotions. Votre approche ?", type: "single_with_free", options: ["Je travaille uniquement l'alimentation, c'est mon périmètre", "Je reconnais la dimension émotionnelle et j'oriente vers un psy si besoin", "Je travaille les deux en parallèle dans mon suivi", "Autre (Précisez...)"] },
  { id: "non_suivi", block: "Gestion Humaine & Émotions", label: "Un patient ne suit plus votre protocole depuis plusieurs jours. Votre réaction ?", type: "single", options: ["Bienveillance totale, on repart sans jugement", "On cherche ensemble ce qui bloque vraiment", "Recadrage ferme mais bienveillant", "On remet en question le protocole ensemble"] },
  { id: "fetes_vacances", block: "Gestion Humaine & Émotions", label: "Votre position sur les fêtes et les vacances ?", type: "single", options: ["On anticipe et planifie ensemble à l'avance", "Liberté totale, on reprend le protocole après", "L'équilibre se fait sur le mois, pas la semaine", "Je donne des guidelines souples et fais confiance"] },
  { id: "levier_motivation", block: "Gestion Humaine & Émotions", label: "Comment remotivez-vous un patient qui décroche ?", type: "single", options: ["Je lui rappelle ses objectifs initiaux et ses raisons profondes", "Je valorise chaque petit progrès, même minime", "Je propose d'ajuster le protocole ensemble", "Je lui laisse de l'espace et attends son retour"] },
  { id: "profil_perfectionniste", block: "Gestion Humaine & Émotions", label: "Un patient ultra-perfectionniste stresse dès qu'il s'éloigne du plan. Votre approche ?", type: "single", options: ["Je pousse au lâcher-prise", "Je valorise sa rigueur tout en l'aidant à accepter que l'équilibre se fait sur la durée", "Je valide son niveau d'exigence et l'aide à recalibrer pour tenir sur le long terme"] },
  { id: "adaptation_profil", block: "Gestion Humaine & Émotions", label: "Comment adaptez-vous votre communication selon le profil du patient ?", type: "single", options: ["Je reste moi-même avec tout le monde, c'est ma force", "J'adapte le ton mais pas le fond de mes conseils", "J'adapte à la fois le fond et la forme selon la personne", "Je laisse le patient me guider vers ce dont il a besoin"] },

  // BLOC 4 — SÉCURITÉ & LIMITES
  { id: "perimetre", block: "Sécurité & Limites", label: "Jusqu'où peut aller votre jumeau de manière autonome ?", type: "single", options: ["Autonomie totale", "Prudent sur les pathologies, il me redirige", "Questions simples uniquement, il m'alerte pour tout le reste"] },
  { id: "questions_medicales", block: "Sécurité & Limites", label: "Face à une question médicale complexe, un traitement ou un bilan sanguin ?", type: "single", options: ["Il répond selon la littérature scientifique disponible", "Il dit qu'il ne sait pas et m'alerte directement", "Il propose une piste et invite à valider lors de la consultation", "Il redirige systématiquement vers le médecin"] },
  { id: "urgence_detresse", block: "Sécurité & Limites", label: "Comment votre jumeau gère-t-il une souffrance psychologique exprimée ?", type: "single", options: ["Il exprime de l'empathie et invite doucement à en parler lors de la prochaine consultation", "Il oriente vers une ligne d'écoute ou un professionnel de santé", "Il gère avec bienveillance dans les limites de son périmètre"] },
  { id: "ligne_rouge", block: "Sécurité & Limites", label: "Votre ligne rouge absolue ?", sublabel: "Ce que votre jumeau ne doit JAMAIS dire ou faire, quoi qu'il arrive", type: "free", placeholder: "Exemple : Ne jamais culpabiliser un patient. Ne jamais donner de calories précises sans contexte. Ne jamais parler de médicaments..." },

  // MISES EN SITUATION
  { id: "situation_craquage", block: "Mises en situation", label: "Il est 22h. Un patient vous écrit :", sublabel: '"J\'ai craqué sur tout le frigo ce soir, je me déteste, je suis nul(le). Je vais jamais y arriver."', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_stagnation", block: "Mises en situation", label: "Un patient vous écrit :", sublabel: '"La balance n\'a pas bougé d\'un gramme cette semaine alors que j\'ai été irréprochable. Ça m\'énerve, j\'ai envie de tout arrêter."', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_abandon", block: "Mises en situation", label: "Un patient disparu revient après 3 semaines de silence :", sublabel: '"J\'ai honte de revenir. J\'ai tout sabordé ces dernières semaines, j\'ai même pas osé vous écrire tellement c\'était mauvais."', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_prediabete", block: "Mises en situation", label: "Un patient sort de chez son médecin :", sublabel: '"Mon médecin m\'a dit que j\'ai un prédiabète. Est-ce que je dois arrêter les féculents complètement ?"', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_alcool", block: "Mises en situation", label: "Un patient vous pose LA question du week-end :", sublabel: '"Est-ce que j\'ai le droit de boire mes 3 verres de vin ou mes bières le week-end avec mes amis, ou ça ruine tout ?"', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_marketing", block: "Mises en situation", label: "Un patient a vu une pub en ligne :", sublabel: '"J\'ai vu un complément qui promet de brûler les graisses sans rien changer à l\'alimentation. Ça marche vraiment ou c\'est du marketing ?"', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_drastique", block: "Mises en situation", label: "Un patient vous demande quelque chose d'irréaliste :", sublabel: '"Je veux perdre 8 kilos en 3 semaines pour mon mariage. On fait comment ?"', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_flemme", block: "Mises en situation", label: "Le classique du soir de semaine :", sublabel: '"Je rentre du boulot à 19h, je suis crevé(e), j\'ai rien à cuisiner et zéro motivation. Qu\'est-ce que je peux faire de rapide sans tout ruiner ?"', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_coup_dur", block: "Mises en situation", label: "Un patient traverse quelque chose de difficile :", sublabel: '"J\'ai appris une très mauvaise nouvelle aujourd\'hui. Je n\'ai plus la force de cuisiner ni de suivre le programme."', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_victoire", block: "Mises en situation", label: "Un patient annonce une vraie victoire :", sublabel: '"Je voulais vous dire : j\'ai tenu tout le week-end chez ma belle-famille sans craquer une seule fois, même pendant l\'apéro. Pour moi c\'était le scénario le plus difficile depuis qu\'on a commencé. Je suis vraiment fier(e) de moi."', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_arret", block: "Mises en situation", label: "Un patient veut voler de ses propres ailes :", sublabel: '"Je me sens vraiment bien depuis 2 mois. J\'ai retrouvé un équilibre qui me convient, je me pèse plus, je stresse plus à table. Est-ce qu\'on a encore besoin de continuer les séances ou je peux y aller seul(e) maintenant ?"', type: "free", placeholder: "Vous auriez répondu quoi ?" },
];

const BLOCKS = ["Identité & Caractère", "Philosophie Nutritionnelle", "Gestion Humaine & Émotions", "Sécurité & Limites", "Mises en situation", "Votre Expertise"];
const AUTRE_OPTION = "Autre (Précisez...)";

const NoteIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);



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

  // Core UI states
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [showCertTooltip, setShowCertTooltip] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [genProgress, setGenProgress] = useState(0);
  const [genDone, setGenDone] = useState(false);
  const [genFlash, setGenFlash] = useState(false);
  const genTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const genIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const blockBarRef = useRef<HTMLDivElement | null>(null);
  const activeBlockRef = useRef<HTMLSpanElement | null>(null);
  const [activating, setActivating] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [autreText, setAutreText] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("onboarding_autre") ?? "";
  });

  // Vision & Signature states
  const [visionText, setVisionText] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("onboarding_vision") ?? "";
  });
  const [signatureText, setSignatureText] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("onboarding_signature") ?? "";
  });
  const [visionSaved, setVisionSaved] = useState(false);
  const [signatureSaved, setSignatureSaved] = useState(false);
  const [visionEditing, setVisionEditing] = useState(false);
  const [signatureEditing, setSignatureEditing] = useState(false);
  const [savingVision, setSavingVision] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [visionError, setVisionError] = useState("");
  const [signatureError, setSignatureError] = useState("");

  // Computed values
  const total = questions.length;
  const isIdentityStep = step === total;
  const currentQuestion = questions[step];
  const progress = genDone ? 100 : isGenerating ? 99 : isIdentityStep ? 98 : Math.round((step / total) * 95);
  const currentBlock = isIdentityStep ? "" : currentQuestion?.block ?? "";
  const blockIndex = BLOCKS.indexOf(currentBlock);
  const identityFilled = (visionSaved ? 1 : 0) + (signatureSaved ? 1 : 0);
  const identityScore = identityFilled === 0 ? 80 : identityFilled === 1 ? 90 : 100;
  const identityColor = identityFilled === 0 ? "#f59e0b" : identityFilled === 1 ? "#06b6d4" : "#10b981";

  // Per-section colors
  const visionColor = !visionSaved ? "#64748b" : signatureSaved ? "#10b981" : "#06b6d4";
  const signatureColor = !signatureSaved ? "#64748b" : visionSaved ? "#10b981" : "#06b6d4";
  // RGB components for inline rgba() usage — green when both filled, cyan otherwise
  const visionRgb = visionColor === "#10b981" ? "16,185,129" : "6,182,212";
  const signatureRgb = signatureColor === "#10b981" ? "16,185,129" : "6,182,212";

  // Persistence effects
  useEffect(() => { localStorage.setItem("onboarding_step", String(step)); }, [step]);
  useEffect(() => { localStorage.setItem("onboarding_answers", JSON.stringify(answers)); }, [answers]);
  useEffect(() => { localStorage.setItem("onboarding_selected", JSON.stringify(selected)); }, [selected]);
  useEffect(() => { localStorage.setItem("onboarding_autre", autreText); }, [autreText]);
  useEffect(() => { localStorage.setItem("onboarding_vision", visionText); }, [visionText]);
  useEffect(() => { localStorage.setItem("onboarding_signature", signatureText); }, [signatureText]);

  // Auto-scroll la barre de blocs pour garder l'élément actif visible
  useEffect(() => {
    if (activeBlockRef.current && blockBarRef.current) {
      activeBlockRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [blockIndex]);

  // Restore selected answer when navigating between questions
  useEffect(() => {
    if (isIdentityStep) return;
    const q = questions[step];
    if (!q) return;
    const saved = answers[q.id];
    if (saved === undefined || saved === null) {
      setSelected(q.type === "multiple" || q.type === "multiple_with_free" ? [] : "");
      setAutreText("");
    } else if (q.type === "multiple" || q.type === "multiple_with_free") {
      const arr = Array.isArray(saved) ? saved : [];
      const hasAutre = q.type === "multiple_with_free" && arr.some(v => !q.options?.slice(0, -1).includes(v));
      if (hasAutre) {
        const autreVal = arr.find(v => !q.options?.slice(0, -1).includes(v)) ?? "";
        setSelected([...arr.filter(v => q.options?.slice(0, -1).includes(v)), AUTRE_OPTION]);
        setAutreText(autreVal);
      } else { setSelected(arr); setAutreText(""); }
    } else if (q.type === "single_with_free") {
      const isOption = q.options?.includes(saved as string);
      if (isOption) { setSelected(saved as string); setAutreText(""); }
      else { setSelected(AUTRE_OPTION); setAutreText(saved as string); }
    } else {
      setSelected(typeof saved === "string" ? saved : "");
      setAutreText("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Init: load onboarding state + vision/signature from Supabase
  useEffect(() => {
    const init = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prac } = await supabase.from("practitioners").select("onboarding_done").eq("user_id", user.id).single();
      if (prac?.onboarding_done) {
        setAlreadyDone(true);
      } else {
        const savedUserId = localStorage.getItem("onboarding_user_id");
        if (savedUserId && savedUserId !== user.id) {
          localStorage.removeItem("onboarding_step");
          localStorage.removeItem("onboarding_answers");
          localStorage.removeItem("onboarding_selected");
          localStorage.removeItem("onboarding_autre");
          localStorage.removeItem("onboarding_vision");
          localStorage.removeItem("onboarding_signature");
        }
        localStorage.setItem("onboarding_user_id", user.id);
      }

      // Load existing vision/signature from Supabase (source of truth for saved state)
      const { data: profile } = await supabase
        .from("practitioner_profiles")
        .select("vision, signature")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.vision) {
        setVisionText(profile.vision);
        setVisionSaved(true);
        localStorage.setItem("onboarding_vision", profile.vision);
      }
      if (profile?.signature) {
        setSignatureText(profile.signature);
        setSignatureSaved(true);
        localStorage.setItem("onboarding_signature", profile.signature);
      }
    };
    void init();
  }, []);

  // Block browser back navigation
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

  // Question navigation
  const canGoNext = () => {
    if (currentQuestion?.optional) return true;
    if (currentQuestion?.type === "multiple") return Array.isArray(selected) && selected.length > 0;
    if (currentQuestion?.type === "multiple_with_free") {
      if (!Array.isArray(selected) || selected.length === 0) return false;
      if (selected.includes(AUTRE_OPTION)) return autreText.trim().length > 0;
      return true;
    }
    if (currentQuestion?.type === "free") return typeof selected === "string" && selected.trim().length > 0;
    if (currentQuestion?.type === "single_with_free") {
      if (typeof selected !== "string" || selected.length === 0) return false;
      if (selected === AUTRE_OPTION) return autreText.trim().length > 0;
      return true;
    }
    return typeof selected === "string" && selected.length > 0;
  };

  const goNext = () => {
    if (!canGoNext() || isIdentityStep) return;
    let valueToSave: string | string[] = selected;
    if (currentQuestion.type === "single_with_free" && selected === AUTRE_OPTION) {
      valueToSave = autreText.trim();
    } else if (currentQuestion.type === "multiple_with_free" && Array.isArray(selected) && selected.includes(AUTRE_OPTION)) {
      valueToSave = selected.map(v => v === AUTRE_OPTION ? autreText.trim() : v).filter(Boolean);
    }
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: valueToSave }));
    setSelected(currentQuestion.type === "multiple" || currentQuestion.type === "multiple_with_free" ? [] : "");
    setAutreText("");
    setStep(prev => prev + 1);
  };

  const toggleMultiple = (option: string) => {
    setSelected(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.includes(option) ? arr.filter(x => x !== option) : [...arr, option];
    });
  };

  // Save vision to Supabase
  const saveVision = async () => {
    if (!visionText.trim() || savingVision) return;
    if (visionText.trim().length < 100) { setVisionError("Ce texte est trop court (minimum 100 caractères)."); return; }
    setVisionError("");
    setSavingVision(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch("/api/save-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: { vision: visionText.trim() }, userId: user?.id ?? null }),
      });
      if (res.ok) { setVisionSaved(true); setVisionEditing(false); }
    } finally { setSavingVision(false); }
  };

  // Save signature to Supabase
  const saveSignature = async () => {
    if (!signatureText.trim() || savingSignature) return;
    if (signatureText.trim().length < 100) { setSignatureError("Ce texte est trop court (minimum 100 caractères)."); return; }
    setSignatureError("");
    setSavingSignature(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch("/api/save-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: { signature: signatureText.trim() }, userId: user?.id ?? null }),
      });
      if (res.ok) { setSignatureSaved(true); setSignatureEditing(false); }
    } finally { setSavingSignature(false); }
  };

  // Delete vision from Supabase
  const deleteVision = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    await fetch("/api/save-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: { vision: "" }, userId: user?.id ?? null }),
    });
    setVisionText(""); setVisionSaved(false); setVisionEditing(false);
    localStorage.removeItem("onboarding_vision");
  };

  // Delete signature from Supabase
  const deleteSignature = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    await fetch("/api/save-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: { signature: "" }, userId: user?.id ?? null }),
    });
    setSignatureText(""); setSignatureSaved(false); setSignatureEditing(false);
    localStorage.removeItem("onboarding_signature");
  };

  // Save all answers + activate
  const saveProfile = async (redirect = true, extras?: { vision?: string; signature?: string }) => {
    if (isSaving) return;
    setIsSaving(true); setSaveError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const formattedAnswers = Object.fromEntries(
        Object.entries(answers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v])
      );
      if (extras?.vision) formattedAnswers.vision = extras.vision;
      if (extras?.signature) formattedAnswers.signature = extras.signature;
      const response = await fetch("/api/save-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: formattedAnswers, userId: user?.id ?? null }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? "Erreur lors de la sauvegarde.");
      }
      await supabase.from("practitioners").update({ onboarding_done: true }).eq("user_id", user?.id ?? "");
      localStorage.removeItem("onboarding_step");
      localStorage.removeItem("onboarding_answers");
      localStorage.removeItem("onboarding_selected");
      localStorage.removeItem("onboarding_autre");
      if (redirect) router.push("/dashboard");
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Impossible de sauvegarder votre profil.");
    } finally { setIsSaving(false); }
  };

  const startGeneration = () => {
    void saveProfile(false, { vision: visionText, signature: signatureText });
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

  // Reusable save button style helper
  const saveBtnStyle = (active: boolean, loading: boolean) => ({
    background: active && !loading ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.03)",
    border: active && !loading ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.06)",
    color: active && !loading ? "#10b981" : "#3f3f46",
    borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 600,
    cursor: active && !loading ? "pointer" : "not-allowed",
    opacity: loading ? 0.7 : 1,
    display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
  });

  return (
    <>
      {alreadyDone ? (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
          <div className="rounded-3xl border border-[#10b981]/30 bg-[#121212] p-8 max-w-md w-full text-center">
            <div className="w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(16,185,129,0.12)", border: "2px solid rgba(16,185,129,0.4)" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 12 9 17 20 6" stroke="#10b981" strokeWidth="2"/>
              </svg>
            </div>
            <p className="text-xs font-mono font-bold tracking-widest text-[#10b981] uppercase mb-3">Jumeau opérationnel</p>
            <h1 className="text-xl font-bold text-white mb-3">Votre jumeau s'est finalisé<br />en arrière-plan.</h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-8">
              Même si vous avez quitté la page, votre profil a bien été enregistré. Votre Jumeau est prêt à prendre le relais auprès de vos patients.
            </p>
            <button type="button" onClick={() => { setNavigating(true); setTimeout(() => router.push("/dashboard"), 800); }}
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "black", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", border: "none", boxShadow: "0 4px 24px rgba(16,185,129,0.25)", transition: "all 0.25s ease" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(16,185,129,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}>
              {navigating
                ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTop: "2px solid black", animation: "spin 1s linear infinite", display: "inline-block" }} />Chargement</span>
                : "Accéder à mon cabinet numérique"}
            </button>
          </div>
        </div>
      ) : (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
          <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

            {/* Progress bar */}
            <div className="mb-8">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-300">Configuration de votre jumeau : {progress}%</p>
                {!isIdentityStep && !isGenerating && <p className="text-xs text-zinc-500">{step + 1} / {total}</p>}
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#10b981] transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              {!isIdentityStep && !isGenerating && (
                <div ref={blockBarRef} className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
                  {BLOCKS.map((block, i) => (
                    <span key={block}
                      ref={i === blockIndex ? activeBlockRef : null}
                      className="whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium transition"
                      style={{
                        background: i === blockIndex ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                        color: i === blockIndex ? "#10b981" : "#52525b",
                        border: i === blockIndex ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.06)",
                      }}>
                      {block}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Question step */}
            {!isIdentityStep && !isGenerating && currentQuestion ? (
              <section className="rounded-3xl border border-white/10 bg-[#121212] p-6 sm:p-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#10b981]">{currentQuestion.block}</p>
                <h1 className="text-xl font-bold leading-tight sm:text-2xl" style={{ textWrap: "pretty" }}>{currentQuestion.label}</h1>
                {currentQuestion.sublabel && (
                  <p className={`mt-2 text-sm text-zinc-400${currentQuestion.sublabel.startsWith('"') ? " italic" : ""}`} style={{ textWrap: "pretty" }}>
                    {currentQuestion.sublabel}
                  </p>
                )}
                <div className="mt-8">
                  {currentQuestion.type === "single" && (
                    <div className="grid gap-3">
                      {currentQuestion.options?.map(option => (
                        <button key={option} type="button" onClick={() => setSelected(option)}
                          className={`w-full rounded-2xl border px-4 py-4 text-left text-[14px] transition-all duration-200 cursor-pointer ${selected === option ? "border-[#10b981] bg-[#10b981]/15 text-white" : "border-white/10 bg-[#1a1a1a] text-zinc-300 hover:border-[#10b981]/50"}`}>
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                  {currentQuestion.type === "single_with_free" && (
                    <div className="grid gap-3">
                      {currentQuestion.options?.map(option => (
                        <button key={option} type="button" onClick={() => { setSelected(option); if (option !== AUTRE_OPTION) setAutreText(""); }}
                          className={`w-full rounded-2xl border px-4 py-4 text-left text-[14px] transition-all duration-200 cursor-pointer ${selected === option ? "border-[#10b981] bg-[#10b981]/15 text-white" : "border-white/10 bg-[#1a1a1a] text-zinc-300 hover:border-[#10b981]/50"}`}>
                          {option}
                        </button>
                      ))}
                      {selected === AUTRE_OPTION && (
                        <input type="text" value={autreText} onChange={e => setAutreText(e.target.value)}
                          placeholder="Précisez votre approche..." autoFocus
                          className="w-full rounded-2xl border border-[#10b981]/50 bg-[#1a1a1a] px-4 py-4 text-[15px] text-white outline-none transition placeholder:text-zinc-600 focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25" />
                      )}
                    </div>
                  )}
                  {(currentQuestion.type === "multiple" || currentQuestion.type === "multiple_with_free") && (
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
                      {currentQuestion.type === "multiple_with_free" && Array.isArray(selected) && selected.includes(AUTRE_OPTION) && (
                        <div className="sm:col-span-2">
                          <input type="text" value={autreText} onChange={e => setAutreText(e.target.value)}
                            placeholder="Précisez votre spécialité..." autoFocus
                            className="w-full rounded-2xl border border-[#10b981]/50 bg-[#1a1a1a] px-4 py-4 text-[15px] text-white outline-none transition placeholder:text-zinc-600 focus:border-[#10b981] focus:ring-2 focus:ring-[#10b981]/25" />
                        </div>
                      )}
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
                    <button type="button" onClick={() => setStep(prev => prev - 1)}
                      className="text-sm text-zinc-500 transition-all duration-200 hover:text-white cursor-pointer">← Retour</button>
                  ) : <div />}
                  <button type="button" onClick={goNext} disabled={!canGoNext()}
                    style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", borderRadius: 12, padding: "10px 28px", fontSize: 13, fontWeight: 600, cursor: canGoNext() ? "pointer" : "not-allowed", opacity: canGoNext() ? 1 : 0.4, transition: "all 0.2s" }}
                    onMouseEnter={e => { if (canGoNext()) { e.currentTarget.style.background = "rgba(16,185,129,0.2)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"; }}>
                    Suivant →
                  </button>
                </div>
              </section>

            ) : isGenerating ? (
              /* Generation screen */
              <section className="rounded-3xl border border-[#10b981]/20 bg-[#0d0d0d] p-8 min-h-[520px] flex flex-col overflow-hidden">
                {genDone ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ animation: "fadeInUp 0.6s ease forwards" }}>
                    <div className="w-28 h-28 rounded-full flex items-center justify-center mb-8"
                      style={{ background: "rgba(16,185,129,0.12)", border: "2px solid rgba(16,185,129,0.4)" }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="4 12 9 17 20 6" stroke="rgba(16,185,129,0.15)" strokeWidth="2"/>
                        <polyline points="4 12 9 17 20 6" stroke="#10b981" strokeWidth="2" strokeDasharray="30" strokeDashoffset="30" style={{ animation: "drawCheck 5s ease 0.3s forwards" }}/>
                        <polyline points="4 12 9 17 20 6" stroke="white" strokeWidth="3" strokeDasharray="2 28" strokeDashoffset="30" style={{ animation: "drawCheck 5s ease 0.3s forwards, fadeOut 0.5s ease 5.3s forwards", opacity: 0.8, filter: "blur(0.5px)" }}/>
                      </svg>
                    </div>
                    <p className="text-xs font-mono font-bold tracking-widest text-[#10b981] uppercase mb-3">Configuration terminée</p>
                    <h2 className="text-2xl font-bold text-white mb-3 leading-tight">Votre Jumeau est prêt.</h2>
                    <p className="text-sm text-zinc-400 max-w-sm leading-relaxed mb-2">
                      Votre double numérique est désormais capable de prendre le relais auprès de vos patients, avec votre philosophie, votre expertise et votre signature.
                    </p>
                    <p className="text-xs font-mono text-[#10b981]/50 mb-10">[NT-006] Certification validée · Jumeau opérationnel</p>
                    {saveError && <p className="mb-4 text-sm text-red-400">{saveError}</p>}
                    <button type="button" onClick={() => { setNavigating(true); setTimeout(() => router.push("/dashboard"), 800); }}
                      style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "black", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", border: "none", boxShadow: "0 4px 24px rgba(16,185,129,0.25)", transition: "all 0.25s ease" }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(16,185,129,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}>
                      {navigating
                        ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.2)", borderTop: "2px solid black", animation: "spin 1s linear infinite", display: "inline-block" }} />Chargement</span>
                        : "Accéder à mon cabinet numérique"}
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
                        {/* Halo radial externe */}
                        <div className="absolute rounded-full" style={{ inset: -16, background: "radial-gradient(circle, rgba(16,185,129,0.14), transparent 62%)", pointerEvents: "none" }} />
                        {/* Arc tournant */}
                        <svg className="absolute inset-0 w-full h-full" style={{ animation: "spin 3s linear infinite" }} viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(16,185,129,0.08)" strokeWidth="1.5"/>
                          <circle cx="50" cy="50" r="46" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="80 210" strokeLinecap="round"/>
                        </svg>
                        {/* Logo login-page style — cercle émeraude pulsant + SVG */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div style={{ width: 75, height: 75, borderRadius: "50%", background: "transparent", border: "2px solid rgba(16,185,129,0.6)", boxShadow: "0 0 16px rgba(16,185,129,0.3), 0 0 32px rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse-ring 2s ease-in-out infinite" }}>
                            <svg width="36" height="36" viewBox="0 0 585 586" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M456 0.87578C451.1 1.27578 433.3 1.37577 416.5 1.17577C377.6 0.475768 341.2 2.0758 319.5 5.2758C296.3 8.6758 294.5 9.07578 294.5 9.87578C294.5 10.3758 293.6 10.4758 292.5 10.1758C291.3 9.87583 290.5 10.1758 290.5 10.7758C290.5 11.4758 290.1 11.6758 289.5 11.3758C288.3 10.6758 269.3 15.5758 254.7 20.4758C226.6 29.9758 196.5 43.9757 173 58.5757C73.1 120.776 12.9 217.176 1.30005 333.376C0.300049 343.176 0 375.476 0 465.876V585.376L120 585.676C250.9 585.976 269.6 585.376 298.6 580.476C344.7 572.676 392 553.776 430.4 527.876C455.5 511.076 489.7 479.376 507.1 456.876C519.1 441.476 533.8 419.076 532.9 417.676C532.5 416.976 532.5 416.676 533 417.076C534 418.076 539 409.876 547 393.776C563.1 361.676 572.6 333.276 579.4 296.376C585.2 264.876 585 269.276 584.7 130.876C584.5 60.7758 584.1 2.57579 583.9 1.57579C583.4 -0.0242076 579.8 -0.124208 524.2 0.0757925C491.6 0.0757925 461 0.47578 456 0.87578ZM528.8 31.7758C530.3 32.2758 519.1 43.9757 469.3 93.5757C435.6 127.176 405.1 157.176 401.5 160.376C365.4 192.376 312.4 218.976 262.5 230.376L248 233.576L247.7 230.676C247 224.176 254.3 196.476 261.7 177.376C265.8 166.976 273.3 151.676 278 144.376C279.7 141.576 281 138.676 280.7 137.876C280.4 137.076 280.6 136.676 281 137.076C281.4 137.476 284 134.576 286.8 130.576C295.7 117.576 309.8 101.076 317.5 94.4758C319.4 92.7758 322.8 89.5758 325 87.3758C327.1 85.1758 328.5 84.0758 328 84.8758C327.5 85.6758 329.3 84.4758 332 82.1758C346.5 70.0758 375.5 53.6758 394 47.2758C398.4 45.7758 402.2 44.2758 402.5 43.9758C402.8 43.6758 403.7 43.2758 404.5 43.1758C408.8 42.7758 423.5 38.1758 422.8 37.4758C422.4 36.9758 423 36.9758 424.2 37.2758C425.4 37.6758 429.2 37.2758 432.7 36.4758C446 33.4758 456 32.5758 487.5 31.9758C505.4 31.5758 521.6 31.1758 523.5 31.1758C525.4 31.0758 527.8 31.3758 528.8 31.7758ZM345.5 34.8758C345.5 35.3758 339.8 39.5758 332.8 44.1758C304.5 62.6758 282.3 84.0758 262 112.376C255.5 121.376 246.9 135.876 247.2 137.076C247.4 137.476 247.1 137.876 246.6 137.876C245.5 137.876 235.6 158.976 230.7 171.876C225.1 186.476 219.1 211.376 216.5 230.376C210 278.376 200.8 313.476 186 347.876C178.4 365.276 171.5 377.776 157 400.376L146.1 417.376L89.5 473.876L33 530.376L32.7 510.376C32.4 487.176 34.4 469.476 40 447.376C52.5 397.876 82.6 350.576 121.5 319.176C139.7 304.476 164.5 289.176 179.8 283.176C184.6 281.276 186.7 279.976 187 278.476C187.2 277.276 188.1 270.776 189 263.876C189.9 256.976 190.8 250.376 191.1 249.076C191.4 247.576 191.1 246.876 190 246.876C189.2 246.876 182.1 249.376 174.3 252.476C135.8 267.376 101.7 291.176 72.1001 323.576C59.1001 337.876 50.2 350.076 37.5 371.176C34.2 376.476 31.9 379.476 31.5 378.676C31.2 377.976 31.2001 367.476 31.6001 355.376C32.7001 321.076 37.1 295.376 47.2 264.376C54.6 241.776 60.8 227.276 71 208.876C104.9 148.076 156.3 99.4758 219 68.8758C256.6 50.6758 297.8 38.4758 334.9 34.9758C339.3 34.4758 343.6 34.0758 344.3 33.9758C344.9 33.9758 345.5 34.2758 345.5 34.8758ZM553.3 82.0757C552.7 112.476 551.4 124.076 546 145.476C542.1 160.776 537.7 172.176 528.5 191.376C520.3 208.276 512.8 219.676 499.8 234.876C487.9 248.876 480.4 256.476 470.5 264.476C453.2 278.376 438.7 287.676 422 295.376C408.7 301.576 403.1 304.176 402 304.476C386.7 309.276 373.8 312.476 360.5 314.876C351.4 316.476 339.7 318.676 334.4 319.776C292.8 328.376 251.2 343.876 219 362.776C215.2 365.076 211.5 366.876 210.8 366.876C210.1 366.876 210.7 364.776 212.4 361.076C224 337.776 234.2 306.876 239.5 279.376C242.2 264.876 242.7 263.876 246.5 263.876C248.2 263.876 256.9 262.276 265.8 260.376C324.3 247.576 371.5 224.976 416.2 188.276C427.6 178.876 521 86.5757 521 84.5757C521 83.9757 521.5 83.3758 522 83.3758C523.4 83.3758 546.1 60.7758 545.8 59.6758C545.6 59.2758 546.1 58.9757 546.8 59.0757C547.4 59.2757 547.9 58.7757 547.7 58.0757C547.6 57.2757 547.9 56.9758 548.4 57.2758C548.9 57.5758 549.8 57.1758 550.5 56.3758C553.5 52.7758 553.7 55.1757 553.3 82.0757ZM555.4 225.876C555.5 236.076 553.2 264.376 551 278.876C545.2 317.876 530.5 361.376 512.3 393.176C495.7 422.076 480.5 442.076 457.6 464.876C431.7 490.676 407 507.976 371.8 524.876C354.2 533.376 322.7 544.476 323.7 541.976C323.9 541.476 329.2 537.376 335.5 532.876C356.6 517.776 371.4 503.976 388.5 483.376C416.8 449.476 436.1 409.076 446 363.276C449.8 345.876 450.2 342.376 448.3 343.276C447.6 343.576 441.8 345.876 435.5 348.376C416.1 355.976 417.7 354.476 413.9 368.476C404.6 402.976 386.1 438.176 363.2 465.376C322.7 513.476 270.3 542.676 208 551.976C197 553.576 57.7001 554.476 56.1001 552.876C55.4001 552.176 68.4 538.476 103.5 503.276C175.9 430.776 188.6 419.176 214.9 401.476C241.2 383.776 274.5 368.176 304.5 359.576C308.9 358.276 312.2 356.876 311.8 356.376C311.3 355.976 311.5 355.876 312.2 356.276C312.9 356.576 317.8 355.776 323.2 354.476C336.5 351.076 362 345.876 365 345.876C366.4 345.876 367.5 345.476 367.5 344.976C367.5 344.376 368.4 344.176 369.6 344.376C370.7 344.576 378.5 343.076 386.8 340.976C423.9 331.676 463 311.476 492.1 286.776C508.8 272.576 530.4 247.976 541.8 230.076C544.2 226.376 547.9 220.676 550 217.376L553.9 211.376L554.6 214.376C555 215.976 555.3 221.176 555.4 225.876Z" fill="#10B981"/>
                            </svg>
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
                              {isPending && <span className="text-zinc-700">-</span>}
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
                        {genStep === 6 && "› Jumeau certifié · Lancement imminent..."}
                      </p>
                    </div>
                  </>
                )}
              </section>

            ) : isIdentityStep ? (
              /* Identity step — Vision & Signature */
              <section className="rounded-3xl border border-white/10 bg-[#121212] p-6 sm:p-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#10b981]">Votre Expertise</p>
                <h1 className="text-xl font-bold leading-tight sm:text-2xl">Définissez votre vision et votre signature</h1>

                {/* Score bar */}
                <div className="mt-5 rounded-2xl p-5 transition-all duration-500"
                  style={{ background: `${identityColor}12`, border: `2px solid ${identityColor}40` }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-white">Niveau de fidélité du jumeau</p>
                    <span className="text-lg font-bold" style={{ color: identityColor }}>{identityScore}%</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${identityScore}%`, backgroundColor: identityColor }} />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: identityColor }}>
                    {identityFilled === 0 && "La structure de votre Jumeau est prête ! Vos réponses lui ont transmis votre logique clinique complète : positions scientifiques, règles de sécurité et réflexes face aux situations difficiles. Il sait désormais quoi répondre sur le fond. Il ne lui manque plus que votre style unique : complétez votre Vision et votre Signature pour que l'IA s'approprie votre identité professionnelle et devienne votre véritable double virtuel."}
                    {identityFilled === 1 && visionSaved && "Votre Jumeau possède désormais votre philosophie profonde ! Il ne lui reste plus qu'à capturer votre Signature pour analyser votre style d'écriture, vos expressions fétiches et le rythme de vos phrases. C'est la dernière étape pour atteindre une fidélité à 100 %."}
                    {identityFilled === 1 && signatureSaved && "Votre Jumeau possède désormais votre ton et votre style d'écriture ! Il ne lui reste plus qu'à prendre en compte votre Vision pour que ses conseils reflètent fidèlement votre positionnement et vos valeurs de praticien. C'est la dernière étape pour atteindre une fidélité à 100 %."}
                    {identityFilled === 2 && "Configuration réussie. Votre Jumeau possède toute votre identité. Il est désormais prêt à vous épauler et à interagir de manière ultra-sécurisée avec vos patients. Rendez-vous sur votre tableau de bord pour inviter vos premiers patients et laisser votre Jumeau prolonger votre accompagnement."}
                  </p>
                </div>

                {/* ── Section 1 — Ma Vision ── */}
                <div className="mt-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 border transition-all duration-500"
                      style={{
                        background: visionSaved ? `${visionColor}30` : "rgba(255,255,255,0.06)",
                        color: visionColor,
                        borderColor: visionSaved ? `${visionColor}60` : "rgba(255,255,255,0.1)",
                      }}>1</div>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b" }}>
                      MA VISION
                    </p>
                    {visionSaved && (
                      <span className="text-xs font-semibold transition-colors duration-500" style={{ color: visionColor }}>
                        ✓ Renseignée
                      </span>
                    )}
                  </div>

                  <div className="ml-10">
                    <p className="text-sm font-bold text-white mb-1">L'ancrage de votre philosophie</p>
                    <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                      Ce texte définit ce en quoi vous croyez profondément et dicte la ligne directrice de votre Jumeau. C'est votre &quot;pourquoi&quot; : vos convictions nutritionnelles qui guideront chacune de ses recommandations.
                    </p>

                    {visionSaved && !visionEditing ? (
                      /* Saved note row */
                      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex-shrink-0" style={{ color: visionColor }}><NoteIcon /></span>
                          <p className="text-sm font-medium text-white truncate">Note de vision</p>
                        </div>
                        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                          <button type="button" onClick={() => setVisionEditing(true)}
                            className="px-2 py-1 rounded-lg text-xs transition-all duration-200 cursor-pointer"
                            style={{ color: "#52525b" }}
                            onMouseEnter={e => e.currentTarget.style.color = "#ffffff"}
                            onMouseLeave={e => e.currentTarget.style.color = "#52525b"}>
                            Modifier
                          </button>
                          <button type="button" onClick={() => void deleteVision()}
                            className="p-1.5 rounded-lg transition-all duration-200 cursor-pointer"
                            style={{ color: "#64748b" }}
                            onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                            onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                            <span style={{ fontSize: 18, lineHeight: 1 }}>×</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Textarea + save button */
                      <>
                        <textarea
                          value={visionText}
                          onChange={e => { setVisionText(e.target.value); if (visionError) setVisionError(""); }}
                          placeholder="Je crois que la santé commence dans l'intestin et que l'alimentation doit être un levier de vitalité, jamais une source d'anxiété. Pour moi, aucun aliment n'est à diaboliser..."
                          rows={6}
                          className="w-full rounded-2xl bg-[#1a1a1a] px-4 py-4 text-[15px] text-white outline-none transition-all placeholder:text-zinc-600"
                          style={{ border: `1px solid ${visionSaved && visionText.trim() ? `rgba(${visionRgb},${visionEditing ? "0.5" : "0.35"})` : "rgba(255,255,255,0.1)"}` }}
                          onFocus={e => { e.currentTarget.style.borderColor = visionSaved ? `rgba(${visionRgb},0.7)` : "rgba(255,255,255,0.25)"; e.currentTarget.style.boxShadow = visionSaved ? `0 0 0 2px rgba(${visionRgb},0.12)` : "0 0 0 2px rgba(255,255,255,0.05)"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = visionSaved && visionText.trim() ? `rgba(${visionRgb},${visionEditing ? "0.5" : "0.35"})` : "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                        />
                        {visionError && <p className="mt-1 text-xs" style={{ color: "#f87171" }}>{visionError}</p>}
                        <div className="mt-3 flex items-center justify-end gap-3">
                          {visionEditing && (
                            <button type="button" onClick={() => setVisionEditing(false)}
                              className="text-sm text-zinc-500 hover:text-white transition cursor-pointer">
                              Annuler
                            </button>
                          )}
                          <button type="button" onClick={() => void saveVision()} disabled={!visionText.trim() || savingVision}
                            style={visionEditing
                              ? { background: visionText.trim() && !savingVision ? `rgba(${visionRgb},0.12)` : "rgba(255,255,255,0.03)", border: visionText.trim() && !savingVision ? `1px solid rgba(${visionRgb},0.3)` : "1px solid rgba(255,255,255,0.06)", color: visionText.trim() && !savingVision ? visionColor : "#3f3f46", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: visionText.trim() && !savingVision ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }
                              : { background: visionText.trim() && !savingVision ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)", border: visionText.trim() && !savingVision ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.06)", color: visionText.trim() && !savingVision ? "#e4e4e7" : "#3f3f46", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: visionText.trim() && !savingVision ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}
                            onMouseEnter={e => { if (visionText.trim() && !savingVision) { e.currentTarget.style.background = visionEditing ? `rgba(${visionRgb},0.2)` : "rgba(255,255,255,0.1)"; e.currentTarget.style.borderColor = visionEditing ? `rgba(${visionRgb},0.5)` : "rgba(255,255,255,0.25)"; } }}
                            onMouseLeave={e => { if (visionText.trim()) { e.currentTarget.style.background = visionEditing ? `rgba(${visionRgb},0.12)` : "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = visionEditing ? `rgba(${visionRgb},0.3)` : "rgba(255,255,255,0.15)"; } }}>
                            {savingVision
                              ? <><span style={{ width: 13, height: 13, borderRadius: "50%", border: `2px solid rgba(${visionRgb},0.2)`, borderTop: `2px solid rgba(${visionRgb},1)`, animation: "spin 1s linear infinite", display: "inline-block", flexShrink: 0 }} />Enregistrement</>
                              : visionEditing ? "Mettre à jour ma vision" : "Enregistrer ma vision"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Separator */}
                <div className="my-10 flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-zinc-600 font-medium px-2">et</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* ── Section 2 — Ma Signature ── */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 border transition-all duration-500"
                      style={{
                        background: signatureSaved ? `${signatureColor}30` : "rgba(255,255,255,0.06)",
                        color: signatureColor,
                        borderColor: signatureSaved ? `${signatureColor}60` : "rgba(255,255,255,0.1)",
                      }}>2</div>
                    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b" }}>
                      MA SIGNATURE
                    </p>
                    {signatureSaved && (
                      <span className="text-xs font-semibold transition-colors duration-500" style={{ color: signatureColor }}>
                        ✓ Renseignée
                      </span>
                    )}
                  </div>

                  <div className="ml-10">
                    <p className="text-sm font-bold text-white mb-1">L'étape finale pour passer de l'intelligence artificielle à votre intelligence émotionnelle</p>
                    <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                      Partagez ici vos métaphores favorites, vos expressions fétiches pour dédramatiser un écart et vos mantras de motivation. C'est ici que votre Jumeau capture votre intuition et ces nuances uniques qui font votre voix.
                    </p>

                    {signatureSaved && !signatureEditing ? (
                      /* Saved note row */
                      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#1a1a1a] px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex-shrink-0" style={{ color: signatureColor }}><NoteIcon /></span>
                          <p className="text-sm font-medium text-white truncate">Note de signature</p>
                        </div>
                        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                          <button type="button" onClick={() => setSignatureEditing(true)}
                            className="px-2 py-1 rounded-lg text-xs transition-all duration-200 cursor-pointer"
                            style={{ color: "#52525b" }}
                            onMouseEnter={e => e.currentTarget.style.color = "#ffffff"}
                            onMouseLeave={e => e.currentTarget.style.color = "#52525b"}>
                            Modifier
                          </button>
                          <button type="button" onClick={() => void deleteSignature()}
                            className="p-1.5 rounded-lg transition-all duration-200 cursor-pointer"
                            style={{ color: "#64748b" }}
                            onMouseEnter={e => e.currentTarget.style.color = "#f87171"}
                            onMouseLeave={e => e.currentTarget.style.color = "#64748b"}>
                            <span style={{ fontSize: 18, lineHeight: 1 }}>×</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Textarea + save button */
                      <>
                        <textarea
                          value={signatureText}
                          onChange={e => { setSignatureText(e.target.value); if (signatureError) setSignatureError(""); }}
                          placeholder={"Je compare souvent le métabolisme à un feu de camp. Mon expression fétiche pour relancer la machine c'est : \"Un repas ne fait pas le moine, on tourne la page\". Mon mantra : \"La régularité bat la perfection\"..."}
                          rows={6}
                          className="w-full rounded-2xl bg-[#1a1a1a] px-4 py-4 text-[15px] text-white outline-none transition-all placeholder:text-zinc-600"
                          style={{ border: `1px solid ${signatureSaved && signatureText.trim() ? `rgba(${signatureRgb},${signatureEditing ? "0.5" : "0.35"})` : "rgba(255,255,255,0.1)"}` }}
                          onFocus={e => { e.currentTarget.style.borderColor = signatureSaved ? `rgba(${signatureRgb},0.7)` : "rgba(255,255,255,0.25)"; e.currentTarget.style.boxShadow = signatureSaved ? `0 0 0 2px rgba(${signatureRgb},0.12)` : "0 0 0 2px rgba(255,255,255,0.05)"; }}
                          onBlur={e => { e.currentTarget.style.borderColor = signatureSaved && signatureText.trim() ? `rgba(${signatureRgb},${signatureEditing ? "0.5" : "0.35"})` : "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = "none"; }}
                        />
                        {signatureError && <p className="mt-1 text-xs" style={{ color: "#f87171" }}>{signatureError}</p>}
                        <div className="mt-3 flex items-center justify-end gap-3">
                          {signatureEditing && (
                            <button type="button" onClick={() => setSignatureEditing(false)}
                              className="text-sm text-zinc-500 hover:text-white transition cursor-pointer">
                              Annuler
                            </button>
                          )}
                          <button type="button" onClick={() => void saveSignature()} disabled={!signatureText.trim() || savingSignature}
                            style={signatureEditing
                              ? { background: signatureText.trim() && !savingSignature ? `rgba(${signatureRgb},0.12)` : "rgba(255,255,255,0.03)", border: signatureText.trim() && !savingSignature ? `1px solid rgba(${signatureRgb},0.3)` : "1px solid rgba(255,255,255,0.06)", color: signatureText.trim() && !savingSignature ? signatureColor : "#3f3f46", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: signatureText.trim() && !savingSignature ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }
                              : { background: signatureText.trim() && !savingSignature ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)", border: signatureText.trim() && !savingSignature ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.06)", color: signatureText.trim() && !savingSignature ? "#e4e4e7" : "#3f3f46", borderRadius: 10, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: signatureText.trim() && !savingSignature ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}
                            onMouseEnter={e => { if (signatureText.trim() && !savingSignature) { e.currentTarget.style.background = signatureEditing ? `rgba(${signatureRgb},0.2)` : "rgba(255,255,255,0.1)"; e.currentTarget.style.borderColor = signatureEditing ? `rgba(${signatureRgb},0.5)` : "rgba(255,255,255,0.25)"; } }}
                            onMouseLeave={e => { if (signatureText.trim()) { e.currentTarget.style.background = signatureEditing ? `rgba(${signatureRgb},0.12)` : "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = signatureEditing ? `rgba(${signatureRgb},0.3)` : "rgba(255,255,255,0.15)"; } }}>
                            {savingSignature
                              ? <><span style={{ width: 13, height: 13, borderRadius: "50%", border: `2px solid rgba(${signatureRgb},0.2)`, borderTop: `2px solid rgba(${signatureRgb},1)`, animation: "spin 1s linear infinite", display: "inline-block", flexShrink: 0 }} />Enregistrement</>
                              : signatureEditing ? "Mettre à jour ma signature" : "Enregistrer ma signature"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom actions */}
                <div className="mt-10 flex items-center justify-between">
                  <button type="button" onClick={() => setStep(prev => prev - 1)}
                    className="text-sm text-zinc-500 transition-all duration-200 hover:text-white cursor-pointer">← Retour</button>

                  <div style={{ position: "relative", display: "inline-block" }}
                    onMouseEnter={() => { if (identityFilled < 2) setShowCertTooltip(true); }}
                    onMouseLeave={() => setShowCertTooltip(false)}
                    onClick={() => { if (identityFilled < 2) setShowCertTooltip(prev => !prev); }}>
                    {showCertTooltip && identityFilled < 2 && (
                      <>
                        <div className="hidden sm:block" style={{ position: "absolute", top: "50%", right: "calc(100% + 12px)", transform: "translateY(-50%)", width: 280, borderRadius: 12, padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontSize: 12, textAlign: "center", pointerEvents: "none", whiteSpace: "normal", zIndex: 10 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            Enregistrez votre {!visionSaved && !signatureSaved ? "Vision et votre Signature" : !visionSaved ? "Vision" : "Signature"} pour activer votre Jumeau.
                          </span>
                        </div>
                        <div className="block sm:hidden" style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, width: 240, borderRadius: 12, padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontSize: 12, textAlign: "center", pointerEvents: "none", whiteSpace: "normal", zIndex: 10 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            Enregistrez votre {!visionSaved && !signatureSaved ? "Vision et votre Signature" : !visionSaved ? "Vision" : "Signature"} pour activer votre Jumeau.
                          </span>
                        </div>
                      </>
                    )}
                    <button type="button"
                      onClick={identityFilled === 2 ? () => {
                        setActivating(true);
                        setTimeout(() => { setActivating(false); startGeneration(); }, 1500);
                      } : undefined}
                      style={{
                        background: identityFilled === 2 ? "linear-gradient(135deg, rgba(16,185,129,0.28), rgba(16,185,129,0.10))" : "transparent",
                        color: identityFilled === 2 ? "#10b981" : "#64748b",
                        border: identityFilled === 2 ? "1px solid rgba(16,185,129,0.5)" : "1px solid rgba(255,255,255,0.1)",
                        cursor: identityFilled === 2 ? "pointer" : "not-allowed",
                        boxShadow: identityFilled === 2 ? "0 0 24px rgba(16,185,129,0.2), inset 0 1px 0 rgba(16,185,129,0.15)" : "none",
                        borderRadius: 12, padding: "14px 36px", fontSize: 15, fontWeight: 700, transition: "all 0.2s",
                      }}
                      onMouseEnter={e => {
                        if (identityFilled === 2) {
                          e.currentTarget.style.background = "linear-gradient(135deg, rgba(16,185,129,0.40), rgba(16,185,129,0.16))";
                          e.currentTarget.style.boxShadow = "0 0 32px rgba(16,185,129,0.35), inset 0 1px 0 rgba(16,185,129,0.2)";
                          e.currentTarget.style.borderColor = "rgba(16,185,129,0.7)";
                          e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
                        }
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = identityFilled === 2 ? "linear-gradient(135deg, rgba(16,185,129,0.28), rgba(16,185,129,0.10))" : "transparent";
                        e.currentTarget.style.boxShadow = identityFilled === 2 ? "0 0 24px rgba(16,185,129,0.2), inset 0 1px 0 rgba(16,185,129,0.15)" : "none";
                        e.currentTarget.style.borderColor = identityFilled === 2 ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.1)";
                        e.currentTarget.style.transform = "translateY(0) scale(1)";
                      }}>
                      {activating
                        ? <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(16,185,129,0.2)", borderTop: "2px solid #10b981", animation: "spin 1s linear infinite", display: "inline-block" }} />
                            Activation
                          </span>
                        : `Activer mon Jumeau${identityFilled === 2 ? " 🌿" : ""}`}
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
            @keyframes pulse-ring { 0%, 100% { box-shadow: 0 0 14px rgba(16,185,129,0.3), 0 0 28px rgba(16,185,129,0.1); } 50% { box-shadow: 0 0 22px rgba(16,185,129,0.55), 0 0 40px rgba(16,185,129,0.2); } }
          `}</style>
        </div>
      )}
    </>
  );
}
