import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const getPractitioner = async () => {
    if (!user) return null;
    const { data } = await supabase.from("practitioners").select("plan, last_active_at").eq("user_id", user.id).single();
    return data;
  };

  const getProfile = async () => {
    if (!user) return null;
    const { data } = await supabase.from("practitioner_profiles").select("user_id").eq("user_id", user.id).single();
    return data;
  };

  const getPatient = async () => {
    if (!user) return null;
    const { data } = await supabase.from("patients").select("onboarding_status, onboarding_completed").eq("user_id", user.id).single();
    return data;
  };

  // Page d'accueil — publique
  if (path === "/") return supabaseResponse;

  // /set-password et /reset-password — protégés par token Supabase
  if (path.startsWith("/set-password") || path.startsWith("/reset-password")) {
    return supabaseResponse;
  }

  // /verify-otp — email requis, compte non vérifié uniquement
  if (path.startsWith("/verify-otp")) {
    const email = request.nextUrl.searchParams.get("email");
    if (!email) return NextResponse.redirect(new URL("/", request.url));
    if (user) return NextResponse.redirect(new URL("/checkout?plan=pro", request.url));
    return supabaseResponse;
  }

    // /signup — non connecté uniquement, plan requis
    if (path.startsWith("/signup")) {
      if (!user) {
        const plan = request.nextUrl.searchParams.get("plan");
        if (!plan) return NextResponse.redirect(new URL("/#tarifs", request.url));
        return supabaseResponse;
      }  
    const practitioner = await getPractitioner(); 
    if (!practitioner?.plan) return NextResponse.redirect(new URL("/checkout?plan=pro", request.url));
    const profile = await getProfile();
    if (!profile) return NextResponse.redirect(new URL("/onboarding", request.url));
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

    // /login — non connecté uniquement
    if (path.startsWith("/login")) {
      if (!user) return supabaseResponse; 
      const practitioner = await getPractitioner();
      if (!practitioner?.plan) {
        const changingPlan = request.cookies.get("changing_plan")?.value === "true";
        if (!changingPlan) {
          await supabase.auth.signOut();
          return NextResponse.redirect(new URL("/login?pending=true", request.url));
        }
        return supabaseResponse; 
      }      
      const profile = await getProfile();
      if (!profile) return NextResponse.redirect(new URL("/onboarding", request.url));
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }  

  // /patient-login — non connecté uniquement
  if (path.startsWith("/patient-login")) {
    if (!user) return supabaseResponse;
    const practitioner = await getPractitioner();
    if (practitioner) return NextResponse.redirect(new URL("/dashboard", request.url));
    const patient = await getPatient();
    if (patient?.onboarding_completed) return NextResponse.redirect(new URL("/chat", request.url));
    return NextResponse.redirect(new URL("/patient-onboarding", request.url));
  }

  // /checkout — praticien connecté sans plan uniquement
  if (path.startsWith("/checkout")) {
    if (!user) return NextResponse.redirect(new URL("/signup", request.url));
    const practitioner = await getPractitioner();
    if (!practitioner?.plan) return supabaseResponse;
    const profile = await getProfile();
    if (!profile) return NextResponse.redirect(new URL("/onboarding", request.url));
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // /payment-success — praticien avec plan sans profil uniquement
  if (path.startsWith("/payment-success")) {
    if (!user) return NextResponse.redirect(new URL("/", request.url));
    const practitioner = await getPractitioner();
    if (!practitioner?.plan) return NextResponse.redirect(new URL("/", request.url));
    const profile = await getProfile();
    if (profile) return NextResponse.redirect(new URL("/dashboard", request.url));
    return supabaseResponse;
  }

  // /onboarding — praticien avec plan sans profil uniquement
  if (path.startsWith("/onboarding")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const practitioner = await getPractitioner();
    if (!practitioner?.plan) return NextResponse.redirect(new URL("/login", request.url));
    const profile = await getProfile();
    if (profile) return NextResponse.redirect(new URL("/dashboard", request.url));
    return supabaseResponse;
  }

  // /dashboard — praticien avec plan et profil uniquement
  if (path.startsWith("/dashboard")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const practitioner = await getPractitioner();
    if (!practitioner?.plan) return NextResponse.redirect(new URL("/login", request.url));
    const profile = await getProfile();
    if (!profile) return NextResponse.redirect(new URL("/onboarding", request.url));

    // Expiration session 30 jours
    const lastActive = (practitioner as { last_active_at?: string } | null)?.last_active_at;
    if (lastActive) {
      const days = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 30) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/login?reason=session_expired", request.url));
      }
    }
    await supabase.from("practitioners").update({ last_active_at: new Date().toISOString() }).eq("user_id", user.id);
    return supabaseResponse;
  }

  // /patient-onboarding — patient avec status password_set uniquement
  if (path.startsWith("/patient-onboarding")) {
    if (!user) return NextResponse.redirect(new URL("/patient-login", request.url));
    const practitioner = await getPractitioner();
    if (practitioner) return NextResponse.redirect(new URL("/", request.url));
    const patient = await getPatient();
    if (!patient) return NextResponse.redirect(new URL("/patient-login", request.url));
    if (patient.onboarding_completed) return NextResponse.redirect(new URL("/chat", request.url));
    if (patient.onboarding_status !== "password_set") return NextResponse.redirect(new URL("/patient-login", request.url));
    return supabaseResponse;
  }

  // /chat — patient avec onboarding terminé uniquement
  if (path.startsWith("/chat")) {
    if (!user) return NextResponse.redirect(new URL("/patient-login?reason=session_expired", request.url));
    const practitioner = await getPractitioner();
    if (practitioner) return NextResponse.redirect(new URL("/", request.url));
    const patient = await getPatient();
    if (!patient?.onboarding_completed) return NextResponse.redirect(new URL("/patient-onboarding", request.url));
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: 
  ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",

  ],
};
