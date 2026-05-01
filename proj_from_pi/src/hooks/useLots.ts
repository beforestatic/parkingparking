import { useEffect, useState, useCallback } from 'react'

export interface LotRegistryItem {
  id: string
  name: string
  address: string
  camera_index: number
  enabled: boolean
  tiers: Array<{ id: string; label: string; spaces: string[] }>
  total_spaces: number
  created_at: string
  updated_at: string
}

const API = '/admin/lots'

export function useLots() {
  const [lots, setLots] = useState<LotRegistryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(API)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: LotRegistryItem[] = await res.json()
      setLots(data)
      setError(null)
    } catch (e: any) {
      setError(e.message ?? 'Failed to load lots')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { lots, loading, error, refresh }
}
