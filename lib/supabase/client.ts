import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises.",
    );
  }

  // Intercepteur fetch : reconstruit les headers proprement pour éviter
  // tout strip lié au service worker, CORS preflight caché ou autre middleware.
  const safeFetch: typeof fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;

    if (!url.includes("/rest/v1/")) {
      return fetch(input, init);
    }

    // Reconstruction explicite des headers depuis toutes les sources possibles
    const newHeaders = new Headers();

    // 1. Headers depuis un éventuel Request object (input)
    if (input instanceof Request) {
      input.headers.forEach((value, key) => newHeaders.set(key, value));
    }

    // 2. Headers depuis init (écrasent ceux du Request si doublon)
    const raw = init?.headers;
    if (raw instanceof Headers) {
      raw.forEach((value, key) => newHeaders.set(key, value));
    } else if (Array.isArray(raw)) {
      (raw as string[][]).forEach(([k, v]) => newHeaders.set(k, v));
    } else if (raw) {
      Object.entries(raw as Record<string, string>).forEach(([k, v]) =>
        newHeaders.set(k, v),
      );
    }

    // 3. Garantit apikey même si le client l'avait omis
    if (!newHeaders.has("apikey")) {
      newHeaders.set("apikey", supabaseAnonKey);
      console.warn(
        "[SupabaseFetch] apikey manquant → injecté",
        url.replace(supabaseUrl, "").slice(0, 80),
      );
    } else {
      console.log(
        "[SupabaseFetch] ✓",
        url.replace(supabaseUrl, "").slice(0, 80),
      );
    }

    return fetch(url, { ...init, headers: newHeaders, mode: "cors" });
  };

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { apikey: supabaseAnonKey },
      fetch: safeFetch,
    },
  });
}
