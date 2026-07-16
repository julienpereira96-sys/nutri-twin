# Audit NutriTwin — 2026-07-16

## Résumé exécutif

L'application présente une architecture cohérente et une maturité réelle sur les flux patients (auth, IDOR, webhook Stripe, mode test). La base de sécurité est solide : `lib/api-auth.ts`, guards IDOR systématiques sur les routes praticien/patient, webhook Stripe vérifié par signature. Cependant, **trois routes critiques sont totalement ouvertes sans authentification** : `gemini-token`, `gemini-live-relay` et `gemini-live/context`. Ces routes exposent des tokens Google Cloud et des données médicales patients à n'importe quel visiteur anonyme — c'est le seul blocant réel avant mise en production. Hors sécurité, un bug d'IDOR sur les routes de rapport IA et une omission RGPD sur la suppression de données sont à corriger rapidement. Le reste est robuste.

---

## Critique (à corriger avant mise en production)

### C1 — `/api/gemini-token/route.ts` : token Google Cloud exposé anonymement
**Fichier :** `app/api/gemini-token/route.ts` — route entière  
**Description :** Aucun appel à `getSessionUser()`, aucun header d'auth. N'importe quel visiteur anonyme peut appeler `GET /api/gemini-token` et obtenir un OAuth2 Bearer token Google Cloud avec le scope `cloud-platform`. Ce token donne accès à l'ensemble des API Vertex AI du compte de service NutriTwin pendant ~50 minutes.  
**Impact :** Utilisation abusive illimitée du quota Vertex AI (inference, embeddings, Gemini Live) aux frais de NutriTwin. Facturation pouvant atteindre plusieurs milliers d'euros en quelques heures.  
**Correction :** Ajouter `const user = await getSessionUser(); if (!user) return unauthorized();` en tête du handler.

---

### C2 — `/api/gemini-live-relay/route.ts` : proxy WebSocket Vertex AI anonyme
**Fichier :** `app/api/gemini-live-relay/route.ts` — route entière  
**Description :** Aucune authentification. Ce proxy bidirectionnel relaie n'importe quel flux NDJSON vers Vertex AI Gemini Live (WebSocket) en injectant le token du compte de service NutriTwin. `maxDuration = 300` (5 minutes par requête). Toute personne connaissant l'URL peut ouvrir autant de sessions Gemini Live qu'elle veut.  
**Impact :** Idem C1, avec un coût potentiellement supérieur (Gemini Live facture à la minute).  
**Correction :** Même pattern que C1. La vérification d'auth doit précéder l'ouverture du WebSocket Vertex.

---

### C3 — `/api/gemini-live/context/route.ts` : profil clinique patient accessible sans auth
**Fichier :** `app/api/gemini-live/context/route.ts` — route entière  
**Description :** Aucune authentification. La route accepte `POST { patientId, practitionerId }` sans vérifier l'identité du demandeur. Elle retourne le profil clinique complet du patient (pathologies, défi déclaré, motivation, instruction praticien, statut émotionnel courant) ainsi que les 10 derniers messages de conversation des 5 derniers jours.  
**Impact :** Fuite de données médicales sensibles sur simple connaissance d'un UUID patient (disponible dans les cookies ou dans une réponse API interceptée).  
**Correction :** Ajouter auth + vérification que `user.id === patientId` ou `user.id === practitionerId` avec contrôle de la relation `patient_practitioner`.

---

### C4 — `/api/chat/route.ts` ligne 922 : auth conditionnelle — proxy LLM ouvert sans `patientId`
**Fichier :** `app/api/chat/route.ts`, lignes 922–925  
**Description :** La vérification d'authentification n'est déclenchée que si `patientId` est présent dans le body : `if (patientId) { const user = await getSessionUser(); ... }`. Un appel avec uniquement `message` (et optionnellement `systemPrompt`) sans `patientId` traverse tout le flux principal (profil praticien omis, history vide) sans aucune auth. Vertex AI est appelé, la réponse streamée est retournée.  
**Impact :** Proxy LLM gemini-3.5-flash gratuit avec system prompt arbitraire. Sans rate-limit (le compteur Redis est lié au `patientId`).  
**Correction :** Déplacer la vérification d'auth hors du bloc conditionnel : un appel au chat route sans session valide doit toujours retourner 401.

---

## Important (à corriger rapidement)

### I1 — `/api/generate-bilan/route.ts` et `/api/generate-report/route.ts` : IDOR sur patientId
**Fichiers :** `app/api/generate-bilan/route.ts` ligne 61 ; `app/api/generate-report/route.ts` ligne 59  
**Description :** Les deux routes vérifient `user.id !== practitionerId` (guard correct) mais n'effectuent aucune vérification que `patientId` appartient à ce praticien. Elles utilisent ensuite un client `service_role` qui bypasse les RLS. Un praticien authentifié peut fournir n'importe quel `patientId` dans le body et obtenir le bilan ou rapport complet de ce patient (conversations, SOS events, alertes archivées).  
**Impact :** IDOR inter-praticiens : accès au dossier clinique complet de n'importe quel patient de la base.  
**Correction :** Ajouter avant les queries : `const { data: rel } = await supabase.from("patient_practitioner").select("patient_id").eq("patient_id", patientId).eq("practitioner_id", practitionerId).single(); if (!rel) return forbidden();`

---

### I2 — `/api/tts/route.ts` : proxy TTS Google Cloud sans authentification
**Fichier :** `app/api/tts/route.ts` — route entière  
**Description :** Aucune authentification. Tout visiteur anonyme peut envoyer du texte arbitraire et obtenir une synthèse audio MP3 via le compte Google Cloud TTS de NutriTwin.  
**Impact :** Coût financier non contrôlé ; abus possible de quota.  
**Correction :** Ajouter auth (getSessionUser) en tête du handler.

---

### I3 — `/api/send-behavioral-alert/route.ts` : IDOR sur patientId/practitionerId
**Fichier :** `app/api/send-behavioral-alert/route.ts`, lignes 18–23  
**Description :** La route authentifie l'appelant via Bearer JWT (ligne 15, `auth.getUser(token)`) mais ne vérifie jamais que `practitionerId` correspond à `user.id`, ni que `patientId` appartient à ce praticien. Un praticien A authentifié peut déclencher l'envoi d'un email d'alerte comportementale à n'importe quel praticien B pour n'importe quel patient.  
**Impact :** Envoi d'emails non autorisés, pollution des alertes d'autres praticiens.  
**Correction :** Ajouter `if (user.id !== practitionerId) return Response.json({ error: "Accès refusé" }, { status: 403 });` après la vérification auth, et vérifier la relation `patient_practitioner`.

---

### I4 — Race condition sur `admin_alerts` (pattern read-then-write non atomique)
**Fichier :** `app/api/chat/route.ts`, au moins 6 endroits (lignes ~942–948, ~1063, ~1075–1082, ~1160–1164, ~1185–1190, ~1501–1505) ; également dans `app/api/sos/log/route.ts` et `app/api/exercise/log/route.ts`  
**Description :** Partout, le pattern est identique : `select admin_alerts → push → update`. Si deux requêtes arrivent simultanément pour le même patient (ex : deux messages envoyés rapidement, ou un isPostExercise concurrent à un message), la transaction `select → push → update` de l'une écrase celle de l'autre. Une alerte peut être perdue.  
**Impact :** Alertes critiques (red_critical, red_behavioral) perdues silencieusement — non visible par le praticien.  
**Correction :** Remplacer le pattern par une opération atomique Supabase : `update({ admin_alerts: supabase.raw('admin_alerts || ?::jsonb', [[newAlert]]) })` ou utiliser une fonction SQL dédiée avec `FOR UPDATE`.

---

### I5 — `/api/delete-account/route/route.ts` : table fantôme `sos_closures`
**Fichier :** `app/api/delete-account/route/route.ts`, ligne 22  
**Description :** Le script RGPD supprime les données du patient dans un `Promise.all` incluant `supabaseAdmin.from("sos_closures").delete()`. Cette table n'existe pas dans le schéma actuel (les clôtures SOS sont dans `sos_events`, et le concept "sos_closures" est un artefact d'une migration antérieure). Supabase retourne une erreur silencieuse dans le `Promise.all`, sans bloquer les autres suppressions.  
**Impact :** Si `sos_closures` est une vraie table ancienne avec des données non migrées, ces données survivent à la suppression de compte (violation RGPD Art. 17). À vérifier en base.  
**Correction :** Vérifier si la table `sos_closures` existe encore en production. Si non, supprimer cette ligne. Si oui, s'assurer que les données ont été migrées vers `sos_events` et supprimer l'ancienne table.

---

### I6 — `/api/test-mode/delete/route.ts` : données enfant non supprimées avant le profil patient
**Fichier :** `app/api/test-mode/delete/route.ts`, ligne 69  
**Description :** La route supprime `patient_practitioner` puis `patients` directement, sans supprimer au préalable `conversations`, `sos_events`, `crisis_events` et `exercise_logs` liés à ce patient test. Si ces tables ont des contraintes FK référençant `patients.user_id` sans ON DELETE CASCADE, la suppression de `patients` échouera silencieusement (erreur non vérifiée). Le compte Auth est ensuite supprimé à l'étape 5, laissant potentiellement un patient orphelin en base.  
**Impact :** Données test non supprimées, possible accumulation silencieuse de données orphelines.  
**Correction :** Supprimer explicitement les tables enfant dans l'ordre avant `patients`, comme le fait `/api/delete-account/route/route.ts`.

---

### I7 — `subscription_status: "past_due"` ne bloque pas les actions métier
**Fichiers :** `app/api/invite-patient/route.ts` ligne 53 ; `middleware.ts` lignes 169  
**Description :** Quand un paiement échoue, le webhook Stripe positionne `subscription_status = "past_due"` mais ne met pas `plan = null`. Le middleware ne vérifie que `practitioner.plan` (non null), ce qui permet à un praticien en impayé de continuer à accéder au dashboard, inviter des patients, et générer des bilans.  
**Impact :** Accès au service non payé non bloqué.  
**Correction :** Décision produit à prendre. Si le blocage est voulu : ajouter une vérification `subscription_status !== "past_due"` dans le middleware pour `/dashboard` et dans `invite-patient`.

---

## Mineur (améliorations souhaitables)

### M1 — Code Vertex AI dupliqué dans 4 routes malgré `lib/vertexai.ts`
**Fichiers :** `app/api/sos/log/route.ts`, `app/api/exercise/log/route.ts`, `app/api/sos/word/route.ts`, `app/api/chat/route.ts`  
**Description :** `lib/vertexai.ts` existe et est correctement importé par `generate-bilan` et `generate-report`, mais les 4 routes citées ont chacune leur propre copie locale de `getVertexToken()`, `_cachedToken`, et `vertexGenerate()`. Sur Vercel serverless, chaque bundle de route dispose de son propre cache mémoire (pas partagé), donc le cache token est réinitialisé à chaque cold start de chaque route indépendamment.  
**Impact :** Maintenabilité dégradée ; si le format du token ou les scopes changent, 4 endroits à mettre à jour.  
**Correction :** Importer depuis `lib/vertexai.ts` dans ces 4 routes.

---

### M2 — Pas de timeout sur les appels `fetch()` vers Vertex AI
**Fichiers :** `app/api/chat/route.ts` lignes 44–51 et 67–72 ; toutes les routes avec `vertexGenerate`  
**Description :** Les appels `fetch()` vers Vertex AI n'utilisent pas `AbortController` avec un timeout. En cas de latence élevée ou de panne partielle de l'API Google, la fonction serverless peut bloquer jusqu'à l'expiration du timeout Vercel (300 secondes pour le relay, variable pour les autres).  
**Impact :** Dégradation silencieuse de l'expérience patient ; facturation Vercel inutile sur des timeouts longs.  
**Correction :** Ajouter un `AbortController` avec timeout de 25–30 secondes sur les appels non-streaming, 120 secondes sur le streaming.

---

### M3 — `/api/check-patient-email/route.ts` : énumération d'emails sans auth
**Fichier :** `app/api/check-patient-email/route.ts` — route entière  
**Description :** Aucune authentification. Accepte `{ email, practitionerId }` du body et répond `{ exists: true/false }`. Permet d'énumérer si un email est enregistré comme patient dans NutriTwin.  
**Impact :** Faible (pas de données cliniques exposées), mais constitue une surface d'énumération exploitable.  
**Correction :** Ajouter auth (praticien authentifié uniquement) et vérifier que `practitionerId` correspond à `user.id`.

---

### M4 — `TRAILING_BUFFER_MS = 48h` dans `lib/sosClosures.ts` peut positionner des SOS hors contexte
**Fichier :** `lib/sosClosures.ts`, ligne 61  
**Description :** La marge de 48 heures après le dernier message chargé pour rattacher les événements SOS au fil de discussion est très large. Si un patient n'a pas écrit pendant 48h entre deux conversations distinctes, des événements SOS de la première période pourraient apparaître dans la seconde conversation affichée.  
**Impact :** Affichage potentiellement incohérent des cartes "Exercice SOS terminé" dans le fil patient/dashboard.  
**Correction :** Vérification acceptable en l'état (logique documentée et intentionnelle). À surveiller si des rapports d'affichage incorrect remontent en production.

---

### M5 — `billing/update-subscription/route.ts` : mix de clients Supabase (ssr vs service)
**Fichier :** `app/api/billing/update-subscription/route.ts`, lignes 36–47  
**Description :** Cette route utilise `createServerClient` (avec cookies, `@supabase/ssr`) pour lire le praticien, mais toutes les autres routes billing utilisent `createClient` (service role). La mise à jour optimiste ligne 107 utilise ensuite ce client SSR (avec clé anon), ce qui pourrait échouer si les RLS Supabase bloquent l'écriture sur la table `practitioners` via la clé anon.  
**Impact :** La mise à jour optimiste du plan peut silencieusement échouer (le webhook Stripe corrigera, mais avec un délai).  
**Correction :** Harmoniser avec un client service role pour les écritures, comme le font les autres routes billing.

---

### M6 — `create-subscription/route.ts` n'utilise pas `getSessionUser()`
**Fichier :** `app/api/create-subscription/route.ts`, ligne 25  
**Description :** Cette route utilise directement `supabase.auth.getUser()` via cookies (pattern pré-`lib/api-auth.ts`), alors que toutes les autres routes récentes utilisent `getSessionUser()` qui supporte à la fois cookies et Bearer token.  
**Impact :** Ne supporte pas le mode test (Bearer token). Incohérence de style.  
**Correction :** Remplacer par `getSessionUser()` de `lib/api-auth.ts`.

---

### M7 — `webhook/route.ts` : décrémentation des packs potentiellement incorrecte
**Fichier :** `app/api/webhook/route.ts`, lignes 133–137  
**Description :** Sur `customer.subscription.deleted`, la taille du pack à décrémenter est calculée depuis un dictionnaire local `packSizes = { essentiel: 5, pro: 10 }`. Si le praticien a changé de plan entre l'achat du pack et son annulation (ex : upgradé de essentiel à pro), la décrémentation se base sur le plan actuel, pas sur le plan au moment de l'achat.  
**Impact :** `extra_patients` potentiellement décrémenté du mauvais montant.  
**Correction :** Stocker la taille du pack dans les metadata de l'abonnement Stripe à la création (déjà fait dans `confirm-pack` : `metadata.packSize`), et utiliser `subscription.metadata.packSize` plutôt que le dictionnaire local.

---

### M8 — Logs `console.error` en production sur des chemins Vertex AI
**Fichiers :** `app/api/gemini-live-relay/route.ts` lignes 109, 114 ; `app/api/tts/route.ts` ligne 106  
**Description :** Des `console.error` loguent les messages d'erreur Vertex AI en production. Acceptable pour la debugabilité, mais si le message d'erreur inclut un fragment du body de la requête (possible selon les versions d'API), des données patient pourraient apparaître dans les logs Vercel.  
**Impact :** Faible. À surveiller si les logs sont accessibles à des tiers.  
**Correction :** S'assurer que les messages loggés ne contiennent pas de contenu patient. Envisager un service de logs avec masquage de PII (Datadog, etc.) si les logs Vercel sont partagés.

---

## Points solides

**Authentification et IDOR :**
- `lib/api-auth.ts` est propre, centralisé, et supporte correctement les deux modes (Bearer token pour mode test, cookie SSR pour le flux normal). `getUser(token)` validé côté Supabase (pas une simple vérification JWT locale).
- Guards IDOR bien appliqués sur toutes les routes sensibles : `remove-patient`, `invite-patient`, `sos/log`, `sos/closures`, `sos/word`, `exercise/log`, `save-patient-profile`, `test-mode/active`, `test-mode/delete`, `generate-bilan` (guard practitioner correct), `generate-report` (idem).
- `/api/create-practitioner` : pas de session dispo juste après signUp, mais la route vérifie `admin.getUserById(userId)` et contrôle que l'email correspond — pattern correct et documenté.

**Sécurité Stripe :**
- Webhook Stripe correctement sécurisé par `stripe.webhooks.constructEvent()` avec signature. Retourne 400 si invalide, 200 systématiquement pour les événements traités (bon comportement pour éviter les retry Stripe intempestifs).
- `send-crisis-alert` protégé par header `x-crisis-token` (shared secret serveur-à-serveur) — seules les routes internes peuvent déclencher des alertes email critiques.

**Mode test :**
- Isolation correcte des comptes test via domaine `@nutri-twin.internal` et colonne `is_test = true`.
- Double vérification dans `test-mode/delete` : relation `patient_practitioner` + flag `is_test` avant toute suppression.
- Reset de mot de passe à la volée dans `session/route.ts` : aucun credential stocké en clair.

**Flux billing :**
- Mise à jour optimiste du plan côté Supabase + confirmation via webhook Stripe = cohérence garantie même en cas de délai réseau.
- Vérification du plafond de packs (`maxPacks`) côté serveur dans `confirm-pack` et `purchase-pack`.

**Limites de patients par plan :**
- Vérifiées côté serveur dans `invite-patient/route.ts` (count sur `patient_practitioner`, plan + extra_patients). Pas de confiance au client.

**Sécurité RGPD (suppression patient) :**
- `remove-patient` ban le compte Auth (876 000h) sans supprimer les données — conforme aux obligations légales de conservation des données médicales.
- `delete-account` supprime les données dans le bon ordre (enfants avant parent, compte Auth en dernier).

**Flux SOS :**
- Cohérence des champs `patient_id`, `practitioner_id`, `origin`, `status` entre `/api/chat` (branche isSOS), `/api/sos/log`, `/api/sos/closures`, et `lib/sosClosures.ts`.
- Double garde-fou (mots-clés bruts + LLM) correctement architecturé. Le bypass mots-clés est vérifié par un second appel LLM avant de déclencher l'alerte.

---

## Zones non auditées / incertitudes

- **Schéma SQL Supabase** : L'audit est basé uniquement sur le code applicatif. Il est impossible de confirmer si des colonnes comme `last_patient_message_at`, `summary_text`, `intake_message`, `crisis_level_detected` sont bien présentes dans toutes les tables sans voir les migrations SQL. Les commentaires dans le code suggèrent que des migrations ont bien été appliquées, mais non vérifié.
- **Politiques RLS Supabase** : Aucun accès aux politiques Row Level Security configurées dans Supabase. Certaines routes utilisent le client anon (ex : `update-subscription`), ce qui implique que les RLS doivent permettre à un utilisateur authentifié de lire/écrire sa propre ligne dans `practitioners`. Non vérifié.
- **Pages frontend** (login, onboarding, chat, dashboard) : Non lues dans cet audit (trop longues). Les guard côté client (redirection, état loading) sont supposés cohérents avec le middleware, mais non vérifiés point par point.
- **Variables d'environnement manquantes** : Plusieurs routes utilisent `process.env.STRIPE_PRICE_ESSENTIEL!`, `process.env.STRIPE_PRICE_PRO!` etc. avec le non-null assertion operator. Si une variable est absente, une exception non catchée retournera une 500 silencieuse (TypeScript ne le détecte pas à la compilation). Non testé.
- **Table `exercise_logs`** : Référencée dans le code (`/api/exercise/log` insère dans `sos_events`, pas dans `exercise_logs` directement — la route commentée dit "Remplace /api/breathing/log"). La cohérence entre la logique applicative et le schéma SQL réel de cette table n'a pas pu être vérifiée sans accès aux migrations.
- **Performances Redis** : Le cache Redis est utilisé de façon extensive (profils praticien, profils patient, compteurs messages, résumés). Les TTL semblent raisonnables (1h à 2h). Non testé sous charge.
- **Limites cabinet (80 patients)** : La limite est définie dans `invite-patient/route.ts`. Non vérifié si d'autres flux (cabinet/share-patient, cabinet/transfer-patient) vérifient aussi cette limite.
