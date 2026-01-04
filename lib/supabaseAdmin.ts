import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,       // ✅ stessa URL del client
  process.env.SUPABASE_SERVICE_ROLE_KEY!,      // ✅ service role dello STESSO progetto
  {
    auth: { persistSession: false },
  }
);
