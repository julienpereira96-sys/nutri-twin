import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const type = searchParams.get("type");

  const destination = type ? `${next}?type=${type}` : next;
  const loginPage = type === "patient" ? "/patient-login" : "/login";

  if (code) {
    // Créer la réponse redirect EN PREMIER
    // puis setter les cookies directement dessus — sinon ils ne sont pas transmis
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

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return redirectResponse;
    }

    // Debug: passer le message d'erreur dans l'URL pour comprendre pourquoi ça échoue
    const errorMsg = encodeURIComponent(error.message ?? "unknown");
    return NextResponse.redirect(`${origin}${loginPage}?error=lien_expire&debug=${errorMsg}`);
  }

  return NextResponse.redirect(`${origin}${loginPage}?error=lien_expire&debug=no_code`);
}
