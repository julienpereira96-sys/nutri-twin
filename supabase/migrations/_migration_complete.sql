-- ═══════════════════════════════════════════════════════════════════
-- NutriTwin — Migration complète (idempotente, ordre garanti)
-- À coller dans Supabase SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════

-- ─── add_new_profile_columns.sql ───
-- Migration : nouveaux champs onboarding praticien
-- À exécuter dans Supabase SQL Editor

ALTER TABLE practitioner_profiles
  -- Bloc 2 — positions séparées (remplacent sujets_clivants)
  ADD COLUMN IF NOT EXISTS position_jeune TEXT,
  ADD COLUMN IF NOT EXISTS position_complements TEXT,
  ADD COLUMN IF NOT EXISTS position_petit_dejeuner TEXT,

  -- Bloc 3 — nouveaux champs gestion humaine
  ADD COLUMN IF NOT EXISTS alimentation_emotionnelle TEXT,
  ADD COLUMN IF NOT EXISTS levier_motivation TEXT,
  ADD COLUMN IF NOT EXISTS adaptation_profil TEXT,

  -- Ma Vision & Ma Signature (injection directe dans le prompt, pas RAG)
  ADD COLUMN IF NOT EXISTS vision TEXT,
  ADD COLUMN IF NOT EXISTS signature TEXT,

  -- Mises en situation
  ADD COLUMN IF NOT EXISTS situation_craquage TEXT,
  ADD COLUMN IF NOT EXISTS situation_stagnation TEXT,
  ADD COLUMN IF NOT EXISTS situation_abandon TEXT,
  ADD COLUMN IF NOT EXISTS situation_prediabete TEXT,
  ADD COLUMN IF NOT EXISTS situation_alcool TEXT,
  ADD COLUMN IF NOT EXISTS situation_marketing TEXT,
  ADD COLUMN IF NOT EXISTS situation_drastique TEXT,
  ADD COLUMN IF NOT EXISTS situation_flemme TEXT,
  ADD COLUMN IF NOT EXISTS situation_coup_dur TEXT;

-- Suppression des colonnes retirées de l'onboarding
ALTER TABLE practitioner_profiles
  DROP COLUMN IF EXISTS boussole_ecarts,
  DROP COLUMN IF EXISTS situation_tiktok;

-- ─── cleanup_profile_columns.sql ───
-- Migration : nettoyage practitioner_profiles
-- Remplace lifestyle_budget par deux colonnes distinctes
-- Supprime les anciens champs legacy (praticiens existants = 0, migration safe)
-- À exécuter dans Supabase SQL Editor

-- 1. Nouvelles colonnes issues du split de lifestyle_budget
ALTER TABLE practitioner_profiles
  ADD COLUMN IF NOT EXISTS sensibilite_budget TEXT,
  ADD COLUMN IF NOT EXISTS orientation_produits TEXT;

-- 2. Nouvelle colonne onboarding (manquante dans la migration précédente)
ALTER TABLE practitioner_profiles
  ADD COLUMN IF NOT EXISTS profil_perfectionniste TEXT;

-- 3. Suppression de lifestyle_budget (remplacée par les deux colonnes ci-dessus)
ALTER TABLE practitioner_profiles
  DROP COLUMN IF EXISTS lifestyle_budget;

-- 4. Suppression des anciens champs legacy (plus présents dans l'onboarding)
ALTER TABLE practitioner_profiles
  DROP COLUMN IF EXISTS sujets_clivants,
  DROP COLUMN IF EXISTS gestion_ecarts,
  DROP COLUMN IF EXISTS emotions,
  DROP COLUMN IF EXISTS motivation_berne,
  DROP COLUMN IF EXISTS approche_libre,
  DROP COLUMN IF EXISTS situation1,
  DROP COLUMN IF EXISTS situation2,
  DROP COLUMN IF EXISTS situation3,
  DROP COLUMN IF EXISTS situation4,
  DROP COLUMN IF EXISTS situation5,
  DROP COLUMN IF EXISTS situation6,
  DROP COLUMN IF EXISTS situation7,
  DROP COLUMN IF EXISTS situation8,
  DROP COLUMN IF EXISTS situation9;

-- ─── add_dashboard_tour_done.sql ───
-- Colonne dédiée pour le tour d'onboarding du dashboard
-- Séparée de onboarding_done qui marque la complétion du formulaire praticien
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS dashboard_tour_done boolean DEFAULT false;

-- ─── add_bilan_cursors.sql ───
-- Add bilan_cursors JSONB column to practitioners table
-- Stores the last message timestamp per patient used for bilan generation
-- Key: patient_id (UUID string), Value: ISO timestamp string
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS bilan_cursors JSONB DEFAULT '{}';

-- ─── add_documents_patient_scoping.sql ───
-- Ajoute le scoping patient_id sur la table documents et la fonction RPC
-- match_patient_documents, utilisées par le RAG patient dans /api/chat.

-- 1. Colonne patient_id (nullable = document praticien global / "protocole")
ALTER TABLE documents ADD COLUMN IF NOT EXISTS patient_id uuid;

CREATE INDEX IF NOT EXISTS documents_patient_id_idx ON documents (patient_id);

-- 2. Fonction de recherche vectorielle scoping patient
-- Recherche les chunks de documents appartenant spécifiquement à un patient
-- (documents de type "patient", anonymisés à l'upload).
CREATE OR REPLACE FUNCTION match_patient_documents(
  query_embedding vector(768),
  patient_id_param uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    documents.id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE documents.patient_id = patient_id_param
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─── add_cabinet_collaboration.sql ───
-- ═══════════════════════════════════════════════════════════════════════
-- Migration : Espace Cabinet Collaboratif
-- Crée la table cabinets, lie les praticiens et patients à un cabinet,
-- ajoute le statut de partage et l'audit trail des transferts.
-- ═══════════════════════════════════════════════════════════════════════


-- ── 1. Table cabinets ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cabinets (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── 2. Lier les praticiens à un cabinet ───────────────────────────────
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS cabinet_id UUID REFERENCES cabinets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_practitioners_cabinet_id
  ON practitioners (cabinet_id)
  WHERE cabinet_id IS NOT NULL;


-- ── 3. Enrichir la table patients ─────────────────────────────────────
-- cabinet_id : identifie le cabinet auquel le dossier est rattaché
-- sharing_status :
--   'private'     → visible uniquement par le praticien assignataire (défaut)
--   'shared'      → visible par tous les praticiens du même cabinet en lecture
--   'transferred' → réassigné à un confrère ; retiré de la liste de l'ancien praticien
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS cabinet_id     UUID REFERENCES cabinets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sharing_status TEXT NOT NULL DEFAULT 'private'
    CHECK (sharing_status IN ('private', 'shared', 'transferred'));

-- Index pour les requêtes "dossiers partagés du cabinet"
CREATE INDEX IF NOT EXISTS idx_patients_cabinet_sharing
  ON patients (cabinet_id, sharing_status)
  WHERE sharing_status != 'private';


-- ── 4. Audit trail des actions collaboratives ─────────────────────────
-- Chaque partage ou transfert de dossier est loggué ici (conformité RGPD).
CREATE TABLE IF NOT EXISTS cabinet_transfers (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id           UUID        NOT NULL,  -- patients.user_id
  from_practitioner_id UUID        NOT NULL,  -- practitioners.user_id
  to_practitioner_id   UUID        NOT NULL,  -- practitioners.user_id (= from si action 'share')
  cabinet_id           UUID        NOT NULL,
  action               TEXT        NOT NULL CHECK (action IN ('share', 'unshare', 'transfer')),
  transferred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cabinet_transfers_patient
  ON cabinet_transfers (patient_id, transferred_at DESC);

CREATE INDEX IF NOT EXISTS idx_cabinet_transfers_cabinet
  ON cabinet_transfers (cabinet_id, transferred_at DESC);


-- ═══════════════════════════════════════════════════════════════════════
-- RLS : toutes nos routes API utilisent service_role_key qui bypass RLS
-- entièrement. Les policies de partage cabinet sont donc gérées au niveau
-- applicatif (guards IDOR dans share-patient et transfer-patient).
-- Si tu as besoin de policies client-side à l'avenir, les ajouter ici
-- APRÈS avoir vérifié que la table patients n'a pas de policies existantes
-- conflictuelles via : SELECT policyname FROM pg_policies WHERE tablename = 'patients';
-- ═══════════════════════════════════════════════════════════════════════

-- ─── add_patients_last_seen_at.sql ───
-- Ajoute un horodatage de "dernière connexion" fiable, mis à jour par un
-- heartbeat côté client (app/chat/page.tsx) indépendamment de l'envoi de
-- messages, pour le champ "Dernière connexion" du dashboard praticien.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- ─── add_sos_events_origin.sql ───
-- Distingue les sos_events déclenchés en situation de crise ("crise")
-- des exercices pratiqués librement par le patient en état calme ("pratique").
-- "crise"    : détection auto [TRIGGER_SOS] OU auto-déclenché alors que
--              emotional_status était red / red_behavioral.
-- "pratique" : auto-déclenché en état calme (vert/orange), ou via la bibliothèque d'exercices.
ALTER TABLE sos_events
  ADD COLUMN IF NOT EXISTS origin text DEFAULT 'pratique';

-- ─── add_sos_events_closing_log.sql ───
-- Champs de clôture pour l'exercice SOS vocal (Gemini Live, SOSExercise.tsx).
-- Avant cette migration, /api/sos/log n'existait pas : les 3 appels que
-- SOSExercise.tsx lui adressait (clôture normale, fallback 40s, clôture sans
-- réponse) échouaient en 404 silencieux — aucune clôture vocale n'a jamais
-- été journalisée dans sos_events depuis la réécriture V2.
--
-- closing_message : ce que le patient a dit (ou non) à la question de clôture.
-- traced_word      : le mot tracé pendant l'exercice (null si jamais atteint).
-- emergency_exit   : true si la séance a été interrompue par le garde-fou
--                     critique sur l'intake vocal (red_critical détecté pendant
--                     que le patient parlait), plutôt que terminée normalement.
ALTER TABLE sos_events
  ADD COLUMN IF NOT EXISTS closing_message text,
  ADD COLUMN IF NOT EXISTS traced_word text,
  ADD COLUMN IF NOT EXISTS emergency_exit boolean DEFAULT false;

-- ─── add_sos_events_status_completed_abandoned.sql ───
-- Étend les valeurs acceptées pour sos_events.status avec :
--   "completed" : exercice vocal SOS terminé normalement avec réponse de
--                  clôture, mais sans apaisement confirmé (ni positif ni négatif
--                  suffisant pour déclencher success/failed). Posé par /api/sos/log.
--   "abandoned" : exercice interrompu prématurément (emergencyExit ou fermeture
--                  de l'app). Posé par /api/sos/log.
--
-- Si la colonne est de type "text" sans contrainte CHECK (cas probable),
-- cette migration ne fait rien de destructif — les valeurs sont acceptées
-- nativement et la section DO $$ ci-dessous est un no-op.
--
-- Si une contrainte CHECK existait (cas improbable vu le reste du schéma),
-- elle est retirée et remplacée par une version étendue.

DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Cherche une contrainte CHECK sur la colonne status de sos_events
  SELECT conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class r ON r.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = r.relnamespace
  WHERE r.relname = 'sos_events'
    AND n.nspname = 'public'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE sos_events DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- Pas de nouvelle contrainte CHECK ajoutée : la colonne reste text libre,
-- cohérent avec origin, crisis_level_detected et les autres colonnes texte du schéma.
-- Les valeurs métier valides sont : pending | success | failed | expired | completed | abandoned

-- ─── add_sos_events_intake_and_crisis_link.sql ───
-- Vision globale de l'exercice SOS vocal pour le praticien (carte "Exercice
-- SOS terminé" — app/chat/SOSExercise.tsx + /api/sos/log + /api/sos/closures).
--
-- intake_message            : ce que le patient a dit pendant l'intake, AVANT
--                              de toucher l'écran (ce qui a motivé l'exercice)
--                              — distinct de closing_message (comment il se
--                              sent APRÈS, déjà existant).
-- crisis_level_detected     : "red_critical" | "red_behavioral" | null — posé
--                              par /api/chat (branche isSosIntakeCheck) si le
--                              garde-fou vocal détecte quelque chose pendant
--                              cet exercice précis, pour que la carte puisse
--                              signaler qu'une alerte a eu lieu pendant cette
--                              session sans que le praticien ait à corréler
--                              manuellement deux horodatages.
-- crisis_trigger_message_id : id de la ligne `conversations` correspondant à
--                              la phrase qui a déclenché la détection — permet
--                              au dashboard de réutiliser le mécanisme "Aller
--                              au message" déjà existant.
ALTER TABLE sos_events
  ADD COLUMN IF NOT EXISTS intake_message text,
  ADD COLUMN IF NOT EXISTS crisis_level_detected text,
  ADD COLUMN IF NOT EXISTS crisis_trigger_message_id uuid;

-- ─── add_sos_events_intake_murmure.sql ───
-- Ajoute la colonne intake_murmure à sos_events.
-- Stocke l'interprétation clinique (murmure LLM) de ce que le patient
-- a exprimé pendant l'intake vocal SOS — distincte de la transcription
-- brute (intake_message) et du ressenti de clôture (closing_message).
-- Alimentée par la branche isSosIntakeCheck de /api/chat/route.ts.

ALTER TABLE sos_events ADD COLUMN IF NOT EXISTS intake_murmure TEXT;

-- ─── add_patients_last_patient_message_at.sql ───
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_patient_message_at timestamptz;

