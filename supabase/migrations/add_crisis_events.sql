-- ═══════════════════════════════════════════════════════════════════
-- NutriTwin — Table crisis_events
-- Trace chaque épisode de crise (red_behavioral) avec son moment de
-- déclenchement et (optionnel) sa résolution.
-- Permet de calculer avec précision :
--   • "Crises apaisées"   = COUNT(resolved_at IS NOT NULL)
--   • "Taux d'apaisement" = resolved / triggered × 100
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crisis_events (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id      uuid        NOT NULL,
  practitioner_id uuid        NOT NULL,
  triggered_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

-- Index pour les requêtes par praticien (dashboard mensuel)
CREATE INDEX IF NOT EXISTS crisis_events_prac_month_idx
  ON crisis_events (practitioner_id, triggered_at DESC);

-- Index partiel pour trouver les crises ouvertes d'un patient
CREATE INDEX IF NOT EXISTS crisis_events_patient_open_idx
  ON crisis_events (patient_id)
  WHERE resolved_at IS NULL;
