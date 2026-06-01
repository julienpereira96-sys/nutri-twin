-- Migration : nettoyage practitioner_profiles
-- Remplace lifestyle_budget par deux colonnes distinctes
-- Supprime les anciens champs legacy (praticiens existants = 0, migration safe)
-- À exécuter dans Supabase SQL Editor

-- 1. Nouvelles colonnes issues du split de lifestyle_budget
ALTER TABLE practitioner_profiles
  ADD COLUMN IF NOT EXISTS sensibilite_budget TEXT,
  ADD COLUMN IF NOT EXISTS orientation_produits TEXT;

-- 2. Nouvelle colonne onboarding (manquante dans la migration précédente)
ALTER TABLE practitioner_profiles
  ADD COLUMN IF NOT EXISTS profil_perfectionniste TEXT;

-- 3. Suppression de lifestyle_budget (remplacée par les deux colonnes ci-dessus)
ALTER TABLE practitioner_profiles
  DROP COLUMN IF EXISTS lifestyle_budget;

-- 4. Suppression des anciens champs legacy (plus présents dans l'onboarding)
ALTER TABLE practitioner_profiles
  DROP COLUMN IF EXISTS sujets_clivants,
  DROP COLUMN IF EXISTS gestion_ecarts,
  DROP COLUMN IF EXISTS emotions,
  DROP COLUMN IF EXISTS motivation_berne,
  DROP COLUMN IF EXISTS approche_libre,
  DROP COLUMN IF EXISTS situation1,
  DROP COLUMN IF EXISTS situation2,
  DROP COLUMN IF EXISTS situation3,
  DROP COLUMN IF EXISTS situation4,
  DROP COLUMN IF EXISTS situation5,
  DROP COLUMN IF EXISTS situation6,
  DROP COLUMN IF EXISTS situation7,
  DROP COLUMN IF EXISTS situation8,
  DROP COLUMN IF EXISTS situation9;
