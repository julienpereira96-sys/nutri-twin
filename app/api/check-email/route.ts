import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email } = await request.json() as { email: string };
  const normalizedEmail = email.trim().toLowerCase();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Chercher directement dans la table practitioners par email - 1 requête ciblée
  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("user_id, plan, pending_plan")
    .ilike("email", normalizedEmail)
    .single();

  if (!practitioner) {
    return NextResponse.json({ exists: false, hasPlan: false, isConfirmed: false });
  }

  // Récupérer le statut de confirmation Auth via l'ID (requête ciblée, pas de listUsers)
  const { data: { user } } = await supabase.auth.admin.getUserById(practitioner.user_id);
  const isConfirmed = !!user?.email_confirmed_at;

  return NextResponse.json({
    exists: true,
    hasPlan: !!practitioner.plan,
    isConfirmed,
    pendingPlan: practitioner.pending_plan ?? "pro",
  });
}
