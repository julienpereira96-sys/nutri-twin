import { createClient } from "@supabase/supabase-js";

function createSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const { patientId, practitionerId, toolId, stressBefore, stressAfter } = await request.json() as {
      patientId: string;
      practitionerId: string;
      toolId: string;
      stressBefore: number;
      stressAfter: number;
    };

    const supabase = createSupabaseClient();
    await supabase.from("sos_events").update({
      stress_before: stressBefore,
      stress_after: stressAfter,
      tool_id: toolId,
    }).eq("patient_id", patientId).eq("practitioner_id", practitionerId).order("triggered_at", { ascending: false }).limit(1);

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}
