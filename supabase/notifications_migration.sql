-- Migration: Préférences de notifications pour les praticiens
-- À exécuter dans Supabase Studio (SQL Editor) ou via supabase db push

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS notify_behavioral BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_critical   BOOLEAN NOT NULL DEFAULT true;

-- Commentaires pour clarté
COMMENT ON COLUMN practitioners.notify_behavioral IS 'Envoyer un email si un patient reste en alerte comportementale (red_behavioral) sans retour au vert après 12h';
COMMENT ON COLUMN practitioners.notify_critical   IS 'Envoyer un email immédiatement si une crise critique est détectée (red_critical)';
