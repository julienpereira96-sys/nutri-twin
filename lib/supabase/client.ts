import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requises.",
    );
  }

  // Diagnostic temporaire — log chaque requête REST pour voir si apikey est présent
  const debugFetch: typeof fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    if (url.includes("/rest/v1/")) {
      const raw = init?.headers;
      let apikey = "";
      if (raw instanceof Headers) {
        apikey = raw.get("apikey") ?? "";
      } else if (Array.isArray(raw)) {
        apikey =
          (
            (raw as string[][]).find(
              (h) => h[0]?.toLowerCase() === "apikey",
            ) ?? ["", ""]
          )[1] ?? "";
      } else if (raw) {
        apikey = (raw as Record<string, string>)["apikey"] ?? "";
      }
      console.log("[SupabaseFetch]", {
        endpoint: url.replace(supabaseUrl, "").slice(0, 90),
        apikey: apikey ? `✓ (${apikey.length}c)` : "❌ ABSENT",
      });
    }
    return fetch(input, init);
  };

  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    // global.headers garantit que apikey est toujours présent même en cas de bug @supabase/ssr
    global: {
      headers: { apikey: supabaseAnonKey },
      fetch: debugFetch,
    },
  });
}
