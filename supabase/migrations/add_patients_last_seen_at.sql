-- Ajoute un horodatage de "dernière connexion" fiable, mis à jour par un
-- heartbeat côté client (app/chat/page.tsx) indépendamment de l'envoi de
-- messages, pour le champ "Dernière connexion" du dashboard praticien.
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
