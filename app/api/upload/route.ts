import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createServerSupabase } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_VERSION = "UPLOAD-V1";

function getBearerTokenFromHeader(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabase();

    // 1) Auth via cookie (prima scelta)
    const { data: cookieAuth } = await supabase.auth.getUser();
    let userId = cookieAuth?.user?.id ?? null;

    // 2) Fallback via Bearer token
    if (!userId) {
      const token = getBearerTokenFromHeader(req);
      if (!token) {
        return NextResponse.json(
          { success: false, error: "Not authenticated", routeVersion: ROUTE_VERSION },
          { status: 401, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
        );
      }

      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user?.id) {
        return NextResponse.json(
          { success: false, error: "Not authenticated", details: error?.message, routeVersion: ROUTE_VERSION },
          { status: 401, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
        );
      }

      userId = data.user.id;
    }

    // 3) FormData
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Missing file", routeVersion: ROUTE_VERSION },
        { status: 400, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    const contentType = (file.type || "video/mp4").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("video/")) {
      return NextResponse.json(
        { success: false, error: "File is not a video", details: `content-type=${contentType}`, routeVersion: ROUTE_VERSION },
        { status: 400, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    // 4) Env R2
    const R2_ENDPOINT = process.env.R2_ENDPOINT!;
    const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
    const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
    const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
    const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL!; // es: https://pub-xxxx.r2.dev oppure tuo dominio

    if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_BASE_URL) {
      return NextResponse.json(
        { success: false, error: "Missing R2 envs", routeVersion: ROUTE_VERSION },
        { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    const s3 = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    // 5) Upload bytes
    const ab = await file.arrayBuffer();
    const bytes = new Uint8Array(ab);

    const key = `videos/${userId}/${Date.now()}-${safeFilename(file.name || "video.mp4")}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: bytes as any,
        ContentType: contentType,
      })
    );

    const url = `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;

    return NextResponse.json(
      { success: true, routeVersion: ROUTE_VERSION, url },
      { status: 200, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Upload failed", details: err?.message || String(err), routeVersion: ROUTE_VERSION },
      { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  }
}
