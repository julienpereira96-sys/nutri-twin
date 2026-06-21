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
