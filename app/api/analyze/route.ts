import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_VERSION = "ANALYZE-REST-FILES-V5";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeMimeType(ct: string | null) {
  if (!ct) return "video/mp4";
  const clean = ct.split(";")[0].trim().toLowerCase();
  if (!clean.includes("/")) return "video/mp4";
  if (clean === "application/octet-stream") return "video/mp4";
  return clean;
}

async function filesStart(apiKey: string, size: number, mimeType: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(size),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      // ✅ camelCase per REST
      body: JSON.stringify({ file: { displayName: "VIDEO" } }),
    }
  );

  const uploadUrl = res.headers.get("x-goog-upload-url");
  if (!res.ok || !uploadUrl) {
    const t = await res.text().catch(() => "");
    throw new Error(`Files start failed: ${res.status} ${res.statusText} ${t}`);
  }

  return uploadUrl;
}

async function filesUploadFinalize(uploadUrl: string, buf: Buffer) {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(buf.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: buf,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.file?.name || !json?.file?.uri) {
    throw new Error(
      `Files upload failed: ${res.status} ${res.statusText} ${JSON.stringify(json)}`
    );
  }

  return {
    fileName: json.file.name as string, // "files/..."
    fileUri: json.file.uri as string, // "https://.../v1beta/files/..."
    mimeType: (json.file.mimeType as string | undefined) || undefined,
    state: (json.file.state as string | undefined) || undefined,
  };
}

async function filesGet(apiKey: string, fileName: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
  );
  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.file) {
    throw new Error(
      `files.get failed: ${res.status} ${res.statusText} ${JSON.stringify(json)}`
    );
  }

  return json.file as {
    name: string;
    uri: string;
    mimeType?: string;
    state?: string;
  };
}

async function geminiGenerate(
  apiKey: string,
  model: string,
  prompt: string,
  fileUri: string,
  mimeType: string
) {
  // ✅ camelCase richiesto dalla REST API
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { fileData: { fileUri, mimeType } },
          { text: prompt },
        ],
      },
    ],
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    // ✅ qui c’è l’errore VERO con dettagli
    throw new Error(`Gemini ${res.status}: ${JSON.stringify(json)}`);
  }

  return (
    json?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text)
      .filter(Boolean)
      .join("\n") || ""
  );
}

// ✅ GET 200: verifica facile routeVersion
export async function GET() {
  return NextResponse.json(
    { ok: true, routeVersion: ROUTE_VERSION },
    { status: 200, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
  );
}

export async function POST(req: Request) {
  console.log("✅ ANALYZE HIT", ROUTE_VERSION, new Date().toISOString());

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Missing GEMINI_API_KEY", routeVersion: ROUTE_VERSION },
      { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  }

  let userId: string | null = null;
  let creditScaled = false;

  const refund = async () => {
    if (!userId || !creditScaled) return;
    try {
      const { error } = await supabaseAdmin.rpc("decrease_credits", {
        uid: userId,
        amount: -1,
      });
      if (error) console.warn("REFUND RPC error:", error.message);
    } catch (e: any) {
      console.warn("REFUND exception:", e?.message || String(e));
    }
  };

  try {
    // 1) Auth via cookie/session
    const supabase = createServerSupabase();
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

    userId = user.id;

    // 2) Payload
    const body = await req.json().catch(() => ({}));
    const videoUrl: string | undefined = body?.videoUrl || body?.url;

    if (!videoUrl) {
      return NextResponse.json(
        { success: false, error: "Missing videoUrl", routeVersion: ROUTE_VERSION },
        { status: 400, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    console.log("ANALYZE videoUrl:", videoUrl);

    // 3) Scala 1 credito
    const { error: rpcErr } = await supabaseAdmin.rpc("decrease_credits", {
      uid: userId,
      amount: 1,
    });

    if (rpcErr) {
      const msg = (rpcErr.message || "").toLowerCase();
      if (msg.includes("esauriti") || msg.includes("nessun credito")) {
        return NextResponse.json(
          { success: false, error: "Crediti esauriti", redirect: "/pricing", routeVersion: ROUTE_VERSION },
          { status: 403, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
        );
      }

      return NextResponse.json(
        { success: false, error: rpcErr.message || "Credits error", routeVersion: ROUTE_VERSION },
        { status: 403, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    creditScaled = true;

    // 4) Scarica video
    const vidRes = await fetch(videoUrl, { cache: "no-store", redirect: "follow" });
    if (!vidRes.ok) {
      await refund();
      return NextResponse.json(
        { success: false, error: `Video fetch failed: ${vidRes.status} ${vidRes.statusText}`, routeVersion: ROUTE_VERSION },
        { status: 400, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    const rawCt = vidRes.headers.get("content-type");
    const mimeType = normalizeMimeType(rawCt);

    console.log("ANALYZE content-type:", rawCt);
    console.log("ANALYZE normalized mimeType:", mimeType);

    if (!mimeType.startsWith("video/")) {
      await refund();
      return NextResponse.json(
        {
          success: false,
          error: "URL non restituisce un video",
          details: `content-type=${rawCt || "null"}`,
          routeVersion: ROUTE_VERSION,
        },
        { status: 400, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    const ab = await vidRes.arrayBuffer();
    const buf = Buffer.from(ab);

    console.log("ANALYZE bytes:", buf.byteLength);

    // 5) Upload Files API
    const uploadUrl = await filesStart(GEMINI_API_KEY, buf.byteLength, mimeType);
    const uploaded = await filesUploadFinalize(uploadUrl, buf);

    console.log("ANALYZE uploaded fileName:", uploaded.fileName);
    console.log("ANALYZE uploaded fileUri:", uploaded.fileUri);
    console.log("ANALYZE uploaded mimeType:", uploaded.mimeType);

    // 6) Wait ACTIVE (video spesso PROCESSING)
    let file = await filesGet(GEMINI_API_KEY, uploaded.fileName);
    const start = Date.now();

    while (file.state === "PROCESSING" && Date.now() - start < 55_000) {
      console.log("ANALYZE file state:", file.state);
      await sleep(4000);
      file = await filesGet(GEMINI_API_KEY, uploaded.fileName);
    }

    if (file.state !== "ACTIVE") {
      await refund();
      return NextResponse.json(
        { success: false, error: "Video non pronto (Files API non ACTIVE)", details: file, routeVersion: ROUTE_VERSION },
        { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    const prompt = `
You are a TikTok video analyst.
Return:
1) 1-sentence summary
2) Key hook (first 2 seconds)
3) What to improve (3 bullet points)
4) Suggested caption (max 120 chars)
5) 10 hashtags
Write in Italian.
`.trim();

    try {
      const text = await geminiGenerate(
        GEMINI_API_KEY,
        "gemini-2.0-flash",
        prompt,
        file.uri,
        file.mimeType || mimeType
      );

      return NextResponse.json(
        { success: true, routeVersion: ROUTE_VERSION, text },
        { status: 200, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    } catch (e: any) {
      await refund();
      return NextResponse.json(
        { success: false, error: "Gemini error", details: e?.message || String(e), routeVersion: ROUTE_VERSION },
        { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }
  } catch (err: any) {
    await refund();
    console.error("ANALYZE ERROR:", err);
    return NextResponse.json(
      { success: false, error: "Analyze failed", details: err?.message || String(err), routeVersion: ROUTE_VERSION },
      { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  }
}
