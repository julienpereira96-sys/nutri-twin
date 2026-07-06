import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { patientId, practitionerId, fields, clearIdentityAlert } = await request.json() as {
    patientId: string;
    practitionerId: string;
    fields: {
      first_name?: string | null;
      last_name?: string | null;
      age?: number | null;
      taille?: number | null;
      poids?: number | null;
      sexe?: string | null;
      objective?: string | null;
      pathologies?: string | null;
      allergies?: string | null;
      traitements?: string | null;
      objectif_clinique?: string | null;
      niveau_activite?: string | null;
      regime_specifique?: string | null;
      notes?: string | null;
      motivation?: string | null;
      defi?: string | null;
      aliments_detestes?: string | null;
    };
    clearIdentityAlert?: boolean;
  };

  if (!patientId || !practitionerId) {
    return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  }

  if (user.id !== practitionerId) return forbidden();

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Vérifier que ce patient appartient bien à ce praticien
  const { data: relation } = await supabase
    .from("patient_practitioner")
    .select("patient_id")
    .eq("patient_id", patientId)
    .eq("practitioner_id", practitionerId)
    .single();

  if (!relation) return forbidden();

  const { error } = await supabase
    .from("patients")
    .update(fields)
    .eq("user_id", patientId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Invalider le cache profil IA pour que le jumeau voie les changements immédiatement
  await redis.del(`patient_profile_v2:${patientId}`).catch(() => {});

  // Supprimer les alertes de correction d'identité ET de rectification si demandé
  if (clearIdentityAlert) {
    const { data: patient } = await supabase
      .from("patients")
      .select("admin_alerts")
      .eq("user_id", patientId)
      .single();

    if (patient?.admin_alerts) {
      const filtered = (patient.admin_alerts as { alert_type?: string }[])
        .filter(a => a.alert_type !== "identity_correction" && a.alert_type !== "rectification_request");
      await supabase.from("patients").update({ admin_alerts: filtered }).eq("user_id", patientId);
    }
  }

  return NextResponse.json({ success: true });
}
