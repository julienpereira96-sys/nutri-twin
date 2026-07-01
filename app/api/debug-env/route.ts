import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return NextResponse.json({
    url_set: !!url,
    url_starts_with: url ? url.substring(0, 30) + "..." : null,
    key_set: !!key,
    key_length: key ? key.length : 0,
    key_starts_with: key ? key.substring(0, 10) + "..." : null,
    node_env: process.env.NODE_ENV,
  });
}
