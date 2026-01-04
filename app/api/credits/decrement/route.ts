import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabase();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Utente non autenticato" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valore amount non valido" }, { status: 400 });
    }

    const { error: rpcErr } = await supabaseAdmin.rpc("decrease_credits", {
      uid: user.id,
      amount,
    });

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
