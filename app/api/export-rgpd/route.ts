import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  if (!patientId) return Response.json({ error: "patientId manquant" }, { status: 400 });

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [profile, conversations, journal, sos] = await Promise.all([
    supabase.from("patients").select("*").eq("user_id", patientId).single(),
    supabase.from("conversations").select("role, content, created_at").eq("patient_id", patientId).order("created_at", { ascending: true }),
    supabase.from("journal_entries").select("*").eq("patient_id", patientId).order("date", { ascending: true }),
    supabase.from("sos_events").select("triggered_at, tool_id, stress_before, stress_after").eq("patient_id", patientId).order("triggered_at", { ascending: true }),
  ]);

  const data = {
    export_date: new Date().toISOString(),
    profil: profile.data,
    conversations: conversations.data ?? [],
    journal: journal.data ?? [],
    sos_events: sos.data ?? [],
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="nutritwin-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
