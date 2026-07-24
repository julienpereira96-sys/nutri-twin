/**
 * lib/practitioner-profile.ts
 *
 * Génération du résumé de profil praticien et des embeddings de situations.
 * Appelé depuis /api/save-profile après l'upsert Supabase.
 * Résultats stockés dans practitioner_profiles (profile_summary) et Redis (situation_embeddings).
 */

import { Redis } from "@upstash/redis";
import { vertexGenerate, vertexEmbed } from "./vertexai";

// ─── Scénarios canoniques ──────────────────────────────────────────────────────
// Pour chaque situation praticien, on définit un scénario canonique : ce que le patient
// pourrait écrire dans ce contexte. À la sauvegarde du profil, on embed le scénario
// (pas la réponse praticien). À l'exécution, on embed le message patient et on cherche
// la situation la plus proche — puis on injecte la réponse praticien comme few-shot.
const SITUATION_SCENARIOS: Record<string, { label: string; scenario: string }> = {
  situation_craquage: {
    label: "Craquage ou écart alimentaire",
    scenario:
      "J'ai craqué ce soir, j'ai tout mangé, je me déteste, je suis nul(le), j'y arriverai jamais",
  },
  situation_avant_crise: {
    label: "Résistance à une envie forte",
    scenario:
      "L'envie est trop forte ce soir, j'ai peur de craquer, je suis seul(e) et j'ai de la nourriture devant moi",
  },
  situation_stagnation: {
    label: "Stagnation du poids",
    scenario:
      "La balance n'a pas bougé depuis des semaines malgré mes efforts, j'ai envie de tout arrêter",
  },
  situation_abandon: {
    label: "Patient absent qui revient avec honte",
    scenario:
      "J'ai honte de revenir, ça fait des semaines que j'ai tout sabordé et je n'ai pas osé écrire",
  },
  situation_prediabete: {
    label: "Question médicale spécifique glycémie",
    scenario:
      "Mon médecin m'a dit que j'ai un prédiabète, est-ce que je dois arrêter les féculents complètement",
  },
  situation_alcool: {
    label: "Alcool et vie sociale",
    scenario:
      "Est-ce que je peux boire de l'alcool ce week-end avec mes amis ou ça ruine tout mon suivi",
  },
  situation_marketing: {
    label: "Produit minceur ou promesse miracle",
    scenario:
      "J'ai vu un complément minceur qui semble très efficace, vous en pensez quoi, ça vaut le coup",
  },
  situation_drastique: {
    label: "Objectif irréaliste ou urgence forte",
    scenario:
      "Je veux perdre 8 kilos en 3 semaines pour mon mariage, c'est possible, on fait comment",
  },
  situation_flemme: {
    label: "Flemme ou manque de temps pour cuisiner",
    scenario:
      "Je rentre crevé(e) du boulot à 19h, j'ai rien à cuisiner et zéro motivation, qu'est-ce que je peux manger",
  },
  situation_coup_dur: {
    label: "Coup dur ou période difficile",
    scenario:
      "J'ai appris une très mauvaise nouvelle aujourd'hui, je n'ai plus la force de cuisiner ni de suivre le programme",
  },
  situation_victoire: {
    label: "Victoire ou succès du patient",
    scenario:
      "J'ai tenu tout le week-end sans craquer même pendant l'apéro, je suis vraiment fier(e) de moi",
  },
  situation_arret: {
    label: "Patient qui veut continuer seul",
    scenario:
      "Je me sens vraiment bien depuis 2 mois, j'ai retrouvé l'équilibre, est-ce qu'on a encore besoin de continuer ensemble",
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type SituationEmbedding = {
  key: string;
  label: string;
  scenario: string;
  answer: string;
  embedding: number[];
};

export type FewShotResult = {
  label: string;
  scenario: string;
  answer: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Cosine similarity between two vectors. Returns 0 if either vector is zero. */
function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ─── Profile summary ──────────────────────────────────────────────────────────

/**
 * Génère via Gemini Flash un résumé synthétique (~250 tokens) du profil praticien.
 * Ce résumé remplace les champs bruts de philosophie dans le system prompt caché :
 * plus concis, plus naturel, plus efficace pour que Gemini incarne la personnalité.
 * Retourne une string vide en cas d'échec (non bloquant — fallback vers champs bruts).
 */
export async function generateProfileSummary(
  profile: Record<string, string>
): Promise<string> {
  const parts = [
    profile.presentation && `PRÉSENTATION DU PRATICIEN (en ses propres mots) :\n${profile.presentation}`,
    profile.vision && `VISION DU PRATICIEN :\n${profile.vision}`,
    profile.approche_generale && `Approche principale : ${profile.approche_generale}`,
    profile.pathologies && `Cœur de métier / spécialité : ${profile.pathologies}`,
    profile.conviction && `Conviction fondamentale : ${profile.conviction}`,
    profile.jamais_dire && `Ne jamais recommander ni valider : ${profile.jamais_dire}`,
    profile.position_regimes && `Régimes restrictifs : ${profile.position_regimes}`,
    profile.position_glucides && `Position sur les glucides : ${profile.position_glucides}`,
    profile.position_jeune && `Jeûne intermittent : ${profile.position_jeune}`,
    profile.position_complements && `Compléments alimentaires : ${profile.position_complements}`,
    profile.sensibilite_budget && `Sensibilité budget : ${profile.sensibilite_budget}`,
    profile.orientation_produits && `Types de produits privilégiés : ${profile.orientation_produits}`,
    profile.dimension_emotionnelle &&
      `Place de la dimension émotionnelle : ${profile.dimension_emotionnelle}`,
    profile.alimentation_emotionnelle &&
      `Quand un patient mange ses émotions : ${profile.alimentation_emotionnelle}`,
    profile.non_suivi && `Quand un patient décroche du protocole : ${profile.non_suivi}`,
    profile.fetes_vacances && `Position sur les fêtes et vacances : ${profile.fetes_vacances}`,
    profile.levier_motivation && `Remotivation : ${profile.levier_motivation}`,
    profile.profil_perfectionniste &&
      `Face à un profil perfectionniste : ${profile.profil_perfectionniste}`,
    profile.adaptation_profil &&
      `Adaptation au profil patient : ${profile.adaptation_profil}`,
    profile.gestion_culpabilite &&
      `Culpabilité après un écart : ${profile.gestion_culpabilite}`,
    profile.vocabulaire_crise &&
      `Vocabulaire autour de la crise alimentaire : ${profile.vocabulaire_crise}`,
    profile.urgence_detresse &&
      `Souffrance psychologique exprimée : ${profile.urgence_detresse}`,
  ]
    .filter(Boolean)
    .join("\n");

  if (!parts) return "";

  const prompt = `Tu rédiges la synthèse d'identité d'un praticien nutritionniste pour alimenter le system prompt de son Jumeau Numérique IA.

Données d'onboarding du praticien :
${parts}

Rédige en 200 à 250 mots maximum, à la PREMIÈRE PERSONNE DU SINGULIER, un texte qui capture :
1. La philosophie et l'approche nutritionnelle unique de ce praticien
2. Sa façon concrète de gérer les moments émotionnels et les difficultés
3. Ses convictions profondes et ce qu'il ne fait jamais
4. Son positionnement sur les sujets clés (régimes, glucides, compléments...)

Ce texte sera injecté tel quel dans Gemini pour incarner ce praticien. Il doit être vivant, précis, refléter une vraie personnalité de soignant — pas une liste de règles.
Écris directement le texte synthèse, sans titre ni introduction.`;

  try {
    const summary = await vertexGenerate("gemini-2.0-flash-001", prompt, {
      maxOutputTokens: 450,
      temperature: 0.3,
    });
    return summary.trim();
  } catch {
    return "";
  }
}

// ─── Situation embeddings ─────────────────────────────────────────────────────

/**
 * Calcule et stocke en Redis les embeddings des situations praticien.
 * Pour chaque situation renseignée, on embed le SCÉNARIO CANONIQUE (ce que le patient
 * écrirait), et on stocke la réponse praticien associée. À l'exécution, on compare
 * l'embedding du message patient aux scénarios pour trouver le meilleur match.
 * Clé Redis : `situation_embeddings:{practitionerId}` — expire dans 90 jours.
 */
export async function generateSituationEmbeddings(
  profile: Record<string, string>,
  practitionerId: string,
  redis: Redis
): Promise<void> {
  // Ne traiter que les situations avec une réponse praticien non vide
  const filled = Object.entries(SITUATION_SCENARIOS).filter(
    ([key]) => profile[key]?.trim()
  );
  if (filled.length === 0) return;

  // Batch : un seul appel API pour tous les scénarios canoniques
  const texts = filled.map(([, { scenario }]) => scenario);
  const embeddings = await vertexEmbed(texts);

  const situations: SituationEmbedding[] = filled.map(
    ([key, { label, scenario }], i) => ({
      key,
      label,
      scenario,
      answer: profile[key],
      embedding: embeddings[i] ?? [],
    })
  );

  await redis.set(
    `situation_embeddings:${practitionerId}`,
    JSON.stringify(situations),
    { ex: 90 * 24 * 3600 } // 90 jours — regénéré à chaque save profil
  );
}

// ─── Runtime few-shot selection ───────────────────────────────────────────────

/**
 * Trouve la situation la plus proche du message patient par similarité cosinus.
 * Retourne null si aucun match n'atteint le seuil de confiance (0.55),
 * pour éviter les injections non pertinentes (faux positifs).
 * Non bloquant — retourne null en cas d'erreur réseau ou Redis.
 */
export async function getBestFewShot(
  userMessage: string,
  practitionerId: string,
  redis: Redis
): Promise<FewShotResult | null> {
  try {
    const stored = await redis.get<string>(`situation_embeddings:${practitionerId}`);
    if (!stored) return null;

    const situations: SituationEmbedding[] = JSON.parse(stored);
    if (!situations.length) return null;

    // Embed le message patient (tronqué à 500 chars — suffisant pour la similarité)
    const [msgEmbedding] = await vertexEmbed([userMessage.slice(0, 500)]);
    if (!msgEmbedding?.length) return null;

    // Trouver la situation avec la meilleure similarité cosinus
    let bestSim = 0;
    let best: SituationEmbedding | null = null;
    for (const sit of situations) {
      if (!sit.embedding?.length) continue;
      const sim = cosineSim(msgEmbedding, sit.embedding);
      if (sim > bestSim) {
        bestSim = sim;
        best = sit;
      }
    }

    // Seuil de confiance : 0.55 — en dessous, pas d'injection (message non situationnel)
    if (bestSim < 0.55 || !best) return null;

    return { label: best.label, scenario: best.scenario, answer: best.answer };
  } catch {
    // Silencieux — le few-shot est une optimisation, pas un composant critique
    return null;
  }
}
