"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = supabaseClient;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // se hai email confirmation ON, metti qui la redirect corretta:
      // options: { emailRedirectTo: `${window.location.origin}/auth/login` },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Se email confirmation è attiva, data.user esiste ma NON hai sessione.
    // In quel caso: manda a login con messaggio.
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    // Prova a creare la riga crediti (se RLS blocca, ci penserà useCredits)
    if (data.user) {
      const { error: insertErr } = await supabase.from("analisi_video").insert({
        user_id: data.user.id,
        credits: 0,
        email, // <-- colonna è "email" (non "mail")
      });

      // non bloccare il flow se fallisce (RLS ecc.)
      if (insertErr) {
        console.warn("Insert analisi_video fallito:", insertErr.message);
      }
    }

    if (!session) {
      router.push("/auth/login");
      return;
    }

    router.replace("/dashboard");
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#0d1117", color: "white" }}>
      <form onSubmit={handleRegister} style={{ background: "#111827", padding: "40px 35px", borderRadius: 14, width: "100%", maxWidth: 420 }}>
        <h1 style={{ textAlign: "center", marginBottom: 25 }}>Registrati</h1>

        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={input} />

        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={input} />

        {error && <p style={{ color: "#ef4444", marginTop: 10, textAlign: "center" }}>{error}</p>}

        <button type="submit" disabled={loading} style={{ width: "100%", marginTop: 20, padding: "14px", background: "#2563eb", border: "none", borderRadius: 10, color: "white", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Creazione..." : "Crea account"}
        </button>

        <p style={{ marginTop: 18, textAlign: "center", opacity: 0.7 }}>
          Hai già un account? <a href="/auth/login" style={{ color: "#3b82f6" }}>Accedi</a>
        </p>
      </form>
    </main>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #374151",
  background: "#1f2937",
  color: "white",
  marginBottom: 20,
};
