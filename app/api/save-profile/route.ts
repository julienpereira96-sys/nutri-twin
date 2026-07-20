import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json(
      { error: "Variables d'environnement Supabase manquantes." },
      { status: 500 },
    );
  }

  const user = await getSessionUser();
  if (!user) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body JSON invalide." }, { status: 400 });
  }

  const { answers, userId } = body as {
    answers: Record<string, string>;
    userId: string | null;
  };

  if (!answers || typeof answers !== "object") {
    return Response.json(
      { error: "Le body doit contenir un objet answers." },
      { status: 400 },
    );
  }
  
  if (!userId) {
    return Response.json({ error: "userId requis." }, { status: 400 });
  }

  if (user.id !== userId) return forbidden();
  
  // Validation server-side des answers
  const ALLOWED_KEYS = [
    // Bloc 1 — Identité & Caractère
    "tone_of_voice","tutoiement","technicite","longueur_reponses","emojis",
    // Bloc 2 — Philosophie Nutritionnelle
    "approche_generale","pathologies","position_regimes","position_glucides",
    "position_jeune","position_complements","position_petit_dejeuner",
    "sensibilite_budget","orientation_produits","jamais_dire","conviction",
    // Bloc 3 — Gestion Humaine & Émotions
    "alimentation_emotionnelle","non_suivi","fetes_vacances",
    "levier_motivation","profil_perfectionniste","adaptation_profil",
    // Bloc 4 — Sécurité & Limites
    "perimetre","questions_medicales","urgence_detresse","ligne_rouge",
    // Ma Vision & Ma Signature (injection directe, pas RAG)
    "vision","signature",
    // Mises en situation
    "situation_craquage","situation_stagnation","situation_abandon",
    "situation_prediabete","situation_alcool","situation_marketing","situation_drastique",
    "situation_flemme","situation_coup_dur",
    "situation_victoire","situation_arret",
  ];

  // Vision et Signature peuvent être des textes longs
  const LONG_TEXT_KEYS = new Set(["vision","signature","ligne_rouge","jamais_dire","conviction"]);

  const sanitizedAnswers: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (!ALLOWED_KEYS.includes(key)) continue;
    if (typeof value !== "string") continue;
    const maxLen = LONG_TEXT_KEYS.has(key) ? 5000 : 2000;
    if (value.length > maxLen) continue;
    sanitizedAnswers[key] = value.trim();
  }
  
  if (Object.keys(sanitizedAnswers).length === 0) {
    return Response.json({ error: "Aucune réponse valide." }, { status: 400 });
  }  

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
      .from("practitioner_profiles")
      .upsert({ ...sanitizedAnswers, user_id: userId }, { onConflict: "user_id" });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (userId) {
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
        await redis.del(`practitioner:${userId}`);
        await redis.del(`patient_profile:${userId}`);
        await redis.incr(`pract_v:${userId}`);
      } catch {
        // Silencieux
      }
    }

    return Response.json({ success: true });
  } catch {
    return Response.json(
      { error: "Erreur lors de la sauvegarde du profil." },
      { status: 500 },
    );
  }
}
