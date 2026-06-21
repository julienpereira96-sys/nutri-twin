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
