"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

// 🔴 IMPEDISCE IL PRERENDER IN BUILD (OBBLIGATORIO)
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const supabase = supabaseClient;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;

    setError("");
    setLoading(true);

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

        {/* EMAIL */}
        <label style={label}>Email</label>
        <input
          type="email"
          placeholder="Inserisci la tua email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
        />

        {/* PASSWORD */}
        <label style={label}>Password</label>
        <input
          type="password"
          placeholder="Inserisci la password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
        />

        {/* ERRORE */}
        {error && (
          <p
            style={{
              color: "#ef4444",
              marginTop: 10,
              marginBottom: 5,
              fontSize: ".95rem",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        {/* BTN */}
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

        {/* LINK REGISTER */}
        <p
          style={{
            marginTop: 18,
            textAlign: "center",
            opacity: 0.7,
            fontSize: ".9rem",
          }}
        >
          Non hai un account?{" "}
          <a
            href="/auth/register"
            style={{ color: "#3b82f6", textDecoration: "underline" }}
          >
            Registrati
          </a>
        </p>
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
  fontSize: "1rem",
};

const label = {
  display: "block",
  marginBottom: 6,
  fontSize: "1rem",
  fontWeight: 600,
};
