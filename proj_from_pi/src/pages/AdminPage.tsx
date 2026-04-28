/**
 * /admin — Camera feed + detection controls
 *
 * Camera server assumed at http://localhost:8000 (proxied via /stream and /admin-api/*)
 */

import React, { useState } from 'react'
import { useParkingLot } from '../hooks/useParkingLot'
import { useLang } from '../i18n/LanguageContext'

const SCENARIOS = ['all_free', 'morning_light', 'midday_busy', 'evening_full', 'only_dark_cars'] as const
type Scenario = typeof SCENARIOS[number]

const SPACE_BG: Record<string, { bg: string; color: string }> = {
  free:     { bg: '#14532d', color: '#86efac' },
  occupied: { bg: '#7f1d1d', color: '#fca5a5' },
  unknown:  { bg: '#1f2937', color: '#6b7280' },
}

// ─── Shared style tokens ───────────────────────────────────────────────────

const S = {
  card: {
    background: '#1a1d28',
    border: '1px solid #252a3e',
    borderRadius: 12,
    padding: '16px 18px',
  } as React.CSSProperties,
  label: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#4b5563',
    marginBottom: 8,
    display: 'block',
  } as React.CSSProperties,
  btn: (variant: 'primary' | 'ghost' | 'danger' = 'ghost'): React.CSSProperties => ({
    padding: '7px 14px',
    borderRadius: 7,
    border: variant === 'ghost' ? '1px solid #252a3e' : 'none',
    background:
      variant === 'primary' ? '#F7C12E'
      : variant === 'danger'  ? '#7f1d1d'
      : '#252a3e',
    color:
      variant === 'primary' ? '#111'
      : variant === 'danger'  ? '#fca5a5'
      : '#d1d5db',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    lineHeight: 1,
  }),
}

// ─── API helpers ───────────────────────────────────────────────────────────

async function postJson(path: string, body?: object) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function captureSnapshot(): Promise<void> {
  const res = await fetch('/admin-api/capture_snapshot', { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'baseline_preview.jpg'
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Components ────────────────────────────────────────────────────────────

function CameraFeed() {
  const [error, setError] = useState(false)
  const { t } = useLang()
  return (
    <div style={S.card}>
      <span style={S.label}>{t.cameraFeed}</span>
      {error ? (
        <div style={{
          background: '#12141a',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          aspectRatio: '16/9',
          color: '#4b5563',
          fontSize: 12,
        }}>
          {t.cameraOffline} — <code style={{ margin: '0 4px', color: '#6b7280' }}>http://localhost:8000</code>
        </div>
      ) : (
        <img
          src="/stream"
          alt="MJPEG parking camera"
          onError={() => setError(true)}
          style={{ width: '100%', borderRadius: 8, display: 'block' }}
        />
      )}
    </div>
  )
}

function SpaceGrid() {
  const { data, error } = useParkingLot()
  const { t } = useLang()
  return (
    <div style={S.card}>
      <span style={S.label}>{t.spaceStatuses}</span>
      {error && (
        <p style={{ fontSize: 11, color: '#f87171', marginBottom: 10 }}>
          {t.navigatorOffline}
        </p>
      )}
      {data?.tiers.map(tier => (
        <div key={tier.id} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 6 }}>{tier.label}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {tier.spaces.map(sp => {
              const c = SPACE_BG[sp.status] ?? SPACE_BG.unknown
              return (
                <div
                  key={sp.id}
                  title={`${sp.label}: ${sp.status}`}
                  style={{
                    flex: 1,
                    aspectRatio: '1 / 1.6',
                    background: c.bg,
                    color: c.color,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: 4,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {sp.id}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {!data && !error && (
        <p style={{ fontSize: 11, color: '#4b5563' }}>{t.loading}</p>
      )}
    </div>
  )
}

type Mode = 'mock' | 'live'

function DetectionControls({ mode }: { mode: Mode }) {
  const [paused, setPaused] = useState(false)
  const [scenario, setScenario] = useState<Scenario>('all_free')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { t } = useLang()

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true)
    setStatus(null)
    try {
      await fn()
      setStatus(`✓ ${label}`)
    } catch (e: any) {
      setStatus(`✗ ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function handlePauseToggle() {
    const next = !paused
    await run(next ? t.pauseDetection : t.resumeDetection, () =>
      postJson('/admin-api/pause', { paused: next })
    )
    setPaused(next)
  }

  return (
    <div style={S.card}>
      <span style={S.label}>{t.detectionControls}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {/* Set Baseline */}
        <button
          style={S.btn('primary')}
          disabled={busy}
          onClick={() => run(t.setBaseline, () => postJson('/admin-api/baseline'))}
        >
          {t.setBaseline}
        </button>

        {/* Pause / Resume toggle */}
        <button
          style={S.btn(paused ? 'danger' : 'ghost')}
          disabled={busy}
          onClick={handlePauseToggle}
        >
          {paused ? t.resumeDetection : t.pauseDetection}
        </button>
      </div>

      {/* Scenario selector */}
      <div>
        <span style={{ ...S.label, marginBottom: 6 }}>{t.scenario}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SCENARIOS.map(s => (
            <button
              key={s}
              style={{
                ...S.btn('ghost'),
                background: scenario === s ? '#252a3e' : 'transparent',
                color: scenario === s ? '#F7C12E' : '#6b7280',
                border: `1px solid ${scenario === s ? '#F7C12E44' : '#252a3e'}`,
              }}
              disabled={busy}
              onClick={() => {
                setScenario(s)
                run(`Scenario: ${s}`, () => postJson('/admin-api/scenario', { scenario: s }))
              }}
            >
              {s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback */}
      {status && (
        <p style={{
          marginTop: 10,
          fontSize: 11,
          color: status.startsWith('✓') ? '#4ade80' : '#f87171',
        }}>
          {status}
        </p>
      )}
    </div>
  )
}

// ─── Calibration section (live mode only) ─────────────────────────────────

function CalibrationSection() {
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { t } = useLang()

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true)
    setStatus(null)
    try {
      await fn()
      setStatus(`✓ ${label}`)
    } catch (e: any) {
      setStatus(`✗ ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={S.card}>
      <span style={S.label}>{t.calibration}</span>

      <p style={{
        fontSize: 11,
        color: '#6b7280',
        marginBottom: 14,
        lineHeight: 1.6,
      }}>
        {t.calibrationHint}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          style={S.btn('ghost')}
          disabled={busy}
          onClick={() => run(t.captureSnapshot, captureSnapshot)}
        >
          {t.captureSnapshot}
        </button>

        <button
          style={S.btn('primary')}
          disabled={busy}
          onClick={() => run(t.setAsBaseline, () => postJson('/admin-api/baseline'))}
        >
          {t.setAsBaseline}
        </button>
      </div>

      {status && (
        <p style={{
          marginTop: 10,
          fontSize: 11,
          color: status.startsWith('✓') ? '#4ade80' : '#f87171',
        }}>
          {status}
        </p>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [mode, setMode] = useState<Mode>('mock')
  const { t } = useLang()

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#12141a',
      color: '#e5e7eb',
      fontFamily: "'Space Grotesk', 'DM Sans', sans-serif",
      padding: '20px 16px 40px',
      boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Back link */}
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#6b7280',
            textDecoration: 'none',
            marginBottom: 20,
          }}
        >
          {t.backToMap}
        </a>

        {/* Header + mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{
            background: '#F7C12E', color: '#111',
            fontWeight: 900, fontSize: 13,
            padding: '2px 7px', borderRadius: 5,
          }}>T</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>
              {t.adminTitle}
            </div>
            <div style={{ fontSize: 11, color: '#4b5563' }}>
              {t.adminSubtitle}
            </div>
          </div>

          {/* Mode toggle */}
          <div style={{
            display: 'flex',
            background: '#1a1d28',
            border: '1px solid #252a3e',
            borderRadius: 8,
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {(['mock', 'live'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: '5px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  background: mode === m ? '#252a3e' : 'transparent',
                  color: mode === m ? (m === 'live' ? '#4ade80' : '#F7C12E') : '#4b5563',
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '0.06em',
                }}
              >
                {m === 'mock' ? t.modeMock : t.modeLive}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CameraFeed />
          <SpaceGrid />
          <DetectionControls mode={mode} />
          {mode === 'live' && <CalibrationSection />}
        </div>
      </div>
    </div>
  )
}
