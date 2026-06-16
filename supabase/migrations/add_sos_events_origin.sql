-- Distingue les sos_events déclenchés en situation de crise ("crise")
-- des exercices pratiqués librement par le patient en état calme ("pratique").
-- "crise"    : détection auto [TRIGGER_SOS] OU auto-déclenché alors que
--              emotional_status était red / red_behavioral.
-- "pratique" : auto-déclenché en état calme (vert/orange), ou via la bibliothèque d'exercices.
ALTER TABLE sos_events
  ADD COLUMN IF NOT EXISTS origin text DEFAULT 'pratique';

-- Best-effort : les événements historiques avec sos_context préfixé "[contexte chat récent]"
-- proviennent de la détection automatique → on les requalifie en "crise".
UPDATE sos_events
  SET origin = 'crise'
  WHERE sos_context LIKE '[contexte chat récent]%';
