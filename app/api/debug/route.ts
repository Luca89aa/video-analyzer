import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    // 1) check ENV (server-side)
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    // 2) auth via cookie
    const supabase = createServerSupabase();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    // 3) read credits via admin (bypass RLS)
    let creditsRow: any = null;
    let creditsErr: any = null;

    if (user?.id) {
      const { data, error } = await supabaseAdmin
        .from("analisi_video")
        .select("credits, email, user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      creditsRow = data ?? null;
      creditsErr = error ? { message: error.message, code: error.code } : null;
    }

    return NextResponse.json({
      ok: true,
      env,
      auth: {
        user: user ? { id: user.id, email: user.email } : null,
        error: authErr ? { message: authErr.message } : null,
      },
      credits: {
        row: creditsRow,
        error: creditsErr,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}
