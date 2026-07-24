-- ─── add_patients_profile_columns.sql ───
-- Colonnes profil patient manquantes en production.
--
-- niveau_activite   : niveau d'activité physique saisi à l'invitation (step 2)
--                     Exemples : "Sédentaire", "Légère", "Modérée", "Intense", "Athlète"
-- regime_specifique : régime alimentaire particulier
--                     Exemples : "Végétarien", "Vegan", "Sans gluten", "Halal", "Méditerranéen"
-- is_test           : true pour le patient de démonstration créé par le mode test praticien.
--                     Déjà présent dans add_test_patient.sql mais non appliqué sur certains
--                     environnements — cette migration le recouvre en IF NOT EXISTS.
--
-- Ces trois colonnes étaient référencées dans le SELECT de loadPatients() et dans
-- l'upsert de /api/invite-patient, causant des erreurs 400 PostgREST en production.

ALTER TABLE patients ADD COLUMN IF NOT EXISTS niveau_activite text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS regime_specifique text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;
