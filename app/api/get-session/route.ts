import { createServerSupabase } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = createServerSupabase();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return Response.json({ token: null, error: error.message }, { status: 500 });
  }

  return Response.json({
    token: data?.session?.access_token || null
  });
}
