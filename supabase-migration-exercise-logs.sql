-- Migration : système de logs d'exercices + résumés praticien
-- À exécuter dans l'éditeur SQL Supabase

-- 1. Colonne practitioner_only dans conversations
--    Les messages avec cette colonne à true sont visibles côté praticien uniquement
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS practitioner_only boolean DEFAULT false;

-- 2. Colonne extra dans sos_events
--    Données spécifiques par type d'exercice (blocs, sens complétés, pensées, etc.)
ALTER TABLE sos_events
  ADD COLUMN IF NOT EXISTS extra jsonb;

-- 3. Index sur practitioner_only pour les requêtes dashboard
CREATE INDEX IF NOT EXISTS conversations_practitioner_only_idx
  ON conversations (practitioner_only)
  WHERE practitioner_only = true;
