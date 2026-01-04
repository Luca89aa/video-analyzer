import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_VERSION = "DEBUG-V1";

export async function GET() {
  try {
    // ✅ FIX: await
    const supabase = await createServerSupabase();

    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated", routeVersion: ROUTE_VERSION },
        { status: 401, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    // esempio: leggi crediti (bypass RLS)
    const { data, error } = await supabaseAdmin
      .from("analisi_video")
      .select("credits, user_id, updated_at, created_at")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json(
      {
        success: true,
        routeVersion: ROUTE_VERSION,
        userId: user.id,
        credits: error ? null : data?.credits ?? null,
        row: error ? null : data,
        error: error ? error.message : null,
      },
      { status: 200, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Debug failed", details: err?.message || String(err), routeVersion: ROUTE_VERSION },
      { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  }
}
