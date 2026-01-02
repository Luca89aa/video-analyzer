"use client"

import { useEffect, useState, useCallback } from "react"
import { supabaseClient } from "@/lib/supabaseClient"

export default function useCredits() {
  const supabase = supabaseClient

  const [credits, setCredits] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let mounted = true

    async function loadCredits() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError || !user) {
          if (mounted) setCredits(0)
          return
        }

        const { data, error } = await supabase
          .from("analisi_video")
          .select("credits")
          .eq("user_id", user.id)
          .single()

        if (!error && mounted) {
          setCredits(data?.credits ?? 0)
        }
      } catch (err) {
        console.error("Errore caricamento crediti:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadCredits()

    return () => {
      mounted = false
    }
  }, [supabase])

  const decrement = useCallback((amount = 1) => {
    setCredits((c) => Math.max(0, c - amount))
  }, [])

  return { credits, loading, decrement }
}
