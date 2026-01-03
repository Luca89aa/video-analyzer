import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json(
    { ok: true, routeVersion: "SENTINEL-ANALYZE-V999" },
    { status: 200, headers: { "Cache-Control": "no-store", "x-route-version": "SENTINEL-ANALYZE-V999" } }
  );
}

export async function POST() {
  return NextResponse.json(
    { ok: false, routeVersion: "SENTINEL-ANALYZE-V999", note: "If you don't see this, you're NOT hitting this file." },
    { status: 418, headers: { "Cache-Control": "no-store", "x-route-version": "SENTINEL-ANALYZE-V999" } }
  );
}
