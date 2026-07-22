-- ─── protect_patient_clinical_fields.sql ───
-- RLS-2 — Statut clinique du patient autoritatif côté serveur (2026-07-22).
--
-- Problème : la policy RLS `patient_own` (ALL) laisse un patient modifier n'importe
-- quelle colonne de sa propre ligne via PostgREST — y compris `emotional_status`,
-- `admin_alerts`, `emotional_insight`. Un patient pouvait donc mettre son statut à
-- "green" et MASQUER une crise, court-circuitant les alertes praticien.
--
-- Pourquoi un TRIGGER et pas un REVOKE de colonne :
--   un REVOKE ... FROM authenticated frappe TOUT le rôle authenticated, donc aussi
--   le dashboard praticien (qui écrit légitimement ces colonnes en direct). Le
--   trigger distingue l'appelant : il bloque le patient, laisse passer le praticien
--   référent et le service_role. Zéro changement au dashboard.
--
-- Effet : côté patient, seule la route /api/patient/calm-return (service_role) peut
-- désormais écrire emotional_status.

CREATE OR REPLACE FUNCTION public.protect_patient_clinical_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Le serveur (routes API en service_role, webhooks) n'est jamais bridé.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Champs cliniques protégés : seul un praticien LIÉ au patient peut les modifier.
  IF (NEW.emotional_status  IS DISTINCT FROM OLD.emotional_status
   OR NEW.admin_alerts      IS DISTINCT FROM OLD.admin_alerts
   OR NEW.emotional_insight IS DISTINCT FROM OLD.emotional_insight) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.patient_practitioner pp
      WHERE pp.patient_id = NEW.user_id
        AND pp.practitioner_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Statut clinique : modification réservée au praticien référent ou au serveur';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_patient_clinical_fields ON public.patients;
CREATE TRIGGER trg_protect_patient_clinical_fields
  BEFORE UPDATE ON public.patients
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_patient_clinical_fields();

-- Vérif rapide après application :
--   • en tant que PATIENT (JWT patient) : UPDATE patients SET emotional_status='green'
--     WHERE user_id = <soi>  →  doit ÉCHOUER (exception).
--   • en tant que PRATICIEN lié : le même UPDATE sur son patient  →  doit PASSER.
