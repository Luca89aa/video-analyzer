"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

// 🔴 BLOCCA IL PRERENDER (OBBLIGATORIO)
export const dynamic = "force-dynamic";

export default function PaymentSuccessPage() {
  const params = useSearchParams();

  useEffect(() => {
    async function addCredits() {
      const pack = Number(params.get("pack"));
      if (!pack) return;

      // ✅ IMPORT SUPABASE SOLO A RUNTIME
      const { supabaseClient } = await import("@/lib/supabaseClient");
      const supabase = supabaseClient;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/auth/login";
        return;
      }

      const { error } = await supabase.rpc("increase_credits", {
        amount: pack,
      });

      if (error) {
        console.error(error);
        alert("Errore nell'aggiunta dei crediti.");
        return;
      }

      window.location.href = "/dashboard";
    }

    addCredits();
  }, [params]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "white",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui",
      }}
    >
      <div
        style={{
          textAlign: "center",
          background: "#111827",
          padding: "40px 30px",
          borderRadius: "14px",
          boxShadow: "0 12px 25px rgba(0,0,0,.35)",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 700 }}>
          Pagamento completato
        </h1>
        <p style={{ opacity: 0.8, marginTop: 10 }}>
          ⏳ Stiamo accreditando i tuoi crediti...
        </p>
      </div>
    </main>
  );
}
