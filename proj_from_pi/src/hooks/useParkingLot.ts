import { useEffect, useRef, useState, useCallback } from 'react'

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
const WS_RETRY_MS = 3000

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/live`
}

/**
 * Hook that subscribes to live parking data for a specific lot.
 *
 * The WebSocket now broadcasts an array of LotSummary objects (all lots).
 * This hook filters for the requested lotId and fetches full detail
 * (with tiers) via HTTP when the summary arrives.
 *
 * If lotId is omitted, it subscribes to the first available lot.
 */
export function useParkingLot(lotId?: string) {
  const [data, setData] = useState<LotDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastPoll, setLastPoll] = useState<Date | null>(null)
  const [transport, setTransport] = useState<'ws' | 'poll'>('ws')
  const wsRef = useRef<WebSocket | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentLotRef = useRef<string | undefined>(lotId)

  // Keep lotId ref in sync
  useEffect(() => {
    currentLotRef.current = lotId
  }, [lotId])

  // ── Fetch full detail for a lot ───────────────────────────────────────
  const fetchDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/lots/${id}`)
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
  }, [])

  // ── Fetch all lot summaries (for polling fallback) ────────────────────
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/lots`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const lots: LotDetail[] = await res.json()
      const target = currentLotRef.current
      const found = target
        ? lots.find(l => l.lot_id === target)
        : lots[0]
      if (found) {
        // Summary has no tiers — fetch full detail
        fetchDetail(found.lot_id)
      }
    } catch (e: any) {
      setError(e.message ?? 'Network error')
      setLoading(false)
    }
  }, [fetchDetail])

  // ── WebSocket connect ────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    const ws = new WebSocket(getWsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      setTransport('ws')
      setError(null)
      // Clear polling fallback
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    ws.onmessage = (ev) => {
      try {
        const lots: LotDetail[] = JSON.parse(ev.data)
        const target = currentLotRef.current
        const found = target
          ? lots.find(l => l.lot_id === target)
          : lots[0]
        if (found) {
          // WS sends summaries; fetch full detail for tiers
          fetchDetail(found.lot_id)
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      wsRef.current = null
      setTransport('poll')
      // Fall back to polling
      if (!pollRef.current) {
        fetchSummary()
        pollRef.current = setInterval(fetchSummary, 3000)
      }
      // Retry WS after delay
      retryRef.current = setTimeout(connectWs, WS_RETRY_MS)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [fetchDetail, fetchSummary])

  // ── Mount: try WS first, fallback to poll ────────────────────────────
  useEffect(() => {
    connectWs()
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (pollRef.current) clearInterval(pollRef.current)
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [connectWs])

  return { data, error, loading, lastPoll, transport }
}
