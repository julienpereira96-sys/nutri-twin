# Audit approfondi NutriTwin — parties 4 & 5

> Passe complémentaire au-delà du périmètre sécurité initial (2026-07-22).
> Domaines : détection de crise (clinique), RGPD, secrets/infra, legacy/code.
> Traités un par un, par ordre de criticité.

---

## Domaine 1 — Fiabilité clinique de la détection de crise

### Architecture réelle (3 couches)

1. **Fast-path mots-clés** (`isCriticalKeyword`) → si un mot-clé de `CRISIS_CRITICAL_KEYWORDS` est présent → vérification LLM (« danger de mort immédiat ? oui/non ») → si « oui », réponse `CRISIS_CRITICAL_RESPONSES` (avec le **3114**) + `red_critical` + alerte praticien.
2. **Classifieur LLM permanent** (`analyzeCrisisWithLLM`, `gemini-3.1-flash-lite`, temp 0) — **lancé sur chaque message, sans barrière regex** (bon point). Contexte : profil + 5 derniers messages + état patient. Produit `red_critical` / `red_behavioral` / `none`.
3. **JSON technique du modèle principal** (`|||{status}|||`) — filet universel.

### Points positifs

- Le classifieur LLM tourne **toujours** (pas de gate regex) → filet au-delà des mots-clés.
- La ressource **3114** (prévention suicide, 24h/24) est affichée sur le fast-path suicide — excellente pratique.
- Trois couches indépendantes.

### Findings

**CD-1 — 🟠 Élevé — Fail-open silencieux des deux classifieurs LLM.**
`analyzeCrisisWithLLM` (catch → `{level:"none"}`, ligne 339-341) et le parsing du JSON principal (catch silencieux, ligne 1862) échouent **en « pas de crise »**, sans log, sans retry. Une erreur Vertex transitoire (timeout, 5xx, JSON malformé) sur un message suicidaire sans mot-clé exact → **crise ratée et invisible**. Sur un détecteur de suicide, le fail-open silencieux est le pire mode de défaillance.
→ *Reco : logguer chaque échec du classifieur, retry 1× sur erreur, et exposer un compteur d'échecs pour monitoring. Ne jamais avaler l'erreur en silence sur ce chemin.*

**CD-2 — 🟠 Élevé — La ressource 3114 n'est PAS montrée quand la crise est détectée par le LLM (et non par mot-clé).**
Le message d'urgence contenant le 3114 (`CRISIS_CRITICAL_RESPONSES`) n'est injecté que sur le **fast-path mots-clés**. Quand `analyzeCrisisWithLLM` détecte `red_critical` (ligne 1689) sans match mot-clé, le code mène l'alerte praticien + verrou, mais **la réponse au patient reste la réponse streamée normale du Jumeau** — pas de garantie que le numéro d'urgence apparaisse. Un patient en crise détecté « uniquement » par le LLM peut donc ne pas recevoir la ressource vitale.
→ *Reco : toute bascule `red_critical` (quelle que soit la couche qui la détecte) doit surfacer la ressource d'urgence au patient, de façon homogène.*

**CD-3 — 🟡 Moyen — Le modèle le plus léger sur la tâche la plus critique.**
`gemini-3.1-flash-lite` (temp 0, 150 tokens) pour la détection suicide, plus un « verify » à 10 tokens (« oui/non ») qui peut **supprimer un vrai positif** : si le verify répond « non » (ou glitche → chaîne vide), un vrai « je veux mourir » du fast-path est écarté.
→ *Reco : envisager un modèle plus robuste (ou un double-check) spécifiquement sur le chemin critique ; le verify devrait pencher côté sécurité (en cas de doute/erreur, garder l'alerte plutôt que la lever).*

**CD-4 — 🟡 Moyen — Faux négatifs par fragilité des mots-clés.**
`includes()` en sous-chaîne rate : fautes/SMS (« jveux mourir », « chui suicidaire »), euphémismes (« je serais mieux mort », « que tout s'arrête », « m'endormir et ne pas me réveiller », « à quoi bon continuer »), formulations indirectes. Tous reposent **entièrement** sur le classifieur LLM — qui fait fail-open (CD-1). La combinaison CD-1 + CD-4 est le vrai angle mort.
→ *Reco : élargir prudemment la liste + s'appuyer sur un classifieur fiabilisé (CD-1/CD-3) plutôt que sur les seuls mots-clés.*

**CD-5 — 🔵 Faible — Négation non gérée.**
`includes("disparaître")` matche « je ne veux pas disparaître » (rassurant) → faux positif. Moins grave qu'un faux négatif ici, mais source de bruit (cf. le faux positif déjà corrigé côté insight).

**CD-6 — 🔵 Faible / hygiène — `hasBehavioralSignal` est du code mort.**
La fonction pré-filtre regex n'est **jamais appelée** (confirmé par ESLint « defined but never used »). La `CARTOGRAPHIE.md` la décrit pourtant comme une barrière active → documentation obsolète. À supprimer ou re-brancher consciemment.

### Priorisation domaine 1

- **À traiter (sécurité patient réelle, bien cadré)** : **CD-1** (logging/retry, pas de fail silencieux) et **CD-2** (ressource d'urgence homogène sur toute détection `red_critical`).
- **À concevoir avec soin (ne pas dégrader la sensibilité)** : CD-3, CD-4.
- **Mineur** : CD-5, CD-6.

> ⚠️ Je ne modifie pas la logique de détection sans validation : sur ce produit, un faux négatif est potentiellement mortel. CD-1 et CD-2 sont des ajouts (filet + ressource), pas un affaiblissement — ils sont sûrs à implémenter si tu valides.

---

## Domaine 2 — RGPD & rétention

### RGPD-2 — 🟠 Élevé — L'export RGPD fuite des données confidentielles du praticien au patient
`export-rgpd/route.ts` fait `patients.select("*")` (ligne 19) et renvoie tout au patient. Or la table `patients` contient **`private_notes`** (notes privées du praticien sur le patient) et **`practitioner_instruction`** (les murmures — instructions confidentielles au Jumeau). Le patient récupère donc les notes cliniques privées et la stratégie du praticien. Confidentialité praticien rompue.
→ *Reco : remplacer `select("*")` par une liste explicite de colonnes appartenant au patient (profil, réponses onboarding, statut) en EXCLUANT `private_notes`, `practitioner_instruction`, et idéalement `emotional_insight` / murmures (évaluations cliniques).* 

### RGPD-1 — 🟠 Élevé — Export incomplet (Art. 15/20)
L'export omet `crisis_events` (historique de crise) et `documents` (documents patient). Le droit d'accès/portabilité doit couvrir **toutes** les données personnelles.
→ *Reco : ajouter crisis_events et documents (contenu patient) à l'export.*

### RGPD-3 — 🟡 Moyen — La suppression de compte ne purge pas l'avatar
`delete-account/route.ts` supprime les tables mais **pas la photo de profil** dans `storage.objects` (bucket Avatars). Le script manuel `droit-a-loubli.sql` le fait (`DELETE FROM storage.objects WHERE bucket_id='Avatars' AND name LIKE pid/%`), la route non → photo conservée après suppression.
→ *Reco : ajouter la suppression du dossier avatar du patient dans la route.*

### RGPD-4 — 🟡 Moyen — Trois chemins de suppression divergents
`delete-account/route.ts`, le doublon `delete-account/route/route.ts`, et `droit-a-loubli.sql` suppriment des **jeux de tables différents** (le doublon oublie `sos_closures` ; les routes oublient `storage.objects` ; etc.). Selon le chemin emprunté, des données personnelles peuvent survivre. Risque de purge incomplète.
→ *Reco : une seule source de vérité — centraliser la liste des tables/objets à purger, et aligner les trois chemins (ou supprimer le doublon, déjà signalé).*

### RGPD-5 — 🟡 Moyen — Rétention non automatisée
`retention-audit.sql` calcule une durée (20 ans pro de santé réglementé / 3 ans sinon) mais c'est un **script manuel** lancé par le praticien. Aucune purge automatique au-delà de la durée légale → risque de conservation excessive (Art. 5.1.e).
→ *Reco : à terme, un job planifié qui purge selon `retention_ans`. Au minimum, documenter le processus manuel et sa cadence.*

### RGPD-6 — 🔵 Info / juridique — Sous-traitants (hors code)
Données de santé traitées par Google (Gemini/Vertex, TTS), Supabase, Stripe, Resend, Upstash. Nécessite des DPA avec chaque sous-traitant + mention dans la politique de confidentialité + base légale du traitement de données de santé (Art. 9). À valider avec le volet juridique.

### Note
Les requêtes export/delete touchent `sos_closures` / `exercise_logs` (tables vestigiales inexistantes) → renvoient vide silencieusement, sans erreur bloquante. Cohérent avec le domaine 4 (nettoyage).

---

## Domaine 3 — Secrets, config & durcissement infra

### Points positifs (vérifiés)
- **Aucun secret côté client** : `SERVICE_ROLE_KEY`, `STRIPE_SECRET`, `CRISIS_SECRET_TOKEN`, `RESEND_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `WEBHOOK_SECRET` ne sont jamais référencés hors `app/api`. Les `NEXT_PUBLIC_*` exposées sont toutes légitimement publiques (URL, project ID, clés publishable/anon).
- **Headers de sécurité solides** (`next.config.ts`) : HSTS 1 an + sous-domaines, `X-Frame-Options: DENY` (SAMEORIGIN sur `/chat` pour l'iframe test), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (caméra/géoloc off, micro self pour le SOS vocal).
- **Quota de messages du chat enforced côté serveur** (`/api/chat` renvoie `429` à la limite du plan) — pas seulement côté client, donc non contournable.
- **Aucun `dangerouslySetInnerHTML`** → React échappe le contenu, donc pas de XSS stocké via les messages patient.

### INFRA-1 — 🟡 Moyen — Pas de Content-Security-Policy
Le commentaire de `next.config.ts` dit « X-XSS-Protection 0 (remplacé par CSP) » mais **aucun CSP n'est défini**. Le risque XSS direct est faible (React échappe, pas de innerHTML), mais un CSP reste une défense-en-profondeur utile : restreindre les sources de scripts, encadrer les connexions sortantes (WebSocket Vertex, Stripe), durcir contre l'injection. 
→ *Reco : ajouter un CSP (au moins `default-src 'self'` + les origines Vertex/Stripe/Supabase/Upstash nécessaires). À tester soigneusement pour ne pas casser le WebSocket Gemini Live.*

### INFRA-2 — 🟡 Moyen — Routes LLM/TTS sans rate limiting
Seul `/api/chat` a un quota. `generate-report`, `generate-bilan`, `generate-soutien`, `generate-bravo`, `generate-pdf`, `tts` appellent Vertex/TTS **sans aucune limite**. Un praticien authentifié peut les marteler (boucle sur `generate-report`, `tts`) → **abus de coût** Vertex/TTS. Portée limitée à ses propres patients (guards IDOR), mais coût non borné.
→ *Reco : appliquer un rate limit par `user.id` (même mécanisme Upstash que le chat) sur les routes LLM/TTS.*

### INFRA-3 — 🔵 Faible — Alerte crise : auth incohérente + appel HTTP interne fragile
`send-crisis-alert` s'authentifie par secret partagé (`CRISIS_SECRET_TOKEN`) et est appelée par le chat via un **self-fetch HTTP** (`fetch(NEXT_PUBLIC_APP_URL/api/send-crisis-alert)`), tandis que `send-behavioral-alert` utilise un Bearer JWT. Deux modèles pour la même famille d'action. Et si `CRISIS_SECRET_TOKEN` n'est pas défini en prod, l'email de crise **échoue en silence** (le chat catch sans logguer).
→ *Reco : soit un appel de fonction direct (pas de round-trip HTTP) pour l'alerte crise, soit au minimum vérifier que `CRISIS_SECRET_TOKEN` est défini + logguer l'échec d'envoi.*

### INFRA-4 — 🔵 Info — CSRF
Les routes POST authentifiées par cookie SSR sont exposées au CSRF en théorie, mais les cookies Supabase sont `SameSite=Lax` par défaut (mitigation efficace pour les POST cross-site) et la plupart des routes acceptent aussi un Bearer. Risque faible ; à garder en tête si un flux passe un jour en `SameSite=None`.

---

## Domaine 4 — Nettoyage legacy & code restant

Déjà nettoyé (le brief §8 était en retard) : les composants `MarcheExercise` / `BodyScanExercise` / `AdaptiveCoachingExercise` n'existent plus, et les checks du statut `"red"` legacy ont disparu. Reste :

### LEGACY-1 — 🟡 Moyen (incohérence, pas juste du mort) — `red_behavioral_until`
La `CARTOGRAPHIE.md` §5.3 dit ce champ **supprimé** (« pas de verrou temporel, retour au vert piloté par Gemini »). Or il subsiste (15 occurrences dans `chat/page.tsx`, `dashboard/page.tsx`, `calm-return`). Surtout, le dashboard (ligne ~1254) garde un **bloc d'auto-expiry** qui remet en vert les patients dont `red_behavioral_until` a expiré, et le bouton SAS « rester safe » (`chat` 1597) le positionne à +12h. Résultat : **deux mécanismes concurrents de retour au vert** (apaisement Gemini vs timer 12h). À trancher : soit on assume le timer et on met à jour la cartographie, soit on retire complètement le champ et le bloc d'auto-expiry.

### LEGACY-2 — 🔵 Faible — Route doublon `delete-account/route/route.ts`
Existe toujours (déjà signalée dans l'audit initial). Purge un jeu de tables différent de la route principale (cf. RGPD-4). À supprimer.

### LEGACY-3 — 🔵 Faible — Fonctions mortes dans `chat/route.ts`
`hasBehavioralSignal` (ligne 217, cf. CD-6) et `getDefaultPrompt` (ligne 978) ne sont jamais appelées (confirmé ESLint). Plus quelques variables inutilisées (`currentEmotionalStatusSos`, `patientPathologies`). À retirer.

### LEGACY-4 — 🔵 Faible — Tables vestigiales référencées
`exercise_logs`, `journal_entries`, `sos_closures` sont référencées dans les routes delete/export mais **n'existent pas** en base. Soit les créer (si features à réactiver), soit retirer les références. `journal_entries` = ancien journal retiré (confirmé par toi).

---

## Synthèse — priorisation des 4 domaines

| # | Finding | Sévérité | Type |
|---|---|---|---|
| CD-1 | Fail-open silencieux des classifieurs de crise | 🟠 Élevé | Sécurité patient |
| CD-2 | Ressource 3114 absente si détection LLM (non mot-clé) | 🟠 Élevé | Sécurité patient |
| RGPD-2 | Export fuite `private_notes`/murmures au patient | 🟠 Élevé | Confidentialité |
| RGPD-1 | Export incomplet (crisis_events, documents) | 🟠 Élevé | Conformité |
| CD-3 / CD-4 | Modèle léger + fragilité mots-clés (angle mort combiné) | 🟡 Moyen | Sécurité patient |
| RGPD-3/4/5 | Avatar non purgé, 3 chemins delete divergents, rétention manuelle | 🟡 Moyen | Conformité |
| INFRA-1/2 | Pas de CSP ; routes LLM/TTS non rate-limitées | 🟡 Moyen | Infra/coût |
| LEGACY-1 | `red_behavioral_until` : deux retours-au-vert concurrents | 🟡 Moyen | Cohérence |
| CD-5/6, INFRA-3/4, LEGACY-2/3/4 | Divers | 🔵 Faible | Hygiène |

**Quick wins sûrs à implémenter (ajouts, pas de risque de régression clinique) :**
1. RGPD-2 (colonnes explicites à l'export au lieu de `select("*")`) — 2 min, ferme une fuite de confidentialité.
2. CD-2 (ressource d'urgence sur toute bascule `red_critical`) — sécurité patient.
3. CD-1 (log + retry sur échec classifieur) — filet, pas d'affaiblissement.
4. RGPD-1 + RGPD-3 (compléter export + purge avatar).

**À concevoir/valider avant de toucher :** CD-3/CD-4 (sensibilité détection — ne pas dégrader), LEGACY-1 (décision produit sur le retour au vert).
