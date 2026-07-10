-- ============================================================
-- NUTRITWIN — Script droit à l'oubli (RGPD Art. 17)
-- À utiliser UNIQUEMENT sur demande explicite du patient
-- ============================================================
-- 1. Remplacer 'PATIENT_UUID_ICI' par l'UUID du patient
--    (visible dans Supabase → Authentication → Users)
-- 2. Coller dans Supabase → SQL Editor → Run
-- ============================================================

DO $$
DECLARE
  pid UUID := 'PATIENT_UUID_ICI';
BEGIN

  -- Données de suivi
  DELETE FROM journal_entries      WHERE patient_id = pid;
  DELETE FROM documents            WHERE patient_id = pid;
  DELETE FROM crisis_events        WHERE patient_id = pid;
  DELETE FROM exercise_logs        WHERE patient_id = pid;
  DELETE FROM sos_closures         WHERE patient_id = pid;
  DELETE FROM sos_events           WHERE patient_id = pid;

  -- Historique de conversation
  DELETE FROM conversations_sessions WHERE patient_id = pid;
  DELETE FROM conversations          WHERE patient_id = pid;

  -- Relation praticien/patient
  DELETE FROM patient_practitioner WHERE patient_id = pid;

  -- Profil patient
  DELETE FROM patients WHERE user_id = pid;

  -- Photo de profil (Storage)
  DELETE FROM storage.objects
    WHERE bucket_id = 'Avatars'
    AND name LIKE (pid::text || '/%');

  -- Compte de connexion (Auth)
  DELETE FROM auth.users WHERE id = pid;

  RAISE NOTICE 'Patient % supprimé définitivement.', pid;

END $$;
