import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabase();

    // 1️⃣ Recupera user autenticato dai cookie
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: "Utente non autenticato" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // 2️⃣ Leggi quanti crediti scalare
    const { amount } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valore amount non valido" },
        { status: 400 }
      );
    }

    // 3️⃣ Esegui la funzione RPC decrease_credits
    const { error: rpcErr } = await supabaseAdmin.rpc("decrease_credits", {
      amount,
      uid: userId,
    });

    if (rpcErr) {
      return NextResponse.json(
        { error: rpcErr.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
