import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ROUTE_VERSION = "ANALYZE-GENAI-V1";

// ---------- utils ----------
function normalizeMimeType(ct: string | null) {
  if (!ct) return "video/mp4";
  const clean = ct.split(";")[0].trim().toLowerCase();

  // spesso r2/s3 torna octet-stream -> meglio mp4
  if (clean === "application/octet-stream") return "video/mp4";

  // se è html/json, NON è un video
  if (clean.includes("text/html")) return "text/html";
  if (clean.includes("application/json")) return "application/json";

  // deve contenere "/"
  if (!clean.includes("/")) return "video/mp4";

  return clean;
}

function guessVideoMimeFromUrl(url: string) {
  const u = url.toLowerCase();
  if (u.includes(".webm")) return "video/webm";
  if (u.includes(".mov")) return "video/quicktime";
  if (u.includes(".m4v")) return "video/x-m4v";
  return "video/mp4";
}

function safePreview(buf: Buffer) {
  // preview ASCII per capire se è HTML/JSON
  const txt = buf.toString("utf8", 0, Math.min(buf.length, 200));
  return txt.replace(/\s+/g, " ").slice(0, 200);
}

// ---------- health GET ----------
export async function GET() {
  return NextResponse.json(
    { ok: true, routeVersion: ROUTE_VERSION },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "x-route-version": ROUTE_VERSION,
      },
    }
  );
}

// ---------- main ----------
export async function POST(req: Request) {
  console.log("✅ ANALYZE HIT", ROUTE_VERSION, new Date().toISOString());

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Missing GEMINI_API_KEY", routeVersion: ROUTE_VERSION },
      { status: 500 }
    );
  }

  let userId: string | null = null;
  let creditScaled = false;

  const refund = async () => {
    if (!userId || !creditScaled) return;
    // decrease_credits: credits = credits - amount → amount note: -1 = +1 credito
    await supabaseAdmin.rpc("decrease_credits", { uid: userId, amount: -1 }).catch(() => null);
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
        { status: 401 }
      );
    }
    userId = user.id;

    // 2) Payload
    const body = await req.json().catch(() => ({}));
    const videoUrl: string | undefined = body?.videoUrl || body?.url;

    if (!videoUrl) {
      return NextResponse.json(
        { success: false, error: "Missing videoUrl", routeVersion: ROUTE_VERSION },
        { status: 400 }
      );
    }

    console.log("ANALYZE videoUrl:", videoUrl);

    // 3) Scala 1 credito (prima dell’analisi)
    const { error: rpcErr } = await supabaseAdmin.rpc("decrease_credits", {
      uid: userId,
      amount: 1,
    });

    if (rpcErr) {
      const msg = (rpcErr.message || "").toLowerCase();
      if (msg.includes("esauriti") || msg.includes("nessun credito")) {
        return NextResponse.json(
          { success: false, error: "Crediti esauriti", redirect: "/pricing", routeVersion: ROUTE_VERSION },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { success: false, error: rpcErr.message || "Credits error", routeVersion: ROUTE_VERSION },
        { status: 403 }
      );
    }

    creditScaled = true;

    // 4) Scarica video (IMPORTANTISSIMO: su Vercel può tornare HTML/403/404)
    const vidRes = await fetch(videoUrl, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        // aiuta alcuni bucket/CDN
        "User-Agent": "video-analyzer/1.0",
        Accept: "video/*,*/*;q=0.8",
      },
    });

    console.log("ANALYZE fetch status:", vidRes.status, vidRes.statusText);

    if (!vidRes.ok) {
      await refund();
      return NextResponse.json(
        {
          success: false,
          error: `Video fetch failed: ${vidRes.status} ${vidRes.statusText}`,
          routeVersion: ROUTE_VERSION,
        },
        { status: 400 }
      );
    }

    const rawCt = vidRes.headers.get("content-type");
    const ct = normalizeMimeType(rawCt);

    console.log("ANALYZE content-type:", rawCt);
    console.log("ANALYZE normalized:", ct);

    const ab = await vidRes.arrayBuffer();
    const buf = Buffer.from(ab);

    console.log("ANALYZE bytes:", buf.byteLength);

    // 🔥 guardrail: se è HTML/JSON, stai scaricando una pagina, non il video
    if (ct === "text/html" || ct === "application/json") {
      await refund();
      return NextResponse.json(
        {
          success: false,
          error: "URL non restituisce un file video (torna HTML/JSON)",
          details: { contentType: rawCt, preview: safePreview(buf) },
          routeVersion: ROUTE_VERSION,
        },
        { status: 400 }
      );
    }

    // se content-type non è video/* ma sembra un mp4, proviamo lo stesso con fallback
    let mimeType = ct;
    if (!mimeType.startsWith("video/")) {
      mimeType = guessVideoMimeFromUrl(videoUrl);
      console.log("ANALYZE mimeType fallback:", mimeType);
    }

    // hard limit: evita request troppo grandi a Gemini
    const MAX_VIDEO_BYTES = 18 * 1024 * 1024; // 18MB
    if (buf.byteLength > MAX_VIDEO_BYTES) {
      await refund();
      return NextResponse.json(
        {
          success: false,
          error: "Video troppo grande per l’analisi (max ~18MB). Riduci durata/risoluzione.",
          details: { bytes: buf.byteLength },
          routeVersion: ROUTE_VERSION,
        },
        { status: 400 }
      );
    }

    // 5) Gemini multimodal (come in locale)
    const base64Video = buf.toString("base64");

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
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Video,
            mimeType,
          },
        },
        { text: prompt },
      ]);

      const text = result.response.text();

      return NextResponse.json(
        { success: true, routeVersion: ROUTE_VERSION, mimeType, bytes: buf.byteLength, text },
        { status: 200, headers: { "Cache-Control": "no-store", "x-route-version": ROUTE_VERSION } }
      );
    } catch (e: any) {
      await refund();
      console.error("GEMINI ERROR:", e?.message || e);

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
