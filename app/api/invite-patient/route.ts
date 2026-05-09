import { createClient } from "@supabase/supabase-js";

const PLAN_LIMITS: Record<string, number> = {
  essentiel: 10,
  pro: 100,
  cabinet: Infinity,
  fondateur: Infinity,
};

export async function POST(request: Request) {
  const {
    email,
    practitionerId,
    age,
    sexe,
    taille,
    poids,
    pathologies,
    allergies,
    traitements,
    objectif_clinique,
    brief_jumeau,
    notes,
  } = await request.json() as {
    email: string;
    practitionerId: string;
    age?: number | null;
    sexe?: string | null;
    taille?: number | null;
    poids?: number | null;
    pathologies?: string | null;
    allergies?: string | null;
    traitements?: string | null;
    objectif_clinique?: string | null;
    brief_jumeau?: string | null;
    notes?: string | null;
  };

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

  if (error) {
    const errorMessage = error.message.includes("already registered")
      ? "Un compte existe déjà pour cette adresse email."
      : error.message.includes("invalid")
      ? "Adresse email invalide."
      : "Une erreur est survenue lors de l'envoi de l'invitation.";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
  

  if (data.user && practitionerId) {
    await supabase.from("patient_practitioner").insert({
      patient_id: data.user.id,
      practitioner_id: practitionerId,
    });

    // Sauvegarder les infos pré-remplies par le praticien
    await supabase.from("patients").upsert({
      user_id: data.user.id,
      email,
      age: age ?? null,
      sexe: sexe ?? null,
      taille: taille ?? null,
      poids: poids ?? null,
      pathologies: pathologies ?? null,
      allergies: allergies ?? null,
      traitements: traitements ?? null,
      objectif_clinique: objectif_clinique ?? null,
      brief_jumeau: brief_jumeau ?? null,
      notes: notes ?? null,
    }, { onConflict: "user_id" });
  }

  return Response.json({ success: true });
}
