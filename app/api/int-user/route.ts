import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { user_id, email } = (await req.json()) as {
      user_id?: string;
      email?: string;
    };

    if (!user_id || !email) {
      return Response.json(
        { success: false, error: "user_id/email mancanti" },
        { status: 400 }
      );
    }

    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return Response.json(
        {
          success: false,
          error: "Missing env vars",
          details: [
            !SUPABASE_URL ? "SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)" : null,
            !SERVICE_ROLE ? "SUPABASE_SERVICE_ROLE_KEY" : null,
          ].filter(Boolean),
        },
        { status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // crea (o assicura) riga crediti
    const { error } = await supabase
      .from("analisi_video")
      .upsert({ user_id, email, credits: 1 }, { onConflict: "user_id" });

    if (error) {
      return Response.json(
        { success: false, error: "upsert fallito", details: error.message },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (e: any) {
    return Response.json(
      {
        success: false,
        error: "init-user error",
        details: e?.message || String(e),
      },
      { status: 500 }
    );
  }
}
