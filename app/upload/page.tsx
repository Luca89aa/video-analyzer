"use client";

import React, { useState, useEffect } from "react";

// 🔴 BLOCCA PRERENDER
export const dynamic = "force-dynamic";

export default function UploadPage() {
  const [supabase, setSupabase] = useState<any>(null);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // ✅ CARICA SUPABASE SOLO IN BROWSER
  useEffect(() => {
    import("@/lib/supabaseClient").then((m) => {
      setSupabase(m.supabaseClient);
    });
  }, []);

  // 🔥 RECUPERO UTENTE + CREDITI
  useEffect(() => {
    if (!supabase) return;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/auth/login";
        return;
      }

      setEmail(user.email ?? null);
      setUserId(user.id);

      const { data, error } = await supabase
        .from("analisi_video")
        .select("credits")
        .eq("user_id", user.id)
        .single();

      if (!error) {
        setCredits(data?.credits ?? 0);
      }
    }

    loadUser();
  }, [supabase]);

  // 🚀 ANALISI VIDEO
  async function analyzeVideo(url: string) {
    if (!userId) return;

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, user_id: userId }),
    });

    const data = await res.json();
    if (!data.success) {
      alert(data.error);
      return;
    }

    setAiResponse(data.text);

    const { data: updated } = await supabase
      .from("analisi_video")
      .select("credits")
      .eq("user_id", userId)
      .single();

    setCredits(updated?.credits ?? 0);
  }

  // 📤 UPLOAD
  async function handleUpload() {
    if (!file || !email || !userId) return;

    if (credits === 0) {
      window.location.href = "/pricing";
      return;
    }

    setLoading(true);
    setAiResponse("");

    const form = new FormData();
    form.append("file", file);
    form.append("email", email);
    form.append("user_id", userId);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: form,
    });

    const json = await res.json();

    if (json.success && json.url) {
      await analyzeVideo(json.url);
    } else {
      alert(json.error);
    }

    setLoading(false);
  }

  if (credits === null || !supabase) {
    return <p style={{ color: "white" }}>Caricamento...</p>;
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0d1117", color: "white" }}>
      <h1>Carica un video</h1>
      <p>Crediti: {credits}</p>

      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Analisi..." : "Carica e analizza"}
      </button>

      {aiResponse && <pre>{aiResponse}</pre>}
    </main>
  );
}
