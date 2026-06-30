import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email, redirectTo } = await request.json() as { email: string; redirectTo?: string };

  if (!email) {
    return NextResponse.json({ error: "Email requis" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const destination = redirectTo ?? `${origin}/auth/callback?next=/reset-password`;

  // Créer la réponse EN PREMIER pour pouvoir y attacher les cookies
  const response = NextResponse.json({ success: true });

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Le code_verifier PKCE est setté ici directement sur la réponse HTTP
          // → le navigateur le reçoit via Set-Cookie et le renvoie à /auth/callback
          // même si le lien est ouvert depuis un client mail (Apple Mail, Gmail…)
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: destination,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return response;
}
