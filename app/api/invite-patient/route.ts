import { createClient } from "@supabase/supabase-js";
import { buildMurmureExpiry } from "@/lib/murmure";
import { getSessionUser, unauthorized, forbidden } from "@/lib/api-auth";
import { buildEmailHtml, sendEmail } from "@/lib/email";

const PLAN_LIMITS: Record<string, number> = {
  essentiel: 10,
  pro: 25,
  cabinet: 80,
};

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const {
    email, practitionerId, first_name, last_name, age, sexe, taille, poids,
    pathologies, allergies, traitements, objectif_clinique, brief_jumeau,
    murmure_duration, notes, niveau_activite, regime_specifique,
  } = await request.json() as {
    email: string; practitionerId: string; first_name?: string | null; last_name?: string | null;
    age?: number | null; sexe?: string | null; taille?: number | null; poids?: number | null;
    pathologies?: string | null; allergies?: string | null; traitements?: string | null;
    objectif_clinique?: string | null; brief_jumeau?: string | null; murmure_duration?: string | null;
    notes?: string | null; niveau_activite?: string | null; regime_specifique?: string | null;
  };

  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Email invalide." }, { status: 400 });
  }
  if (!practitionerId || typeof practitionerId !== "string") {
    return Response.json({ error: "practitionerId requis." }, { status: 400 });
  }

  if (user.id !== practitionerId) return forbidden();

  const sanitize = (val: string | null | undefined, max = 500): string | null => {
    if (!val || typeof val !== "string") return null;
    return val.trim().slice(0, max) || null;
  };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: practitioner } = await supabase
    .from("practitioners")
    .select("plan, subscription_status, extra_patients")
    .eq("user_id", practitionerId)
    .single();

  // M5 — Un praticien dont l'abonnement est résilié / impayé ne peut plus inviter
  // de patients (la route API n'est pas protégée par le middleware des pages).
  const BLOCKED_SUB_STATUSES = ["canceled", "cancelled", "unpaid", "incomplete_expired"];
  const subStatus = practitioner?.subscription_status as string | undefined;
  if (subStatus && BLOCKED_SUB_STATUSES.includes(subStatus)) {
    return Response.json(
      { error: "Votre abonnement n'est pas actif. Réactivez-le pour inviter de nouveaux patients." },
      { status: 403 }
    );
  }

  const plan = practitioner?.plan ?? "essentiel";
  const baseLimit = PLAN_LIMITS[plan] ?? 10;
  const limit = baseLimit + (practitioner?.extra_patients ?? 0);

  const { count } = await supabase
    .from("patient_practitioner")
    .select("*", { count: "exact", head: true })
    .eq("practitioner_id", practitionerId);

  if ((count ?? 0) >= limit) {
    return Response.json({
      error: `Vous avez atteint la limite de ${limit} patient${limit > 1 ? "s" : ""} pour votre plan ${plan}. Passez à un plan supérieur pour en ajouter davantage.`
    }, { status: 403 });
  }

  // Vérifier si le patient existe déjà - 1 requête ciblée, pas de listUsers
  const { data: existingPatient } = await supabase
    .from("patients")
    .select("user_id, onboarding_completed")
    .ilike("email", email.trim())
    .single();

  if (existingPatient) {
    const { data: existingRelation } = await supabase
      .from("patient_practitioner")
      .select("patient_id")
      .eq("patient_id", existingPatient.user_id)
      .eq("practitioner_id", practitionerId)
      .single();

    // Patient déjà associé et ayant terminé son onboarding → erreur claire
    if (existingRelation && existingPatient.onboarding_completed) {
      return Response.json({ error: "Ce patient est déjà associé à votre cabinet." }, { status: 400 });
    }

    // Patient déjà activé (onboarding terminé) mais pas encore lié à CE praticien
    // → ajouter la relation sans renvoyer un lien (il peut se connecter normalement)
    if (existingPatient.onboarding_completed) {
      if (!existingRelation) {
        await supabase.from("patient_practitioner").insert({
          patient_id: existingPatient.user_id,
          practitioner_id: practitionerId,
        });
      }
      return Response.json({ success: true, alreadyActivated: true });
    }

    // Compte existe mais pas encore activé — inviteUserByEmail échoue pour un user existant.
    // On génère un lien magique (type "magiclink") qui déclenche SIGNED_IN côté client,
    // identique au flux d'invitation initial — plus robuste que "recovery" pour ce cas.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/set-password` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("Reinvite generateLink error:", linkError?.message);
      return Response.json({ error: "Impossible de renvoyer l'invitation." }, { status: 500 });
    }

    const inviteHtml = buildEmailHtml({
      preheader: "Votre praticien vous a envoyé une invitation pour accéder à votre espace NutriTwin.",
      greeting: "Bonjour,",
      headline: "Votre invitation NutriTwin",
      body: `
        <p style="margin:0 0 20px;font-size:15px;color:#94a3b8;line-height:1.65;">
          Votre praticien vous a envoyé une nouvelle invitation pour accéder à votre espace NutriTwin.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
          <tr>
            <td align="center">
              <a href="${linkData.properties.action_link}" style="display:inline-block;background:#10b981;color:#000000;font-size:14px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;">Accéder à mon espace →</a>
            </td>
          </tr>
        </table>
      `,
      infoBox: `Ce lien est à usage unique. Pour vous reconnecter à tout moment, rendez-vous sur&nbsp;: <a href="${process.env.NEXT_PUBLIC_APP_URL}/patient-login" style="color:#10b981;text-decoration:none;">${process.env.NEXT_PUBLIC_APP_URL}/patient-login</a>`,
    });

    await sendEmail({
      to: email,
      subject: "Votre invitation NutriTwin",
      html: inviteHtml,
    });

    if (!existingRelation) {
      await supabase.from("patient_practitioner").insert({
        patient_id: existingPatient.user_id,
        practitioner_id: practitionerId,
      });
    }

    return Response.json({ success: true, resent: true });
  }

  // Nouveau patient - invitation Supabase
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/set-password`,
  });

  if (error) {
    console.error("Invite error:", error.message);
    const errorMessage = error.message.includes("invalid")
      ? "Adresse email invalide."
      : "Une erreur est survenue lors de l'envoi de l'invitation.";
    return Response.json({ error: errorMessage }, { status: 500 });
  }

  if (data.user && practitionerId) {
    const { data: existing } = await supabase
      .from("patient_practitioner")
      .select("patient_id")
      .eq("patient_id", data.user.id)
      .eq("practitioner_id", practitionerId)
      .single();

    if (!existing) {
      await supabase.from("patient_practitioner").insert({
        patient_id: data.user.id,
        practitioner_id: practitionerId,
      });
    }

    const practitionerInstruction = brief_jumeau ? [{
      id: crypto.randomUUID(),
      text: sanitize(brief_jumeau, 1000) ?? "",
      expires_at: buildMurmureExpiry(murmure_duration),
      created_at: new Date().toISOString(),
    }] : [];

    const { error: upsertError } = await supabase.from("patients").upsert({
      user_id: data.user.id,
      email,
      first_name: sanitize(first_name, 100),
      last_name: sanitize(last_name, 100),
      age: age ?? null,
      sexe: sexe ?? null,
      taille: taille ?? null,
      poids: poids ?? null,
      pathologies: sanitize(pathologies),
      allergies: sanitize(allergies),
      traitements: sanitize(traitements),
      objectif_clinique: sanitize(objectif_clinique),
      practitioner_instruction: practitionerInstruction.length > 0 ? practitionerInstruction : undefined,
      private_notes: notes ? [{ id: crypto.randomUUID(), text: sanitize(notes, 1000) ?? "", created_at: new Date().toISOString() }] : undefined,
      niveau_activite: sanitize(niveau_activite, 100),
      regime_specifique: sanitize(regime_specifique, 100),
    }, { onConflict: "user_id" });

    if (upsertError) console.error("Upsert patients error:", upsertError.message);
  }

  return Response.json({ success: true });
}