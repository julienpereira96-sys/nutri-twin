-- Migration : ajouter summary_text sur sos_events
-- Note clinique narrative générée par Gemini à la complétion de chaque session SOS ou exercice.
-- Stockée pour éviter tout appel LLM au moment de l'affichage côté praticien.

ALTER TABLE sos_events
  ADD COLUMN IF NOT EXISTS summary_text TEXT;
