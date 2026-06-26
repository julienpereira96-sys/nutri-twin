import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

/**
 * POST /api/breathing/log
 * Enregistre silencieusement une séance de cohérence cardiaque dans sos_events
 * avec origin = "breathing" pour que le Rapport IA et le Bilan puissent l'inclure.
 *
 * Body : { outcome: "positive" | "negative" | "interrupted", blocks: number }
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();

    const { outcome, blocks } = await request.json() as {
      outcome?: "positive" | "negative" | "interrupted";
      blocks?: number;
    };

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Récupérer patient_id et practitioner_id depuis la table patients
    const { data: patient } = await supabase
      .from("patients")
      .select("id, practitioner_id")
      .eq("user_id", user.id)
      .single();

    if (!patient) return Response.json({ error: "Patient introuvable." }, { status: 404 });

    const label = outcome === "positive"
      ? `Cohérence cardiaque — ${blocks ?? 0} bloc(s) — apaisé`
      : outcome === "negative"
      ? `Cohérence cardiaque — ${blocks ?? 0} bloc(s) — en détresse`
      : `Cohérence cardiaque — interrompu (${blocks ?? 0} bloc(s))`;

    await supabase.from("sos_events").insert({
      patient_id:       user.id,
      practitioner_id:  patient.practitioner_id,
      triggered_at:     new Date().toISOString(),
      origin:           "breathing",
      status:           outcome === "positive" ? "success" : outcome === "negative" ? "failed" : "abandoned",
      sos_context:      label,
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}
