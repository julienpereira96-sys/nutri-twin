import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { field, correction } = await request.json() as {
    field?: string;
    correction?: string;
  };

  if (!field || !correction?.trim()) {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Récupérer les alertes existantes
  const { data: patient } = await supabase
    .from("patients")
    .select("admin_alerts")
    .eq("user_id", user.id)
    .single();

  const existing = (patient as { admin_alerts?: object[] } | null)?.admin_alerts ?? [];

  const newAlert = {
    type: "admin_alert",
    alert_type: "rectification_request",
    date: new Date().toISOString(),
    seen: false,
    field,
    correction: correction.trim(),
  };

  const { error } = await supabase
    .from("patients")
    .update({ admin_alerts: [...existing, newAlert] })
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
