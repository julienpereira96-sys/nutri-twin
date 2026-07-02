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

  // ── Suppression ────────────────────────────────────────────────────────
  if (body.action === "delete") {
    // Supprimer le fichier dans Storage (silencieux si absent)
    await supabaseAdmin.storage
      .from("Avatars")
      .remove([`prac_${user.id}/avatar.jpg`]);

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

  // ── Upload ─────────────────────────────────────────────────────────────
  if (!body.avatarDataUrl) {
    return NextResponse.json({ error: "No data" }, { status: 400 });
  }

  if (!body.avatarDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  }

  if (body.avatarDataUrl.length > 700_000) {
    return NextResponse.json({ error: "Image trop volumineuse" }, { status: 400 });
  }

  // Convertir dataUrl → Buffer
  const base64Data = body.avatarDataUrl.split(",")[1];
  if (!base64Data) {
    return NextResponse.json({ error: "Data URL invalide" }, { status: 400 });
  }
  const buffer = Buffer.from(base64Data, "base64");

  // Upload dans le même bucket que les patients — préfixe "prac_" pour séparer
  const storagePath = `prac_${user.id}/avatar.jpg`;
  const { error: storageError } = await supabaseAdmin.storage
    .from("Avatars")
    .upload(storagePath, buffer, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "no-store",
    });

  if (storageError) {
    console.error("[save-avatar] storage error:", storageError.message);
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  // URL publique avec cache-buster (identique au pattern patient)
  const { data: publicData } = supabaseAdmin.storage
    .from("Avatars")
    .getPublicUrl(storagePath);

  const publicUrl = publicData.publicUrl + "?t=" + Date.now();

  // Stocker l'URL (pas le base64) dans la colonne avatar_url
  const { error: dbError } = await supabaseAdmin
    .from("practitioners")
    .update({ avatar_url: publicUrl })
    .eq("user_id", user.id);

  if (dbError) {
    console.error("[save-avatar] db error:", dbError.message);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: publicUrl });
}
