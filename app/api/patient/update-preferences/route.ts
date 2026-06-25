import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { objective, motivation, defi, aliments_aimes, aliments_detestes } = await request.json() as {
    objective?: string | null;
    motivation?: string | null;
    defi?: string | null;
    aliments_aimes?: string | null;
    aliments_detestes?: string | null;
  };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const fields: Record<string, string | null> = {};
  if (objective !== undefined) fields.objective = objective ?? null;
  if (motivation !== undefined) fields.motivation = motivation ?? null;
  if (defi !== undefined) fields.defi = defi ?? null;
  if (aliments_aimes !== undefined) fields.aliments_aimes = aliments_aimes ?? null;
  if (aliments_detestes !== undefined) fields.aliments_detestes = aliments_detestes ?? null;

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour." }, { status: 400 });
  }

  const { error } = await supabase
    .from("patients")
    .update(fields)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
