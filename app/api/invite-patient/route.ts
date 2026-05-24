import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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
   first_name,
   last_name,
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
   niveau_activite,
   regime_specifique,
 } = await request.json() as {
   email: string;
   practitionerId: string;
   first_name?: string | null;
   last_name?: string | null;
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
   niveau_activite?: string | null;
   regime_specifique?: string | null;
 };

 if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
   return Response.json({ error: "Email invalide." }, { status: 400 });
 }
 if (!practitionerId || typeof practitionerId !== "string") {
   return Response.json({ error: "practitionerId requis." }, { status: 400 });
 }

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
   .select("plan, subscription_status")
   .eq("user_id", practitionerId)
   .single();

 const plan = practitioner?.plan ?? "essentiel";
 const limit = PLAN_LIMITS[plan] ?? 10;

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
   console.error("Invite error:", error.message);
   if (error.message.includes("already been registered") || error.message.includes("already registered")) {
     const { data: existingUser } = await supabase.auth.admin.listUsers();
     const existingPatient = existingUser?.users?.find(u => u.email === email);
     if (existingPatient) {
       const { data: patientData } = await supabase.from("patients").select("onboarding_completed").eq("user_id", existingPatient.id).single();
       if (!patientData?.onboarding_completed) {
         const { data: linkData } = await supabase.auth.admin.generateLink({
           type: "magiclink",
           email,
           options: {
             redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/set-password`,
           },
         });

         if (linkData?.properties?.action_link) {
           const resend = new Resend(process.env.RESEND_API_KEY!);
           await resend.emails.send({
             from: "NutriTwin <noreply@nutritwin.fr>",
             to: email,
             subject: "Votre invitation NutriTwin",
             html: `
               <p>Bonjour,</p>
               <p>Votre praticien vous a envoyé une nouvelle invitation pour accéder à votre espace NutriTwin.</p>
               <p><a href="${linkData.properties.action_link}">Accéder à mon espace →</a></p>
               <p>L'équipe NutriTwin</p>
             `,
           });
         }

         await supabase.from("patients").upsert({
           user_id: existingPatient.id,
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
           brief_jumeau: sanitize(brief_jumeau, 1000),
           notes: sanitize(notes, 1000),
           niveau_activite: sanitize(niveau_activite, 100),
           regime_specifique: sanitize(regime_specifique, 100),
         }, { onConflict: "user_id" });

         return Response.json({ success: true, resent: true });
       }
     }
     return Response.json({ error: "Un compte actif existe déjà pour cette adresse email." }, { status: 500 });
   }
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

   await supabase.from("patients").upsert({
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
     brief_jumeau: sanitize(brief_jumeau, 1000),
     notes: sanitize(notes, 1000),
     niveau_activite: sanitize(niveau_activite, 100),
     regime_specifique: sanitize(regime_specifique, 100),
   }, { onConflict: "user_id" });
 }

 return Response.json({ success: true });
}
