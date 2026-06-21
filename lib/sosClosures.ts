/**
 * lib/sosClosures.ts — Fusion par horodatage des clôtures d'exercice SOS dans
 * un fil de discussion, sans jamais écrire ces données dans `conversations`.
 *
 * Pourquoi : `conversations` nourrit le contexte renvoyé à Gemini à chaque
 * tour (getConversationHistory dans app/api/chat/route.ts) et les Rapports
 * IA / Bilans. Y insérer un marqueur de résumé créerait un risque réel de
 * contamination de ce contexte (un texte entre crochets qui remonte dans une
 * réponse de Gemini, ou dans un rapport généré). sos_events reste la source
 * unique de vérité (closing_message / traced_word, écrits par
 * /api/sos/log) ; cette fonction se contente de la relire pour l'affichage,
 * côté patient (app/chat/page.tsx) ET côté praticien (app/dashboard/page.tsx).
 *
 * Comme sos_events n'a pas de session_id, on ancre chaque événement dans le
 * fil par comparaison d'horodatage : un événement n'est inséré que si son
 * triggered_at tombe dans la fenêtre couverte par les messages déjà chargés
 * (avec une marge après le dernier message, pour couvrir le temps que dure
 * l'exercice — jusqu'à 6 min de hard timer côté SOSExercise.tsx).
 */

export type SosClosureEvent = {
  triggered_at: string;
  traced_word: string | null;
  closing_message: string | null;
  // Vision globale de l'exercice (voir migration add_sos_events_intake_and_crisis_link.sql) :
  // ce qui a motivé l'exercice (intake) + si une alerte a été détectée pendant
  // cette session précise, posé par /api/chat (branche isSosIntakeCheck).
  intake_message: string | null;
  crisis_level_detected: string | null;
  crisis_trigger_message_id: string | null;
};

export type AnchoredRow = {
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type SosSummary = {
  word: string;
  feeling: string;
  intake: string | null;
  crisisLevel: string | null;
  crisisMessageId: string | null;
};

export type MergedRow =
  | { role: "user" | "assistant"; content: string }
  | { role: "widget"; content: string; sosSummary: SosSummary };

// Marge après le dernier message du fil pour rattacher un événement qui se
// clôture après le dernier message texte (cas le plus fréquent : l'exercice
// est souvent la dernière chose que fait le patient dans une session).
export const TRAILING_BUFFER_MS = 10 * 60 * 1000; // 10 min
// Marge symétrique avant le premier message — couvre le cas où l'événement a
// été déclenché juste avant que le premier message du fil ne soit horodaté.
export const LEADING_BUFFER_MS = 60 * 1000; // 1 min

/** Texte affiché dans la carte pour le ressenti — fallback si le patient n'a
 * rien dit à voix haute (placeholder entre crochets côté SOSExercise.tsx). */
export function closureFeeling(closingMessage: string | null): string {
  const raw = closingMessage?.trim() ?? "";
  return raw && !raw.startsWith("[") ? raw : "Aucun ressenti partagé à voix haute";
}

/**
 * Filtre les sos_events dont triggered_at tombe dans la fenêtre couverte par
 * des horodatages de messages déjà chargés (+ marge avant/après), triés par
 * triggered_at croissant. Brique de base réutilisée par mergeSosClosures
 * (côté patient) et par le merge dédié du dashboard praticien (qui a besoin
 * de produire ses propres lignes avec un id, donc ne peut pas réutiliser
 * directement MergedRow).
 */
export function findClosuresInWindow(rowCreatedAts: string[], events: SosClosureEvent[]): SosClosureEvent[] {
  if (rowCreatedAts.length === 0) return [];
  const tsOf = (s: string) => new Date(s).getTime();
  const timestamps = rowCreatedAts.map(tsOf);
  const minTs = Math.min(...timestamps);
  const maxTs = Math.max(...timestamps);
  return events
    .filter(e => {
      const t = tsOf(e.triggered_at);
      return !Number.isNaN(t) && t >= minTs - LEADING_BUFFER_MS && t <= maxTs + TRAILING_BUFFER_MS;
    })
    .sort((a, b) => tsOf(a.triggered_at) - tsOf(b.triggered_at));
}

export function mergeSosClosures(rows: AnchoredRow[], events: SosClosureEvent[]): MergedRow[] {
  if (rows.length === 0) return rows;

  const tsOf = (s: string) => new Date(s).getTime();
  type Anchored = { ts: number; row: MergedRow };
  const anchored: Anchored[] = rows.map(r => ({ ts: tsOf(r.created_at), row: { role: r.role, content: r.content } }));

  const inWindow = findClosuresInWindow(rows.map(r => r.created_at), events);
  for (const e of inWindow) {
    anchored.push({
      ts: tsOf(e.triggered_at),
      row: {
        role: "widget", content: "",
        sosSummary: {
          word: e.traced_word || "—",
          feeling: closureFeeling(e.closing_message),
          intake: e.intake_message?.trim() || null,
          crisisLevel: e.crisis_level_detected,
          crisisMessageId: e.crisis_trigger_message_id,
        },
      },
    });
  }

  anchored.sort((a, b) => a.ts - b.ts);
  return anchored.map(a => a.row);
}
