import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = createServerSupabase();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("analisi_video")
      .select("credits")
      .eq("user_id", user.id)
      .single();

    if (error) {
      // qui è il tuo "Crediti non trovati"
      return NextResponse.json({ error: "Crediti non trovati", details: error.message }, { status: 404 });
    }

    return NextResponse.json({ credits: data.credits });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
