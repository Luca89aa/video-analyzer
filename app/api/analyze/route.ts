import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { createServerSupabase } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_VERSION = "UPLOAD-R2-V2";

function getBearerTokenFromHeader(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function safeFilename(name: string) {
  return (name || "video.mp4").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function pickEnv(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.trim()) return v.trim();
  }
  return "";
}

export async function GET() {
  return NextResponse.json(
    { ok: true, routeVersion: ROUTE_VERSION },
    {
      status: 200,
      headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION },
    }
  );
}

export async function POST(req: Request) {
  try {
    // 1) Auth: cookie -> Bearer
    const supabase = createServerSupabase();
    const { data: cookieAuth } = await supabase.auth.getUser();
    let userId = cookieAuth?.user?.id ?? null;

    if (!userId) {
      const token = getBearerTokenFromHeader(req);
      if (!token) {
        return NextResponse.json(
          { success: false, error: "Not authenticated", routeVersion: ROUTE_VERSION },
          {
            status: 401,
            headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION },
          }
        );
      }

      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user?.id) {
        return NextResponse.json(
          { success: false, error: "Not authenticated", details: error?.message, routeVersion: ROUTE_VERSION },
          {
            status: 401,
            headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION },
          }
        );
      }
      userId = data.user.id;
    }

    // 2) FormData
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Missing file", routeVersion: ROUTE_VERSION },
        {
          status: 400,
          headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION },
        }
      );
    }

    const contentType = (file.type || "video/mp4").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("video/")) {
      return NextResponse.json(
        {
          success: false,
          error: "File is not a video",
          details: `content-type=${contentType}`,
          routeVersion: ROUTE_VERSION,
        },
        {
          status: 400,
          headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION },
        }
      );
    }

    // 3) Env R2
    const R2_ENDPOINT = pickEnv("R2_ENDPOINT");
    const R2_ACCESS_KEY_ID = pickEnv("R2_ACCESS_KEY_ID");
    const R2_SECRET_ACCESS_KEY = pickEnv("R2_SECRET_ACCESS_KEY");
    const R2_BUCKET_NAME = pickEnv("R2_BUCKET_NAME");

    // ✅ dal pannello Cloudflare: "Public Development URL"
    const R2_PUBLIC_BASE_URL = pickEnv("R2_PUBLIC_BASE_URL", "R2_PUBLIC_URL", "R2_PUBLIC_DOMAIN");

    const missing: string[] = [];
    if (!R2_ENDPOINT) missing.push("R2_ENDPOINT");
    if (!R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
    if (!R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
    if (!R2_BUCKET_NAME) missing.push("R2_BUCKET_NAME");
    if (!R2_PUBLIC_BASE_URL) missing.push("R2_PUBLIC_BASE_URL (or R2_PUBLIC_URL/R2_PUBLIC_DOMAIN)");

    if (missing.length) {
      return NextResponse.json(
        { success: false, error: "Missing R2 envs", missing, routeVersion: ROUTE_VERSION },
        {
          status: 500,
          headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION },
        }
      );
    }

    // 4) Upload R2
    const s3 = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const ab = await file.arrayBuffer();

    // ✅ TS-safe Body per PutObjectCommand su Vercel/Next
    const body = Buffer.from(ab);

    const key = `videos/${userId}/${Date.now()}-${randomUUID()}-${safeFilename(file.name)}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
        // opzionale ma utile:
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const base = R2_PUBLIC_BASE_URL.replace(/\/$/, "");
    const url = `${base}/${key}`;

    return NextResponse.json(
      { success: true, routeVersion: ROUTE_VERSION, url },
      {
        status: 200,
        headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: "Upload failed", details: err?.message || String(err), routeVersion: ROUTE_VERSION },
      {
        status: 500,
        headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION },
      }
    );
  }
}
