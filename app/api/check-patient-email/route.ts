import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const { email, practitionerId } = await request.json() as { email: string; practitionerId: string };

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: allUsers } = await supabase.auth.admin.listUsers();
  const existingUser = allUsers?.users?.find(u => u.email === email);
  if (existingUser) {
    const { data: existingRelation } = await supabase
      .from("patient_practitioner")
      .select("patient_id")
      .eq("patient_id", existingUser.id)
      .eq("practitioner_id", practitionerId)
      .single();
    if (existingRelation) {
      return Response.json({ exists: true });
    }
  }
  return Response.json({ exists: false });
}
