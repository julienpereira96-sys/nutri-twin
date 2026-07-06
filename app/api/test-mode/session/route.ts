import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

/**
 * GET /api/test-mode/session
 *
 * Retourne une session fraîche pour le patient test du praticien.
 * Utilise signInWithPassword avec les credentials stockés → session permanente,
 * renouvelable à volonté, jamais exposée côté client sauf en tant que token JWT.
 *
 * Authentification : praticien connecté (cookie session).
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Récupérer les credentials du patient test
  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("test_patient_user_id, test_patient_email, test_patient_password")
    .eq("user_id", user.id)
    .single();

  if (!practitioner?.test_patient_email || !practitioner?.test_patient_password) {
    return NextResponse.json(
      { error: "Patient test non initialisé. Appelez d'abord /api/test-mode/setup." },
      { status: 404 }
    );
  }

  // Créer un client public (anon) pour se connecter avec les credentials patient
  const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: authData, error } = await supabaseAnon.auth.signInWithPassword({
    email: practitioner.test_patient_email,
    password: practitioner.test_patient_password,
  });

  if (error || !authData.session) {
    return NextResponse.json(
      { error: "Impossible de créer la session patient test." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
    patient_user_id: practitioner.test_patient_user_id,
  });
}
