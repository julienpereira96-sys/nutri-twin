import { createClient } from "@supabase/supabase-js";

const ANSWER_KEYS = [
  "tone_of_voice",
  "tutoiement",
  "technicite",
  "longueur_reponses",
  "emojis",
  "approche_generale",
  "faculents_soir",
  "jejune",
  "complements",
  "regimes",
  "petit_dejeuner",
  "collations",
  "lifestyle_budget",
  "gestion_ecarts",
  "emotions",
  "non_suivi",
  "fetes_vacances",
  "perimetre",
  "questions_medicales",
  "relance_patients",
] as const;

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || (!supabaseServiceKey && !supabaseAnonKey)) {
    return Response.json(
      { error: "Variables d'environnement Supabase manquantes cote serveur." },
      { status: 500 },
    );
  }

  let answers: unknown;
  try {
    answers = await request.json();
  } catch {
    return Response.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  if (!Array.isArray(answers)) {
    return Response.json(
      { error: "Le body doit etre un tableau de reponses." },
      { status: 400 },
    );
  }

  const mappedAnswers = Object.fromEntries(
    ANSWER_KEYS.map((key, index) => [key, answers[index] ?? null]),
  );

  try {
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey ?? supabaseAnonKey!,
    );

    const { error } = await supabase
      .from("practitioner_profiles")
      .insert({ ...mappedAnswers });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json(
      { error: "Erreur lors de la sauvegarde du profil." },
      { status: 500 },
    );
  }
}
