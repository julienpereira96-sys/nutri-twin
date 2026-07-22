# Checklist de tests staging — NutriTwin (avant lancement)

> À dérouler en **staging** (base + Stripe en mode test) après déploiement des correctifs de sécurité/billing.
> Objectif : valider à l'exécution ce que `tsc`/`eslint` ne peuvent pas garantir (comportement réel).
> Convention : ☐ = à tester, coche quand OK. Chaque test a un **cas bloqué attendu** ET un **happy path** pour vérifier qu'on n'a rien cassé.

---

## A. Pré-requis (à faire AVANT de tester)

- [ ] **Migration** `supabase/migrations/add_processed_stripe_events.sql` appliquée sur la base staging. Vérifier : `SELECT * FROM processed_stripe_events LIMIT 1;` ne renvoie pas d'erreur « relation does not exist ».
- [ ] **IAM Google (M4)** : le compte de service `GOOGLE_SERVICE_ACCOUNT_JSON` de staging porte **uniquement** `roles/aiplatform.user`. Vérifier dans la console GCP → IAM qu'il n'a aucun autre rôle (surtout pas Editor/Owner).
- [ ] **Stripe test mode** : clés de test configurées, endpoint webhook staging enregistré dans le dashboard Stripe, `STRIPE_WEBHOOK_SECRET` de staging à jour.
- [ ] **Env vars packs** présents : `STRIPE_PRICE_PACK_ESSENTIEL`, `STRIPE_PRICE_PACK_PRO` (sinon l'achat de pack renvoie 500).
- [ ] **Backfill packs existants** (si des packs ont été vendus avant ce déploiement) : poser `metadata.type=pack` sur ces souscriptions Stripe, sinon les routes cancel/update/resume pourraient ne pas les exclure. En staging c'est probablement inutile ; à vérifier en prod.
- [ ] Outil recommandé : **Stripe CLI** (`stripe listen`, `stripe trigger`, `stripe events resend`) pour rejouer les webhooks.

---

## B. Sécurité — IDOR & auth

> Pour tous ces tests il faut **2 praticiens** (A et B) avec chacun ≥1 patient, et récupérer les UUID via les DevTools/réseau. Le principe : A tente d'agir sur le patient de B.

### B1 · IDOR famille « action praticien » (C1 + H1)
- [ ] **Bloqué** : authentifié en A, appeler chacune de ces routes avec `patientId` = un patient de **B** et `practitionerId` = A → attendu **403** :
  `save-murmure`, `save-private-notes`, `send-bravo`, `send-soutien`, `send-victory`.
- [ ] **Happy path** : les mêmes actions sur **un patient de A** fonctionnent (200) et l'effet est visible (murmure injecté, note enregistrée, bandeau bravo/soutien côté patient, message victoire dans le chat).
- [ ] **Régression murmure** : le murmure enregistré par A sur son patient apparaît bien dans le prompt du Jumeau (envoyer un message patient, vérifier le comportement attendu).

### B2 · Chat — `practitionerId` server-side (H2)
- [ ] **Bloqué** : en tant que patient de A, envoyer un message chat en forçant `practitionerId` = B dans le body (via DevTools) → aucune donnée de B ne doit fuiter dans la réponse, et **aucune alerte email ne part vers B**.
- [ ] **Happy path** : chat patient normal → réponse cohérente, RAG documents de A remontent, historique correct.
- [ ] **Mode test praticien** : A ouvre le chat en mode test de son patient test → fonctionne (la relation `patient_practitioner` du patient test existe).
- [ ] **Patient multi-praticien** (si applicable) : un patient lié à 2 praticiens → le chat reste fonctionnel (résolution = hint validé, ou repli).

### B3 · Mode test — contrôle `is_test` (H3)
- [ ] **Bloqué** : forcer `PATCH /api/test-mode/active` avec `testPatientUserId` = un **vrai** patient de A → attendu **403** (« pas un compte test »).
- [ ] **Critique / non-régression** : vérifier qu'un **vrai patient ne subit jamais de reset de mot de passe**. Après la tentative ci-dessus, le vrai patient doit toujours pouvoir se connecter avec son mot de passe d'origine.
- [ ] **Happy path** : créer un patient test (`test-mode/setup`) → `test-mode/session` renvoie bien une session, le chat en mode test fonctionne.

### B4 · invalidate-cache (L2)
- [ ] **Bloqué** : authentifié en A, `POST /api/invalidate-cache` avec `patientId` d'un patient de **B** → **403**.
- [ ] **Happy path** : A invalide le cache d'un de **ses** patients → 200. Un patient invalide son propre cache → 200.

### B5 · generate-bravo / generate-soutien (L3)
- [ ] **Bloqué** : A appelle `generate-bravo` / `generate-soutien` avec un patient de B → **403** (plus de fuite du prénom).
- [ ] **Happy path** : sur un patient de A → message généré correctement.

---

## C. Billing (le plus structurel — tester en priorité)

> Toutes ces manips en **Stripe test mode**. Cartes de test : `4242 4242 4242 4242` (succès), `4000 0000 0000 0341` (échec de prélèvement récurrent).

### C1 · Abonnement principal — happy path
- [ ] Souscrire (SetupIntent → subscription avec trial) → practitioner `subscription_status=trialing`, `plan` correct.
- [ ] Changement de plan (`update-subscription`) → nouveau plan appliqué, prorata Stripe visible.
- [ ] Résiliation (`cancel-subscription`) → `cancel_at_period_end=true`, email « Résiliation confirmée ».
- [ ] Annulation de résiliation (`resume-subscription`) → `cancel_at_period_end=false`, email « Résiliation annulée ».

### C2 · Packs — le cœur du groupe 4 (H4, M2, M3)
- [ ] **Achat pack** (`confirm-pack` ou checkout `purchase-pack`) → `extra_patients` crédité **une seule fois**, `pack_subscription_id` renseigné.
- [ ] **M2 — pas de contamination** : après l'achat du pack, le `plan` du praticien est **inchangé** (pas de bascule vers « pro ») et `subscription_status` reste `active`/`trialing` (pas `past_due`).
- [ ] **L5 — pas d'email parasite** : l'achat du pack ne déclenche **pas** l'email « Votre abonnement NutriTwin est activé ».
- [ ] **H4 — cancel vise le principal** : avec un pack actif, `cancel-subscription` programme l'annulation de **l'abonnement principal**, pas du pack. Vérifier dans Stripe quel `subscription.id` a `cancel_at_period_end`.
- [ ] **H4 — update vise le principal** : avec un pack actif, changer de plan modifie le **principal** ; le prix du pack reste intact dans Stripe.
- [ ] **M3 — pas de pack orphelin** : provoquer la suppression effective de l'abonnement principal (dans Stripe : cancel immédiat) → le webhook `customer.subscription.deleted` doit **aussi résilier la/les souscription(s) pack**. Vérifier qu'aucune souscription pack ne reste `active`.

### C3 · Idempotence webhook (M1)
- [ ] Avec Stripe CLI, **rejouer** un `checkout.session.completed` de pack déjà traité (`stripe events resend <id>`) → `extra_patients` **ne double pas** ; une ligne dans `processed_stripe_events` ; réponse 200 « déjà traité ».
- [ ] **Rollback** : simuler une erreur de traitement (ex. couper Redis/DB un instant) → vérifier que le marqueur est retiré et que le retry Stripe re-traite l'event.

### C4 · États edge (past_due / échec paiement)
- [ ] Échec de prélèvement sur le **principal** → `subscription_status=past_due`, email « Problème de paiement ».
- [ ] **M2 — échec sur le pack** : provoquer un échec de paiement du **pack** → le compte **ne doit pas** basculer en `past_due` (seul le principal compte).
- [ ] Fin de trial imminente (`trial_will_end`) → email envoyé une fois.

---

## D. Cycle de vie

### D1 · invite-patient — statut abonnement (M5)
- [ ] **Bloqué** : praticien avec `subscription_status` = `cancelled`/`unpaid` tente d'inviter un patient → **403**.
- [ ] **Happy path** : praticien `active`/`trialing`/`past_due` invite un patient → OK (email d'invitation envoyé, relation créée).
- [ ] **Limite de slots** : atteindre la limite du plan → message d'erreur clair ; achat d'un pack → limite augmentée.

### D2 · Routes pré-session (L1)
- [ ] **create-practitioner** : ré-appeler la route sur un praticien déjà onboardé (`onboarding_done=true`) → renvoie `alreadyOnboarded`, **n'écrase pas** ses champs d'identité.
- [ ] **Régression signup** : un tout nouveau signup praticien passe toujours (création de la ligne + `pending_plan`).
- [ ] **confirm-patient-rgpd** : ré-appeler sur un patient déjà `onboarding_completed` → renvoie `alreadyCompleted`, ne rétrograde pas l'état.
- [ ] **Régression activation** : un nouveau patient qui active son compte enregistre bien son RGPD.

### D3 · delete-account (L4)
- [ ] **Patient** : suppression de compte → toutes les données parties (conversations, sos, documents…), compte Auth clôturé, `success`.
- [ ] **Bloqué praticien** : un praticien qui appelle `delete-account` → **403** (son compte Auth n'est pas supprimé, abonnement Stripe préservé).
- [ ] **Échec partiel** (optionnel/avancé) : simuler une erreur sur une suppression enfant → le compte Auth **n'est pas** supprimé, réponse 500, l'utilisateur peut réessayer.

---

## E. Non-régression générale (smoke tests)

- [ ] Parcours complet **praticien** : signup → choix plan → onboarding → dashboard s'affiche.
- [ ] Parcours complet **patient** : invitation → set-password → onboarding → chat opérationnel.
- [ ] **Détection de crise** : envoyer un message à mot-clé critique → statut `red_critical`, alerte email reçue par le **bon** praticien (celui réellement lié), alerte visible sur le dashboard, message sauvegardé dans l'historique.
- [ ] **Alerte comportementale** : déclencher un `red_behavioral`, vérifier le passage au vert quand le patient exprime un apaisement.
- [ ] **Exercice SOS (Gemini Live)** : lancer « Mon Soutien » → le WebSocket se connecte (valide que `gemini-token` fonctionne **avec l'IAM restreint** — test important après le durcissement M4).
- [ ] **TTS / voix** : vérifier que la synthèse vocale répond (même compte de service).
- [ ] **Rapport IA & bilan** : générer un rapport et un bilan de séance sur un patient de A → contenu cohérent, aucune erreur 500.

---

## F. À valider hors périmètre code (revues séparées)

- [ ] **RAG H2 — résiduel** : récupérer la définition SQL de `match_documents` (absente du repo) et confirmer qu'elle filtre bien par `practitioner_id`. Tant que non confirmé, considérer que le volet exfiltration RAG de H2 n'est que partiellement mitigé (le blocage server-side du `practitionerId` couvre déjà l'essentiel).
- [ ] **RLS Supabase** : auditer si des policies RLS existent en défense-en-profondeur. Rappel : toutes les routes critiques utilisent la `service_role` (bypass RLS) → le check applicatif est l'unique garde. Des policies RLS restrictives seraient un filet de sécurité utile.
- [ ] **Fiabilité clinique de la détection de crise** : revue dédiée (faux négatifs sur signal suicidaire = enjeu vital). Hors périmètre d'un audit de code.
- [ ] **Conformité RGPD** : parcours droit à l'oubli complet, DPA, rétention — à valider avec le volet juridique.
- [ ] **Secrets & rotation** : vérifier qu'aucun secret n'est exposé côté client (hors le token Vertex volontaire), rotation `CRISIS_SECRET_TOKEN`, `STRIPE_WEBHOOK_SECRET`.

---

### Récapitulatif des correctifs couverts par cette checklist

| Finding | Section |
|---|---|
| C1, H1 (IDOR action praticien) | B1 |
| H2 (chat practitionerId) | B2, F |
| H3 (mode test is_test) | B3 |
| H4, M2, M3 (billing pack) | C2 |
| M1 (idempotence webhook) | C3 |
| L5 (email pack) | C2 |
| M5 (invite statut abonnement) | D1 |
| L1 (routes pré-session) | D2 |
| L2 (invalidate-cache) | B4 |
| L3 (generate-bravo/soutien) | B5 |
| L4 (delete-account) | D3 |
| M4 (IAM gemini-token) | A, E (SOS) |
