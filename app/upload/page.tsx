"use client";

import React, { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

export default function UploadPage() {
  const [supabase, setSupabase] = useState<any>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // ✅ carica supabase client solo in browser
  useEffect(() => {
    import("@/lib/supabaseClient").then((m) => setSupabase(m.supabaseClient));
  }, []);

  async function getAccessToken() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  }

  // ✅ carica user + crediti
  async function refreshCredits(currentUserId?: string) {
    if (!supabase) return;

    const uid = currentUserId || userId;
    if (!uid) return;

    const { data, error } = await supabase
      .from("analisi_video")
      .select("credits")
      .eq("user_id", uid)
      .single();

    // se manca la riga, mostro 0 (ma NON blocco la pagina)
    setCredits(error ? 0 : (data?.credits ?? 0));
  }

  useEffect(() => {
    if (!supabase) return;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      // ✅ QUI: se non loggato -> vai a REGISTER (non login)
      if (!user) {
        window.location.href = "/auth/register";
        return;
      }

      setUserId(user.id);
      await refreshCredits(user.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // ✅ ANALYZE
  async function analyzeVideo(videoUrl: string) {
    const token = await getAccessToken();

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ videoUrl, accessToken: token }),
    });

    const data = await res.json().catch(() => ({}));

    if (data?.redirect) {
      window.location.href = data.redirect;
      return;
    }

    if (!data?.success) {
      alert(
        data?.error ||
          data?.details ||
          `Errore analisi (status ${res.status})`
      );
      await refreshCredits();
      return;
    }

    setAiResponse(data.text || "");
    await refreshCredits();
  }

  // ✅ UPLOAD
  async function handleUpload() {
    if (!file) return;

    if (credits !== null && credits <= 0) {
      window.location.href = "/pricing";
      return;
    }

    setLoading(true);
    setAiResponse("");

    try {
      const token = await getAccessToken();

      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        // ✅ IMPORTANTISSIMO: qui il token risolve i problemi tra domini/cookie
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: form,
      });

      const json = await res.json().catch(() => ({}));

      if (json?.redirect) {
        window.location.href = json.redirect;
        return;
      }

      if (!json?.success) {
        alert(
          json?.error ||
            json?.details ||
            `Upload error (status ${res.status})`
        );
        await refreshCredits();
        return;
      }

      if (typeof json.url === "string" && json.url.startsWith("http")) {
        await analyzeVideo(json.url);
      } else {
        alert("Upload ok ma URL mancante/non valido");
      }
    } finally {
      setLoading(false);
    }
  }

  if (credits === null || !supabase) {
    return <p style={{ color: "white" }}>Caricamento...</p>;
  }

  const noCredits = credits <= 0;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "white",
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>
        Carica un video
      </h1>

      <p style={{ opacity: 0.8, marginBottom: 18 }}>
        Crediti: <b>{credits}</b>
        {noCredits && (
          <>
            {" "}
            —{" "}
            <a href="/pricing" style={{ color: "#60a5fa" }}>
              Ricarica
            </a>
          </>
        )}
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{
            padding: 10,
            borderRadius: 10,
            border: "1px solid #374151",
            background: "#111827",
            color: "white",
            maxWidth: 420,
          }}
        />

        <button
          onClick={handleUpload}
          disabled={loading || !file || noCredits}
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            border: "none",
            background: "#2563eb",
            color: "white",
            fontWeight: 800,
            cursor:
              loading || !file || noCredits ? "not-allowed" : "pointer",
            opacity: loading || !file || noCredits ? 0.7 : 1,
          }}
        >
          {loading ? "Analisi..." : "Carica e analizza"}
        </button>
      </div>

      {aiResponse && (
        <pre
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            border: "1px solid #1f2937",
            background: "#0b1220",
            whiteSpace: "pre-wrap",
            lineHeight: 1.45,
          }}
        >
          {aiResponse}
        </pre>
      )}
    </main>
  );
}
