-- Migration : ajout avatar_url sur la table practitioners
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
