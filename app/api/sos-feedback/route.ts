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

      const { data: practitionerData } = await supabase
        .from("practitioners")
        .select("first_name, last_name, email")
        .eq("user_id", practitionerId)
        .single();

      const practitioner = practitionerData as { first_name?: string; last_name?: string; email?: string } | null;
      const patientName = `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim();

      if (practitioner?.email && process.env.RESEND_API_KEY) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "NutriTwin Alertes <alertes@nutritwin.fr>",
            to: practitioner.email,
            subject: `⚡ SOS Inefficace — ${patientName}`,
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:Inter,sans-serif;color:#f1f5f9;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <p style="font-size:20px;font-weight:800;color:#f1f5f9;margin-bottom:32px;">Nutri<span style="color:#10b981;">Twin</span></p>
    <div style="background:#1a0a0a;border:1px solid rgba(244,63,94,0.4);border-radius:16px;padding:28px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#f43f5e;letter-spacing:0.1em;text-transform:uppercase;">⚡ SOS Inefficace</p>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#f1f5f9;">Intervention recommandée</h1>
      <p style="margin:0;font-size:15px;color:#94a3b8;line-height:1.6;"><strong style="color:#f1f5f9;">${patientName}</strong> a utilisé l'outil SOS mais son niveau de stress n'a pas diminué après l'exercice.</p>
    </div>
    <div style="background:#0d1512;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Scores</p>
      <p style="margin:0 0 6px;font-size:14px;color:#e2e8f0;">Avant l'exercice : <strong>${stressBeforeProxy}/10</strong></p>
      <p style="margin:0;font-size:14px;color:#f87171;">Après l'exercice : <strong>${scoreAfter}/10</strong></p>
    </div>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display:block;text-align:center;background:#10b981;color:black;font-size:14px;font-weight:700;padding:14px 24px;border-radius:12px;text-decoration:none;margin-bottom:32px;">Voir le dashboard →</a>
    <p style="margin:0;font-size:11px;color:#374151;text-align:center;">NutriTwin · Confidentiel — destiné à ${practitioner.first_name} ${practitioner.last_name}</p>
  </div>
</body>
</html>`,
          }),
        });
      }

      return Response.json({ success: true, sosFailed: true });
    }

    return Response.json({ success: true, sosFailed: false });
  } catch {
    return Response.json({ error: "Erreur" }, { status: 500 });
  }
}
