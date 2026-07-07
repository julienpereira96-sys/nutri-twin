import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * GET /api/conversations?practitionerId=<uuid>
 *
 * Charge l'historique de conversation d'un patient authentifié.
 * Utilise la service_role key → bypass RLS → aucune dépendance aux politiques Supabase.
 * Supporte Bearer token (mode test) et cookie SSR (mode normal).
 *
 * Filtre :
 *   - patient_id = userId (identité auth)
 *   - practitioner_id = practitionerId OU NULL (couvre les messages sauvés avant fix)
 *   - practitioner_only != true (exclut les notes internes praticien)
 * Retourne les 100 derniers messages, ordre chronologique.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const practitionerId = searchParams.get("practitionerId");

  let userId: string | null = null;

  // ─── 1. Bearer token (mode test) ───────────────────────────────────────────
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

  // ─── 2. Cookie SSR (mode normal) ───────────────────────────────────────────
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

  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // ─── Service role — bypass RLS ─────────────────────────────────────────────
  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Filtre practitioner_id : UUID exact OU NULL (messages sauvés sans praticien)
  const practFilter = practitionerId
    ? `practitioner_id.eq.${practitionerId},practitioner_id.is.null`
    : "practitioner_id.is.null";

  const { data, error } = await admin
    .from("conversations")
    .select("role, content, created_at")
    .eq("patient_id", userId)
    .or(practFilter)
    .neq("practitioner_only", true)   // null != true → inclut les lignes sans practitioner_only
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[NutriTwin] /api/conversations error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data ?? [] });
}
