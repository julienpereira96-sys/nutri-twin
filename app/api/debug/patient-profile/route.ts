/**
 * DIAGNOSTIC ENDPOINT — À SUPPRIMER APRÈS DEBUG
 * Accessible uniquement au patient authentifié.
 * Retourne exactement ce que getPatientProfile voit.
 */
import { createClient } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/api-auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const patientId = user.id;

  // 1. Requête complète (identique à getPatientProfile)
  const { data: fullData, error: fullError } = await supabase
    .from("patients")
    .select("first_name, last_name, age, sexe, taille, poids, objective, pathologies, allergies, traitements, objectif_clinique, practitioner_instruction, instruction_updated_at, motivation, defi, situation_vie, rythme_professionnel, aliments_aimes, aliments_detestes, niveau_activite, regime_specifique, notes")
    .eq("user_id", patientId)
    .single();

  // 2. Requête simplifiée sans les nouvelles colonnes (test de comparaison)
  const { data: basicData, error: basicError } = await supabase
    .from("patients")
    .select("first_name, last_name, age, objectif_clinique, aliments_aimes")
    .eq("user_id", patientId)
    .single();

  // 3. Vérifier si les colonnes existent via information_schema
  const { data: colCheck, error: colCheckError } = await supabase
    .rpc("check_columns_exist" as never, {} as never)
    .select("*");

  // Alternative: check via une requête directe
  const { data: colData, error: colError } = await supabase
    .from("patients")
    .select("situation_vie, rythme_professionnel")
    .eq("user_id", patientId)
    .limit(1);

  return Response.json({
    patientId,
    auth_email: user.email,

    // Résultat requête complète (celle de getPatientProfile)
    full_query: {
      success: !fullError,
      error: fullError ? { message: fullError.message, code: fullError.code, details: fullError.details } : null,
      data_is_null: fullData === null,
      first_name: fullData?.first_name ?? "NULL",
      aliments_aimes: (fullData as Record<string, unknown> | null)?.aliments_aimes ?? "NULL",
      fields_filled: fullData ? Object.entries(fullData as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k]) => k) : [],
    },

    // Résultat requête basique (sans situation_vie/rythme_professionnel)
    basic_query: {
      success: !basicError,
      error: basicError ? { message: basicError.message, code: basicError.code } : null,
      data_is_null: basicData === null,
      first_name: basicData?.first_name ?? "NULL",
    },

    // Test isolation colonnes nouvelles
    new_columns_query: {
      success: !colError,
      error: colError ? { message: colError.message, code: colError.code } : null,
      data: colData,
    },

    // Diagnostic : raison probable du profil vide
    diagnosis: !fullError && fullData && fullData.first_name
      ? "OK — getPatientProfile devrait retourner un profil non vide"
      : fullError?.message?.includes("situation_vie") || fullError?.message?.includes("rythme_professionnel")
        ? "BUG CONFIRMÉ — colonnes situation_vie/rythme_professionnel absentes de la DB (migration non exécutée)"
        : fullError
          ? `ERREUR DB — ${fullError.message}`
          : !fullData
            ? "AUCUNE LIGNE — aucun patient avec user_id = votre auth ID"
            : !fullData.first_name
              ? "PROFIL VIDE — ligne trouvée mais first_name est null"
              : "INCONNU",
  });
}
