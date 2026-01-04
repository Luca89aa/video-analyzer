import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_VERSION = "ANALYZE-REST-FILES-V7";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeMimeType(ct: string | null) {
  if (!ct) return "video/mp4";
  const clean = ct.split(";")[0].trim().toLowerCase();

  // a volte arriva "application/octet-stream" da storage/CDN
  if (clean === "application/octet-stream") return "video/mp4";

  // se non è un mime valido, fallback
  if (!clean.includes("/")) return "video/mp4";

  return clean;
}

/**
 * Start resumable upload (Files API)
 * REST doc usa display_name e x-goog-api-key header
 */
async function filesStart(apiKey: string, size: number, mimeType: string) {
  const res = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(size),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "VIDEO" } }),
  });

  const uploadUrl = res.headers.get("x-goog-upload-url");
  if (!res.ok || !uploadUrl) {
    const t = await res.text().catch(() => "");
    throw new Error(`Files start failed: ${res.status} ${res.statusText} ${t}`);
  }

  return uploadUrl;
}

async function filesUploadFinalize(uploadUrl: string, bytes: Uint8Array) {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    // TS su Vercel può lamentarsi: cast esplicito
    body: bytes as any,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.file?.name || !json?.file?.uri) {
    throw new Error(
      `Files upload failed: ${res.status} ${res.statusText} ${JSON.stringify(json)}`
    );
  }

  return {
    fileName: json.file.name as string, // "files/..."
    fileUri: json.file.uri as string,   // "https://.../v1beta/files/..."
    mimeType: (json.file.mimeType as string | undefined) || undefined,
    state: (json.file.state as string | undefined) || undefined,
  };
}

async function filesGet(apiKey: string, fileName: string) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}`, {
    headers: { "x-goog-api-key": apiKey },
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.file) {
    throw new Error(`files.get failed: ${res.status} ${res.statusText} ${JSON.stringify(json)}`);
  }

  return json.file as { name: string; uri: string; mimeType?: string; state?: string };
}

/**
 * generateContent (REST) con file_data in snake_case
 * (La doc raccomanda: video part prima del testo)
 */
async function geminiGenerateWithFile(
  apiKey: string,
  model: string,
  prompt: string,
  fileUri: string,
  mimeType: string
) {
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { file_data: { mime_type: mimeType, file_uri: fileUri } },
          { text: prompt },
        ],
      },
    ],
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    // questo è il motivo vero, non “invalid argument” generico
    throw new Error(`Gemini ${res.status}: ${JSON.stringify(json)}`);
  }

  return (
    json?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text)
      .filter(Boolean)
      .join("\n") || ""
  );
}

/**
 * Inline video (<20MB) - REST usa inline_data in snake_case
 */
async function geminiGenerateInline(
  apiKey: string,
  model: string,
  prompt: string,
  base64: string,
  mimeType: string
) {
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: prompt },
        ],
      },
    ],
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(json)}`);

  return (
    json?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text)
      .filter(Boolean)
      .join("\n") || ""
  );
}

// GET 200 per verificare che stai hit-tando la route giusta
export async function GET() {
  return NextResponse.json(
    { ok: true, routeVersion: ROUTE_VERSION },
    { status: 200, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
  );
}

export async function POST(req: Request) {
  // log impossibile da perdere
  // eslint-disable-next-line no-console
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
      await supabaseAdmin.rpc("decrease_credits", { uid: userId, amount: -1 });
    } catch {
      // niente
    }
  };

  try {
    // 1) Auth: prima cookie (server supabase), poi fallback Bearer token
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id) {
      userId = user.id;
    } else {
      const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

      if (!token) {
        return NextResponse.json(
          { success: false, error: "Not authenticated", routeVersion: ROUTE_VERSION },
          { status: 401, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
        );
      }

      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user) {
        return NextResponse.json(
          { success: false, error: "Not authenticated", details: error?.message, routeVersion: ROUTE_VERSION },
          { status: 401, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
        );
      }

      userId = data.user.id;
    }

    // 2) Payload
    const body = await req.json().catch(() => ({}));
    const videoUrl: string | undefined = body?.videoUrl || body?.url;
    if (!videoUrl) {
      return NextResponse.json(
        { success: false, error: "Missing videoUrl", routeVersion: ROUTE_VERSION },
        { status: 400, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    // eslint-disable-next-line no-console
    console.log("ANALYZE videoUrl:", videoUrl);

    // 3) Scala 1 credito
    const { error: rpcErr } = await supabaseAdmin.rpc("decrease_credits", { uid: userId, amount: 1 });
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

    // 4) Scarica video dal link pubblico
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

    // eslint-disable-next-line no-console
    console.log("ANALYZE content-type:", rawCt);
    // eslint-disable-next-line no-console
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
    const bytes = new Uint8Array(ab);

    // eslint-disable-next-line no-console
    console.log("ANALYZE video bytes:", bytes.byteLength);

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

    const model = "gemini-2.0-flash";

    try {
      // Inline sotto ~20MB, altrimenti Files API
      // (La doc consiglia Files API per video > 20MB o più lunghi) :contentReference[oaicite:1]{index=1}
      const INLINE_LIMIT = 18 * 1024 * 1024;

      let text = "";

      if (bytes.byteLength <= INLINE_LIMIT) {
        const base64 = Buffer.from(bytes).toString("base64");
        text = await geminiGenerateInline(GEMINI_API_KEY, model, prompt, base64, mimeType);
      } else {
        const uploadUrl = await filesStart(GEMINI_API_KEY, bytes.byteLength, mimeType);
        const uploaded = await filesUploadFinalize(uploadUrl, bytes);

        // eslint-disable-next-line no-console
        console.log("ANALYZE uploaded file:", uploaded);

        // Wait ACTIVE (video spesso resta PROCESSING)
        let file = await filesGet(GEMINI_API_KEY, uploaded.fileName);
        const start = Date.now();

        while (file.state === "PROCESSING" && Date.now() - start < 55_000) {
          // eslint-disable-next-line no-console
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

        text = await geminiGenerateWithFile(
          GEMINI_API_KEY,
          model,
          prompt,
          file.uri,
          file.mimeType || mimeType
        );
      }

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
    // eslint-disable-next-line no-console
    console.error("ANALYZE ERROR:", err);

    return NextResponse.json(
      { success: false, error: "Analyze failed", details: err?.message || String(err), routeVersion: ROUTE_VERSION },
      { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  }
}
