import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

export async function POST(request: Request) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || (!supabaseServiceKey && !supabaseAnonKey)) {
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

  try {
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey ?? supabaseAnonKey!,
    );

    const { error } = await supabase
      .from("practitioner_profiles")
      .insert({ ...answers, user_id: userId ?? null });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Invalider le cache Redis du praticien
    if (userId) {
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
        await redis.del(`practitioner:${userId}`);
      } catch {
        // Silencieux — le cache sera mis à jour à la prochaine requête
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