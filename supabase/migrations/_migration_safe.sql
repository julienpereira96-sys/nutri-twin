-- ═══════════════════════════════════════════════════════════════════
-- NutriTwin — Colonnes manquantes uniquement (100% safe)
-- Toutes les instructions utilisent IF NOT EXISTS :
-- si la colonne existe déjà → aucune erreur, aucun effet.
-- ═══════════════════════════════════════════════════════════════════

-- practitioners : colonnes pouvant manquer sur certains environnements
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS discrete_pin TEXT;
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- patients : heartbeat de connexion + dernier message patient
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_patient_message_at timestamptz;

-- sos_events : données exercice vocal SOS
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS origin text DEFAULT 'pratique';
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS closing_message text;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS traced_word text;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS emergency_exit boolean DEFAULT false;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS intake_message text;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS crisis_level_detected text;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS crisis_trigger_message_id uuid;
ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS intake_murmure text;
