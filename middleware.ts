import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Redirection permanente depuis l'URL Vercel vers le domaine custom
  // Exception : /reset-password et /set-password car ils utilisent des hash fragments (#access_token=...)
  // qui sont perdus lors d'une redirection serveur.
  const host = request.headers.get("host") ?? "";
  if (host === "nutri-twin.vercel.app" && !request.nextUrl.pathname.startsWith("/reset-password") && !request.nextUrl.pathname.startsWith("/set-password")) {
    const url = request.nextUrl.clone();
    url.host = "nutritwin.fr";
    url.port = "";
    return NextResponse.redirect(url, { status: 301 });
  }

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
    const { data } = await supabase.from("practitioners").select("plan, last_active_at, pending_plan, onboarding_done").eq("user_id", user.id).single();
    return data;
  };

  // Sélection séparée pour le mode test — colonne optionnelle (migration peut ne pas être appliquée)
  const getTestPatientUserId = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data } = await supabase.from("practitioners").select("test_patient_user_id").eq("user_id", user.id).single();
      return (data as { test_patient_user_id?: string | null } | null)?.test_patient_user_id ?? null;
    } catch { return null; }
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

  // /auth/callback — échange de code PKCE côté serveur, passe toujours
  if (path.startsWith("/auth/callback")) {
    return supabaseResponse;
  }

  // /set-password et /reset-password — protégés par token Supabase
  if (path.startsWith("/set-password") || path.startsWith("/reset-password")) {
    return supabaseResponse;
  }

  // /verify-otp — email requis, compte non vérifié uniquement
  if (path.startsWith("/verify-otp")) {
    const email = request.nextUrl.searchParams.get("email");
    if (!email) return NextResponse.redirect(new URL("/", request.url));
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
    if (!practitioner?.plan) return NextResponse.redirect(new URL("/choose-plan", request.url));
    const profile = await getProfile();
    if (!profile || !practitioner.onboarding_done) return NextResponse.redirect(new URL("/onboarding", request.url));
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

    // /login — redirige les utilisateurs déjà pleinement connectés
    if (path.startsWith("/login")) {
      if (!user) return supabaseResponse;
      const practitioner = await getPractitioner();
      if (!practitioner?.plan) return supabaseResponse; // connecté sans plan → on laisse passer
      const profile = await getProfile();
      if (!profile || !practitioner.onboarding_done) return NextResponse.redirect(new URL("/onboarding", request.url));
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

  // /choose-plan — praticien connecté sans plan uniquement
  if (path.startsWith("/choose-plan")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const practitioner = await getPractitioner();
    if (practitioner?.plan) {
      const profile = await getProfile();
      if (!profile || !practitioner.onboarding_done) return NextResponse.redirect(new URL("/onboarding", request.url));
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return supabaseResponse;
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

  // /checkout-pack — praticien avec plan uniquement (achat pack additionnel)
  if (path.startsWith("/checkout-pack")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const practitioner = await getPractitioner();
    if (!practitioner?.plan) return NextResponse.redirect(new URL("/choose-plan", request.url));
    return supabaseResponse;
  }

  // /checkout — praticien connecté sans plan uniquement
  if (path.startsWith("/checkout")) {
    if (!user) return NextResponse.redirect(new URL("/signup", request.url));
    const practitioner = await getPractitioner();
    if (!practitioner?.plan) return supabaseResponse;
    const profile = await getProfile();
    if (!profile || !practitioner.onboarding_done) return NextResponse.redirect(new URL("/onboarding", request.url));
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // /payment-success — praticien connecté uniquement
  if (path.startsWith("/payment-success")) {
    if (!user) return NextResponse.redirect(new URL("/", request.url));
    const profile = await getProfile();
    if (profile) return NextResponse.redirect(new URL("/dashboard", request.url));
    return supabaseResponse;
  }

  // /onboarding — praticien avec plan, onboarding non terminé
  if (path.startsWith("/onboarding")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const practitioner = await getPractitioner();
    if (!practitioner?.plan) return NextResponse.redirect(new URL("/login", request.url));
    // Rediriger vers dashboard uniquement si l'onboarding est vraiment terminé
    if (practitioner.onboarding_done) return NextResponse.redirect(new URL("/dashboard", request.url));
    return supabaseResponse;
  }

  // /dashboard — praticien avec plan et onboarding terminé uniquement
  if (path.startsWith("/dashboard")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const practitioner = await getPractitioner();
    if (!practitioner?.plan) return NextResponse.redirect(new URL("/login", request.url));
    const profile = await getProfile();
    if (!profile || !practitioner.onboarding_done) return NextResponse.redirect(new URL("/onboarding", request.url));

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

  // /chat — patient avec onboarding terminé, OU praticien en mode test
  if (path.startsWith("/chat")) {
    if (!user) return NextResponse.redirect(new URL("/patient-login?reason=session_expired", request.url));
    const practitioner = await getPractitioner();
    if (practitioner) {
      // Exception mode test : praticien qui accède au chat comme patient test
      const isTestMode = request.nextUrl.searchParams.get("test") === "true";
      if (isTestMode) {
        const testPatientUserId = await getTestPatientUserId();
        if (testPatientUserId) return supabaseResponse;
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
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
