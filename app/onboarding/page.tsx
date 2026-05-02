 "use client";

import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useState } from "react";

type Question = {
  label: string;
  options: string[];
};

const questions: Question[] = [
  {
    label: "Comment doit sonner votre jumeau ?",
    options: [
      "Le Medical (factuel, precis, pas d'emojis)",
      "Le Coach (energique, motivant, emojis)",
      "Le Complice (chaleureux, empathique)",
      "Le Pedagogue (explicatif, vulgarise la science)",
    ],
  },
  {
    label: "Comment vous adressez-vous a vos patients ?",
    options: [
      "Vouvoiement strict",
      "Vouvoiement bienveillant",
      "Tutoiement coaching",
      "Je m'adapte selon le patient",
    ],
  },
  {
    label: "Niveau de langage de votre jumeau ?",
    options: [
      "Tres vulgarise",
      "Scientifique et precis",
      "Adaptatif selon le patient",
    ],
  },
  {
    label: "Longueur des reponses ?",
    options: [
      "Courtes et directes",
      "Detaillees et completes",
      "Selon la complexite de la question",
    ],
  },
  {
    label: "Utilisation des emojis ?",
    options: ["Jamais", "Avec moderation", "Souvent pour humaniser"],
  },
  {
    label: "Votre approche generale ?",
    options: [
      "Reequilibrage alimentaire doux",
      "Protocoles structures",
      "Alimentation intuitive",
      "Micronutrition fonctionnelle",
    ],
  },
  {
    label: "Votre position sur les feculents le soir ?",
    options: [
      "Je les autorise",
      "Depend de l'objectif",
      "Je les limite",
      "Je les supprime",
    ],
  },
  {
    label: "Votre position sur le jeune intermittent ?",
    options: [
      "Je le recommande souvent",
      "Cas par cas",
      "Je prefere eviter",
      "Je ne me prononce pas",
    ],
  },
  {
    label: "Votre approche des complements alimentaires ?",
    options: [
      "J'en prescris regulierement",
      "Seulement si carence averee",
      "Je prefere l'alimentation seule",
      "Cas par cas",
    ],
  },
  {
    label: "Votre position sur les regimes populaires (keto, paleo, detox) ?",
    options: [
      "Je les integre si adaptes",
      "Je les deconseille",
      "Je les etudie cas par cas",
      "Je reste neutre",
    ],
  },
  {
    label: "Votre approche du petit-dejeuner ?",
    options: ["Indispensable", "Optionnel", "Selon le patient et ses habitudes"],
  },
  {
    label: "Votre position sur les collations ?",
    options: [
      "Encouragees",
      "Deconseillees",
      "Selon l'objectif du patient",
    ],
  },
  {
    label: "Votre approche lifestyle et budget ?",
    options: [
      "Je prone le bio et le local",
      "Je m'adapte au budget du patient",
      "Je mise sur le moins transforme possible",
    ],
  },
  {
    label: "Un patient craque sur une pizza. Vous repondez comment ?",
    options: [
      "Sans culpabilite, on repart",
      "On analyse pourquoi",
      "On recadre sur les objectifs",
      "L'equilibre se fait sur la duree",
    ],
  },
  {
    label: "Un patient mange ses emotions. Votre approche ?",
    options: [
      "Je travaille uniquement l'alimentation",
      "Je l'oriente vers un psy",
      "Les deux en parallele",
      "J'integre ca dans mon suivi global",
    ],
  },
  {
    label: "Un patient ne suit pas vos conseils. Votre reaction ?",
    options: [
      "Bienveillance et comprehension",
      "Recadrage ferme",
      "On remet en question le suivi ensemble",
      "On cherche pourquoi ensemble",
    ],
  },
  {
    label: "Gestion des fetes et vacances ?",
    options: [
      "On planifie a l'avance",
      "Liberte totale pendant",
      "On compense la semaine d'apres",
      "L'equilibre se fait sur le mois",
    ],
  },
  {
    label: "Perimetre de votre jumeau ?",
    options: [
      "Autonomie totale sur nutrition et lifestyle",
      "Prudence sur les pathologies",
      "Securite maximale, questions simples uniquement",
    ],
  },
  {
    label: "Face a une question medicale complexe ?",
    options: [
      "Il repond selon la litterature",
      "Il dit qu'il ne sait pas et vous alerte",
      "Il propose une reponse et attend votre validation",
    ],
  },
  {
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
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const total = questions.length;
  const isFinal = step >= 20;
  const currentQuestion = questions[step];
  const progress = isFinal ? 100 : Math.round((step / total) * 100);

  const goNext = () => {
    if (!selected || isFinal) return;
    setAnswers((prev) => [...prev, selected]);
    setSelected("");
    setStep((prev) => prev + 1);
  };

  const saveProfile = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError("");

    try {
      const response = await fetch("/api/save-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, userId: (await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).auth.getUser()).data.user?.id ?? null }),
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
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="mb-3 text-sm font-medium text-zinc-300">
            Personnalisation de votre jumeau : {progress}%
          </p>
          <div className="h-2 w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#10b981] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {!isFinal && currentQuestion ? (
          <section className="rounded-3xl border border-white/10 bg-[#121212] p-6 sm:p-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#10b981]">
              Question {step + 1} / {total}
            </p>
            <h1 className="text-xl font-bold leading-tight sm:text-3xl">
              {currentQuestion.label}
            </h1>

            <div className="mt-8 grid gap-3 sm:gap-4">
              {currentQuestion.options.map((option) => {
                const isActive = selected === option;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSelected(option)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left text-[15px] transition ${
                      isActive
                        ? "border-[#10b981] bg-[#10b981]/15"
                        : "border-white/10 bg-[#1a1a1a] hover:border-[#10b981]/50"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={goNext}
                disabled={!selected}
                className="rounded-full bg-[#10b981] px-7 py-3 text-sm font-semibold text-black transition hover:bg-[#0fb174] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
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
            <h1 className="text-2xl font-bold sm:text-3xl">
              Votre jumeau vous ressemble. Il est pret.
            </h1>
            <p className="mt-3 text-sm text-zinc-300">
              Resume de vos choix avant sauvegarde.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {answers.map((answer, index) => (
                <span
                  key={`${answer}-${index}`}
                  className="rounded-full border border-[#10b981]/40 bg-[#10b981]/15 px-3 py-1 text-sm text-[#34d399]"
                >
                  {answer}
                </span>
              ))}
            </div>

            {saveError ? (
              <p className="mt-5 text-sm text-red-400">{saveError}</p>
            ) : null}

            <div className="mt-8">
              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={isSaving}
                className="rounded-full bg-[#10b981] px-8 py-3 text-sm font-semibold text-black transition hover:bg-[#0fb174] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
              >
                {isSaving ? "Sauvegarde..." : "Acceder a mon espace"}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
