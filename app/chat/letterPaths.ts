/**
 * letterPaths.ts
 *
 * Paths SVG cursifs pour les 26 lettres A–Z.
 * Espace de coordonnées : viewBox 0 0 w 100 (hauteur fixe 100, largeur variable).
 * Ligne de base : y ≈ 80  |  Hauteur des capitales : y ≈ 10
 *
 * Utilisé par le système "Poussière de Magnétium" (SOSExercise + SOSExerciseVisual).
 * Les chemins sont des single-stroke ou multi-subpath (M multiples) cursifs/calligraphiques.
 * getTotalLength() + getPointAtLength() fonctionnent sur les deux formes.
 */

export interface LetterDef {
  /** SVG path data (coordonnées locales) */
  d: string;
  /** Largeur de la lettre en unités SVG */
  w: number;
}

export const ALPHABET_PATHS: Record<string, LetterDef> = {

  // A — deux courbes montantes + barre transversale
  A: {
    w: 68,
    d: "M 5,78 C 8,52 22,12 34,10 C 46,8 60,52 63,78 M 17,52 L 51,52",
  },

  // B — vertical + deux bosses courbes
  B: {
    w: 66,
    d: "M 10,10 L 10,78 M 10,12 C 40,8 54,20 54,34 C 54,48 30,46 10,46 M 10,48 C 36,46 58,60 56,72 C 54,82 34,78 10,78",
  },

  // C — arc ouvert à gauche
  C: {
    w: 64,
    d: "M 60,22 C 50,8 20,6 10,26 C 2,40 2,58 10,72 C 18,86 50,90 62,76",
  },

  // D — vertical + bosse droite fermée
  D: {
    w: 66,
    d: "M 10,10 L 10,78 C 38,80 62,66 62,44 C 62,22 40,8 10,10",
  },

  // E — vertical + 3 horizontales
  E: {
    w: 60,
    d: "M 57,10 L 10,10 L 10,78 L 57,78 M 10,44 L 50,44",
  },

  // F — vertical + 2 horizontales
  F: {
    w: 58,
    d: "M 54,10 L 10,10 L 10,78 M 10,44 L 48,44",
  },

  // G — C + étagère intérieure horizontale
  G: {
    w: 66,
    d: "M 62,22 C 52,8 20,6 10,26 C 2,40 2,58 10,72 C 18,86 50,90 62,76 L 62,48 L 36,48",
  },

  // H — deux verticaux + barre
  H: {
    w: 66,
    d: "M 10,10 L 10,78 M 58,10 L 58,78 M 10,44 L 58,44",
  },

  // I — vertical avec empattements
  I: {
    w: 44,
    d: "M 10,10 L 36,10 M 23,10 L 23,78 M 10,78 L 36,78",
  },

  // J — vertical descendant avec crochet gauche
  J: {
    w: 52,
    d: "M 42,10 L 42,68 C 42,82 30,90 18,86 C 8,82 6,72 8,64",
  },

  // K — vertical + deux diagonales courbes
  K: {
    w: 64,
    d: "M 10,10 L 10,78 M 54,10 C 32,28 32,60 54,78",
  },

  // L — vertical + base horizontale
  L: {
    w: 58,
    d: "M 10,10 L 10,78 L 56,78",
  },

  // M — montagne cursive
  M: {
    w: 74,
    d: "M 6,78 L 6,10 C 18,38 28,58 37,54 C 46,50 56,30 68,10 L 68,78",
  },

  // N — deux verticaux + diagonale courbe
  N: {
    w: 66,
    d: "M 10,78 L 10,10 C 24,34 44,54 58,10 L 58,78",
  },

  // O — ellipse fermée
  O: {
    w: 68,
    d: "M 34,10 C 54,10 64,24 64,44 C 64,64 54,78 34,78 C 14,78 4,64 4,44 C 4,24 14,10 34,10",
  },

  // P — vertical + bosse haute droite
  P: {
    w: 62,
    d: "M 10,78 L 10,10 C 10,10 54,12 54,32 C 54,50 28,50 10,50",
  },

  // Q — O + queue en bas-droite
  Q: {
    w: 70,
    d: "M 34,10 C 54,10 64,24 64,44 C 64,64 54,78 34,78 C 14,78 4,64 4,44 C 4,24 14,10 34,10 M 48,66 L 66,86",
  },

  // R — P + jambe diagonale
  R: {
    w: 64,
    d: "M 10,78 L 10,10 C 10,10 54,12 54,30 C 54,46 30,48 10,48 M 34,48 L 60,78",
  },

  // S — courbe en S
  S: {
    w: 62,
    d: "M 58,22 C 52,8 28,4 16,16 C 6,24 6,36 22,44 C 38,52 62,60 60,72 C 58,84 38,90 20,86 C 10,82 6,72 8,66",
  },

  // T — horizontale + vertical
  T: {
    w: 64,
    d: "M 8,10 L 60,10 M 34,10 L 34,78",
  },

  // U — descente + base arrondie
  U: {
    w: 66,
    d: "M 10,10 L 10,62 C 10,80 22,88 34,88 C 46,88 58,80 58,62 L 58,10",
  },

  // V — deux diagonales courbes
  V: {
    w: 64,
    d: "M 8,10 C 16,40 28,70 34,78 C 40,70 52,40 60,10",
  },

  // W — double V courbe
  W: {
    w: 78,
    d: "M 5,10 C 10,40 18,72 22,78 C 28,60 34,40 38,46 C 42,40 50,60 56,78 C 60,72 68,40 73,10",
  },

  // X — deux diagonales courbes qui se croisent
  X: {
    w: 64,
    d: "M 8,10 C 22,30 46,58 60,78 M 60,10 C 46,30 22,58 8,78",
  },

  // Y — deux branches + tige verticale
  Y: {
    w: 64,
    d: "M 8,10 C 18,28 28,46 34,48 C 40,28 52,10 60,10 M 34,48 L 34,78",
  },

  // Z — haut, diagonale courbe, bas
  Z: {
    w: 62,
    d: "M 8,10 L 60,10 C 44,30 24,56 8,78 L 60,78",
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

export interface WordSVGLayout {
  /** Path d par lettre (dans l'espace local de la lettre) */
  paths: string[];
  /** Décalage X de chaque lettre dans le viewBox global */
  xOffsets: number[];
  /** Largeurs individuelles */
  widths: number[];
  /** Largeur totale du viewBox */
  totalWidth: number;
  /** Hauteur du viewBox (constante) */
  height: number;
}

/**
 * Assemble les paths SVG d'un mot en calculant les décalages X de chaque lettre.
 * @param word  Mot en majuscules (ex. "CALME", "LIBRE")
 * @param gap   Espace entre lettres en unités SVG (défaut 14)
 */
export function buildWordSVG(word: string, gap = 14): WordSVGLayout {
  const height = 100;
  const paths: string[]   = [];
  const xOffsets: number[] = [];
  const widths: number[]   = [];
  let x = 0;

  for (const ch of word.toUpperCase()) {
    const def = ALPHABET_PATHS[ch];
    if (!def) {
      // Lettre inconnue → espace
      x += 40 + gap;
      continue;
    }
    xOffsets.push(x);
    paths.push(def.d);
    widths.push(def.w);
    x += def.w + gap;
  }

  const totalWidth = Math.max(0, x - gap);
  return { paths, xOffsets, widths, totalWidth, height };
}
