import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { email, practitionerId } = await request.json() as { email: string; practitionerId: string };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://nutri-twin.vercel.app"}/set-password`,

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
