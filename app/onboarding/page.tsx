"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useState } from "react";

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
  // BLOC 1 — Identité & Caractère
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

  // BLOC 2 — Philosophie Nutritionnelle
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

  // BLOC 3 — Gestion Humaine & Émotions
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

  // BLOC 4 — Sécurité & Limites
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

  // BLOC 5 — Votre approche en vos mots
  {
    id: "approche_libre",
    block: "Votre approche en vos mots",
    label: "Décrivez votre approche en quelques phrases",
    sublabel: "Parlez librement — comme si vous expliquiez votre méthode à un confrère",
    type: "free",
    placeholder: "Ma façon d'accompagner mes patients est...",
  },

  // BLOC 6 — Mises en situation
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
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [selected, setSelected] = useState<string | string[]>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const total = questions.length;
  const isFinal = step >= total;
  const currentQuestion = questions[step];
  const progress = isFinal ? 100 : Math.round((step / total) * 100);

  const currentBlock = isFinal ? "" : currentQuestion.block;
  const blockIndex = BLOCKS.indexOf(currentBlock);

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
    if (!canGoNext() || isFinal) return;
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

  const saveProfile = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError("");

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Progress */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-zinc-300">
              Configuration de votre jumeau — {progress}%
            </p>
            {!isFinal && (
              <p className="text-xs text-zinc-500">
                {step + 1} / {total}
              </p>
            )}
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#10b981] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Blocs */}
          {!isFinal && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {BLOCKS.map((block, i) => (
                <span
                  key={block}
                  className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition"
                  style={{
                    background: i === blockIndex
                      ? "rgba(16,185,129,0.15)"
                      : "rgba(255,255,255,0.04)",
                    color: i === blockIndex ? "#10b981" : "#52525b",
                    border: i === blockIndex
                      ? "1px solid rgba(16,185,129,0.3)"
                      : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {block}
                </span>
              ))}
            </div>
          )}
        </div>

        {!isFinal && currentQuestion ? (
          <section className="rounded-3xl border border-white/10 bg-[#121212] p-6 sm:p-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#10b981]">
              {currentQuestion.block}
            </p>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">
              {currentQuestion.label}
            </h1>
            {currentQuestion.sublabel && (
              <p className="mt-2 text-sm italic text-zinc-400">
                {currentQuestion.sublabel}
              </p>
            )}

            <div className="mt-8">
              {/* Single choice */}
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

              {/* Multiple choice */}
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

              {/* Free text */}
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
                  onClick={() => {
                    setStep((prev) => prev - 1);
                    setSelected("");
                  }}
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
        ) : (
          <section className="rounded-3xl border border-[#10b981]/30 bg-[#121212] p-6 sm:p-8">
            <p className="mb-2 text-sm font-semibold text-[#10b981]">
              ✅ Configuration terminée
            </p>
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

            {saveError && (
              <p className="mt-5 text-sm text-red-400">{saveError}</p>
            )}

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
