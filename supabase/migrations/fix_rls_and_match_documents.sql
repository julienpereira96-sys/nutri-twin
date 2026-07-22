-- ─── fix_rls_and_match_documents.sql ───
-- Corrections issues de la revue RLS + fonction RAG (2026-07-22).
-- Contient UNIQUEMENT les corrections sûres à appliquer telles quelles.
-- (RLS-2 — écriture patient sur ses champs cliniques — n'est PAS ici : elle exige
--  d'abord un refactor code, voir le rapport. Ne pas restreindre patients côté client
--  tant que les écritures directes du chat ne sont pas passées server-side.)
--
-- À appliquer sur CHAQUE environnement (staging PUIS prod).

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS-1 — patient_practitioner en LECTURE SEULE côté client.
--
-- Problème : les policies ALL sans WITH CHECK laissent Postgres retomber sur le
-- USING pour les INSERT. Via PostgREST (clé anon + JWT de session) :
--   • un praticien peut insérer {patient_id: <n'importe qui>, practitioner_id: soi}
--     → il se lie à un patient arbitraire et lit son profil `patients` + ses
--       `sos_events` (policies SELECT basées sur la relation) ;
--   • un patient peut insérer {patient_id: soi, practitioner_id: <victime>}
--     → ré-ouvre l'exfiltration RAG (le chat résout practitionerId via cette table).
--
-- Les relations sont créées EXCLUSIVEMENT server-side (invite-patient, test-mode,
-- cabinet) avec la service_role, qui bypasse les RLS. Vérifié : aucune écriture
-- directe à patient_practitioner hors app/api. Ce durcissement ne casse donc rien.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Praticien voit ses relations"    ON public.patient_practitioner;
DROP POLICY IF EXISTS patient_practitioner_practitioner ON public.patient_practitioner;
DROP POLICY IF EXISTS relation_visible                  ON public.patient_practitioner;
-- patient_practitioner_patient (SELECT, auth.uid() = patient_id) est conservée.

-- Lecture praticien (remplace l'ancienne policy ALL par une SELECT seule) :
DROP POLICY IF EXISTS patient_practitioner_practitioner_select ON public.patient_practitioner;
CREATE POLICY patient_practitioner_practitioner_select
  ON public.patient_practitioner
  FOR SELECT
  USING (auth.uid() = practitioner_id);

-- Résultat : public (anon+authenticated) ne peut QUE lire les relations le
-- concernant ; aucune policy INSERT/UPDATE/DELETE → écritures réservées au service_role.

-- ═══════════════════════════════════════════════════════════════════════════
-- match_documents — ne renvoyer que les documents GLOBAUX du praticien.
--
-- Sans `patient_id IS NULL`, la fonction renvoyait TOUS les documents du praticien,
-- y compris ceux rattachés à un patient précis → dans le chat du patient X, le RAG
-- pouvait remonter un document uploadé pour le patient Y (même cabinet). Les docs
-- patient passent déjà par match_patient_documents (correctement scopé par patient).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.match_documents(query_embedding vector, practitioner_id uuid, match_count integer)
 RETURNS TABLE(content text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  select content, 1 - (embedding <=> query_embedding) as similarity
  from documents d
  where d.practitioner_id = match_documents.practitioner_id
    and d.patient_id is null
  order by embedding <=> query_embedding
  limit match_count;
$function$;
