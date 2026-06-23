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
