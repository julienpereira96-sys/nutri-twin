import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const next = searchParams.get("next") ?? "/dashboard";
  const type = searchParams.get("type");

  const destination = type && type !== "recovery" ? `${next}?type=${type}` : next;
  const loginPage = type === "patient" ? "/patient-login" : "/login";

  // Créer la réponse redirect EN PREMIER pour pouvoir y attacher les cookies
  const redirectResponse = NextResponse.redirect(`${origin}${destination}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Approche token_hash : fonctionne cross-navigateur/cross-device
  // Supabase vérifie le token côté serveur — aucun code_verifier nécessaire
  if (tokenHash) {
    const otpType = (type ?? "recovery") as
      | "recovery"
      | "email"
      | "signup"
      | "invite"
      | "email_change";
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    if (!error) return redirectResponse;

    // Le token est à usage unique — si l'utilisateur reclique le lien sans avoir
    // changé son mot de passe, verifyOtp échoue mais il a déjà une session active.
    // Dans ce cas on le renvoie vers /reset-password plutôt que vers /login.
    if (type === "recovery") {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
    }

    const errorMsg = encodeURIComponent(error.message ?? "unknown");
    return NextResponse.redirect(`${origin}${loginPage}?error=lien_expire&debug=${errorMsg}`);
  }

  // Approche PKCE (code) : fonctionne si le même navigateur est utilisé
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectResponse;
    const errorMsg = encodeURIComponent(error.message ?? "unknown");
    return NextResponse.redirect(`${origin}${loginPage}?error=lien_expire&debug=${errorMsg}`);
  }

  return NextResponse.redirect(`${origin}${loginPage}?error=lien_expire&debug=no_code`);
}
