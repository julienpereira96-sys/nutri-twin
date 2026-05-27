/**
 * Calcule la date d'expiration d'un murmure praticien.
 * Retourne null si la durée est "permanent" ou non reconnue.
 */
export const buildMurmureExpiry = (duration: string | null | undefined): string | null => {
  if (!duration || duration === "permanent") return null;
  if (duration === "24h") return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  if (duration === "3j") return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  if (duration === "7j") return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  if (duration === "30j") return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  if (duration.startsWith("custom_")) {
    const parts = duration.split("_");
    const amount = parseInt(parts[1]);
    const unit = parts[2];
    if (!amount || isNaN(amount)) return null;
    const ms =
      unit === "semaines" ? amount * 7 * 24 * 60 * 60 * 1000
      : unit === "mois" ? amount * 30 * 24 * 60 * 60 * 1000
      : amount * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms).toISOString();
  }
  return null;
};
