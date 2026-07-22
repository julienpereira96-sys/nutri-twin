-- ============================================================
-- NUTRITWIN — Rétention (RGPD Art. 5.1.e) : RAPPORT des patients
-- au-delà de leur durée de conservation.
-- ============================================================
-- ⚠️  Ce script NE SUPPRIME RIEN. Il LISTE les dossiers dont la
--     dernière activité dépasse la durée de rétention applicable,
--     pour revue humaine. La suppression effective doit passer par
--     droit-a-loubli.sql (ou la route /api/delete-account), qui
--     utilisent la même liste canonique de tables.
--
-- Règles de rétention (cf. retention-audit.sql) :
--   Pro de santé réglementé (Diététicien, Médecin nutritionniste,
--   Endocrinologue, Diabétologue, Psychologue TCA) → 20 ans
--   Autres (Coach, Conseiller, Naturopathe, titre non protégé) → 3 ans
--
-- Base de calcul : dernière activité connue du patient
--   = COALESCE(last_patient_message_at, created_at).
-- ============================================================

WITH retention AS (
  SELECT
    p.user_id,
    p.first_name,
    p.last_name,
    COALESCE(p.last_patient_message_at, p.created_at) AS last_activity,
    CASE
      WHEN pr.specialty ILIKE '%Diétét%'
        OR pr.specialty ILIKE '%Médecin%'
        OR pr.specialty ILIKE '%Endocrinologue%'
        OR pr.specialty ILIKE '%Diabétologue%'
        OR pr.specialty ILIKE '%Psychologue%'
      THEN 20
      ELSE 3
    END AS retention_years
  FROM patients p
  JOIN patient_practitioner pp ON pp.patient_id = p.user_id
  JOIN practitioners pr ON pr.user_id = pp.practitioner_id
)
SELECT
  user_id,
  first_name,
  last_name,
  last_activity,
  retention_years,
  (last_activity + make_interval(years => retention_years)) AS purge_eligible_at
FROM retention
WHERE last_activity + make_interval(years => retention_years) < NOW()
ORDER BY purge_eligible_at ASC;

-- ============================================================
-- AUTOMATISATION (à activer UNIQUEMENT après validation du rapport ci-dessus)
--
-- Une fois le processus validé, on peut planifier une revue via pg_cron
-- (extension Supabase). Recommandation : NE PAS auto-supprimer — plutôt
-- notifier / marquer pour revue, puis suppression humaine via le chemin vetté.
--
--   -- Exemple : rapport mensuel inséré dans une table d'audit
--   -- SELECT cron.schedule('retention-review', '0 3 1 * *', $$
--   --   INSERT INTO retention_review_log (ran_at, candidates)
--   --   SELECT NOW(), count(*) FROM ( <la requête ci-dessus> ) q;
--   -- $$);
-- ============================================================
