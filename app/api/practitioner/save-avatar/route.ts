import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const action = formData.get("action") as string | null;

  // Suppression
  if (action === "delete") {
    await supabaseAdmin.storage.from("Avatars").remove([`${user.id}/practitioner-avatar.jpg`]);
    await supabaseAdmin.from("practitioners").update({ avatar_url: null }).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  }

  // Upload
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from("Avatars")
    .upload(`${user.id}/practitioner-avatar.jpg`, buffer, {
      upsert: true,
      contentType: file.type || "image/jpeg",
      cacheControl: "no-store",
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabaseAdmin.storage
    .from("Avatars")
    .getPublicUrl(`${user.id}/practitioner-avatar.jpg`);

  const publicUrl = urlData.publicUrl;

  await supabaseAdmin.from("practitioners").update({ avatar_url: publicUrl }).eq("user_id", user.id);

  return NextResponse.json({ url: publicUrl });
}
