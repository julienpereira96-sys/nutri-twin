-- Add bilan_cursors JSONB column to practitioners table
-- Stores the last message timestamp per patient used for bilan generation
-- Key: patient_id (UUID string), Value: ISO timestamp string
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS bilan_cursors JSONB DEFAULT '{}';
