-- Migration : nouveaux champs onboarding praticien
-- À exécuter dans Supabase SQL Editor

ALTER TABLE practitioner_profiles
  -- Bloc 2 — positions séparées (remplacent sujets_clivants)
  ADD COLUMN IF NOT EXISTS position_jeune TEXT,
  ADD COLUMN IF NOT EXISTS position_complements TEXT,
  ADD COLUMN IF NOT EXISTS position_petit_dejeuner TEXT,

  -- Bloc 3 — nouveaux champs gestion humaine
  ADD COLUMN IF NOT EXISTS boussole_ecarts TEXT,
  ADD COLUMN IF NOT EXISTS alimentation_emotionnelle TEXT,
  ADD COLUMN IF NOT EXISTS levier_motivation TEXT,
  ADD COLUMN IF NOT EXISTS adaptation_profil TEXT,

  -- Ma Vision & Ma Signature (injection directe dans le prompt, pas RAG)
  ADD COLUMN IF NOT EXISTS vision TEXT,
  ADD COLUMN IF NOT EXISTS signature TEXT,

  -- Nouvelles mises en situation
  ADD COLUMN IF NOT EXISTS situation_craquage TEXT,
  ADD COLUMN IF NOT EXISTS situation_stagnation TEXT,
  ADD COLUMN IF NOT EXISTS situation_tiktok TEXT,
  ADD COLUMN IF NOT EXISTS situation_abandon TEXT,
  ADD COLUMN IF NOT EXISTS situation_prediabete TEXT,
  ADD COLUMN IF NOT EXISTS situation_alcool TEXT,
  ADD COLUMN IF NOT EXISTS situation_marketing TEXT,
  ADD COLUMN IF NOT EXISTS situation_drastique TEXT,
  ADD COLUMN IF NOT EXISTS situation_flemme TEXT,
  ADD COLUMN IF NOT EXISTS situation_coup_dur TEXT;
