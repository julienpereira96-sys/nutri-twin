/**
 * Observabilité — alerting des events CRITIQUES (sécurité patient / paiement).
 *
 * Léger et sans dépendance : ne casse aucun build. Deux canaux :
 *   1. console.error → capté par les logs Vercel (toujours).
 *   2. Webhook Slack-compatible (optionnel) → alerte IMMÉDIATE si l'env
 *      CRISIS_ALERT_WEBHOOK_URL est défini (une "Incoming Webhook" Slack suffit).
 *
 * Point d'extension : si tu installes Sentry plus tard (via `npx @sentry/wizard`),
 * ajoute simplement `Sentry.captureMessage(event, { level: "error", extra: context })`
 * ici — c'est le seul endroit à modifier.
 */
export async function reportCriticalEvent(
  event: string,
  context: Record<string, unknown> = {}
): Promise<void> {
  // 1. Toujours dans les logs.
  console.error(`[CRITICAL] ${event}`, context);

  // 2. Alerte immédiate optionnelle (Slack Incoming Webhook, ou tout endpoint
  //    acceptant { text }). Ne jamais faire échouer l'appelant pour une alerte.
  const url = process.env.CRISIS_ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 [NutriTwin] ${event}\n\`\`\`${JSON.stringify(context)}\`\`\``,
      }),
    });
  } catch {
    /* silencieux — une alerte qui échoue ne doit jamais casser le flux principal */
  }
}
