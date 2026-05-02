import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("founder_counter")
    .select("places_remaining")
    .single();

  return Response.json({ count: data?.places_remaining ?? 7 });
}
