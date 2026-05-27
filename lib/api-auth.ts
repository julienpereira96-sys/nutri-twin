import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Lit l'utilisateur authentifié depuis les cookies de session.
 * À appeler au début de chaque route API sensible.
 * Retourne null si aucune session valide.
 */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Réponse 401 standard */
export const unauthorized = () =>
  Response.json({ error: "Non autorisé." }, { status: 401 });

/** Réponse 403 standard */
export const forbidden = () =>
  Response.json({ error: "Accès refusé." }, { status: 403 });
