import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_VERSION = "GET-SESSION-V2";

export async function GET() {
  const supabase = await createServerSupabase(); // ✅ IMPORTANT: await

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    return NextResponse.json(
      { token: null, error: error.message, routeVersion: ROUTE_VERSION },
      { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  }

  return NextResponse.json(
    { token: data?.session?.access_token ?? null, routeVersion: ROUTE_VERSION },
    { status: 200, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
  );
}
