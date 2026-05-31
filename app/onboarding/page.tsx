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
  { id: "tone_of_voice", block: "Identité & Caractère", label: "Quelle posture relationnelle votre jumeau doit-il adopter ?", sublabel: "Le ton qu'il devra adopter par défaut avec vos patients", type: "single_with_free", options: ["Le Médical — factuel, précis, sobre, sans émojis", "Le Coach — énergique, motivant, direct, ça bouge", "Le Complice — chaleureux, empathique, très humain", "Le Pédagogue — il explique, vulgarise, rassure", "Autre (Précisez...)"] },
  { id: "tutoiement", block: "Identité & Caractère", label: "Votre jumeau doit-il tutoyer ou vouvoyer vos patients ?", type: "single", options: ["Vouvoiement strict", "Vouvoiement bienveillant", "Tutoiement naturel", "Il s'adapte selon le patient"] },
  { id: "technicite", block: "Identité & Caractère", label: "Quel niveau de langage votre jumeau doit-il utiliser ?", type: "single", options: ["Très vulgarisé, zéro jargon", "Quelques termes techniques expliqués simplement", "Scientifique et précis", "Il s'adapte selon le patient"] },
  { id: "longueur_reponses", block: "Identité & Caractère", label: "Quel style de réponse votre jumeau doit-il privilégier ?", type: "single", options: ["Court et direct, l'essentiel en 2-3 phrases", "Détaillé et complet, il explique tout", "Empathique d'abord, il valide l'émotion avant le conseil", "Adapté à la complexité de la question"] },
  { id: "emojis", block: "Identité & Caractère", label: "Votre jumeau doit-il utiliser des émojis ?", type: "single", options: ["Jamais, ça fait peu professionnel", "Avec modération, un ou deux maximum", "Souvent, ça humanise les échanges"] },

  // BLOC 2 — PHILOSOPHIE NUTRITIONNELLE
  { id: "approche_generale", block: "Philosophie Nutritionnelle", label: "Quelle est votre philosophie principale ?", type: "single_with_free", options: ["Rééquilibrage alimentaire progressif", "Alimentation intuitive et anti-régime strict", "Micronutrition fonctionnelle", "Contrôle des macros (déficit calorique mesuré)", "Autre (Précisez...)"] },
  { id: "pathologies", block: "Philosophie Nutritionnelle", label: "Quel est votre cœur de métier ?", sublabel: "Vous pouvez en sélectionner plusieurs", type: "multiple_with_free", options: ["Perte de poids / obésité", "TCA (troubles du comportement alimentaire)", "Diabète / glycémie / métabolisme", "Performance sportive", "Inconfort digestif / FODMAP", "Fatigue / micronutrition", "Femme enceinte / post-partum", "Enfants / adolescents", "Autre (Précisez...)"] },
  { id: "position_regimes", block: "Philosophie Nutritionnelle", label: "Votre avis sur les régimes restrictifs ?", type: "single", options: ["Je les déconseille systématiquement", "Je les étudie cas par cas", "Certains sont utiles dans mon protocole", "Je reste neutre et m'adapte"] },
  { id: "position_glucides", block: "Philosophie Nutritionnelle", label: "Votre position sur les glucides ?", type: "single", options: ["Indispensables à chaque repas", "À moduler selon l'objectif et le profil", "Je les limite en général", "Dépend du patient et du moment"] },
  { id: "position_jeune", block: "Philosophie Nutritionnelle", label: "Votre position sur le jeûne intermittent ?", type: "single_with_free", options: ["Je le déconseille", "Utile dans des cas précis, sur indication", "Outil intéressant si bien adapté à la personne", "Je le pratique moi-même et l'intègre souvent", "Autre (Précisez...)"] },
  { id: "position_complements", block: "Philosophie Nutritionnelle", label: "Votre position sur les compléments alimentaires ?", type: "single_with_free", options: ["Inutiles en général, une bonne alimentation suffit", "Utiles ponctuellement selon les carences identifiées", "Partie intégrante de mon protocole régulier", "Systématiquement prescrits selon bilan biologique", "Autre (Précisez...)"] },
  { id: "position_petit_dejeuner", block: "Philosophie Nutritionnelle", label: "Votre position sur le petit-déjeuner ?", type: "single_with_free", options: ["Obligatoire pour bien démarrer la journée", "Optionnel, certains fonctionnent très bien sans", "Recommandé mais adapté au patient", "Je ne l'impose jamais, liberté totale", "Autre (Précisez...)"] },
  { id: "lifestyle_budget", block: "Philosophie Nutritionnelle", label: "Votre approche sur le budget et les choix alimentaires ?", type: "single_with_free", options: ["Je prône le moins transformé possible, le bio et le local", "Je m'adapte avant tout au budget du patient", "Végétal / flexitarien", "Pas de restriction d'ingrédients, tout est question de portions", "Autre (Précisez...)"] },
  { id: "jamais_dire", block: "Philosophie Nutritionnelle", label: "Y a-t-il des pratiques que vous refusez catégoriquement ?", sublabel: "Exemple : régimes très hypocaloriques, détox, jeûne prolongé de plus de 24h...", type: "free", placeholder: "Décrivez ce que votre jumeau ne doit jamais recommander..." },
  { id: "conviction", block: "Philosophie Nutritionnelle", label: "Quelle est votre règle d'or ?", sublabel: "Votre conviction la plus forte en tant que praticien, celle qui guide tout le reste", type: "free", placeholder: "Exemple : Pas d'aliment interdit, le plaisir avant tout. Ou : la régularité prime toujours sur la perfection..." },

  // BLOC 3 — GESTION HUMAINE & ÉMOTIONS
  { id: "alimentation_emotionnelle", block: "Gestion Humaine & Émotions", label: "Un patient mange ses émotions. Votre approche ?", type: "single", options: ["Je travaille uniquement l'alimentation, c'est mon périmètre", "J'oriente vers un psy ou un thérapeute si besoin", "Je travaille les deux en parallèle dans mon suivi", "C'est intégré dans mon approche globale dès le départ"] },
  { id: "non_suivi", block: "Gestion Humaine & Émotions", label: "Un patient ne suit plus votre protocole depuis plusieurs jours. Votre réaction ?", type: "single", options: ["Bienveillance totale, on repart sans jugement", "On cherche ensemble ce qui bloque vraiment", "Recadrage ferme mais bienveillant", "On remet en question le protocole ensemble"] },
  { id: "fetes_vacances", block: "Gestion Humaine & Émotions", label: "Votre position sur les fêtes et les vacances ?", type: "single", options: ["On anticipe et planifie ensemble à l'avance", "Liberté totale, on reprend le protocole après", "L'équilibre se fait sur le mois, pas la semaine", "Je donne des guidelines souples et fais confiance"] },
  { id: "levier_motivation", block: "Gestion Humaine & Émotions", label: "Comment remotivez-vous un patient qui décroche ?", type: "single", options: ["Je lui rappelle ses objectifs initiaux et ses raisons profondes", "Je valorise chaque petit progrès, même minime", "Je propose d'ajuster le protocole ensemble", "Je lui laisse de l'espace et attends son retour"] },
  { id: "profil_perfectionniste", block: "Gestion Humaine & Émotions", label: "Un patient ultra-perfectionniste stresse dès qu'il s'éloigne du plan. Votre approche ?", type: "single", options: ["Je pousse au lâcher-prise", "Je valorise sa rigueur tout en l'aidant à accepter que l'équilibre se fait sur la durée", "Je valide son niveau d'exigence et l'aide à recalibrer pour tenir sur le long terme"] },
  { id: "adaptation_profil", block: "Gestion Humaine & Émotions", label: "Comment adaptez-vous votre communication selon le profil du patient ?", type: "single", options: ["Je reste moi-même avec tout le monde, c'est ma force", "J'adapte le ton mais pas le fond de mes conseils", "J'adapte à la fois le fond et la forme selon la personne", "Je laisse le patient me guider vers ce dont il a besoin"] },

  // BLOC 4 — SÉCURITÉ & LIMITES
  { id: "perimetre", block: "Sécurité & Limites", label: "Jusqu'où peut aller votre jumeau de manière autonome ?", type: "single", options: ["Autonomie totale sur nutrition et lifestyle", "Prudent sur les pathologies, il me redirige", "Questions simples uniquement, il m'alerte pour tout le reste"] },
  { id: "questions_medicales", block: "Sécurité & Limites", label: "Face à une question médicale complexe, un traitement ou un bilan sanguin ?", type: "single", options: ["Il répond selon la littérature scientifique disponible", "Il dit qu'il ne sait pas et m'alerte directement", "Il propose une piste et attend ma validation", "Il redirige systématiquement vers le médecin"] },
  { id: "urgence_detresse", block: "Sécurité & Limites", label: "Un patient exprime une vraie souffrance psychologique ?", type: "single", options: ["Il exprime de l'empathie et m'alerte immédiatement", "Il oriente vers une ligne d'écoute ou un professionnel de santé", "Il gère avec bienveillance dans les limites de son périmètre"] },
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
];

const BLOCKS = ["Identité & Caractère", "Philosophie Nutritionnelle", "Gestion Humaine & Émotions", "Sécurité & Limites", "Mises en situation", "Votre Expertise"];
const AUTRE_OPTION = "Autre (Précisez...)";

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
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [showCertTooltip, setShowCertTooltip] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [genProgress, setGenProgress] = useState(0);
  const [genDone, setGenDone] = useState(false);
  const [genFlash, setGenFlash] = useState(false);
  const genTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const genIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [activating, setActivating] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [autreText, setAutreText] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("onboarding_autre") ?? "";
  });
  const [visionText, setVisionText] = useState<string>("");
  const [signatureText, setSignatureText] = useState<string>("");

  const total = questions.length;
  const isIdentityStep = step === total;
  const currentQuestion = questions[step];
  const progress = genDone ? 100 : isGenerating ? 99 : isIdentityStep ? 98 : Math.round((step / total) * 95);
  const currentBlock = isIdentityStep ? "" : currentQuestion?.block ?? "";
  const blockIndex = BLOCKS.indexOf(currentBlock);
  const visionFilled = visionText.trim().length > 0;
  const signatureFilled = signatureText.trim().length > 0;
  const identityFilled = (visionFilled ? 1 : 0) + (signatureFilled ? 1 : 0);
  const identityScore = identityFilled === 0 ? 70 : identityFilled === 1 ? 85 : 100;
  const identityColor = identityFilled === 0 ? "#f59e0b" : identityFilled === 1 ? "#06b6d4" : "#10b981";

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
    localStorage.setItem("onboarding_autre", autreText);
  }, [autreText]);

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
      } else {
        setSelected(arr);
        setAutreText("");
      }
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

  useEffect(() => {
    const init = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase.from("practitioners").select("onboarding_done").eq("user_id", user.id).single();
      if (data?.onboarding_done) {
        setAlreadyDone(true);
      } else {
        const savedUserId = localStorage.getItem("onboarding_user_id");
        if (savedUserId && savedUserId !== user.id) {
          localStorage.removeItem("onboarding_step");
          localStorage.removeItem("onboarding_answers");
          localStorage.removeItem("onboarding_selected");
          localStorage.removeItem("onboarding_autre");
        }
        localStorage.setItem("onboarding_user_id", user.id);
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
              style={{ background: "#10b981", color: "black", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(16,185,129,0.5), 0 8px 30px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(16,185,129,0.3)"; e.currentTarget.style.transform = "translateY(0) scale(1)"; }}>
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
                <p className="text-sm font-medium text-zinc-300">Configuration de votre jumeau — {progress}%</p>
                {!isIdentityStep && !isGenerating && <p className="text-xs text-zinc-500">{step + 1} / {total}</p>}
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[#10b981] transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              {!isIdentityStep && !isGenerating && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {BLOCKS.map((block, i) => (
                    <span key={block} className="whitespace-nowrap rounded-lg px-3 py-1 text-xs font-medium transition"
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
                <h1 className="text-xl font-bold leading-tight sm:text-2xl">{currentQuestion.label}</h1>
                {currentQuestion.sublabel && (
                  <p className={`mt-2 text-sm text-zinc-400${currentQuestion.sublabel.startsWith('"') ? " italic" : ""}`}>
                    {currentQuestion.sublabel}
                  </p>
                )}
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
                  {currentQuestion.type === "single_with_free" && (
                    <div className="grid gap-3">
                      {currentQuestion.options?.map(option => (
                        <button key={option} type="button" onClick={() => { setSelected(option); if (option !== AUTRE_OPTION) setAutreText(""); }}
                          className={`w-full rounded-2xl border px-4 py-4 text-left text-[15px] transition-all duration-200 cursor-pointer ${selected === option ? "border-[#10b981] bg-[#10b981]/15 text-white" : "border-white/10 bg-[#1a1a1a] text-zinc-300 hover:border-[#10b981]/50"}`}>
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
                        <polyline points="4 12 9 17 20 6" stroke="#10b981" strokeWidth="2"
                          strokeDasharray="30" strokeDashoffset="30"
                          style={{ animation: "drawCheck 5s ease 0.3s forwards" }}/>
                        <polyline points="4 12 9 17 20 6" stroke="white" strokeWidth="3"
                          strokeDasharray="2 28" strokeDashoffset="30"
                          style={{ animation: "drawCheck 5s ease 0.3s forwards, fadeOut 0.5s ease 5.3s forwards", opacity: 0.8, filter: "blur(0.5px)" }}/>
                      </svg>
                    </div>
                    <p className="text-xs font-mono font-bold tracking-widest text-[#10b981] uppercase mb-3">Configuration terminée</p>
                    <h2 className="text-2xl font-bold text-white mb-3 leading-tight">Votre Jumeau est prêt.</h2>
                    <p className="text-sm text-zinc-400 max-w-sm leading-relaxed mb-2">
                      Votre double numérique est désormais capable de prendre le relais auprès de vos patients, avec votre philosophie, votre expertise et votre signature.
                    </p>
                    <p className="text-xs font-mono text-[#10b981]/50 mb-10">[NT-006] Certification validée — Jumeau opérationnel</p>
                    {saveError && <p className="mb-4 text-sm text-red-400">{saveError}</p>}
                    <button type="button" onClick={() => { setNavigating(true); setTimeout(() => router.push("/dashboard"), 800); }}
                      style={{ background: "#10b981", color: "black", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(16,185,129,0.5), 0 8px 30px rgba(16,185,129,0.4)"; e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 4px 14px rgba(16,185,129,0.3)"; e.currentTarget.style.transform = "translateY(0) scale(1)"; }}>
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
                        <div className="absolute inset-0 rounded-full border border-[#10b981]/10 animate-ping" style={{ animationDuration: "2s" }} />
                        <div className="absolute inset-2 rounded-full border border-[#10b981]/15 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.3s" }} />
                        <svg className="absolute inset-0 w-full h-full" style={{ animation: "spin 3s linear infinite" }} viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(16,185,129,0.08)" strokeWidth="1.5"/>
                          <circle cx="50" cy="50" r="46" fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="80 210" strokeLinecap="round"/>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-16 h-16 rounded-full flex items-center justify-center"
                            style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                            <span style={{ fontSize: 22 }}>🌿</span>
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
                        {genStep === 6 && "› Jumeau certifié — Lancement imminent..."}
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
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
                  Ces deux éléments sont injectés directement dans l'identité de votre jumeau — pas dans une base documentaire. C'est ce qui lui donne votre ton unique et votre philosophie profonde.
                </p>

                {/* Score bar */}
                <div className="mt-6 rounded-2xl p-5 transition-all duration-500"
                  style={{ background: `${identityColor}12`, border: `2px solid ${identityColor}40` }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-white">Niveau d'identité du jumeau</p>
                    <span className="text-lg font-bold" style={{ color: identityColor }}>{identityScore}%</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-white/10">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${identityScore}%`, backgroundColor: identityColor }} />
                  </div>
                  <p className="mt-3 text-sm" style={{ color: identityColor }}>
                    {identityFilled === 0 && "Complétez votre Vision et votre Signature pour finaliser votre jumeau."}
                    {identityFilled === 1 && `Plus qu'un élément — ajoutez votre ${visionFilled ? "Signature" : "Vision"} pour atteindre 100%.`}
                    {identityFilled === 2 && "Identité complète — Votre jumeau possède votre vision et votre signature."}
                  </p>
                </div>

                {/* Section 1 — Ma Vision */}
                <div className="mt-8">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 border"
                      style={{
                        background: visionFilled ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)",
                        color: visionFilled ? "#10b981" : "#64748b",
                        borderColor: visionFilled ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)",
                      }}>1</div>
                    <p className="text-base font-bold" style={{ color: visionFilled ? "#10b981" : "white" }}>Ma Vision</p>
                    {visionFilled && <span className="text-xs font-semibold text-emerald-500">✓ Renseigné</span>}
                  </div>
                  <p className="text-sm text-zinc-400 mb-4 ml-10 leading-relaxed">
                    Votre philosophie profonde, ce qui vous a amené à ce métier, ce que vous voulez transmettre. Ce texte sera injecté directement dans l'identité de votre jumeau.
                  </p>
                  <textarea
                    value={visionText}
                    onChange={e => setVisionText(e.target.value)}
                    placeholder="Exemple : Je crois que l'alimentation est un acte de soin envers soi-même. Mon rôle est d'aider chaque patient à retrouver une relation apaisée avec la nourriture, sans frustration ni culpabilité..."
                    rows={6}
                    className="w-full rounded-2xl bg-[#1a1a1a] px-4 py-4 text-[15px] text-white outline-none transition placeholder:text-zinc-600"
                    style={{
                      border: `1px solid ${visionFilled ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)"}`,
                      boxShadow: visionFilled ? "0 0 0 1px rgba(16,185,129,0.08)" : "none",
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(16,185,129,0.15)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = visionFilled ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = visionFilled ? "0 0 0 1px rgba(16,185,129,0.08)" : "none"; }}
                  />
                </div>

                {/* Separator */}
                <div className="my-8 flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-zinc-600 font-medium px-2">et</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>

                {/* Section 2 — Ma Signature */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 border"
                      style={{
                        background: signatureFilled ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)",
                        color: signatureFilled ? "#10b981" : "#64748b",
                        borderColor: signatureFilled ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)",
                      }}>2</div>
                    <p className="text-base font-bold" style={{ color: signatureFilled ? "#10b981" : "white" }}>Ma Signature</p>
                    {signatureFilled && <span className="text-xs font-semibold text-emerald-500">✓ Renseigné</span>}
                  </div>
                  <p className="text-sm text-zinc-400 mb-4 ml-10 leading-relaxed">
                    Ce qui vous distingue des autres praticiens. Votre approche unique, votre manière d'être avec vos patients. Ce texte définit la personnalité profonde de votre jumeau.
                  </p>
                  <textarea
                    value={signatureText}
                    onChange={e => setSignatureText(e.target.value)}
                    placeholder="Exemple : Ma signature, c'est la bienveillance radicale. Je ne juge jamais. Je commence toujours par valider l'émotion avant de proposer une solution. Je parle à mes patients comme à des amis intelligents..."
                    rows={6}
                    className="w-full rounded-2xl bg-[#1a1a1a] px-4 py-4 text-[15px] text-white outline-none transition placeholder:text-zinc-600"
                    style={{
                      border: `1px solid ${signatureFilled ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)"}`,
                      boxShadow: signatureFilled ? "0 0 0 1px rgba(16,185,129,0.08)" : "none",
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(16,185,129,0.5)"; e.currentTarget.style.boxShadow = "0 0 0 2px rgba(16,185,129,0.15)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = signatureFilled ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.1)"; e.currentTarget.style.boxShadow = signatureFilled ? "0 0 0 1px rgba(16,185,129,0.08)" : "none"; }}
                  />
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
                          🔒 Complétez votre {!visionFilled && !signatureFilled ? "Vision et votre Signature" : !visionFilled ? "Vision" : "Signature"} pour activer votre Jumeau.
                        </div>
                        <div className="block sm:hidden" style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, width: 240, borderRadius: 12, padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontSize: 12, textAlign: "center", pointerEvents: "none", whiteSpace: "normal", zIndex: 10 }}>
                          🔒 Complétez votre {!visionFilled && !signatureFilled ? "Vision et votre Signature" : !visionFilled ? "Vision" : "Signature"} pour activer votre Jumeau.
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
          `}</style>
        </div>
      )}
    </>
  );
}
