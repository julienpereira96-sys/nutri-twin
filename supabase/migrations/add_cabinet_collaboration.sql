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
