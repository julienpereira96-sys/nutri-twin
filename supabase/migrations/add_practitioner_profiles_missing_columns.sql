-- Migration : colonnes practitioner_profiles attendues par /api/save-profile
-- Idempotente (IF NOT EXISTS) : ne modifie pas les colonnes déjà présentes.
-- Corrige : "Could not find the 'presentation' column of 'practitioner_profiles' in the schema cache"
-- Ajoute aussi profile_summary (résumé généré par le LLM), absent de toutes les migrations.
-- À exécuter dans Supabase SQL Editor.

ALTER TABLE practitioner_profiles
  ADD COLUMN IF NOT EXISTS presentation TEXT,
  ADD COLUMN IF NOT EXISTS tone_of_voice TEXT,
  ADD COLUMN IF NOT EXISTS tutoiement TEXT,
  ADD COLUMN IF NOT EXISTS technicite TEXT,
  ADD COLUMN IF NOT EXISTS longueur_reponses TEXT,
  ADD COLUMN IF NOT EXISTS emojis TEXT,
  ADD COLUMN IF NOT EXISTS approche_generale TEXT,
  ADD COLUMN IF NOT EXISTS pathologies TEXT,
  ADD COLUMN IF NOT EXISTS dimension_emotionnelle TEXT,
  ADD COLUMN IF NOT EXISTS position_regimes TEXT,
  ADD COLUMN IF NOT EXISTS position_glucides TEXT,
  ADD COLUMN IF NOT EXISTS position_jeune TEXT,
  ADD COLUMN IF NOT EXISTS position_complements TEXT,
  ADD COLUMN IF NOT EXISTS position_petit_dejeuner TEXT,
  ADD COLUMN IF NOT EXISTS sensibilite_budget TEXT,
  ADD COLUMN IF NOT EXISTS orientation_produits TEXT,
  ADD COLUMN IF NOT EXISTS jamais_dire TEXT,
  ADD COLUMN IF NOT EXISTS conviction TEXT,
  ADD COLUMN IF NOT EXISTS alimentation_emotionnelle TEXT,
  ADD COLUMN IF NOT EXISTS non_suivi TEXT,
  ADD COLUMN IF NOT EXISTS fetes_vacances TEXT,
  ADD COLUMN IF NOT EXISTS levier_motivation TEXT,
  ADD COLUMN IF NOT EXISTS profil_perfectionniste TEXT,
  ADD COLUMN IF NOT EXISTS adaptation_profil TEXT,
  ADD COLUMN IF NOT EXISTS gestion_culpabilite TEXT,
  ADD COLUMN IF NOT EXISTS vocabulaire_crise TEXT,
  ADD COLUMN IF NOT EXISTS perimetre TEXT,
  ADD COLUMN IF NOT EXISTS questions_medicales TEXT,
  ADD COLUMN IF NOT EXISTS urgence_detresse TEXT,
  ADD COLUMN IF NOT EXISTS ligne_rouge TEXT,
  ADD COLUMN IF NOT EXISTS vision TEXT,
  ADD COLUMN IF NOT EXISTS signature TEXT,
  ADD COLUMN IF NOT EXISTS situation_craquage TEXT,
  ADD COLUMN IF NOT EXISTS situation_avant_crise TEXT,
  ADD COLUMN IF NOT EXISTS situation_stagnation TEXT,
  ADD COLUMN IF NOT EXISTS situation_abandon TEXT,
  ADD COLUMN IF NOT EXISTS situation_prediabete TEXT,
  ADD COLUMN IF NOT EXISTS situation_alcool TEXT,
  ADD COLUMN IF NOT EXISTS situation_drastique TEXT,
  ADD COLUMN IF NOT EXISTS situation_flemme TEXT,
  ADD COLUMN IF NOT EXISTS situation_coup_dur TEXT,
  ADD COLUMN IF NOT EXISTS situation_victoire TEXT,
  ADD COLUMN IF NOT EXISTS situation_arret TEXT,
  ADD COLUMN IF NOT EXISTS profile_summary TEXT;

-- Recharge le cache de schéma PostgREST (sinon l'erreur "schema cache" peut persister)
NOTIFY pgrst, 'reload schema';
