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
    path.startsWith("/set-password")
    path.startsWith("/reset-password") //
  ) {
    return supabaseResponse;
  }

  // /verify-otp — besoin d'un email en paramètre
  if (path.startsWith("/verify-otp")) {
    const email = request.nextUrl.searchParams.get("email");
    if (!email) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return supabaseResponse;
  }

  // /checkout — besoin d'être connecté
  if (path.startsWith("/checkout")) {
    if (!user) {
      return NextResponse.redirect(new URL("/signup", request.url));
    }
    return supabaseResponse;
  }

  // /payment-success — besoin d'être connecté
  if (path.startsWith("/payment-success")) {
    if (!user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return supabaseResponse;
  }

  // /chat — besoin d'être connecté (patient)
  if (path.startsWith("/chat")) {
    if (!user) {
      return NextResponse.redirect(new URL("/patient-login", request.url));
    }
    return supabaseResponse;
  }

  // /onboarding — besoin d'être connecté + PAS encore de profil
  if (path.startsWith("/onboarding")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const { data: profile } = await supabase
      .from("practitioner_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
  }

  // /dashboard — besoin d'être connecté + profil complété
  if (path.startsWith("/dashboard")) {
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const { data: profile } = await supabase
      .from("practitioner_profiles")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
