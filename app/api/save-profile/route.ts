import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json(
      { error: "Variables d'environnement Supabase manquantes." },
      { status: 500 },
    );
  }

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
  
  // Validation server-side des answers
  const ALLOWED_KEYS = ["tone_of_voice","tutoiement","technicite","longueur_reponses","emojis","approche_generale","pathologies","position_regimes","position_glucides","jejune","complements","petit_dejeuner","lifestyle_budget","jamais_dire","conviction","gestion_ecarts","emotions","non_suivi","fetes_vacances","motivation_berne","posture","perimetre","questions_medicales","urgence_detresse","ligne_rouge","approche_libre","situation1","situation2","situation3","situation4","situation5","situation6"];
  
  const sanitizedAnswers: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (!ALLOWED_KEYS.includes(key)) continue;
    if (typeof value !== "string") continue;
    if (value.length > 2000) continue;
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
