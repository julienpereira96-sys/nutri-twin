import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * GET /api/patient/practitioner-info
 * Retourne le plan et le nom du praticien lié au patient authentifié.
 * Supporte l'auth par Bearer token (mode test) ET par cookie SSR (mode normal).
 * Utilise la service role key pour bypasser les RLS sur la table practitioners.
 */
export async function GET() {
  let userId: string | null = null;

  // ─── 1. Bearer token (mode test) ────────────────────────────────────────────
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await anonClient.auth.getUser(token);
    if (user) userId = user.id;
  }

  // ─── 2. Cookie SSR (mode normal) — avec setAll pour le refresh de token ────
  if (!userId) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(list) {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (user) userId = user.id;
  }

  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Service role — bypass RLS pour lire practitioners
  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rel } = await admin
    .from("patient_practitioner")
    .select("practitioner_id")
    .eq("patient_id", userId)
    .single();

  if (!rel) return NextResponse.json({ error: "Relation patient/praticien introuvable" }, { status: 404 });

  // Compte praticien — first_name, last_name, plan sont dans la table `practitioners`
  const { data: practAccount } = await admin
    .from("practitioners")
    .select("first_name, last_name, plan")
    .eq("user_id", rel.practitioner_id)
    .single();

  if (!practAccount) return NextResponse.json({ error: "Compte praticien introuvable" }, { status: 404 });

  // Profil onboarding — tutoiement est dans `practitioner_profiles` (questionnaire onboarding)
  // Optionnel : pas de 404 si le praticien n'a pas encore terminé l'onboarding
  const { data: practProfile } = await admin
    .from("practitioner_profiles")
    .select("tutoiement")
    .eq("user_id", rel.practitioner_id)
    .single();

  return NextResponse.json({
    practitionerId: rel.practitioner_id as string,
    plan: (practAccount.plan as string) ?? "essentiel",
    firstName: (practAccount.first_name as string) ?? "",
    lastName: (practAccount.last_name as string) ?? "",
    tutoiement: (practProfile?.tutoiement as string) ?? "",
  });
}
