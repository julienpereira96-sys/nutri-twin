import { createClient } from "@supabase/supabase-js";

import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

function createSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Renvoie les clôtures d'exercices SOS (sos_events dont closing_message est
// rempli — voir /api/sos/log) pour un patient donné. Consommé par
// app/chat/page.tsx (patient) ET app/dashboard/page.tsx (praticien) pour
// reconstruire la carte "Exercice SOS terminé" au bon endroit chronologique
// dans le fil de discussion, via lib/sosClosures.ts.
//
// Volontairement PAS écrit dans `conversations` : cette table nourrit aussi
// le contexte renvoyé à Gemini à chaque tour (getConversationHistory dans
// /api/chat/route.ts) et les Rapports IA / Bilans — y insérer un marqueur de
// résumé créerait un risque de contamination du contexte ou des rapports.
// sos_events reste la source unique de vérité, lue uniquement pour l'affichage.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  const practitionerId = searchParams.get("practitionerId");
  if (!patientId || !practitionerId) {
    return Response.json({ error: "Paramètres manquants." }, { status: 400 });
  }

  const user = await getSessionUser();
  if (!user) return unauthorized();
  // Même convention que le reste de l'API : le patient peut lire ses propres
  // données, le praticien peut lire celles de ses patients.
  if (user.id !== patientId && user.id !== practitionerId) return forbidden();

  const supabase = createSupabaseClient();
  const { data } = await supabase
    .from("sos_events")
    .select("triggered_at, traced_word, closing_message, intake_message, intake_murmure, crisis_level_detected, crisis_trigger_message_id")
    .eq("patient_id", patientId)
    .eq("practitioner_id", practitionerId)
    .not("traced_word", "is", null)   // exercice arrivé au tracé (with ou sans réponse de clôture)
    .order("triggered_at", { ascending: true });

  return Response.json({ events: data ?? [] });
}
