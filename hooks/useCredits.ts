"use client";

import { useEffect, useState, useCallback } from "react";

export default function useCredits() {
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/credits", { cache: "no-store" });
      if (!res.ok) {
        setCredits(0);
        return;
      }
      const json = await res.json();
      setCredits(Number(json.credits ?? 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const decrementLocal = useCallback((amount = 1) => {
    setCredits((c) => Math.max(0, c - amount));
  }, []);

  return { credits, loading, refresh, decrementLocal };
}
