-- Ajoute le nombre de patients supplémentaires achetés via un pack upsell.
-- Valeur nette en slots additionnels (ex: 5 pour un pack Essentiel, 10 ou 20 pour Pro).
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS extra_patients integer NOT NULL DEFAULT 0;

-- Optionnel : stocker l'ID de l'abonnement Stripe du pack pour gérer les annulations.
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS pack_subscription_id text;
