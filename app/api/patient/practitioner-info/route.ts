import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * GET /api/patient/practitioner-info
 * Retourne le plan et le nom du praticien lié au patient authentifié.
 * Utilise la service role key pour bypasser les RLS sur la table practitioners.
 */
export async function GET() {
  // Auth patient via session cookie (clé anon)
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
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Service role — bypass RLS pour lire practitioners
  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rel } = await admin
    .from("patient_practitioner")
    .select("practitioner_id")
    .eq("patient_id", user.id)
    .single();

  if (!rel) return NextResponse.json({ error: "Relation patient/praticien introuvable" }, { status: 404 });

  const { data: pract } = await admin
    .from("practitioners")
    .select("first_name, last_name, plan, tutoiement")
    .eq("user_id", rel.practitioner_id)
    .single();

  if (!pract) return NextResponse.json({ error: "Profil praticien introuvable" }, { status: 404 });

  return NextResponse.json({
    practitionerId: rel.practitioner_id as string,
    plan: (pract.plan as string) ?? "essentiel",
    firstName: (pract.first_name as string) ?? "",
    lastName: (pract.last_name as string) ?? "",
    tutoiement: (pract.tutoiement as string) ?? "",
  });
}
