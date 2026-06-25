import { createClient } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/api-auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: patient } = await supabase
    .from("patients")
    .select("age, sexe, taille, poids, pathologies, allergies, traitements, objectif_clinique, niveau_activite, regime_specifique, objective, motivation, defi, aliments_aimes, aliments_detestes")
    .eq("user_id", user.id)
    .single();

  return Response.json({ patient: patient ?? null });
}
