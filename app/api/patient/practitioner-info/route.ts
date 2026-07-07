import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-auth";

/**
 * GET /api/patient/practitioner-info
 * Retourne le plan et le nom du praticien lié au patient authentifié.
 * Supporte l'auth par cookie ET par Bearer token (mode test).
 * Utilise la service role key pour bypasser les RLS sur la table practitioners.
 */
export async function GET() {
  // Auth patient — supporte cookie SSR ET Bearer token (mode test)
  const user = await getSessionUser();
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
