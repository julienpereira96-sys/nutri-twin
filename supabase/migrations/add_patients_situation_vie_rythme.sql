-- Migration : nouveaux champs profil patient — situation de vie + rythme professionnel
-- Ajoutés dans l'onboarding patient (task #389) mais migration SQL manquante.
-- IMPORTANT : À exécuter dans le SQL Editor Supabase IMMÉDIATEMENT.
-- Sans ces colonnes, getPatientProfile() échoue silencieusement et Gemini
-- reçoit un profil patient vide (patientContext = "").

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS situation_vie TEXT,
  ADD COLUMN IF NOT EXISTS rythme_professionnel TEXT;
