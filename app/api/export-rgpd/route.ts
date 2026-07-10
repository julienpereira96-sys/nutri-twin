import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  if (!patientId) return Response.json({ error: "patientId manquant" }, { status: 400 });

  // Un patient ne peut exporter que ses propres données
  if (user.id !== patientId) return forbidden();

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [profile, conversations, sos, sosClosures, exerciseLogs] = await Promise.all([
    supabase.from("patients").select("*").eq("user_id", patientId).single(),
    supabase.from("conversations").select("role, content, created_at").eq("patient_id", patientId).order("created_at", { ascending: true }),
    supabase.from("sos_events").select("triggered_at, tool_id, status, intake_message, crisis_level_detected").eq("patient_id", patientId).order("triggered_at", { ascending: true }),
    supabase.from("sos_closures").select("created_at, closing_message, apaisement_detected").eq("patient_id", patientId).order("created_at", { ascending: true }),
    supabase.from("exercise_logs").select("created_at, exercise_type, intake_message, status").eq("patient_id", patientId).order("created_at", { ascending: true }),
  ]);

  const data = {
    export_date: new Date().toISOString(),
    profil: profile.data,
    conversations: conversations.data ?? [],
    sos_events: sos.data ?? [],
    sos_closures: sosClosures.data ?? [],
    exercise_logs: exerciseLogs.data ?? [],
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="nutritwin-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
