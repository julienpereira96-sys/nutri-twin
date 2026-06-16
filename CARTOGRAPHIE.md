# Cartographie NutriTwin — Chat ↔ Dashboard

> Document de référence pour s'y retrouver dans le système SOS / statuts émotionnels / dashboard.
> Mis à jour le 2026-06-16 (refonte complète — session cartographie).
> À relire et compléter au fil des évolutions — c'est la "carte" du système, pas un historique de tâches.

## Comment lire ce document

Le système a été construit par couches successives. Certaines pièces datent d'avant la refonte de cette
session et restent dans le code comme "filets de sécurité". Ce document distingue toujours :

- **Actif** : ce qui tourne réellement aujourd'hui.
- **Legacy / filet de sécurité** : ce qui reste dans le code par prudence mais n'est plus produit.
- **Mort** : ce qui ne sert plus à rien et peut être supprimé sans risque.

---

## 1. Glossaire — les briques du système SOS

| Terme | C'est quoi | Fichier |
|---|---|---|
| **Mon Soutien** | Bouton sidebar → lance `SOSExercise` (Gemini Live unifié). Crée un `sos_event` avec `origin: "crise"`. | `app/chat/page.tsx` |
| **Tag SOS chat** (`[TRIGGER_SOS:exo1,exo2]`) | Tag ajouté par Gemini en fin de réponse lors d'une détresse aiguë. Affiche 2 boutons d'exercices sous le message. Crée un `sos_event` avec `origin: "crise"`. | `route.ts`, `page.tsx` |
| **Bibliothèque** | Bouton sidebar → modale 5 exercices, choix libre. `origin: "crise"` si patient `red_behavioral` au clic, `"pratique"` sinon. | `page.tsx` |
| **SOSExercise** | Expérience Gemini Live immersive (écoute → tracé respiratoire → mot révélé → clôture). Lancé par Mon Soutien uniquement. | `app/chat/SOSExercise.tsx` |
| **5 exercices individuels** | breathing, ancrage, manger, ecriture, defusion — composants Gemini Live dédiés. Lancés par Tag SOS chat et Bibliothèque. | `app/chat/[Exercice].tsx` |
| **handleToolSelect** | Dispatcher central (Tag SOS chat + Bibliothèque). Ouvre l'exercice correspondant, crée le `sos_event`. | `page.tsx` |
| **sos_events** | Table Supabase. Une ligne = un exercice SOS effectué, avec `origin` (`"crise"` ou `"pratique"`). | Supabase |
| ~~**Bandeau SOS**~~ | ~~Bannière préemptive si red_behavioral~~ — **SUPPRIMÉ** (cassait la dynamique du chat). | — |

---

## 2. Les 3 déclencheurs SOS

```
Mon Soutien ────► SOSExercise (Gemini Live unifié)
                  sos_event origin: "crise"

Tag SOS chat ───┐
                ├──► handleToolSelect ──► 1 des 5 exos ──► sos_event (origin calculé)
Bibliothèque ───┘
```

---

## 3. Les 5 exercices (Gemini Live)

| ID | Label |
|---|---|
| `breathing` | Cohérence cardiaque |
| `ancrage` | Ancrage sensoriel 5-4-3-2-1 |
| `manger` | Pleine conscience alimentaire |
| `ecriture` | Écriture cathartique |
| `defusion` | Défusion cognitive |

Les 3 anciens exercices (`marche`, `body_scan`, `adaptive_coaching`) ne font plus partie du périmètre
actif — leurs composants restent dans le code mais ne sont plus accessibles via l'UI.

---

## 4. Calcul du champ `origin` (sos_events)

| Déclencheur | Condition | `origin` |
|---|---|---|
| Mon Soutien | toujours | **crise** |
| Tag SOS chat | toujours (AI a détecté une détresse aiguë) | **crise** |
| Bibliothèque | patient `red_behavioral` au moment du clic | **crise** |
| Bibliothèque | patient `green` au moment du clic | **pratique** |

Effet en aval : `origin: "crise"` + apaisement confirmé + retour `green`
→ victoire automatique → trophée 🏆 visible 48h sur le dashboard.

---

## 5. Statuts émotionnels

### 5.1 Statuts actifs (3 niveaux)

| Statut | Qui le produit | Ce que ça change |
|---|---|---|
| `green` | Défaut / retour après crise | RAS. Jumeau en mode normal. |
| `red_behavioral` | `analyzeCrisisWithLLM` ou JSON technique | Détresse sérieuse. Jumeau en mode ancrage bienveillant pur (zéro conseil nutrition). Alerte dashboard. |
| `red_critical` | `analyzeCrisisWithLLM` ou JSON technique | Urgence vitale. Verrou absolu (levée uniquement manuelle praticien). Email envoyé. |

**`orange` supprimé.** Si ce n'est pas assez grave pour `red_behavioral`, c'est `green`.

### 5.2 Mécanisme de détection (entrée en crise)

**Pre-filtre regex** (`hasBehavioralSignal`) : si aucun mot-clé → `analyzeCrisisWithLLM` bypassé.

**`analyzeCrisisWithLLM`** : LLM dédié (gemini-3.1-flash-lite, temp 0), en parallèle du chat.
Critères : détresse émotionnelle active, perte de contrôle alimentaire immédiate, dégoût profond de soi.
Produit `red_behavioral`, `red_critical` ou `none` + `murmure` pour le praticien.

**JSON technique du chat principal** (`|||{...}|||`) : tourne pour **chaque message**. Filet universel.
Valeurs possibles : `"green"`, `"red_behavioral"`, `"red_critical"`.

### 5.3 Retour à `green` — l'apaisement

Champ `apaisement` dans le JSON technique (`"oui"` / `"non"`).
`"oui"` déclenche le retour à vert **uniquement si** :
- retour au calme réel exprimé **dans cette même conversation**
  (ex : "je me sens mieux", "ça va mieux", "je suis plus calme")
- patient pas en `red_critical`
- statut actuel est `red_behavioral`

**Pas de verrou temporel** (`red_behavioral_until` supprimé). Le retour à vert est piloté uniquement
par Gemini via le signal d'apaisement, pas par un chrono.

### 5.4 Silence prolongé

Si le patient ne revient pas dans le chat après une crise :
- `emotional_status` reste `red_behavioral` (correct — on ne sait pas s'il va mieux).
- Après **24h sans message patient** → indicateur "Sans nouvelles depuis Xh" sur la card dashboard.
- Quand le patient revient, le Jumeau répond en mode bienveillant + check-in discret.
- Gemini peut alors détecter l'apaisement naturellement.
- Implémenté via `last_patient_message_at TIMESTAMPTZ` (table `patients`).

### 5.5 Statut `"red"` — LEGACY

`"red"` n'est jamais écrit par le code actuel (sauf patient démo "Sophie").
Quelques checks défensifs dans `dashboard/page.tsx` et `route.ts` — inoffensifs.

---

## 6. Dashboard praticien

### 6.1 Tri

Ordre strict : `red_critical` > `red_behavioral` > `green`.
À égalité : victoire fraîche (< 48h) remonte.

### 6.2 Filtres

| Filtre | Condition |
|---|---|
| Alertes | `red_critical` ou `red_behavioral` |
| Victoires | `green` + victoire fraîche (< 48h) |
| RAS | `green` sans victoire fraîche |
| Tous | tout le monde |
| Cabinet (`partages`) | dossiers partagés du cabinet |

### 6.3 KPIs

- **Taux d'Apaisement Moyen** : % d'épisodes SOS résolus, depuis `sos_feedback`.
- **Crises apaisées en autonomie** : patients avec `totalMessages > 0`.
- **Temps libéré** : `((messages × 0.75) + (sos_count × 5)) / 60` heures.

### 6.4 Popover "Crises désamorcées"

Affiche uniquement `sos_events` avec `origin: "crise"` du mois.
Les exercices `"pratique"` (Bibliothèque hors crise) n'y apparaissent pas — visibles dans le Rapport IA.

### 6.5 Interactions praticien

**Marquer alerte behavioral comme vue** : archive dans `archived_alerts` avec
`resolution: "practitioner_dismissed"` + timestamp, vide `admin_alerts`, passe en `green`.

**Lever alerte critical** (`LeverAlerteCritique`) : archive avec `resolution: "practitioner_certified"`
+ timestamp + `trigger_message_id`. Traçabilité complète pour la responsabilité clinique.

**Envoi message praticien** : marque alerte `seen: true` — **ne passe PAS en `green` automatiquement**.
Le statut ne change que quand Gemini confirme l'apaisement dans la conversation patient.

### 6.6 Indicateur silence prolongé

`emotional_status === "red_behavioral"` + `last_patient_message_at` > 24h
→ affiche "Sans nouvelles depuis Xh" sur la card et le panneau patient.

---

## 7. Contexte IA, mémoire, rapports

### 7.1 Mémoire hybride

| Plan | Fenêtre | Hardcap | Résumé anciens msgs |
|---|---|---|---|
| Essentiel | 3 jours | 20 | non |
| Pro / Cabinet / Fondateur | 7 jours | 40 | oui (> 7j) |

### 7.2 `buildSystemPrompt` — priorité

1. Murmures praticien (`practitioner_instruction`) — priorité absolue.
2. Documents RAG (global / praticien / patient, scoping `patient_id`).
3. Profil / personnalité (onboarding).

Journal et notes privées : jamais injectés.

### 7.3 RAG

Chunking 500 mots / 50 recouvrement. Embeddings `gemini-embedding-2` (768D).
`match_documents` + `match_patient_documents`, seuil > 0.5.
Anonymisation uniquement docs patient (`documentType === "patient"`).

### 7.4 Rapport IA (`generate-report`)

Injecte : profil onboarding, stats `sos_events`, `archived_alerts`, 30 derniers msgs (200 car. max).
Min 5 msgs. `gemini-3-flash-preview`, temp 0.5.
Sortie : `{synthese, patterns, victoires, murmures_bilan}`.

### 7.5 Bilan de séance (`generate-bilan`)

Injecte : profil, murmures praticien actifs, 20 derniers msgs, SOS + alertes depuis `bilan_cursors`.
Sortie : 3 questions `{question, justification, objectif}`, temp 0.6.

---

## 8. Migrations SQL requises

```sql
-- Champ silence indicator (obligatoire pour tâche #177)
ALTER TABLE patients ADD COLUMN last_patient_message_at TIMESTAMPTZ;

-- Optionnel / non urgent : convertir vieilles lignes "red" → "red_critical"
-- UPDATE patients SET emotional_status = 'red_critical' WHERE emotional_status = 'red';
```

---

## 9. Nettoyage identifié

| Quoi | Où | Statut |
|---|---|---|
| Supprimer branche morte `parsed.status === "red"` | `chat/page.tsx` | Fait en tâche #176 |
| Supprimer composants `MarcheExercise`, `BodyScanExercise`, `AdaptiveCoachingExercise` | `app/chat/` | Non urgent (inaccessibles via UI) |
| Migration SQL `"red"` → `"red_critical"` puis retirer checks défensifs | Supabase + code | Optionnel, low risk |
