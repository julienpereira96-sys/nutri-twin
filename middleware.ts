import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { type NextRequest, NextResponse } from "next/server";

const protectedRoutes = ["/dashboard", "/onboarding", "/chat"];

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

  const isProtected = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Rediriger vers le bon login si non connecté
  if (isProtected && !user) {
    const isChat = request.nextUrl.pathname.startsWith("/chat");
    const loginUrl = isChat ? "/patient-login" : "/login";
    return NextResponse.redirect(new URL(loginUrl, request.url));
  }

  // Bloquer /onboarding et /dashboard si email non confirmé
  if (user && !user.email_confirmed_at) {
    const needsConfirmation = ["/onboarding", "/dashboard"].some((route) =>
      request.nextUrl.pathname.startsWith(route)
    );
    if (needsConfirmation) {
      return NextResponse.redirect(new URL("/verify-email", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
