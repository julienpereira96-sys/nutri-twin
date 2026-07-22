# Brief NutriTwin — Handoff pour audit Fable 5

> Ce document te donne tout le contexte nécessaire pour auditer NutriTwin de façon pertinente.
> Le projet est quasi-finalisé. On cherche un œil frais sur la sécurité, la cohérence et les angles morts éventuels.

---

## 1. C'est quoi NutriTwin

SaaS B2B à destination des **diététiciens / nutritionnistes** (praticiens).  
Chaque praticien invite ses patients sur l'app. Les patients ont accès à un **jumeau numérique IA** (chat Gemini) qui les accompagne entre les séances.

Le praticien a un **dashboard** pour suivre l'état émotionnel de ses patients, recevoir des alertes en cas de détresse, et préparer ses séances avec un bilan IA.

---

## 2. Stack technique

| Couche | Techno |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Auth | Supabase Auth (cookies SSR via `@supabase/ssr`) |
| Base de données | Supabase (PostgreSQL) + pgvector pour RAG |
| IA principale | Google Gemini (`gemini-2.5-flash`, `gemini-3.1-flash-lite`) |
| IA temps réel | Gemini Live (WebSocket via proxy `/api/gemini-live/`) |
| TTS | Google Cloud TTS Neural2 |
| Billing | Stripe (subscriptions + webhooks) |
| Emails | Resend (`contact@nutritwin.fr`) |
| Cache | Upstash Redis (rate limiting + context caching) |
| Embeddings RAG | `gemini-embedding-2` (768D), seuil > 0.5 |
| PWA | `@ducanh2912/next-pwa` |

---

## 3. Architecture des pages

```
/                        → Landing page (marketing)
/signup                  → Inscription praticien
/onboarding              → Onboarding praticien (vision, spécialité, upload)
/dashboard               → Dashboard praticien (liste patients, KPIs, alertes)
/chat                    → Chat patient avec jumeau IA
/patient-login           → Login patient
/set-password            → Activation compte patient
/checkout-pack           → Achat de slots patients supplémentaires
/pack-success            → Confirmation achat pack
/cgu                     → CGU
```

---

## 4. Fichiers critiques à connaître

### Routes API importantes
- `app/api/chat/route.ts` — Cœur du système. Chat Gemini + détection de crise + statuts émotionnels + RAG + rate limiting + context caching Vertex
- `app/api/webhook/route.ts` — Webhooks Stripe (subscription lifecycle + emails transactionnels)
- `app/api/sos/log/route.ts` — Log des exercices SOS + génération de résumé clinique IA
- `app/api/send-crisis-alert/route.ts` — Alerte praticien (red_critical)
- `app/api/send-behavioral-alert/route.ts` — Alerte praticien (red_behavioral)
- `app/api/gemini-live/context/route.ts` — System prompt Gemini Live pour les exercices SOS
- `app/api/billing/*.ts` — Billing complet (cancel, resume, pack, invoices, update-payment)

### Lib partagée
- `lib/api-auth.ts` — Helper auth SSR partagé (`getSessionUser`, `unauthorized`, `forbidden`)
- `lib/email.ts` — Templates email (`buildEmailHtml`, `buildAdminAlertHtml`, `sendEmail`)
- `lib/therapeuticVoice.ts` — Voix TTS (liste Neural2, préparation texte)
- `lib/sosClosures.ts` — Fusion SOS closures par horodatage
- `lib/murmure.ts` — Expiry des instructions praticien

### Pages frontend
- `app/dashboard/page.tsx` — Dashboard praticien complet (~3000 lignes)
- `app/chat/page.tsx` — Chat patient complet (~2500 lignes)
- `app/chat/SOSExercise.tsx` — Exercice SOS immersif Gemini Live

### Cartographie système
- `CARTOGRAPHIE.md` — Document de référence pour le système SOS / statuts émotionnels / dashboard

---

## 5. Décisions d'architecture clés (à ne pas remettre en cause sans bonne raison)

### Auth
- Praticiens : Supabase Auth via cookies SSR (`@supabase/ssr`)
- Patients : même système, mais login séparé (`/patient-login`)
- Mode test : Bearer token en plus des cookies (pour l'iframe split-screen dans le dashboard)
- Toutes les routes API critiques passent par `getSessionUser()` de `lib/api-auth.ts`

### Sécurité IDOR
- Chaque route API vérifie que le `user.id` correspond bien à la ressource accédée
- Le `practitioner_id` est toujours résolu server-side, jamais pris du body client
- Les patients ne peuvent accéder qu'à leurs propres données (scoping `patient_id`)

### Billing Stripe
- Flow : SetupIntent → Subscription (pas de Checkout Session pour l'abonnement principal)
- Webhooks écoutés : `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`, `customer.subscription.trial_will_end`
- Chaque événement envoie un email custom via `buildEmailHtml()` (template dark theme NutriTwin)
- `billing_reason === "subscription_cycle"` → pas d'email (renouvellement mensuel silencieux)

### IA & détection de crise
- Pre-filtre regex `hasBehavioralSignal` avant d'appeler le LLM de détection
- `analyzeCrisisWithLLM` tourne en parallèle du chat (non-bloquant)
- JSON technique `|||{...}|||` dans la réponse du chat principal → filet de sécurité universel
- Statuts : `green`, `red_behavioral`, `red_critical` (orange supprimé)
- `red_critical` : verrou absolu, levée uniquement manuelle par le praticien

### Exercices SOS (Gemini Live)
- SOSExercise : expérience immersive unifiée (écoute → tracé respiratoire → mot → clôture)
- 5 exercices individuels : breathing, ancrage, manger, ecriture, defusion
- Chaque exercice appelle `/api/exercise/log` ou `/api/sos/log` à la clôture
- `origin: "crise"` vs `"pratique"` selon le déclencheur et l'état émotionnel au moment du clic

### Rate limiting
- Upstash Redis, par `user.id`
- Quota par plan (essentiel / pro), fenêtre glissante
- À 95% du quota : `showWarning` injecté dans le system prompt
- À 100% : réponse Jumeau affichée + input verrouillé (pas de 429 sec)

### Context caching Vertex AI
- `buildSystemPrompt` splitté en partie cacheable (profil praticien + docs) et partie dynamique (profil patient + murmures)
- Cache Redis sur la partie cacheable, invalidé sur mise à jour profil

---

## 6. Emails transactionnels — inventaire complet

### Emails praticien (via `buildEmailHtml` + `sendEmail`)

| Déclencheur | Sujet | Fichier |
|---|---|---|
| Trial se termine dans 3j | "Votre période d'essai NutriTwin se termine bientôt" | `webhook/route.ts` |
| Premier vrai paiement | "Votre abonnement NutriTwin est activé" | `webhook/route.ts` |
| Échec de paiement | "Problème de paiement sur votre abonnement NutriTwin" | `webhook/route.ts` |
| Abonnement résilié (effectif) | "Votre abonnement NutriTwin a été résilié" | `webhook/route.ts` |
| Demande de résiliation | "Résiliation confirmée · accès actif jusqu'au [date]" | `billing/cancel-subscription` |
| Annulation de résiliation | "Résiliation annulée · votre abonnement [plan] continue" | `billing/resume-subscription` |
| Demande suppression compte | "Votre demande de suppression de compte a été reçue" | `billing/delete-account-request` |

### Email admin interne
| Déclencheur | Sujet | Fichier |
|---|---|---|
| Demande suppression compte | "🗑️ Suppression compte — [nom] ([email])" | `billing/delete-account-request` |

### Email patient
| Déclencheur | Sujet | Fichier |
|---|---|---|
| Ré-invitation patient (compte existant non activé) | "Votre invitation NutriTwin" | `invite-patient/route.ts` |

> Note : les nouveaux patients reçoivent l'email natif Supabase (`inviteUserByEmail`) — non contrôlé par notre code.

---

## 7. Plans et limites

| Plan | Patients max | Modèle IA | Fenêtre mémoire |
|---|---|---|---|
| Essentiel | 10 | gemini-2.5-flash | 3j / 20 msgs |
| Pro | 25 | gemini-2.5-flash | 7j / 40 msgs |
| ~~Cabinet~~ | ~~80~~ | — | — (masqué UI) |

Packs de slots supplémentaires : +5 (Essentiel) ou +10 (Pro) patients.

---

## 8. Ce que tu peux ignorer

- Les composants `MarcheExercise`, `BodyScanExercise`, `AdaptiveCoachingExercise` — ils existent dans le code mais sont inaccessibles via l'UI (code mort non supprimé).
- Le statut `"red"` legacy — quelques checks défensifs restent dans `dashboard/page.tsx` et `route.ts`, inoffensifs.
- `app/api/delete-account/route/route.ts` — doublon de route à nettoyer mais non critique.

---

## 9. Ce qu'on te demande

Un **audit de sécurité et de cohérence** sur les points suivants, par ordre de priorité :

1. **Sécurité des routes API** — Y a-t-il des routes sans authentification, avec IDOR, ou avec des inputs non validés ?
2. **Webhooks Stripe** — La vérification de signature est-elle correcte ? Y a-t-il des race conditions ou des idempotency issues ?
3. **Billing** — Le flow SetupIntent → Subscription est-il robuste ? Les états edge (trial, past_due, cancelled) sont-ils tous couverts ?
4. **Gestion des erreurs** — Y a-t-il des routes où une exception non catchée pourrait exposer des infos sensibles ou laisser la DB dans un état incohérent ?
5. **Angles morts fonctionnels** — Y a-t-il des cas qu'on n'a pas anticipés dans le cycle de vie d'un praticien ou d'un patient ?

On ne cherche pas de refactoring esthétique ni de commentaires sur le style de code. On cherche des **vrais problèmes** qui pourraient impacter la sécurité ou la fiabilité en production.

---

## 10. Rappel structure dossier

```
app/
  api/                   → Routes API (Next.js App Router)
  chat/                  → Page chat patient + composants exercices SOS
  dashboard/             → Page dashboard praticien
  [autres pages]/
lib/                     → Utilitaires partagés (auth, email, voice, sos...)
hooks/                   → Hooks React (useTherapeuticVoice...)
CARTOGRAPHIE.md          → Référence système SOS / statuts / dashboard
```
