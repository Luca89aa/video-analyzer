"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export default function PaymentSuccessPage() {
  const params = useSearchParams();
  const supabase = supabaseClient;

  useEffect(() => {
    async function addCredits() {
      const pack = Number(params.get("pack"));

      if (!pack) return;

      // Recupero user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Devi effettuare il login per completare l'acquisto.");
        window.location.href = "/auth/login";
        return;
      }

      // Aggiungo i crediti
      const { error } = await supabase.rpc("increase_credits", {
        amount: pack,
      });

      if (error) {
        console.error(error);
        alert("Errore nell'aggiunta dei crediti.");
        return;
      }

      alert(`🎉 Pagamento completato! Hai ricevuto ${pack} crediti.`);
      window.location.href = "/dashboard";
    }

    addCredits();
  }, []);

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
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 10 }}>
          Pagamento completato
        </h1>
        <p style={{ opacity: 0.8 }}>
          ⏳ Stiamo aggiungendo i tuoi crediti...
        </p>
      </div>
    </main>
  );
}
