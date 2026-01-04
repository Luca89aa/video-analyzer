import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createServerSupabase() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,       // ✅ stessa URL del client
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,  // ✅ stessa anon key del client
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // ok in route handlers
          }
        },
      },
    }
  );
}
