"use client"

import { useCredits } from '@/hooks/useCredits'

export default function Dashboard() {
  const { credits, loading, decrement } = useCredits()

  if (loading) return <p>Carico...</p>

  return (
    <div>
      <p>Crediti disponibili: {credits}</p>
      <button onClick={() => decrement(1)}>Usa 1 credito</button>
    </div>
  )
}
