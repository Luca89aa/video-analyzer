import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_VERSION = "CREDITS-GET-V1";

export async function GET() {
  try {
    const supabase = await createServerSupabase(); // ✅ FIX: await
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated", routeVersion: ROUTE_VERSION },
        { status: 401, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    const { data, error } = await supabase
      .from("analisi_video")
      .select("credits")
      .eq("user_id", user.id)
      .single();

    if (error) {
      return NextResponse.json(
        { success: true, credits: 0, routeVersion: ROUTE_VERSION },
        { status: 200, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    return NextResponse.json(
      { success: true, credits: data?.credits ?? 0, routeVersion: ROUTE_VERSION },
      { status: 200, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Credits get failed", details: err?.message || String(err), routeVersion: ROUTE_VERSION },
      { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  }
}
