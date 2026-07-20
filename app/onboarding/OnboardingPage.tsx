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
  { id: "dimension_emotionnelle", block: "Philosophie Nutritionnelle", label: "Quelle place occupe la dimension émotionnelle et comportementale dans votre pratique ?", type: "single", options: ["C'est le cœur de mon travail : la majorité de mes patients ont une relation chargée et complexe avec la nourriture", "C'est une dimension importante que j'intègre systématiquement à l'accompagnement nutritionnel", "Je l'aborde si elle émerge, mais mon approche reste principalement centrée sur le volet nutritionnel"] },
  { id: "position_regimes", block: "Philosophie Nutritionnelle", label: "Votre avis sur les régimes restrictifs ?", type: "single", options: ["Je les déconseille systématiquement", "Je les étudie cas par cas", "Certains sont utiles dans mon protocole", "Je reste neutre et m'adapte"] },
  { id: "position_glucides", block: "Philosophie Nutritionnelle", label: "Votre position sur les glucides ?", type: "single", options: ["Indispensables à chaque repas", "À moduler selon l'objectif et le profil", "Je les limite en général", "Dépend du patient et du moment"] },
  { id: "position_jeune", block: "Philosophie Nutritionnelle", label: "Votre position sur le jeûne intermittent ?", type: "single", options: ["Je le déconseille", "Utile dans des cas précis, sur indication", "Outil intéressant si bien adapté à la personne", "Je le pratique moi-même et l'intègre souvent"] },
  { id: "position_complements", block: "Philosophie Nutritionnelle", label: "Votre position sur les compléments alimentaires ?", type: "single", options: ["Inutiles en général, une bonne alimentation suffit", "Utiles ponctuellement selon les carences identifiées", "Partie intégrante de mon protocole régulier", "Systématiquement prescrits selon bilan biologique"] },
  { id: "position_petit_dejeuner", block: "Philosophie Nutritionnelle", label: "Votre position sur le petit-déjeuner ?", type: "single", options: ["Obligatoire pour bien démarrer la journée", "Optionnel, certains fonctionnent très bien sans", "Recommandé mais adapté au patient", "Je ne l'impose jamais, liberté totale"] },
  { id: "sensibilite_budget", block: "Philosophie Nutritionnelle", label: "Quelle est votre approche face au budget alimentaire de vos patients ?", type: "single", options: ["Priorité absolue à l'accessibilité : je m'adapte toujours au budget et valide les marques distributeurs ou le surgelé.", "Équilibre souple : je propose des alternatives économiques tout en encourageant la qualité quand c'est possible.", "Priorité à la qualité brute : je pousse vers le moins transformé, quitte à ce que le panier d'achat soit plus sélectif."] },
  { id: "orientation_produits", block: "Philosophie Nutritionnelle", label: "Quels types de produits encouragez-vous en priorité ?", sublabel: "Vous pouvez en sélectionner plusieurs", type: "multiple_with_free", options: ["Le bio, le local et les circuits courts", "Le fait-maison et les produits bruts / non transformés", "La flexibilité totale : l'important c'est l'équilibre et les portions, peu importe la provenance", "L'alimentation à dominante végétale (végétarien / flexitarien)", "Autre (Précisez...)"] },
  { id: "jamais_dire", block: "Philosophie Nutritionnelle", label: "Y a-t-il des pratiques que vous refusez catégoriquement ?", sublabel: "Exemple : régimes très hypocaloriques, détox, jeûne prolongé de plus de 24h...", type: "free", placeholder: "Décrivez ce que votre jumeau ne doit jamais recommander..." },
  { id: "conviction", block: "Philosophie Nutritionnelle", label: "Quelle est votre règle d'or ?", sublabel: "Votre conviction la plus forte en tant que praticien, celle qui guide tout le reste", type: "free", placeholder: "Exemple : La relation à la nourriture se construit dans la durée, pas dans la perfection. Ou : mon rôle, c'est d'être présent dans les moments difficiles autant que dans les progrès..." },

  // BLOC 3 — GESTION HUMAINE & ÉMOTIONS
  { id: "alimentation_emotionnelle", block: "Gestion Humaine & Émotions", label: "Un patient mange ses émotions. Votre approche ?", type: "single_with_free", options: ["Je travaille uniquement l'alimentation, c'est mon périmètre", "Je reconnais la dimension émotionnelle et j'oriente vers un psy si besoin", "Je travaille les deux en parallèle dans mon suivi", "Autre (Précisez...)"] },
  { id: "non_suivi", block: "Gestion Humaine & Émotions", label: "Un patient ne suit plus votre protocole depuis plusieurs jours. Votre réaction ?", type: "single", options: ["Bienveillance totale, on repart sans jugement", "On cherche ensemble ce qui bloque vraiment", "Recadrage ferme mais bienveillant", "On remet en question le protocole ensemble"] },
  { id: "fetes_vacances", block: "Gestion Humaine & Émotions", label: "Votre position sur les fêtes et les vacances ?", type: "single", options: ["On anticipe et planifie ensemble à l'avance", "Liberté totale, on reprend le protocole après", "L'équilibre se fait sur le mois, pas la semaine", "Je donne des guidelines souples et fais confiance"] },
  { id: "levier_motivation", block: "Gestion Humaine & Émotions", label: "Comment remotivez-vous un patient qui décroche ?", type: "single", options: ["Je lui rappelle ses objectifs initiaux et ses raisons profondes", "Je valorise chaque petit progrès, même minime", "Je propose d'ajuster le protocole ensemble", "Je lui laisse de l'espace et attends son retour"] },
  { id: "profil_perfectionniste", block: "Gestion Humaine & Émotions", label: "Un patient ultra-perfectionniste stresse dès qu'il s'éloigne du plan. Votre approche ?", type: "single", options: ["Je pousse au lâcher-prise", "Je valorise sa rigueur tout en l'aidant à accepter que l'équilibre se fait sur la durée", "Je valide son niveau d'exigence et l'aide à recalibrer pour tenir sur le long terme"] },
  { id: "adaptation_profil", block: "Gestion Humaine & Émotions", label: "Comment adaptez-vous votre communication selon le profil du patient ?", type: "single", options: ["Je reste moi-même avec tout le monde, c'est ma force", "J'adapte le ton mais pas le fond de mes conseils", "J'adapte à la fois le fond et la forme selon la personne", "Je laisse le patient me guider vers ce dont il a besoin"] },
  { id: "gestion_culpabilite", block: "Gestion Humaine & Émotions", label: "Un patient vient de craquer. Votre position sur la culpabilité qu'il ressent ?", type: "single_with_free", options: ["Je la désamorce immédiatement : la culpabilité est contre-productive et amplifie le problème", "Je valide d'abord l'émotion, puis on explore ensemble ce qui s'est passé, sans jugement", "Je reste factuel : un écart s'analyse, pas se juge. On repart de là.", "Autre (Précisez...)"] },
  { id: "vocabulaire_crise", block: "Gestion Humaine & Émotions", label: "Quand un patient perd le contrôle autour de la nourriture, comment vous en parlez-vous ensemble ?", type: "single_with_free", options: ["Un écart : neutre et factuel, pour éviter de dramatiser", "Une compulsion : pour nommer le mécanisme et pouvoir le travailler", "Un moment difficile : pour valider sans étiqueter", "Je n'utilise pas de mot fixe, j'explore ce qui s'est passé", "Autre (Précisez...)"] },

  // BLOC 4 — SÉCURITÉ & LIMITES
  { id: "perimetre", block: "Sécurité & Limites", label: "Jusqu'où peut aller votre jumeau de manière autonome ?", type: "single", options: ["Autonomie totale", "Prudent sur les pathologies, il me redirige", "Questions simples uniquement, il m'alerte pour tout le reste"] },
  { id: "questions_medicales", block: "Sécurité & Limites", label: "Face à une question médicale complexe, un traitement ou un bilan sanguin ?", type: "single", options: ["Il répond selon la littérature scientifique disponible", "Il dit qu'il ne sait pas et m'alerte directement", "Il propose une piste et invite à valider lors de la consultation", "Il redirige systématiquement vers le médecin"] },
  { id: "urgence_detresse", block: "Sécurité & Limites", label: "Comment votre jumeau gère-t-il une souffrance psychologique exprimée ?", type: "single", options: ["Il exprime de l'empathie et invite doucement à en parler lors de la prochaine consultation", "Il oriente vers une ligne d'écoute ou un professionnel de santé", "Il gère avec bienveillance dans les limites de son périmètre"] },
  { id: "ligne_rouge", block: "Sécurité & Limites", label: "Votre ligne rouge absolue ?", sublabel: "Ce que votre jumeau ne doit JAMAIS dire ou faire, quoi qu'il arrive", type: "free", placeholder: "Exemple : Ne jamais culpabiliser un patient. Ne jamais donner de calories précises sans contexte. Ne jamais parler de médicaments..." },

  // MISES EN SITUATION
  { id: "situation_craquage", block: "Mises en situation", label: "Il est 22h. Un patient vous écrit :", sublabel: '"J\'ai craqué sur tout le frigo ce soir, je me déteste, je suis nul(le). Je vais jamais y arriver."', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_avant_crise", block: "Mises en situation", label: "Un patient vous écrit à 22h30 :", sublabel: '"L\'envie est trop forte ce soir. J\'ai peur de craquer. Je suis seul et je sais que j\'ai des biscuits dans le placard."', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_stagnation", block: "Mises en situation", label: "Un patient vous écrit :", sublabel: '"La balance n\'a pas bougé d\'un gramme cette semaine alors que j\'ai été irréprochable. Ça m\'énerve, j\'ai envie de tout arrêter."', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_abandon", block: "Mises en situation", label: "Un patient disparu revient après 3 semaines de silence :", sublabel: '"J\'ai honte de revenir. J\'ai tout sabordé ces dernières semaines, j\'ai même pas osé vous écrire tellement c\'était mauvais."', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_prediabete", block: "Mises en situation", label: "Un patient sort de chez son médecin :", sublabel: '"Mon médecin m\'a dit que j\'ai un prédiabète. Est-ce que je dois arrêter les féculents complètement ?"', type: "free", placeholder: "Vous auriez répondu quoi ?" },
  { id: "situation_alcool", block: "Mises en situation", label: "Un patient vous pose LA question du week-end :", sublabel: '"Est-ce que j\'ai le droit de boire mes 3 verres de vin ou mes bières le week-end avec mes amis, ou ça ruine tout ?"', type: "free", placeholder: "Vous auriez répondu quoi ?" },
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
  const [showResume, setShowResume] = useState(false);
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

      // Load existing profile from Supabase (source of truth)
      const { data: profile } = await supabase
        .from("practitioner_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.vision) {
        setVisionText(profile.vision as string);
        setVisionSaved(true);
        localStorage.setItem("onboarding_vision", profile.vision as string);
      }
      if (profile?.signature) {
        setSignatureText(profile.signature as string);
        setSignatureSaved(true);
        localStorage.setItem("onboarding_signature", profile.signature as string);
      }

      // Si vision ou signature existent en Supabase, l'utilisateur a déjà atteint
      // l'étape identité (on ne peut sauvegarder ces champs que depuis cette étape).
      // On saute directement à l'étape identité si le step courant est en arrière.
      if (profile?.vision || profile?.signature) {
        const currentLocalStep = parseInt(localStorage.getItem("onboarding_step") ?? "0");
        if (currentLocalStep < questions.length) {
          setStep(questions.length);
          localStorage.setItem("onboarding_step", String(questions.length));
        }
      }

      // Détecter si l'utilisateur a quitté en cours de génération :
      // profile a des réponses aux questions (tone_of_voice existe) mais onboarding_done = false
      if (!prac?.onboarding_done && profile && (profile as Record<string, unknown>).tone_of_voice) {
        setShowResume(true);
      }

      // Hydrate les réponses aux questions depuis Supabase si elles y sont
      // (cas : activation précédente réussie ou partielle).
      if (profile) {
        const hydrated: Record<string, string | string[]> = {};
        for (const q of questions) {
          const val = (profile as Record<string, unknown>)[q.id];
          if (val !== undefined && val !== null && val !== "") {
            hydrated[q.id] = val as string | string[];
          }
        }
        if (Object.keys(hydrated).length > 0) {
          setAnswers(hydrated);
          localStorage.setItem("onboarding_answers", JSON.stringify(hydrated));
        }
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
  const saveProfile = async (redirect = true, activate = true, extras?: { vision?: string; signature?: string }) => {
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
      if (activate) {
        await supabase.from("practitioners").update({ onboarding_done: true }).eq("user_id", user?.id ?? "");
        localStorage.removeItem("onboarding_step");
        localStorage.removeItem("onboarding_answers");
        localStorage.removeItem("onboarding_selected");
        localStorage.removeItem("onboarding_autre");
        if (redirect) router.push("/dashboard");
      }
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : "Impossible de sauvegarder votre profil.");
    } finally { setIsSaving(false); }
  };

  // Activation finale : met onboarding_done à true + nettoie localStorage + redirige
  const activateJumeau = async () => {
    const supabase = createSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("practitioners").update({ onboarding_done: true }).eq("user_id", user?.id ?? "");
    localStorage.removeItem("onboarding_step");
    localStorage.removeItem("onboarding_answers");
    localStorage.removeItem("onboarding_selected");
    localStorage.removeItem("onboarding_autre");
    setNavigating(true);
    setTimeout(() => router.push("/dashboard"), 800);
  };

  const startGeneration = () => {
    void saveProfile(false, false, { vision: visionText, signature: signatureText });
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
      {showResume ? (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
          <div className="rounded-3xl border border-[#10b981]/20 bg-[#121212] p-8 max-w-md w-full text-center">
            {/* Logo avec ring gelé à ~32% en vert */}
            <div className="flex justify-center mb-6">
              {(() => {
                const r = 50;
                const cx = 54;
                const cy = 54;
                const circumference = 2 * Math.PI * r;
                const frozenProgress = 32;
                const dashOffset = circumference * (1 - frozenProgress / 100);
                return (
                  <div className="relative" style={{ width: 108, height: 108 }}>
                    {/* Halo */}
                    <div className="absolute rounded-full" style={{ inset: -14, background: "radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
                    {/* SVG ring */}
                    <svg width="108" height="108" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(16,185,129,0.18)" strokeWidth="2.5" />
                      <circle
                        cx={cx} cy={cy} r={r}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        transform={`rotate(-90 ${cx} ${cy})`}
                        style={{ filter: "drop-shadow(0 0 7px rgba(16,185,129,0.95)) drop-shadow(0 0 14px rgba(16,185,129,0.5))" }}
                      />
                    </svg>
                    {/* Logo */}
                    <div style={{
                      position: "absolute",
                      inset: 6,
                      borderRadius: "50%",
                      overflow: "hidden",
                    }}>
                      <img src="/logo.png" alt="NutriTwin" style={{ width: "100%", height: "100%", padding: "13px", objectFit: "contain", boxSizing: "border-box" }} />
                    </div>
                  </div>
                );
              })()}
            </div>
            <p className="text-xs font-mono font-bold tracking-widest text-[#10b981] uppercase mb-3">Génération interrompue</p>
            <h1 className="text-xl font-bold text-white mb-3 leading-tight">Votre Jumeau n'est pas encore prêt.</h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-2">
              Vous avez quitté la page avant la fin de la génération. Votre profil a été conservé, il suffit de reprendre le téléchargement pour finaliser votre Jumeau.
            </p>
            <p className="text-xs font-mono text-[#10b981]/45 mb-8">[NT-GEN] Reprise disponible · Profil conservé</p>
            <button type="button"
              onClick={() => { setShowResume(false); startGeneration(); }}
              style={{ background: "linear-gradient(135deg, #10b981, #059669)", color: "black", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", border: "none", boxShadow: "0 4px 24px rgba(16,185,129,0.25)", transition: "all 0.25s ease", width: "100%" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 32px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 24px rgba(16,185,129,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}>
              Reprendre la génération
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
                    <div className="rounded-full flex items-center justify-center mb-8"
                      style={{ width: 108, height: 108, background: "rgba(16,185,129,0.12)", border: "2px solid rgba(16,185,129,0.4)" }}>
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
                    <button type="button" onClick={() => { void activateJumeau(); }}
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
                      {(() => {
                        const r = 50;
                        const cx = 54;
                        const cy = 54;
                        const circumference = 2 * Math.PI * r;
                        const dashOffset = circumference * (1 - genProgress / 100);
                        const isComplete = genProgress >= 100;
                        return (
                          <div className="relative" style={{ width: 108, height: 108 }}>
                            {/* Halo */}
                            <div className="absolute rounded-full" style={{ inset: -14, background: "radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
                            {/* SVG — le cercle IS la bordure du logo */}
                            <svg width="108" height="108" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                              <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(16,185,129,0.18)" strokeWidth="2.5" />
                              <circle
                                cx={cx} cy={cy} r={r}
                                fill="none"
                                stroke={isComplete ? "#ffffff" : "#10b981"}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={dashOffset}
                                transform={`rotate(-90 ${cx} ${cy})`}
                                style={{
                                  transition: "stroke-dashoffset 1.2s ease-out, stroke 0.5s ease",
                                  animation: isComplete ? "ring-done 1.2s ease-out 0.2s both" : "none",
                                  filter: isComplete
                                    ? "drop-shadow(0 0 8px rgba(255,255,255,0.9)) drop-shadow(0 0 20px rgba(16,185,129,0.8))"
                                    : "drop-shadow(0 0 7px rgba(16,185,129,0.95)) drop-shadow(0 0 14px rgba(16,185,129,0.5))"
                                }}
                              />
                            </svg>
                            {/* Logo — inset 6px pour que le stroke soit entièrement visible */}
                            <div style={{
                              position: "absolute",
                              inset: 6,
                              borderRadius: "50%",
                              overflow: "hidden",
                            }}>
                              <img src="/logo.png" alt="NutriTwin" style={{ width: "100%", height: "100%", padding: "13px", objectFit: "contain", boxSizing: "border-box" }} />
                            </div>
                          </div>
                        );
                      })()}
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
                    {identityFilled === 1 && visionSaved && "Votre Jumeau possède désormais votre philosophie profonde ! Il ne lui reste plus qu'à capturer votre style d'écriture : vos expressions fétiches, vos métaphores, le rythme de vos phrases. C'est la dernière étape pour atteindre une fidélité à 100 %."}
                    {identityFilled === 1 && signatureSaved && "Votre Jumeau possède désormais votre style d'écriture ! Il ne lui reste plus qu'à intégrer votre Vision pour que ses conseils reflètent fidèlement votre positionnement et vos valeurs. C'est la dernière étape pour atteindre une fidélité à 100 %."}
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
                          placeholder="Je crois que l'alimentation est d'abord une relation, avec soi, avec son corps, avec les autres. Aucun protocole ne tient si la personne ne s'y sent pas en sécurité avec ce qu'elle mange. Pour moi, être présent dans les moments difficiles compte autant que donner les bons conseils..."
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
                      MON STYLE D'ÉCRITURE
                    </p>
                    {signatureSaved && (
                      <span className="text-xs font-semibold transition-colors duration-500" style={{ color: signatureColor }}>
                        ✓ Renseigné
                      </span>
                    )}
                  </div>

                  <div className="ml-10">
                    <p className="text-sm font-bold text-white mb-1">L'étape finale pour que votre Jumeau parle vraiment comme vous</p>
                    <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                      Partagez ici vos expressions fétiches, vos métaphores favorites, les mots que vous n'utilisez jamais, votre façon de dédramatiser un écart ou de remotiver quelqu'un. Votre Jumeau va intégrer ces éléments dans son style, pas les recopier.
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
                          placeholder={"Mon expression fétiche quand un patient culpabilise : \"...\". Je n'utilise jamais le mot \"craquer\", je dis plutôt \"moment difficile\". Quand quelqu'un revient après une longue absence, je commence toujours par rassurer avant tout conseil. Mes métaphores favorites : ..."}
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
                        : "Activer mon Jumeau"}
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
            @keyframes ring-done {
              0%   { filter: drop-shadow(0 0 7px rgba(16,185,129,0.9)) drop-shadow(0 0 14px rgba(16,185,129,0.5)); stroke: #10b981; }
              30%  { filter: drop-shadow(0 0 18px rgba(255,255,255,1)) drop-shadow(0 0 36px rgba(255,255,255,0.5)) drop-shadow(0 0 56px rgba(16,185,129,0.9)); stroke: #ffffff; }
              65%  { filter: drop-shadow(0 0 10px rgba(255,255,255,0.95)) drop-shadow(0 0 22px rgba(16,185,129,0.9)); stroke: #ffffff; }
              100% { filter: drop-shadow(0 0 8px rgba(255,255,255,0.9)) drop-shadow(0 0 20px rgba(16,185,129,0.8)); stroke: #ffffff; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
