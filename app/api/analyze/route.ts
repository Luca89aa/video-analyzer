import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_VERSION = "ANALYZE-REST-FILES-V6";

// -------------------- utils --------------------
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

function safeJsonStringify(obj: any) {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

// -------------------- Gemini Files API --------------------
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
      // JSON mapping: displayName (camelCase)
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

async function filesUploadFinalize(uploadUrl: string, bytes: Uint8Array) {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    // ✅ TS-safe body (no Buffer)
    body: bytes,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.file?.name || !json?.file?.uri) {
    throw new Error(
      `Files upload failed: ${res.status} ${res.statusText} ${safeJsonStringify(json)}`
    );
  }

  return {
    fileName: json.file.name as string, // e.g. "files/abc123"
    fileUri: json.file.uri as string, // e.g. "https://.../v1beta/files/abc123"
    mimeType: (json.file.mimeType as string | undefined) || undefined,
    state: (json.file.state as string | undefined) || undefined,
  };
}

async function filesGet(apiKey: string, fileName: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`,
    { cache: "no-store" }
  );
  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.file) {
    throw new Error(
      `files.get failed: ${res.status} ${res.statusText} ${safeJsonStringify(json)}`
    );
  }

  return json.file as { name: string; uri: string; mimeType?: string; state?: string };
}

// -------------------- Gemini generateContent (REST) --------------------
async function geminiGenerate(
  apiKey: string,
  model: string,
  prompt: string,
  fileUri: string,
  mimeType: string
) {
  // ✅ JSON mapping: fileData { fileUri, mimeType }
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
    // ritorna l'errore "vero" (message, details, ecc.)
    throw new Error(`Gemini ${res.status}: ${safeJsonStringify(json)}`);
  }

  const text =
    json?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text)
      .filter(Boolean)
      .join("\n") || "";

  return text;
}

// -------------------- route --------------------
// GET 200 per verificare subito che stai colpendo questa route (niente 405/HTML)
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
    const { error } = await supabaseAdmin.rpc("decrease_credits", { uid: userId, amount: -1 });
    if (error) console.error("⚠️ REFUND RPC ERROR:", error);
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

    console.log("ANALYZE content-type:", rawCt);
    console.log("ANALYZE normalized mimeType:", mimeType);

    // se arriva HTML/JSON mascherato, fermiamo subito
    if (!mimeType.startsWith("video/")) {
      const snippet = await vidRes.text().catch(() => "");
      await refund();
      return NextResponse.json(
        {
          success: false,
          error: "URL non restituisce un video",
          details: { contentType: rawCt, bodySnippet: snippet.slice(0, 300) },
          routeVersion: ROUTE_VERSION,
        },
        { status: 400, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    const ab = await vidRes.arrayBuffer();
    const bytes = new Uint8Array(ab);

    console.log("ANALYZE bytes:", bytes.byteLength);

    // 5) Upload Files API
    const uploadUrl = await filesStart(GEMINI_API_KEY, bytes.byteLength, mimeType);
    const uploaded = await filesUploadFinalize(uploadUrl, bytes);

    console.log("ANALYZE uploaded:", uploaded);

    // 6) Attendi ACTIVE (video spesso PROCESSING)
    let file = await filesGet(GEMINI_API_KEY, uploaded.fileName);
    const started = Date.now();

    while (file.state === "PROCESSING" && Date.now() - started < 55_000) {
      console.log("ANALYZE file state:", file.state);
      await sleep(3000);
      file = await filesGet(GEMINI_API_KEY, uploaded.fileName);
    }

    console.log("ANALYZE file final state:", file.state);

    if (file.state !== "ACTIVE") {
      await refund();
      return NextResponse.json(
        {
          success: false,
          error: "Video non pronto (Files API non ACTIVE)",
          details: file,
          routeVersion: ROUTE_VERSION,
        },
        { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    // 7) Prompt + generate (con fallback automatico)
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

    const fileUri = file.uri;
    const fileMime = file.mimeType || mimeType;

    try {
      // prima prova 2.0
      let text = await geminiGenerate(GEMINI_API_KEY, "gemini-2.0-flash", prompt, fileUri, fileMime);

      // se dovesse tornare vuoto (capita raramente), riprova 1.5
      if (!text?.trim()) {
        console.log("ANALYZE empty response from 2.0, retrying 1.5-flash");
        text = await geminiGenerate(GEMINI_API_KEY, "gemini-1.5-flash", prompt, fileUri, fileMime);
      }

      return NextResponse.json(
        { success: true, routeVersion: ROUTE_VERSION, text },
        { status: 200, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    } catch (e2: any) {
      // se 2.0 fallisce, prova 1.5-flash prima di rimborsare
      const firstErr = e2?.message || String(e2);
      console.error("ANALYZE Gemini 2.0 error:", firstErr);

      try {
        const text = await geminiGenerate(GEMINI_API_KEY, "gemini-1.5-flash", prompt, fileUri, fileMime);

        return NextResponse.json(
          { success: true, routeVersion: ROUTE_VERSION, text, note: "fallback gemini-1.5-flash" },
          { status: 200, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
        );
      } catch (e3: any) {
        await refund();
        const secondErr = e3?.message || String(e3);
        console.error("ANALYZE Gemini 1.5 error:", secondErr);

        return NextResponse.json(
          {
            success: false,
            error: "Gemini error",
            details: { gemini2: firstErr, gemini15: secondErr },
            routeVersion: ROUTE_VERSION,
          },
          { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
        );
      }
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
