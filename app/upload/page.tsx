"use client";

import React, { useState, useEffect } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export default function UploadPage() {
  const supabase = supabaseClient;

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<string>("");
  const [credits, setCredits] = useState<number | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // 🔥 RECUPERO UTENTE + CREDITI
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/auth/login";
        return;
      }

      setEmail(user.email);
      setUserId(user.id);

      const { data, error } = await supabase
        .from("analisi_video")
        .select("credits")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Errore caricamento crediti:", error);
        return;
      }

      setCredits(data?.credits ?? 0);
    }

    loadUser();
  }, []);

  // 🔥 ANALISI VIDEO + AGGIORNA CREDITI
  async function analyzeVideo(url: string) {
    if (!userId) {
      alert("Errore: dati utente mancanti.");
      return;
    }

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          user_id: userId,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert("Errore durante l'analisi AI: " + data.error);
        return;
      }

      setAiResponse(data.text);

      // 🔥 RICARICO I CREDITI DOPO IL DECREMENTO
      const { data: newCredits, error: creditsErr } = await supabase
        .from("analisi_video")
        .select("credits")
        .eq("user_id", userId)
        .single();

      if (!creditsErr && newCredits) {
        setCredits(newCredits.credits);
      }

    } catch (err) {
      console.error("AI error:", err);
      alert("Errore nella chiamata AI");
    }
  }

  // 📤 UPLOAD VIDEO
  async function handleUpload() {
    if (credits === 0) {
      alert("❌ Non hai crediti disponibili.");
      window.location.href = "/pricing";
      return;
    }

    if (!file) {
      alert("Seleziona un file!");
      return;
    }

    if (!email || !userId) {
      alert("Errore: dati utente mancanti.");
      return;
    }

    setLoading(true);
    setAiResponse("");

    try {
      const data = new FormData();
      data.append("file", file);
      data.append("email", email);
      data.append("user_id", userId);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });

      const json = await res.json();

      if (!json.success) {
        alert("❌ Errore upload: " + json.error);
        return;
      }

      alert("✅ Upload completato!");

      if (json.url) await analyzeVideo(json.url);

    } catch (err) {
      console.error("Upload error:", err);
      alert("Errore imprevisto.");
    } finally {
      setLoading(false);
    }
  }

  // LOADING
  if (credits === null) {
    return (
      <main style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        color: "white",
        background: "#0d1117",
      }}>
        Caricamento...
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px 20px",
        background: "#0d1117",
        color: "white",
      }}
    >
      <h1 style={{ fontSize: "2.4rem", fontWeight: 800 }}>Carica un video</h1>

      <p style={{ opacity: 0.7 }}>
        Crediti disponibili: <strong>{credits}</strong>
      </p>

      <div
        style={{
          background: "#111827",
          padding: "30px",
          borderRadius: "14px",
          width: "100%",
          maxWidth: "520px",
          boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
        }}
      >
        <label style={{ display: "block", marginBottom: 10 }}>
          Scegli un file video
        </label>

        <input
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            background: "#1f2937",
            border: "1px solid #374151",
            color: "white",
            marginBottom: "22px",
          }}
        />

        <button
          onClick={handleUpload}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "10px",
            border: "none",
            background: "#2563eb",
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "white",
          }}
        >
          {loading ? "Caricamento..." : "Carica e Analizza"}
        </button>
      </div>

      {aiResponse && (
        <div
          style={{
            marginTop: 40,
            width: "100%",
            maxWidth: 700,
            background: "#111827",
            padding: 25,
            borderRadius: 12,
          }}
        >
          <h2 style={{ fontWeight: 700 }}>Risultato Analisi AI</h2>

          <pre
            style={{
              whiteSpace: "pre-wrap",
              padding: 20,
              background: "#0d1117",
              borderRadius: 10,
              color: "#e5e7eb",
            }}
          >
            {aiResponse}
          </pre>
        </div>
      )}
    </main>
  );
}
