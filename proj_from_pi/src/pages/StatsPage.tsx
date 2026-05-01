import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface HistoryRow {
  id: number
  lot_id: string
  timestamp: string
  source: string
  total_spaces: number
  free_spaces: number
  occupied_spaces: number
  availability_pct: number
}

interface ErrorRow {
  id: number
  timestamp: string
  component: string
  error_type: string
  message: string
}

interface SessionRow {
  id: number
  started_at: string
  ended_at: string | null
  mode: string
  total_updates: number
}

const COLORS = {
  bg: '#12141a',
  surface: '#1a1d28',
  border: '#252a3e',
  text: '#e5e7eb',
  muted: '#6b7280',
  yellow: '#F7C12E',
  green: '#4ade80',
  red: '#f87171',
}

function fmtTime(ts: string) {
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return ts
  }
}

function fmtDuration(start: string, end: string | null) {
  try {
    const s = new Date(start).getTime()
    const e = end ? new Date(end).getTime() : Date.now()
    const diff = Math.floor((e - s) / 1000)
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`
    const h = Math.floor(diff / 3600)
    const m = Math.floor((diff % 3600) / 60)
    return `${h}h ${m}m`
  } catch {
    return '—'
  }
}

export default function StatsPage() {
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [errors, setErrors] = useState<ErrorRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])

  useEffect(() => {
    const fetchAll = () => {
      fetch('/api/v1/lots/times-mockup-01/history?limit=200')
        .then(r => r.json())
        .then(setHistory)
        .catch(() => {})
      fetch('/api/v1/errors?limit=100')
        .then(r => r.json())
        .then(setErrors)
        .catch(() => {})
      fetch('/api/v1/sessions')
        .then(r => r.json())
        .then(setSessions)
        .catch(() => {})
    }
    fetchAll()
    const iv = setInterval(fetchAll, 5000)
    return () => clearInterval(iv)
  }, [])

  // Chart data — reverse so oldest first
  const chartData = [...history].reverse().map(row => ({
    time: new Date(row.timestamp).toLocaleTimeString(),
    free_spaces: row.free_spaces,
    occupied_spaces: row.occupied_spaces,
  }))

  // Summary stats
  const totalIngests = history.length
  const avgOccupancy = history.length > 0
    ? (history.reduce((s, r) => s + (r.occupied_spaces / r.total_spaces * 100), 0) / history.length).toFixed(1)
    : '—'
  const peakOccupancy = history.length > 0
    ? Math.max(...history.map(r => Math.round(r.occupied_spaces / r.total_spaces * 100)))
    : '—'
  const lastUpdated = history.length > 0 ? fmtTime(history[0].timestamp) : '—'

  return (
    <div style={{
      width: '100vw', minHeight: '100dvh',
      background: COLORS.bg, color: COLORS.text,
      fontFamily: "'Space Grotesk', 'DM Sans', sans-serif",
      padding: '24px', overflow: 'auto',
    }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Header */}
        <a href="/" style={{
          color: COLORS.yellow, fontSize: 13, textDecoration: 'none',
          display: 'inline-block', marginBottom: 16,
        }}>← Back to map</a>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          Parking Statistics
        </h1>
        <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 24 }}>
          Times Parking Navigator — data overview
        </p>

        {/* Summary row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12,
          marginBottom: 28,
        }}>
          {[
            { label: 'Total Ingests', value: String(totalIngests) },
            { label: 'Avg Occupancy', value: `${avgOccupancy}%` },
            { label: 'Peak Occupancy', value: `${peakOccupancy}%` },
            { label: 'Last Updated', value: lastUpdated },
          ].map(s => (
            <div key={s.label} style={{
              background: COLORS.surface, border: `1px solid ${COLORS.border}`,
              borderRadius: 10, padding: '14px 16px',
            }}>
              <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {s.label}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Occupancy chart */}
        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 10, padding: 20, marginBottom: 28,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            Occupancy Over Time
          </h2>
          {chartData.length === 0 ? (
            <p style={{ color: COLORS.muted, fontSize: 13 }}>No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: COLORS.muted }} />
                <YAxis tick={{ fontSize: 10, fill: COLORS.muted }} />
                <Tooltip
                  contentStyle={{
                    background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                    borderRadius: 8, fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="free_spaces" stroke={COLORS.green} strokeWidth={2} dot={false} name="Free" />
                <Line type="monotone" dataKey="occupied_spaces" stroke={COLORS.red} strokeWidth={2} dot={false} name="Occupied" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sessions table */}
        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 10, padding: 20, marginBottom: 28,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            Sessions
          </h2>
          {sessions.length === 0 ? (
            <p style={{ color: COLORS.muted, fontSize: 13 }}>No sessions logged</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}`, textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', color: COLORS.muted, fontWeight: 500 }}>Started</th>
                  <th style={{ padding: '8px 12px', color: COLORS.muted, fontWeight: 500 }}>Mode</th>
                  <th style={{ padding: '8px 12px', color: COLORS.muted, fontWeight: 500 }}>Total Updates</th>
                  <th style={{ padding: '8px 12px', color: COLORS.muted, fontWeight: 500 }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: '8px 12px' }}>{fmtTime(s.started_at)}</td>
                    <td style={{ padding: '8px 12px' }}>{s.mode}</td>
                    <td style={{ padding: '8px 12px' }}>{s.total_updates}</td>
                    <td style={{ padding: '8px 12px' }}>{fmtDuration(s.started_at, s.ended_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Error log table */}
        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 10, padding: 20, marginBottom: 40,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
            Error Log
          </h2>
          {errors.length === 0 ? (
            <p style={{ color: COLORS.muted, fontSize: 13 }}>No errors logged</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}`, textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', color: COLORS.muted, fontWeight: 500 }}>Timestamp</th>
                  <th style={{ padding: '8px 12px', color: COLORS.muted, fontWeight: 500 }}>Component</th>
                  <th style={{ padding: '8px 12px', color: COLORS.muted, fontWeight: 500 }}>Error Type</th>
                  <th style={{ padding: '8px 12px', color: COLORS.muted, fontWeight: 500 }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {errors.map(e => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: '8px 12px' }}>{fmtTime(e.timestamp)}</td>
                    <td style={{ padding: '8px 12px' }}>{e.component}</td>
                    <td style={{ padding: '8px 12px' }}>{e.error_type}</td>
                    <td style={{ padding: '8px 12px' }}>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
