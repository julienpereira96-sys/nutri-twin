# Feuille de route — Tests produit NutriTwin

> Checklist complète pour valider NutriTwin avant un lancement ou une démo.
> À parcourir dans l'ordre — chaque section suppose la précédente validée.

---

## 0. Prérequis

- [ ] Accès à `nutritwin.fr` (production) OU `localhost:3000` (dev)
- [ ] Un compte praticien actif avec abonnement valide
- [ ] Au moins un patient invité (email de test)
- [ ] Accès à la boîte mail du patient de test
- [ ] Clé Stripe en mode test (pour les flux de paiement)

---

## 1. Authentification praticien

### Inscription
- [ ] `/signup` — créer un compte praticien → email de confirmation reçu
- [ ] Cliquer le lien de confirmation → redirige vers `/dashboard`
- [ ] Vérifier que le praticien est bien créé dans Supabase (`practitioners`)

### Connexion
- [ ] `/login` → connexion email/mot de passe → redirige vers `/dashboard`
- [ ] Mauvais mot de passe → message d'erreur clair
- [ ] Session persistante → fermer et rouvrir le navigateur → toujours connecté

### Mot de passe oublié
- [ ] `/login` → "Mot de passe oublié" → saisir email → email reçu
- [ ] Cliquer le lien (via `nutritwin.fr`) → `/reset-password` s'ouvre avec le token
- [ ] Saisir nouveau mot de passe → confirmation → connexion avec nouveau mot de passe OK

---

## 2. Onboarding praticien

- [ ] Premier accès → tour guidé se lance (étapes visibles)
- [ ] Compléter les étapes : identité, spécialité, pratique, vision/signature
- [ ] Photo de profil : upload, recadrage, sauvegarde
- [ ] Accès à `/dashboard` après onboarding

---

## 3. Invitation et onboarding patient

### Invitation
- [ ] Dashboard → "Inviter un patient" → saisir email → invitation envoyée
- [ ] Email d'invitation reçu par le patient (vérifier lien `nutritwin.fr/set-password`)
- [ ] Lien via domaine Vercel (`nutri-twin.vercel.app`) → redirige vers `nutritwin.fr` ✓

### Set-password (côté patient)
- [ ] Cliquer le lien → `/set-password` s'ouvre
- [ ] Créer son mot de passe
- [ ] Cocher CGU et consentement RGPD (obligatoires)
- [ ] "Accéder à mon espace" → redirige vers `/patient-onboarding`

### Onboarding patient
- [ ] Remplir les étapes : identité, objectifs, habitudes alimentaires, contexte de vie
- [ ] Compléter toutes les étapes → redirige vers `/chat`

---

## 4. Interface chat (côté patient)

### Chargement
- [ ] Chat s'ouvre → message de bienvenue affiché (logo + phrase d'accueil)
- [ ] Pas de flash blanc avant le chargement
- [ ] Historique conversations visible dans la sidebar

### Conversation de base
- [ ] Envoyer un message texte → réponse en streaming (typewriter)
- [ ] Réponse cohérente avec le profil patient (onboarding pris en compte)
- [ ] Envoyer une photo/image → analyse visuelle de l'image dans la réponse

### Persistance
- [ ] Rafraîchir la page → historique conservé, conversation courante intacte
- [ ] Se déconnecter / reconnecter → historique toujours présent

### Mobile (iOS/Android)
- [ ] PWA installée → s'ouvre en standalone (pas dans Safari)
- [ ] Swipe droite → sidebar s'ouvre
- [ ] Clavier virtuel → input bar remonte, pas de chevauchement
- [ ] Pas de bounce scroll indésirable

---

## 5. Système SOS

### Déclenchement depuis "Mon Soutien"
- [ ] Sidebar → "Mon Soutien" → SOSExercise s'ouvre (Gemini Live)
- [ ] Phase d'écoute → Gemini parle et écoute le patient
- [ ] Phase tracé respiratoire (orbe animée)
- [ ] Phase révélation du mot
- [ ] Phase clôture → retour au chat avec message de synthèse
- [ ] `sos_event` créé avec `origin: "crise"` dans Supabase

### Déclenchement depuis la Bibliothèque
- [ ] Sidebar → "Bibliothèque" → modale 5 exercices
- [ ] Lancer chaque exercice : cohérence cardiaque, ancrage, pleine conscience, écriture, défusion
- [ ] Chaque exercice se complète correctement
- [ ] `sos_event` créé avec `origin: "pratique"` (si statut non rouge)

### Post-exercice
- [ ] Message de clôture visible dans le chat après l'exercice
- [ ] Trophée 🏆 visible dans la sidebar si premier exercice réussi
- [ ] Statut émotionnel mis à jour si apaisement détecté

---

## 6. Statuts émotionnels

- [ ] Message neutre → `emotional_status: green` dans la sidebar patient
- [ ] Message de détresse modérée → `orange` (behavioral)
  - [ ] Verrou orange actif pendant 6h
  - [ ] Sas de décompression affiché après 6h
- [ ] Message de crise grave → `red_critical`
  - [ ] Bandeau rouge dans le dashboard praticien
  - [ ] Bouton "Aller au message" dans le bandeau → ouvre le bon message
- [ ] Exercice SOS réussi → apaisement détecté → retour vers green/orange

---

## 7. Dashboard praticien

### Vue liste patients
- [ ] Liste des patients avec statut coloré (vert/orange/rouge)
- [ ] Dernier message du patient affiché en italique
- [ ] Trophée 🏆 visible sur les patients avec victoires récentes
- [ ] Silence indicator : badge si pas de message depuis X jours
- [ ] Filtres : Alertes / Victoires / RAS fonctionnels

### Fiche patient (Vue d'ensemble)
- [ ] Ouvrir un patient → modal Vue d'ensemble
- [ ] KPIs : crises désamorcées, taux d'apaisement
- [ ] Cliquer "Crises désamorcées" → popover avec liste + résumés cliniques
- [ ] Emotional insight affiché (pas le dernier message en cas d'alerte)
- [ ] Victoires récentes affichées

### Actions praticien
- [ ] "Envoyer un Bravo" → message épinglé visible côté patient (bandeau)
- [ ] "Préparer ma séance" → bilan IA généré avec le contexte patient
- [ ] "Rapport IA" → rapport narratif complet généré
- [ ] Notes privées : ajouter / supprimer une note
- [ ] Murmure : envoyer un message discret

### Cabinet collaboratif
- [ ] Onglet "Cabinet" → dashboard multi-praticiens
- [ ] Documents partagés visibles
- [ ] Upload document fonctionne

---

## 8. Mode test (split-screen)

- [ ] Dashboard → activer "Mode Test"
- [ ] Split-screen : dashboard à gauche, chat patient à droite
- [ ] Badge TEST visible dans le header du chat
- [ ] Sidebar et hamburger masqués en mode test
- [ ] Configurer le profil test (étapes 1-3)
- [ ] Interaction praticien ↔ patient en temps réel visible

---

## 9. Billing / Abonnement

### Premier abonnement
- [ ] Dashboard sans abonnement → modale d'upgrade visible
- [ ] `/checkout` → formulaire Stripe → paiement test (4242 4242 4242 4242)
- [ ] Redirection vers `/dashboard` après succès
- [ ] Abonnement actif visible dans Paramètres → Abonnement

### Achat de pack patients
- [ ] Dashboard → "Ajouter des patients" → `/checkout-pack`
- [ ] Paiement test → `/pack-success`
- [ ] Nouveau quota visible dans le dashboard

### Gestion abonnement
- [ ] Paramètres → Abonnement → voir le plan actuel et les factures
- [ ] Changer la méthode de paiement
- [ ] Annuler l'abonnement → confirmation → statut "annulation fin de période"
- [ ] Reprendre un abonnement annulé

---

## 10. PWA (mobile + desktop)

### Installation iOS (Safari)
- [ ] Ouvrir `nutritwin.fr` dans Safari
- [ ] Partager → "Sur l'écran d'accueil"
- [ ] Icône arrondie iOS visible avec le bon logo (monstera feuille)
- [ ] App s'ouvre en standalone (pas dans Safari)
- [ ] apple-touch-icon correct (pas l'ancienne icône)

### Installation macOS (Chrome)
- [ ] Ouvrir `nutritwin.fr` dans Chrome
- [ ] Bouton installer dans la barre d'adresse → installer
- [ ] Icône squircle dans le Dock avec le bon logo
- [ ] App s'ouvre en window standalone

### Service worker
- [ ] Mode hors-ligne : les pages déjà visitées se chargent
- [ ] Pas d'erreur dans la console liée au service worker

---

## 11. Sécurité & accès

- [ ] Patient ne peut pas accéder à `/dashboard`
- [ ] Praticien ne peut pas accéder à `/chat` (hors mode test)
- [ ] `/set-password` avec token expiré → affiche "Lien expiré" (pas de crash)
- [ ] `/reset-password` avec token expiré → affiche "Lien expiré"
- [ ] API routes sans session → 401 (pas de données exposées)
- [ ] Un praticien ne peut pas voir les patients d'un autre praticien

---

## 12. Performance & qualité

- [ ] `npx tsc --noEmit` → zéro erreur TypeScript
- [ ] Pas d'erreur dans la console navigateur en navigation normale
- [ ] Streaming chat fluide (pas de freeze ou latence visible)
- [ ] Images uploadées compressées et affichées rapidement
- [ ] Score Lighthouse > 80 (mobile)

---

## Résumé des flux critiques (ordre de priorité)

| Priorité | Flux | Risque si cassé |
|---|---|---|
| 🔴 P0 | Invitation patient → set-password → chat | Patient ne peut pas accéder |
| 🔴 P0 | Reset password (lien email → formulaire) | Praticien bloqué hors session |
| 🔴 P0 | Conversation chat → streaming → persistance | Cœur du produit |
| 🟠 P1 | Exercice SOS → sos_event → dashboard | Suivi clinique cassé |
| 🟠 P1 | Statuts émotionnels → alerte praticien | Sécurité patient |
| 🟠 P1 | Billing → abonnement actif | Revenus |
| 🟡 P2 | Rapport IA / Bilan | Valeur praticien |
| 🟡 P2 | PWA installation | UX mobile |
| 🟢 P3 | Cabinet collaboratif | Feature avancée |

---

*Dernière mise à jour : 2026-07-14*
