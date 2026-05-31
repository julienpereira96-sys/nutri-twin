-- Colonne dédiée pour le tour d'onboarding du dashboard
-- Séparée de onboarding_done qui marque la complétion du formulaire praticien
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS dashboard_tour_done boolean DEFAULT false;
