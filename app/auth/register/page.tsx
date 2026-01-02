"use client";

import { useState } from "react";

// 🔴 blocca il prerender
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (loading) return;

    setError("");
    setLoading(true);

    // ✅ IMPORT SUPABASE SOLO A RUNTIME
    const { supabaseClient } = await import("@/lib/supabaseClient");
    const supabase = supabaseClient;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // inserimento iniziale crediti
    if (data.user) {
      await supabase.from("analisi_video").insert({
        user_id: data.user.id,
        credits: 0,
        email,
      });
    }

    window.location.href = "/auth/login";
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#0d1117",
        color: "white",
        padding: 20,
        fontFamily: "system-ui",
      }}
    >
      <div
        style={{
          background: "#111827",
          padding: "40px 35px",
          borderRadius: 14,
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
        }}
      >
        <h1
          style={{
            textAlign: "center",
            fontSize: "2rem",
            fontWeight: 800,
            marginBottom: 25,
          }}
        >
          Registrati
        </h1>

        <label style={label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
        />

        <label style={label}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
        />

        {error && (
          <p style={{ color: "#ef4444", marginTop: 10, textAlign: "center" }}>
            {error}
          </p>
        )}

        <button
          onClick={handleRegister}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 20,
            padding: "14px",
            background: "#2563eb",
            border: "none",
            borderRadius: 10,
            color: "white",
            fontSize: "1.1rem",
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Creazione..." : "Crea account"}
        </button>

        <p
          style={{
            marginTop: 18,
            textAlign: "center",
            opacity: 0.7,
            fontSize: ".9rem",
          }}
        >
          Hai già un account?{" "}
          <a
            href="/auth/login"
            style={{ color: "#3b82f6", textDecoration: "underline" }}
          >
            Accedi
         
