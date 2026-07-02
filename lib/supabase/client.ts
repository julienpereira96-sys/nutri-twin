import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises.",
    );
  }

  // Correctif CORS preflight cache :
  // Le navigateur peut cacher une réponse preflight CORS qui ne liste pas
  // "apikey" dans Access-Control-Allow-Headers, ce qui le conduit à stripper
  // ce header des requêtes suivantes — même si le client JS l'avait bien ajouté.
  // Solution : passer l'apikey AUSSI en paramètre URL.
  // Supabase supporte les deux : header ET param URL (cf. message d'erreur Kong :
  // "No 'apikey' request header or url param was found").
  const safeFetch: typeof fetch = async (input, init) => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    if (!rawUrl.includes("/rest/v1/")) {
      return fetch(input, init);
    }

    // Ajoute apikey en paramètre URL — contourne tout strip CORS sur les headers
    const urlObj = new URL(rawUrl);
    if (!urlObj.searchParams.has("apikey")) {
      urlObj.searchParams.set("apikey", supabaseAnonKey);
    }
    const finalUrl = urlObj.toString();

    return fetch(finalUrl, init);
  };

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { apikey: supabaseAnonKey },
      fetch: safeFetch,
    },
  });
}
