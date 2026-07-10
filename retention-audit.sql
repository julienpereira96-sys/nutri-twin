-- ============================================================
-- NUTRITWIN — Audit rétention des données patients (RGPD)
-- ============================================================
-- La durée est calculée automatiquement selon la spécialité
-- du praticien enregistrée dans la table `practitioners`.
--
-- Règles appliquées :
--   Diététicien·ne, Médecin Nutritionniste, Endocrinologue,
--   Diabétologue, Psychologue (TCA)
--     → 20 ans (professionnel de santé réglementé)
--
--   Coach Nutrition, Conseiller, Naturopathe,
--   Nutritionniste (titre non protégé en France),
--   texte libre inconnu
--     → 3 ans (relation commerciale, CNIL)
--
-- ⚠️  Si vous avez renseigné "Autre" avec du texte libre,
--     vérifiez manuellement la colonne `retention_ans`
--     avant de lancer le script droit-a-loubli.sql.
--
-- Comment utiliser :
--   1. Remplacer PRACTITIONER_UUID_ICI par votre UUID
--      (Supabase → Authentication → Users)
--   2. Coller dans Supabase → SQL Editor → Run
-- ============================================================

DO $$
DECLARE
  -- ⚠️  Remplacer par votre UUID praticien
  practitioner_uuid UUID := 'PRACTITIONER_UUID_ICI';

  practitioner_specialty TEXT;
  retention_years        INT;
  cutoff                 TIMESTAMPTZ;
  r                      RECORD;
BEGIN

  -- Récupérer la spécialité du praticien
  SELECT specialty INTO practitioner_specialty
  FROM practitioners
  WHERE user_id = practitioner_uuid;

  IF practitioner_specialty IS NULL THEN
    RAISE EXCEPTION 'Praticien introuvable : %', practitioner_uuid;
  END IF;

  -- Calculer la durée de rétention selon la spécialité
  IF practitioner_specialty ILIKE '%Diétet%'
    OR practitioner_specialty ILIKE '%Médecin%'
    OR practitioner_specialty ILIKE '%Endocrinologue%'
    OR practitioner_specialty ILIKE '%Diabétologue%'
    OR practitioner_specialty ILIKE '%Psychologue%'
  THEN
    retention_years := 20;
  ELSE
    -- Coach, Naturopathe, Nutritionniste (titre libre), texte inconnu → 3 ans
    retention_years := 3;
  END IF;

  cutoff := NOW() - (retention_years || ' years')::INTERVAL;

  RAISE NOTICE '─────────────────────────────────────────────────────────';
  RAISE NOTICE 'Spécialité détectée  : %', practitioner_specialty;
  RAISE NOTICE 'Durée de rétention   : % ans', retention_years;
  RAISE NOTICE 'Date limite          : %', cutoff::DATE;
  RAISE NOTICE '─────────────────────────────────────────────────────────';
  RAISE NOTICE 'Patients dont le dossier peut être supprimé :';

  FOR r IN
    SELECT
      p.user_id,
      p.full_name,
      COALESCE(p.last_seen_at, p.created_at) AS derniere_activite,
      DATE_PART('year', AGE(COALESCE(p.last_seen_at, p.created_at)))::INT AS inactivite_ans
    FROM patients p
    INNER JOIN patient_practitioner pp
      ON pp.patient_id = p.user_id
      AND pp.practitioner_id = practitioner_uuid
    WHERE COALESCE(p.last_seen_at, p.created_at) < cutoff
    ORDER BY derniere_activite ASC
  LOOP
    RAISE NOTICE '  • % — inactif depuis % ans (dernière activité : %) — UUID : %',
      r.full_name,
      r.inactivite_ans,
      r.derniere_activite::DATE,
      r.user_id;
  END LOOP;

END $$;
