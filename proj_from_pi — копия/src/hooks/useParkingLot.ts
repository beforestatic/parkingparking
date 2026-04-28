import { useEffect, useRef, useState } from 'react'

export interface SpaceStatus {
  id: string
  label: string
  status: 'free' | 'occupied' | 'unknown'
}

export interface TierDetail {
  id: string
  label: string
  spaces: SpaceStatus[]
}

export interface LotDetail {
  lot_id: string
  name: string
  brand: string
  address: string
  total_spaces: number
  free_spaces: number
  occupied_spaces: number
  availability_pct: number
  status: 'available' | 'limited' | 'full'
  last_updated: string | null
  tiers: TierDetail[]
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? ''
const LOT_ID = 'times-mockup-01'
const POLL_MS = 2000

export function useParkingLot() {
  const [data, setData] = useState<LotDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastPoll, setLastPoll] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchLot() {
    try {
      const res = await fetch(`${API_BASE}/api/v1/lots/${LOT_ID}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: LotDetail = await res.json()
      setData(json)
      setError(null)
    } catch (e: any) {
      setError(e.message ?? 'Network error')
    } finally {
      setLoading(false)
      setLastPoll(new Date())
    }
  }

  useEffect(() => {
    fetchLot()
    timerRef.current = setInterval(fetchLot, POLL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return { data, error, loading, lastPoll }
}
