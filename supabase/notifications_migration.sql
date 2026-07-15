-- Migration: Préférences de notifications pour les praticiens
-- À exécuter dans Supabase Studio (SQL Editor) ou via supabase db push

ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS notify_behavioral BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_critical   BOOLEAN NOT NULL DEFAULT true;

-- Commentaires pour clarté
COMMENT ON COLUMN practitioners.notify_behavioral IS 'Opt-in : envoyer un email si un patient reste en alerte comportementale (red_behavioral). Désactivé par défaut — le praticien active s'il le souhaite.';
COMMENT ON COLUMN practitioners.notify_critical   IS 'Opt-out : envoyer un email immédiatement si une crise critique est détectée (red_critical). Activé par défaut — le praticien peut désactiver en connaissance de cause.';
