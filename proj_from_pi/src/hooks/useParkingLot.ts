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
const LOT_ID = 'times-mockup-01'
const WS_RETRY_MS = 3000

function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/live`
}

export function useParkingLot() {
  const [data, setData] = useState<LotDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastPoll, setLastPoll] = useState<Date | null>(null)
  const [transport, setTransport] = useState<'ws' | 'poll'>('ws')
  const wsRef = useRef<WebSocket | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── HTTP fallback fetch ──────────────────────────────────────────────
  const fetchLot = useCallback(async () => {
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
  }, [])

  // ── WebSocket connect ────────────────────────────────────────────────
  const connectWs = useCallback(() => {
    const ws = new WebSocket(getWsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      setTransport('ws')
      setError(null)
      setLoading(false)
      // Clear any polling fallback
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    ws.onmessage = (ev) => {
      try {
        const json: LotDetail = JSON.parse(ev.data)
        setData(json)
        setLastPoll(new Date())
        setError(null)
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      wsRef.current = null
      setTransport('poll')
      // Fall back to polling
      if (!pollRef.current) {
        fetchLot()
        pollRef.current = setInterval(fetchLot, 2000)
      }
      // Retry WS after delay
      retryRef.current = setTimeout(connectWs, WS_RETRY_MS)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [fetchLot])

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
