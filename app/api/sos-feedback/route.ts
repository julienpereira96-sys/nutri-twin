import { createClient } from "@supabase/supabase-js";

function createSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const { patientId, practitionerId, eventId, stressBeforeProxy, scoreAfter } = await request.json() as {
      patientId: string;
      practitionerId: string;
      eventId: string;
      stressBeforeProxy: number;
      scoreAfter: number;
    };

    if (!patientId || !practitionerId || !scoreAfter) {
      return Response.json({ error: "Paramètres manquants." }, { status: 400 });
    }

    const supabase = createSupabaseClient();

    const isHighStressPersisting = scoreAfter >= 7;
    const hasNotImproved = scoreAfter >= stressBeforeProxy;

    // Insérer le feedback
    await supabase.from("sos_feedback").insert({
      event_id: eventId ?? null,
      patient_id: patientId,
      practitioner_id: practitionerId,
      stress_before_proxy: stressBeforeProxy,
      score_after: scoreAfter,
    });

    // SOS inefficace si le stress reste élevé OU n'a pas baissé
    if (isHighStressPersisting || hasNotImproved) {
      const { data: current } = await supabase
        .from("patients")
        .select("admin_alerts, first_name, last_name")
        .eq("user_id", patientId)
        .single();

      const patient = current as { admin_alerts?: object[]; first_name?: string; last_name?: string } | null;
      const alerts = patient?.admin_alerts ?? [];

      await supabase.from("patients").update({
        emotional_status: "red_critical",
        emotional_insight: "SOS inefficace — stress non réduit après l'exercice",
        admin_alerts: [...alerts, {
          type: "sos_failed",
          date: new Date().toISOString(),
          seen: false,
          score_before: stressBeforeProxy,
          score_after: scoreAfter,
        }],
      }).eq("user_id", patientId);

      return Response.json({ success: true, sosFailed: true });
    }

    return Response.json({ success: true, sosFailed: false });
  } catch {
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}
