import { createClient } from "@supabase/supabase-js";

const PLAN_LIMITS: Record<string, number> = {
  essentiel: 10,
  pro: 100,
  cabinet: Infinity,
  fondateur: Infinity,
};

export async function POST(request: Request) {
  const { email, practitionerId } = await request.json() as { email: string; practitionerId: string };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Récupérer le plan du praticien
  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("plan, subscription_status")
    .eq("user_id", practitionerId)
    .single();

  const plan = practitioner?.plan ?? "essentiel";
  const limit = PLAN_LIMITS[plan] ?? 10;

  // Compter les patients actuels
  const { count } = await supabase
    .from("patient_practitioner")
    .select("*", { count: "exact", head: true })
    .eq("practitioner_id", practitionerId);

  const currentCount = count ?? 0;

  if (currentCount >= limit) {
    return Response.json({
      error: `Vous avez atteint la limite de ${limit} patient${limit > 1 ? "s" : ""} pour votre plan ${plan}. Passez à un plan supérieur pour en ajouter davantage.`
    }, { status: 403 });
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/set-password`,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (data.user && practitionerId) {
    await supabase.from("patient_practitioner").insert({
      patient_id: data.user.id,
      practitioner_id: practitionerId,
    });
  }

  return Response.json({ success: true });
}
