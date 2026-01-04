import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_VERSION = "CREDITS-DECREMENT-V1";

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase(); // ✅ FIX: await
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: "Utente non autenticato", routeVersion: ROUTE_VERSION },
        { status: 401, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const amount = typeof body?.amount === "number" ? body.amount : 1;

    const { error: rpcErr } = await supabaseAdmin.rpc("decrease_credits", { uid: user.id, amount });
    if (rpcErr) {
      return NextResponse.json(
        { success: false, error: rpcErr.message || "Credits error", routeVersion: ROUTE_VERSION },
        { status: 400, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    return NextResponse.json(
      { success: true, routeVersion: ROUTE_VERSION },
      { status: 200, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Decrement failed", details: err?.message || String(err), routeVersion: ROUTE_VERSION },
      { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  }
}
