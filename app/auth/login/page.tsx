"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const supabase = supabaseClient;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1️⃣ Login
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // 2️⃣ ASPETTA la sessione reale (CRITICO)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setError("Sessione non creata. Riprova.");
      setLoading(false);
      return;
    }

    // 3️⃣ Redirect SICURO
    router.push("/dashboard");
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
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          width: 320,
          background: "#111827",
          padding: 24,
          borderRadius: 12,
        }}
      >
        <h1 style={{ marginBottom: 16 }}>Accedi</h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", marginBottom: 12, padding: 10 }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", marginBottom: 12, padding: 10 }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Accesso..." : "Accedi"}
        </button>

        {error && (
          <p style={{ color: "#ef4444", marginTop: 12 }}>{error}</p>
        )}
      </form>
    </main>
  );
}
