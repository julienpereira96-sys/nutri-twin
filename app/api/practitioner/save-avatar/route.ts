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

  const body = await req.json() as { avatarDataUrl?: string; action?: string };

  // Suppression
  if (body.action === "delete") {
    const { error } = await supabaseAdmin
      .from("practitioners")
      .update({ avatar_url: null })
      .eq("user_id", user.id);
    if (error) {
      console.error("[save-avatar] delete error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Upload
  if (!body.avatarDataUrl) {
    return NextResponse.json({ error: "No data" }, { status: 400 });
  }

  // Validation basique
  if (!body.avatarDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  }

  // Taille max ~700 000 chars ≈ 525 KB d'image — largement suffisant pour une photo compressée
  if (body.avatarDataUrl.length > 700_000) {
    return NextResponse.json({ error: "Image trop volumineuse" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("practitioners")
    .update({ avatar_url: body.avatarDataUrl })
    .eq("user_id", user.id);

  if (error) {
    console.error("[save-avatar] update error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
