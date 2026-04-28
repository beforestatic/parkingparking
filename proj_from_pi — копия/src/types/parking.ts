export interface ParkingSpace {
  id: string
  label: string
  free: boolean
  changed: boolean
  edge_pct: number
  diff_pct: number
}

export interface ParkingState {
  mode: 'mock' | 'live'
  paused: boolean
  baseline_set: boolean
  fps: number
  total: number
  free: number
  occupied: number
  spaces: ParkingSpace[]
  scenarios: string[]
  mock_occupied: string[]
  navigator_log: NavigatorLogEntry[]
}

export interface NavigatorLogEntry {
  lot_id: string
  timestamp: string
  total_spaces: number
  free_spaces: number
  occupied_spaces: number
  spaces: Array<{ id: string; status: string }>
}
