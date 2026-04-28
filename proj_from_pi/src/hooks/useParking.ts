import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParkingState } from '../types/parking'

const POLL_MS = 2000

export function useParking() {
  const [state, setState] = useState<ParkingState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ParkingState = await res.json()
      if (mountedRef.current) {
        setState(data)
        setError(null)
        setLoading(false)
      }
    } catch (e: any) {
      if (mountedRef.current) {
        setError(e.message ?? 'Fetch failed')
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchState()
    timerRef.current = setInterval(fetchState, POLL_MS)
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchState])

  /** POST /api/scenario */
  const setScenario = useCallback(async (name: string) => {
    await fetch('/api/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    fetchState()
  }, [fetchState])

  /** POST /api/pause */
  const setPaused = useCallback(async (paused: boolean) => {
    await fetch('/api/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused }),
    })
    fetchState()
  }, [fetchState])

  /** POST /api/baseline */
  const setBaseline = useCallback(async () => {
    await fetch('/api/baseline', { method: 'POST' })
    fetchState()
  }, [fetchState])

  return { state, error, loading, setScenario, setPaused, setBaseline }
}
