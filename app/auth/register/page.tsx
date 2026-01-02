"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const supabase = supabaseClient;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async () => {
    setError("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    // AGGIUNTA IN analisi_video
    await supabase.from("analisi_video").insert({
      user_id: data.user?.id,
      crediti: 0,
      mail: email,
    });

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
          placeholder="Crea una password"
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

        {/* BUTTON */}
        <button
          onClick={handleRegister}
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
            cursor: "pointer",
            transition: "0.2s",
          }}
        >
          Crea account
        </button>

        {/* LOGIN LINK */}
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
