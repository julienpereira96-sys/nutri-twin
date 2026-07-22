-- ─── add_processed_stripe_events.sql ───
-- Idempotence des webhooks Stripe (finding M1).
-- Stripe garantit une livraison "at-least-once" : le même event peut arriver
-- plusieurs fois (retries sur timeout, doublons). La garde d'entrée du webhook
-- insère event.id ici AVANT traitement ; un doublon (unique_violation 23505) est
-- ignoré, ce qui empêche notamment le double-crédit de slots pack.
--
-- En cas d'échec de traitement, le webhook retire le marqueur (rollback) pour
-- autoriser le retry Stripe.

CREATE TABLE IF NOT EXISTS processed_stripe_events (
  event_id     TEXT        PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Purge : les marqueurs de plus de 30 jours ne servent plus (Stripe ne retente
-- pas au-delà de ~3 jours). Un cron peut exécuter :
--   DELETE FROM processed_stripe_events WHERE processed_at < NOW() - INTERVAL '30 days';
CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_processed_at
  ON processed_stripe_events (processed_at);
