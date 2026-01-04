import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createServerSupabase() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In alcuni contesti Next non permette set sui cookies (readonly).
        // Non deve rompere la route: per quello try/catch.
        try {
          for (const { name, value, options } of cookiesToSet) {
            (cookieStore as any).set(name, value, options);
          }
        } catch {
          // ignore
        }
      },
    },
  });
}
