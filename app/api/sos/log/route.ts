import { createClient } from "@supabase/supabase-js";

import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

function createSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Journalise la clôture de l'exercice SOS vocal (SOSExercise.tsx, Gemini Live).
// Rattache la clôture au sos_event le plus récent de ce patient/praticien —
// celui créé au déclenchement de l'exercice (voir branche isSOS de /api/chat).
// Best-effort : silencieux si aucun événement n'est trouvé (ex: exercice
// relancé hors du triage habituel).
export async function POST(request: Request) {
  try {
    const { patientId, practitionerId, closingMessage, word, emergencyExit, intakeMessage } = await request.json() as {
      patientId: string;
      practitionerId: string;
      closingMessage?: string;
      word?: string | null;
      emergencyExit?: boolean;
      // Ce que le patient a dit pendant l'intake, AVANT de toucher l'écran —
      // distinct de closingMessage (après le tracé). Donne au praticien la
      // vision globale de l'exercice plutôt que le seul ressenti final.
      intakeMessage?: string;
    };

    if (!patientId || !practitionerId) {
      return Response.json({ error: "Paramètres manquants." }, { status: 400 });
    }

    const user = await getSessionUser();
    if (!user) return unauthorized();
    if (user.id !== patientId) return forbidden();

    const supabase = createSupabaseClient();

    const { data: recent } = await supabase
      .from("sos_events")
      .select("id")
      .eq("patient_id", patientId)
      .eq("practitioner_id", practitionerId)
      .order("triggered_at", { ascending: false })
      .limit(1)
      .single();

    if (recent?.id) {
      await supabase.from("sos_events").update({
        closing_message: closingMessage?.trim() || null,
        traced_word: word ?? null,
        emergency_exit: !!emergencyExit,
        intake_message: intakeMessage?.trim() || null,
      }).eq("id", recent.id);
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}
