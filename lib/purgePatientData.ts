import { SupabaseClient } from "@supabase/supabase-js";

// RGPD-4 — Liste CANONIQUE des données patient à purger (droit à l'oubli, Art. 17).
// Source de vérité unique : toute route de suppression doit passer par ici, pour
// éviter les jeux de tables divergents. À garder aligné avec le script manuel
// droit-a-loubli.sql.
const CHILD_TABLES = [
  "conversations",
  "conversations_sessions",
  "sos_events",
  "sos_closures",
  "exercise_logs",
  "crisis_events",
  "documents",
  "journal_entries",
  "patient_practitioner",
] as const;

// Codes "relation/table introuvable" tolérés (feature non déployée sur l'environnement).
const MISSING_TABLE_CODES = ["42P01", "PGRST205", "PGRST202"];

/**
 * Purge toutes les données d'un patient : tables enfant + profil + avatar Storage.
 * NE supprime PAS le compte Auth (laissé à l'appelant, après vérification d'identité).
 *
 * @returns { ok, errors } — ok=false si une vraie erreur (hors table absente) survient,
 *          auquel cas l'appelant ne doit PAS supprimer le compte Auth (éviter les
 *          données médicales orphelines).
 */
export async function purgePatientData(
  admin: SupabaseClient,
  userId: string
): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];

  // 1. Tables enfant (scopées patient_id)
  const results = await Promise.all(
    CHILD_TABLES.map((t) => admin.from(t).delete().eq("patient_id", userId))
  );
  results.forEach((r, i) => {
    if (r.error && !MISSING_TABLE_CODES.includes(r.error.code ?? "")) {
      errors.push(`${CHILD_TABLES[i]}: ${r.error.message}`);
    }
  });
  if (errors.length > 0) return { ok: false, errors };

  // 2. Profil patient
  const { error: patientErr } = await admin.from("patients").delete().eq("user_id", userId);
  if (patientErr) {
    errors.push(`patients: ${patientErr.message}`);
    return { ok: false, errors };
  }

  // 3. Avatar Storage (bucket Avatars/<userId>/) — non bloquant
  try {
    const { data: avatarFiles } = await admin.storage.from("Avatars").list(userId);
    if (avatarFiles && avatarFiles.length > 0) {
      await admin.storage.from("Avatars").remove(avatarFiles.map((f) => `${userId}/${f.name}`));
    }
  } catch (e) {
    console.error("[NutriTwin] purgePatientData — avatar:", e);
  }

  return { ok: true, errors: [] };
}
