import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";

/**
 * Lit l'utilisateur authentifié.
 *
 * Priorité :
 * 1. Header Authorization: Bearer <token>  — mode test (chat iframe)
 * 2. Cookies de session SSR                — flux normal
 *
 * Retourne null si aucune session valide.
 */
export async function getSessionUser() {
  // ─── 1. Bearer token (mode test) ────────────────────────────────────────────
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) return user;
  }

  // ─── 2. Cookie SSR (flux normal) ────────────────────────────────────────────
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

/** Réponse 401 standard */
export const unauthorized = () =>
  Response.json({ error: "Non autorisé." }, { status: 401 });

/** Réponse 403 standard */
export const forbidden = () =>
  Response.json({ error: "Accès refusé." }, { status: 403 });
