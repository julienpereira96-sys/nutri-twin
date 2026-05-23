import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Routes publiques
  if (
    path === "/" ||
    path.startsWith("/signup") ||
    path.startsWith("/login") ||
    path.startsWith("/patient-login") ||
    path.startsWith("/set-password") ||
    path.startsWith("/reset-password")
  ) {
    // Si praticien connecté tente d'accéder à login/signup → dashboard
    if (user && (path.startsWith("/login") || path.startsWith("/signup"))) {
      const { data: practitioner } = await supabase.from("practitioners").select("plan").eq("user_id", user.id).single();
      if (practitioner?.plan) return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    // Si patient connecté tente d'accéder à patient-login → chat
    if (user && path.startsWith("/patient-login")) {
      const { data: practitioner } = await supabase.from("practitioners").select("plan").eq("user_id", user.id).single();
      if (!practitioner) return NextResponse.redirect(new URL("/chat", request.url));
    }
    return supabaseResponse;
  }

  // /verify-otp — besoin d'un email en paramètre
  if (path.startsWith("/verify-otp")) {
    const email = request.nextUrl.searchParams.get("email");
    if (!email) return NextResponse.redirect(new URL("/", request.url));
    return supabaseResponse;
  }

  // /checkout — praticien connecté sans plan
  if (path.startsWith("/checkout")) {
    if (!user) return NextResponse.redirect(new URL("/signup", request.url));
    const { data: practitioner } = await supabase.from("practitioners").select("plan").eq("user_id", user.id).single();
    if (practitioner?.plan) return NextResponse.redirect(new URL("/dashboard", request.url));
    return supabaseResponse;
  }

  // /payment-success — praticien connecté uniquement
  if (path.startsWith("/payment-success")) {
    if (!user) return NextResponse.redirect(new URL("/", request.url));
    const { data: practitioner } = await supabase.from("practitioners").select("plan").eq("user_id", user.id).single();
    if (!practitioner) return NextResponse.redirect(new URL("/", request.url));
    return supabaseResponse;
  }

  // /patient-onboarding — patient connecté uniquement (pas un praticien)
  if (path.startsWith("/patient-onboarding")) {
    if (!user) return NextResponse.redirect(new URL("/patient-login", request.url));
    const { data: practitioner } = await supabase.from("practitioners").select("plan").eq("user_id", user.id).single();
    if (practitioner) return NextResponse.redirect(new URL("/dashboard", request.url));
    return supabaseResponse;
  }

  // /chat — patient connecté uniquement (pas un praticien)
  if (path.startsWith("/chat")) {
    if (!user) return NextResponse.redirect(new URL("/patient-login?reason=session_expired", request.url));
    const { data: practitioner } = await supabase.from("practitioners").select("plan").eq("user_id", user.id).single();
    if (practitioner) return NextResponse.redirect(new URL("/dashboard", request.url));
    return supabaseResponse;
  }

  // /onboarding — praticien connecté sans profil
  if (path.startsWith("/onboarding")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const { data: practitioner } = await supabase.from("practitioners").select("plan").eq("user_id", user.id).single();
    if (!practitioner) return NextResponse.redirect(new URL("/login", request.url));
    const { data: profile } = await supabase.from("practitioner_profiles").select("user_id").eq("user_id", user.id).single();
    if (profile) return NextResponse.redirect(new URL("/dashboard", request.url));
    return supabaseResponse;
  }

  // /dashboard — praticien connecté avec profil
  if (path.startsWith("/dashboard")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const { data: practitioner } = await supabase.from("practitioners").select("plan, last_active_at").eq("user_id", user.id).single();
    if (!practitioner) return NextResponse.redirect(new URL("/login", request.url));

    const { data: profile } = await supabase.from("practitioner_profiles").select("user_id").eq("user_id", user.id).single();
    if (!profile) return NextResponse.redirect(new URL("/onboarding", request.url));

    // Expiration session après 30 jours
    const lastActive = (practitioner as { last_active_at?: string } | null)?.last_active_at;
    if (lastActive) {
      const daysSinceActive = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceActive > 30) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/login?reason=session_expired", request.url));
      }
    }

    await supabase.from("practitioners").update({ last_active_at: new Date().toISOString() }).eq("user_id", user.id);
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
