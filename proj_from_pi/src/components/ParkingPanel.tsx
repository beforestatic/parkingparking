import { useState } from 'react'
import type { LotDetail, SpaceStatus } from '../hooks/useParkingLot'
import { useLang } from '../i18n/LanguageContext'

const PLACEHOLDER_SPACES = ['L1', 'L2', 'L3', 'L4', 'L5']

// ─── Status helpers ────────────────────────────────────────────────────────

const SPACE_BG = {
  free:     { bg: '#14532d', color: '#86efac' },
  occupied: { bg: '#7f1d1d', color: '#fca5a5' },
  unknown:  { bg: '#1f2937', color: '#6b7280' },
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SpaceBox({ space }: { space: SpaceStatus }) {
  const c = SPACE_BG[space.status]
  return (
    <div
      title={`${space.label}: ${space.status}`}
      style={{
        flex: 1,
        aspectRatio: '1 / 1.7',
        background: c.bg,
        color: c.color,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: 5,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.03em',
        transition: 'background 0.35s',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 6, bottom: 20,
        left: '50%', width: 1,
        transform: 'translateX(-50%)',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 1,
      }} />
      {space.id}
    </div>
  )
}

function TierRow({ tier }: { tier: LotDetail['tiers'][0] }) {
  const { t } = useLang()
  const free = tier.spaces.filter(s => s.status === 'free').length
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6b7280' }}>
          {tier.label}
        </span>
        <span style={{ fontSize: 10, color: free > 0 ? '#4ade80' : '#f87171' }}>
          {t.tierFreeLabel(free, tier.spaces.length)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {tier.spaces.map(sp => <SpaceBox key={sp.id} space={sp} />)}
      </div>
    </div>
  )
}

// ─── Pulse dot ────────────────────────────────────────────────────────────

function PulseDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 7, height: 7,
      borderRadius: '50%',
      background: ok ? '#4ade80' : '#f87171',
      boxShadow: ok ? '0 0 0 0 rgba(74,222,128,0.6)' : 'none',
      animation: ok ? 'parking-pulse 2s infinite' : 'none',
    }} />
  )
}

// ─── Get Directions button ─────────────────────────────────────────────────

function DirectionsButton() {
  const { t } = useLang()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={() => {
          setMsg(t.navUnavailable)
          setTimeout(() => setMsg(null), 3000)
        }}
        style={{
          width: '100%',
          padding: '10px 0',
          background: '#F7C12E',
          color: '#111',
          fontSize: 13,
          fontWeight: 800,
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          letterSpacing: '0.03em',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        {t.getDirections}
      </button>
      {msg && (
        <div style={{
          marginTop: 6,
          fontSize: 10,
          color: '#6b7280',
          textAlign: 'center',
        }}>
          {msg}
        </div>
      )}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────

interface ParkingPanelProps {
  data: LotDetail | null
  error: string | null
  loading: boolean
  lastPoll: Date | null
  transport?: 'ws' | 'poll'
  compact?: boolean
}

export default function ParkingPanel({ data, error, loading, lastPoll, transport, compact }: ParkingPanelProps) {
  const { t } = useLang()

  const STATUS_COLORS = {
    available: { bg: '#14532d', text: '#4ade80', badge: '#166534', label: t.statusAvailable },
    limited:   { bg: '#713f12', text: '#facc15', badge: '#854d0e', label: t.statusLimited   },
    full:      { bg: '#7f1d1d', text: '#f87171', badge: '#991b1b', label: t.statusFull      },
  }

  const st = data ? STATUS_COLORS[data.status] : null

  const panel: React.CSSProperties = {
    background: '#1a1d28',
    border: '1px solid #252a3e',
    borderRadius: compact ? '16px 16px 0 0' : 16,
    overflow: 'hidden',
    boxShadow: '0 -4px 40px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: compact ? '72vh' : '100%',
    fontFamily: "'Space Grotesk', 'DM Sans', sans-serif",
  }

  return (
    <>
      {/* Keyframe injected inline — no CSS module needed */}
      <style>{`
        @keyframes parking-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(74,222,128,0.6); }
          70%  { box-shadow: 0 0 0 6px rgba(74,222,128,0);   }
          100% { box-shadow: 0 0 0 0   rgba(74,222,128,0);   }
        }
        @keyframes parking-shimmer {
          0%   { opacity: 0.5; }
          50%  { opacity: 1;   }
          100% { opacity: 0.5; }
        }
        @keyframes parking-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={panel}>
        {/* ── Header ── */}
        <div style={{ background: '#F7C12E', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: '#111',
            color: '#F7C12E',
            fontWeight: 900,
            fontSize: 14,
            padding: '3px 8px',
            borderRadius: 5,
            letterSpacing: '0.06em',
            flexShrink: 0,
          }}>
            T
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111', lineHeight: 1.2 }}>
              {data?.name || 'Times Parking'}
            </div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data?.address || 'Абай / Байзақов · Алматы'}
            </div>
          </div>
          {st && (
            <div style={{
              marginLeft: 'auto',
              background: st.badge,
              color: st.text,
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 999,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              {st.label}
            </div>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
          {/* Availability count */}
          {data && (
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              marginBottom: 16,
              borderBottom: '1px solid #252a3e',
              paddingBottom: 14,
            }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: st?.text ?? '#eee', lineHeight: 1 }}>
                {data.free_spaces}
              </span>
              <span style={{ fontSize: 16, color: '#6b7280', fontWeight: 600 }}>
                / {data.total_spaces}
              </span>
              <span style={{ fontSize: 12, color: '#4b5563', marginLeft: 2 }}>{t.spacesFree}</span>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && !data && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{
                  flex: 1, aspectRatio: '1 / 1.7',
                  background: '#252a3e',
                  borderRadius: 6,
                  animation: 'parking-shimmer 1.2s ease infinite',
                  animationDelay: `${i * 0.1}s`,
                }} />
              ))}
            </div>
          )}

          {/* Offline placeholder grid — shown when data is null */}
          {!data && !loading && (
            <div style={{ marginBottom: 12 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#374151' }}>
                  {t.lowerDeck}
                </span>
                <span style={{ fontSize: 10, color: '#374151' }}>{t.dashFree}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {PLACEHOLDER_SPACES.map(id => (
                  <div key={id} style={{
                    flex: 1,
                    aspectRatio: '1 / 1.7',
                    background: '#1f2937',
                    color: '#374151',
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: 5,
                    fontSize: 10,
                    fontWeight: 700,
                    position: 'relative',
                    userSelect: 'none',
                  }}>
                    <span style={{
                      position: 'absolute',
                      top: 6, bottom: 20,
                      left: '50%', width: 1,
                      transform: 'translateX(-50%)',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: 1,
                    }} />
                    {id}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tier grids */}
          {data?.tiers.map(tier => <TierRow key={tier.id} tier={tier} />)}

          {/* Get Directions button */}
          <DirectionsButton />

          {/* Offline inline notice — small, below the grid */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              color: '#6b7280',
              marginTop: 6,
              paddingTop: 10,
              borderTop: '1px solid #1f2937',
            }}>
              <span style={{ color: '#ef4444' }}>⚠</span>
              <span>{t.offlineNotice.split('uvicorn')[0]}<code style={{ color: '#4b5563' }}>uvicorn{t.offlineNotice.split('uvicorn')[1]}</code></span>
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, marginTop: 8, paddingTop: 12, borderTop: '1px solid #252a3e' }}>
            {([
              ['free',     '#86efac', t.free],
              ['occupied', '#fca5a5', t.occupied],
              ['unknown',  '#6b7280', t.unknown],
            ] as const).map(([k, color, label]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10,
                  borderRadius: 2,
                  background: SPACE_BG[k].bg,
                  border: `1px solid ${color}30`,
                }} />
                <span style={{ fontSize: 10, color: '#6b7280' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '10px 18px',
          borderTop: '1px solid #252a3e',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PulseDot ok={!error} />
            <span style={{ fontSize: 10, color: '#4b5563' }}>
              {error ? t.offline : transport === 'ws' ? 'Live · WebSocket' : t.live}
            </span>
          </div>
          <span style={{ fontSize: 10, color: '#6b7280' }}>
            {t.lastUpdated}{' '}
            {lastPoll
              ? lastPoll.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Almaty' })
              : '—'}
          </span>
        </div>
      </div>
    </>
  )
}
