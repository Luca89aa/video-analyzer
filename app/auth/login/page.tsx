"use client";

import { useState } from "react";

// 🔴 impedisce il prerender
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;

    setError("");
    setLoading(true);

    // ✅ import SUPABASE SOLO A RUNTIME
    const { supabaseClient } = await import("@/lib/supabaseClient");
    const supabase = supabaseClient;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/dashboard";
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
          Accedi
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
          onClick={handleLogin}
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
          {loading ? "Accesso..." : "Login"}
        </button>
      </div>
    </main>
  );
}

const input = {
  width: "100%",
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #374151",
  background: "#1f2937",
  color: "white",
  marginBottom: 20,
};

const label = {
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
};
