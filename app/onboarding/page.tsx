"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Question = {
  id: number;
  block: string;
  label: string;
  options: string[];
};

const questions: Question[] = [
  {
    id: 1,
    block: "Bloc 1 — Identite",
    label: "Comment doit sonner votre jumeau ?",
    options: [
      "Le Medical (factuel, precis, pas d'emojis)",
      "Le Coach (energique, motivant, emojis)",
      "Le Complice (chaleureux, empathique)",
      "Le Pedagogue (explicatif, vulgarise la science)",
    ],
  },
  {
    id: 2,
    block: "Bloc 1 — Identite",
    label: "Comment vous adressez-vous a vos patients ?",
    options: [
      "Vouvoiement strict",
      "Vouvoiement bienveillant",
      "Tutoiement coaching",
      "Je m'adapte selon le patient",
    ],
  },
  {
    id: 3,
    block: "Bloc 1 — Identite",
    label: "Niveau de langage de votre jumeau ?",
    options: [
      "Tres vulgarise",
      "Scientifique et precis",
      "Adaptatif selon le patient",
    ],
  },
  {
    id: 4,
    block: "Bloc 1 — Identite",
    label: "Longueur des reponses ?",
    options: [
      "Courtes et directes",
      "Detaillees et completes",
      "Selon la complexite de la question",
    ],
  },
  {
    id: 5,
    block: "Bloc 1 — Identite",
    label: "Utilisation des emojis ?",
    options: ["Jamais", "Avec moderation", "Souvent pour humaniser"],
  },
  {
    id: 6,
    block: "Bloc 2 — Philosophie",
    label: "Votre approche generale ?",
    options: [
      "Reequilibrage alimentaire doux",
      "Protocoles structures",
      "Alimentation intuitive",
      "Micronutrition fonctionnelle",
    ],
  },
  {
    id: 7,
    block: "Bloc 2 — Philosophie",
    label: "Votre position sur les feculents le soir ?",
    options: [
      "Je les autorise",
      "Depend de l'objectif",
      "Je les limite",
      "Je les supprime",
    ],
  },
  {
    id: 8,
    block: "Bloc 2 — Philosophie",
    label: "Votre position sur le jeune intermittent ?",
    options: [
      "Je le recommande souvent",
      "Cas par cas",
      "Je prefere eviter",
      "Je ne me prononce pas",
    ],
  },
  {
    id: 9,
    block: "Bloc 2 — Philosophie",
    label: "Votre approche des complements alimentaires ?",
    options: [
      "J'en prescris regulierement",
      "Seulement si carence averee",
      "Je prefere l'alimentation seule",
      "Cas par cas",
    ],
  },
  {
    id: 10,
    block: "Bloc 2 — Philosophie",
    label: "Votre position sur les regimes populaires (keto, paleo, detox) ?",
    options: [
      "Je les integre si adaptes",
      "Je les deconseille",
      "Je les etudie cas par cas",
      "Je reste neutre",
    ],
  },
  {
    id: 11,
    block: "Bloc 2 — Philosophie",
    label: "Votre approche du petit-dejeuner ?",
    options: ["Indispensable", "Optionnel", "Selon le patient et ses habitudes"],
  },
  {
    id: 12,
    block: "Bloc 2 — Philosophie",
    label: "Votre position sur les collations ?",
    options: [
      "Encouragees",
      "Deconseillees",
      "Selon l'objectif du patient",
    ],
  },
  {
    id: 13,
    block: "Bloc 2 — Philosophie",
    label: "Votre approche lifestyle et budget ?",
    options: [
      "Je prone le bio et le local",
      "Je m'adapte au budget du patient",
      "Je mise sur le moins transforme possible",
    ],
  },
  {
    id: 14,
    block: "Bloc 3 — Comportement",
    label: "Un patient craque sur une pizza. Vous repondez comment ?",
    options: [
      "Sans culpabilite, on repart",
      "On analyse pourquoi",
      "On recadre sur les objectifs",
      "L'equilibre se fait sur la duree",
    ],
  },
  {
    id: 15,
    block: "Bloc 3 — Comportement",
    label: "Un patient mange ses emotions. Votre approche ?",
    options: [
      "Je travaille uniquement l'alimentation",
      "Je l'oriente vers un psy",
      "Les deux en parallele",
      "J'integre ca dans mon suivi global",
    ],
  },
  {
    id: 16,
    block: "Bloc 3 — Comportement",
    label: "Un patient ne suit pas vos conseils. Votre reaction ?",
    options: [
      "Bienveillance et comprehension",
      "Recadrage ferme",
      "On remet en question le suivi ensemble",
      "On cherche pourquoi ensemble",
    ],
  },
  {
    id: 17,
    block: "Bloc 3 — Comportement",
    label: "Gestion des fetes et vacances ?",
    options: [
      "On planifie a l'avance",
      "Liberte totale pendant",
      "On compense la semaine d'apres",
      "L'equilibre se fait sur le mois",
    ],
  },
  {
    id: 18,
    block: "Bloc 4 — Securite",
    label: "Perimetre de votre jumeau ?",
    options: [
      "Autonomie totale sur nutrition et lifestyle",
      "Prudence sur les pathologies",
      "Securite maximale, questions simples uniquement",
    ],
  },
  {
    id: 19,
    block: "Bloc 4 — Securite",
    label: "Face a une question medicale complexe ?",
    options: [
      "Il repond selon la litterature",
      "Il dit qu'il ne sait pas et vous alerte",
      "Il propose une reponse et attend votre validation",
    ],
  },
  {
    id: 20,
    block: "Bloc 4 — Securite",
    label: "Votre jumeau doit-il relancer les patients ?",
    options: [
      "Jamais, il attend qu'on lui ecrive",
      "Il relance apres 4 jours sans nouvelles",
      "Il envoie chaque matin un conseil personnalise",
    ],
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const total = questions.length;
  const isSummary = stepIndex >= total;
  const currentQuestion = questions[stepIndex];
  const selectedOption = currentQuestion ? answers[currentQuestion.id] : undefined;
  const answeredCount = Object.keys(answers).length;
  const progress = isSummary
    ? 100
    : Math.round((Math.max(answeredCount, stepIndex) / total) * 100);

  const orderedSummary = useMemo(
    () =>
      questions.map((question) => ({
        id: question.id,
        label: question.label,
        answer: answers[question.id],
      })),
    [answers],
  );

  const mappedAnswers = useMemo(
    () => ({
      tone_of_voice: answers[1] ?? null,
      tutoiement: answers[2] ?? null,
      technicite: answers[3] ?? null,
      longueur_reponses: answers[4] ?? null,
      emojis: answers[5] ?? null,
      approche_generale: answers[6] ?? null,
      faculents_soir: answers[7] ?? null,
      jejune: answers[8] ?? null,
      complements: answers[9] ?? null,
      regimes: answers[10] ?? null,
      petit_dejeuner: answers[11] ?? null,
      collations: answers[12] ?? null,
      lifestyle_budget: answers[13] ?? null,
      gestion_ecarts: answers[14] ?? null,
      emotions: answers[15] ?? null,
      non_suivi: answers[16] ?? null,
      fetes_vacances: answers[17] ?? null,
      perimetre: answers[18] ?? null,
      questions_medicales: answers[19] ?? null,
      relance_patients: answers[20] ?? null,
    }),
    [answers],
  );

  const selectOption = (value: string) => {
    if (!currentQuestion) return;

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const goNext = () => {
    if (isSummary || !currentQuestion || !selectedOption || isTransitioning) {
      return;
    }

    setIsTransitioning(true);
    window.setTimeout(() => {
      setStepIndex((prev) => prev + 1);
      setIsTransitioning(false);
    }, 180);
  };

  const saveProfileAndContinue = async () => {
    console.log("BOUTON CLIQUE");
    if (isSaving) return;

    setIsSaving(true);
    setSaveError("");

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      console.log("Sauvegarde...", answers);
      const { error } = await supabase
        .from("practitioner_profiles")
        .insert({ ...mappedAnswers });

      if (error) {
        throw error;
      }

      router.push("/dashboard");
    } catch (error: unknown) {
      console.log("Erreur:", error);
      setSaveError(
        error instanceof Error
          ? error.message
          : "Impossible de sauvegarder votre profil pour le moment.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-white"
      style={{
        fontFamily:
          "var(--font-geist-sans), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div className="mx-auto w-full max-w-4xl px-4 pb-14 pt-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-zinc-300">
              Personnalisation de votre jumeau : {progress}%
            </p>
            {!isSummary ? (
              <p className="text-xs text-zinc-500">
                Question {stepIndex + 1} / {total}
              </p>
            ) : null}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#10b981] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        {!isSummary && currentQuestion ? (
          <section
            className={`rounded-3xl border border-white/10 bg-[#121212] p-5 transition-all duration-200 sm:p-8 ${
              isTransitioning
                ? "translate-y-2 opacity-0"
                : "translate-y-0 opacity-100"
            }`}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#10b981]">
              {currentQuestion.block}
            </p>
            <h1 className="text-xl font-bold leading-tight text-white sm:text-3xl">
              {currentQuestion.label}
            </h1>

            <div className="mt-8 grid gap-3 sm:gap-4">
              {currentQuestion.options.map((option) => {
                const isSelected = selectedOption === option;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => selectOption(option)}
                    className={`group w-full rounded-2xl border px-4 py-4 text-left text-[15px] font-medium transition-all duration-150 active:scale-[0.99] sm:px-5 ${
                      isSelected
                        ? "border-[#10b981] bg-[#10b981]/15 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"
                        : "border-white/10 bg-[#1a1a1a] text-zinc-200 hover:border-[#10b981]/40 hover:bg-[#141414]"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-4">
                      <span>{option}</span>
                      <span
                        className={`size-5 rounded-full border transition ${
                          isSelected
                            ? "border-[#10b981] bg-[#10b981]"
                            : "border-zinc-600 bg-transparent group-hover:border-[#10b981]/60"
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={goNext}
                disabled={!selectedOption || isTransitioning}
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#10b981] px-7 text-sm font-semibold text-black transition hover:bg-[#0fb174] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
              >
                Suivant
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-[#10b981]/30 bg-[#121212] p-6 sm:p-8">
            <p className="mb-2 text-sm font-semibold text-[#10b981]">
              Votre jumeau est pret
            </p>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              Votre jumeau vous ressemble. Il est pret.
            </h1>
            <p className="mt-3 text-[15px] text-zinc-300">
              Voici le resume de vos choix, appliques a votre jumeau numerique IA.
            </p>

            <div className="mt-8 space-y-5">
              {orderedSummary.map((entry) => (
                <article key={entry.id}>
                  <p className="mb-2 text-sm text-zinc-400">{entry.label}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[#10b981]/50 bg-[#10b981]/15 px-3 py-1.5 text-sm font-medium text-[#34d399]">
                      {entry.answer ?? "Non renseigne"}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            {saveError ? (
              <p className="mt-6 text-sm text-red-400">{saveError}</p>
            ) : null}

            <div className="mt-10">
              <button
                onClick={() => {
                  console.log("TEST");
                  alert("bouton clique");
                }}
              >
                Test
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
