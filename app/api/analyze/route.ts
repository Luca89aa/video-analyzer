import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_VERSION = "ANALYZE-REST-FILES-V9";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeMimeType(ct: string | null) {
  if (!ct) return "video/mp4";
  const clean = ct.split(";")[0].trim().toLowerCase();
  if (clean === "application/octet-stream") return "video/mp4";
  if (!clean.includes("/")) return "video/mp4";
  return clean;
}

function getBearerTokenFromHeader(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

/**
 * Files API - start resumable upload
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
    // TS-safe on Vercel
    body: bytes as unknown as BodyInit,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.file?.name || !json?.file?.uri) {
    throw new Error(`Files upload failed: ${res.status} ${res.statusText} ${JSON.stringify(json)}`);
  }

  return {
    fileName: json.file.name as string,
    fileUri: json.file.uri as string,
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
 * generateContent con file_data (snake_case)
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
        parts: [{ file_data: { mime_type: mimeType, file_uri: fileUri } }, { text: prompt }],
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
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") || ""
  );
}

/**
 * Inline video con inline_data (snake_case)
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
        parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: prompt }],
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
    json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") || ""
  );
}

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

  const body = await req.json().catch(() => ({}));
  const videoUrl: string | undefined = body?.videoUrl || body?.url;
  const bodyToken: string | undefined = body?.accessToken || body?.token;

  if (!videoUrl) {
    return NextResponse.json(
      { success: false, error: "Missing videoUrl", routeVersion: ROUTE_VERSION },
      { status: 400, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  }

  let userId: string | null = null;
  let creditScaled = false;

  const refund = async () => {
    if (!userId || !creditScaled) return;
    try {
      await supabaseAdmin.rpc("decrease_credits", { uid: userId, amount: -1 });
    } catch {}
  };

  try {
    // 1) cookie auth
    const supabase = await createServerSupabase();
    const { data: cookieAuth } = await supabase.auth.getUser();
    if (cookieAuth?.user?.id) userId = cookieAuth.user.id;

    // 2) bearer/header/body token fallback
    if (!userId) {
      const headerToken = getBearerTokenFromHeader(req);
      const token = headerToken || bodyToken || null;

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

    // 3) scala 1 credito
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

    // 4) scarica video
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

    if (!mimeType.startsWith("video/")) {
      await refund();
      return NextResponse.json(
        { success: false, error: "URL non restituisce un video", details: `content-type=${rawCt || "null"}`, routeVersion: ROUTE_VERSION },
        { status: 400, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    }

    const ab = await vidRes.arrayBuffer();
    const bytes = new Uint8Array(ab);

    // ✅ PROMPT AGGIORNATO (solo questa parte è cambiata)
    const prompt = `
Sei un TikTok strategist senior. Analizza il video fornito e produci un report pratico per migliorare performance (retenzione, completamento, conversione).
Scrivi in italiano. Niente premesse, niente spiegazioni generiche.

Rispondi ESATTAMENTE in questo formato:

TITOLO: (max 8 parole)
ANALISI BREVE: (2-3 frasi su cosa succede e che “promessa” comunica)
HOOK (0-2s): (descrivi il gancio attuale + una versione migliore in 1 frase)
BODY (sviluppo): (cosa funziona nella parte centrale + come migliorare ritmo/struttura, 3 punti)
CTA: (CTA attuale o mancante + 2 alternative migliori, brevi)
COSA FUNZIONA: (3 bullet)
COSA CAMBIARE: (3 bullet, modifiche specifiche e applicabili)
CAPTION: (una sola caption, max 120 caratteri, senza emoji)
HASHTAGS: (5 hashtag, separati da spazio)

Nota: se mancano elementi nel video, dillo nella sezione corretta e proponi la soluzione.
`.trim();

    const model = "gemini-2.0-flash";
    const INLINE_LIMIT = 18 * 1024 * 1024;

    let text = "";

    try {
      if (bytes.byteLength <= INLINE_LIMIT) {
        const base64 = Buffer.from(bytes).toString("base64");
        text = await geminiGenerateInline(GEMINI_API_KEY, model, prompt, base64, mimeType);
      } else {
        const uploadUrl = await filesStart(GEMINI_API_KEY, bytes.byteLength, mimeType);
        const uploaded = await filesUploadFinalize(uploadUrl, bytes);

        let file = await filesGet(GEMINI_API_KEY, uploaded.fileName);
        const start = Date.now();

        while (file.state === "PROCESSING" && Date.now() - start < 55_000) {
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

        text = await geminiGenerateWithFile(GEMINI_API_KEY, model, prompt, file.uri, file.mimeType || mimeType);
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
    console.error("ANALYZE ERROR:", err);
    return NextResponse.json(
      { success: false, error: "Analyze failed", details: err?.message || String(err), routeVersion: ROUTE_VERSION },
      { status: 500, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
    );
  }
}
