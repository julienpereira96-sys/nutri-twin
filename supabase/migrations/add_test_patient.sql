-- Colonnes pour le patient test (mode test praticien)
-- test_patient_user_id : UUID auth du patient test
-- test_patient_email   : email fictif utilisé pour se connecter
-- test_patient_password: mot de passe généré à la création (jamais exposé côté client)
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS test_patient_user_id uuid,
  ADD COLUMN IF NOT EXISTS test_patient_email text,
  ADD COLUMN IF NOT EXISTS test_patient_password text;

-- Flag is_test sur patients pour exclure le patient test des listes réelles
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;
