-- Ajoute la colonne intake_murmure à sos_events.
-- Stocke l'interprétation clinique (murmure LLM) de ce que le patient
-- a exprimé pendant l'intake vocal SOS — distincte de la transcription
-- brute (intake_message) et du ressenti de clôture (closing_message).
-- Alimentée par la branche isSosIntakeCheck de /api/chat/route.ts.

ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS intake_murmure TEXT;
