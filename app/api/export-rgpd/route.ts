import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";

// RGPD-2 — Champs de la table patients RÉSERVÉS au praticien : jamais exportés au
// patient (notes privées, murmures/instructions au Jumeau, évaluations cliniques).
const PRACTITIONER_CONFIDENTIAL = [
  "private_notes",
  "practitioner_instruction",
  "notes",
  "emotional_insight",
  "admin_alerts",
  "archived_alerts",
];

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");
  if (!patientId) return Response.json({ error: "patientId manquant" }, { status: 400 });

  // Un patient ne peut exporter que ses propres données
  if (user.id !== patientId) return forbidden();

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [profile, conversations, sos, sosClosures, exerciseLogs, crisisEvents, documents] = await Promise.all([
    supabase.from("patients").select("*").eq("user_id", patientId).single(),
    supabase.from("conversations").select("role, content, created_at").eq("patient_id", patientId).order("created_at", { ascending: true }),
    supabase.from("sos_events").select("triggered_at, tool_id, status, intake_message, crisis_level_detected").eq("patient_id", patientId).order("triggered_at", { ascending: true }),
    supabase.from("sos_closures").select("created_at, closing_message, apaisement_detected").eq("patient_id", patientId).order("created_at", { ascending: true }),
    supabase.from("exercise_logs").select("created_at, exercise_type, intake_message, status").eq("patient_id", patientId).order("created_at", { ascending: true }),
    // RGPD-1 — complétude : historique de crise + documents patient
    supabase.from("crisis_events").select("*").eq("patient_id", patientId).order("created_at", { ascending: true }),
    supabase.from("documents").select("file_name, content, created_at").eq("patient_id", patientId).order("created_at", { ascending: true }),
  ]);

  // RGPD-2 — retirer les champs confidentiels du praticien avant l'export patient.
  const profileData = profile.data ? { ...(profile.data as Record<string, unknown>) } : null;
  if (profileData) for (const k of PRACTITIONER_CONFIDENTIAL) delete profileData[k];

  // crisis_events — retirer practitioner_id (donnée du praticien, pas du patient).
  const crisisData = (crisisEvents.data ?? []).map((e) => {
    const c = { ...(e as Record<string, unknown>) };
    delete c.practitioner_id;
    return c;
  });

  const data = {
    export_date: new Date().toISOString(),
    profil: profileData,
    conversations: conversations.data ?? [],
    sos_events: sos.data ?? [],
    sos_closures: sosClosures.data ?? [],
    exercise_logs: exerciseLogs.data ?? [],
    crisis_events: crisisData,
    documents: documents.data ?? [],
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="nutritwin-export-${new Date().toISOString().split("T")[0]}.json"`,
    },
  });
}
