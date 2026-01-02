import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = createServerSupabase();

    // 1️⃣ Recupera utente autenticato dai cookie
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // 2️⃣ Legge i crediti dalla tabella corretta
    const { data, error } = await supabase
      .from("analisi_video")
      .select("credits")
      .eq("user_id", userId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ credits: data.credits });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
