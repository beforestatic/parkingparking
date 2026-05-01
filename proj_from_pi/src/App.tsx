import { useState, useRef, useEffect } from 'react'
import MapView from './components/MapView'
import ParkingPanel from './components/ParkingPanel'
import { useParkingLot } from './hooks/useParkingLot'
import { useLots } from './hooks/useLots'
import { useLang, LANG_LABELS } from './i18n/LanguageContext'
import type { Lang } from './i18n/translations'
import type { LotDetail } from './hooks/useParkingLot'

// ─── Status colours ────────────────────────────────────────────────────────

const STATUS_PIN_COLOR: Record<string, string> = {
  available: '#4ade80',
  limited:   '#facc15',
  full:      '#f87171',
}

// ─── Parking pin on the map ────────────────────────────────────────────────

function ParkingPin({ onClick, active, free, status, offsetX = 0 }: {
  onClick: () => void
  active: boolean
  free: number | null
  status: string | null
  offsetX?: number
}) {
  const pinColor = active
    ? (status ? STATUS_PIN_COLOR[status] ?? '#F7C12E' : '#F7C12E')
    : '#1a1d28'
  const textColor = active ? '#111' : '#F7C12E'

  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        left: `${43 + offsetX}%`,
        top: '38%',
        transform: 'translate(-50%, -100%)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{
        background: pinColor,
        border: `2px solid ${pinColor}`,
        borderRadius: active ? 10 : 999,
        padding: active ? '6px 12px' : '8px',
        display: 'flex',
        alignItems: 'center',
        gap: active ? 6 : 0,
        boxShadow: active
          ? `0 4px 20px ${pinColor}66`
          : '0 2px 10px rgba(0,0,0,0.6)',
        transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: 13, fontWeight: 900, color: textColor }}>P</span>
        {active && free !== null && (
          <span style={{ fontSize: 11, fontWeight: 700, color: textColor }}>
            {free} free
          </span>
        )}
      </div>
      <div style={{
        width: 2, height: 8,
        background: active ? pinColor : '#3a4060',
        borderRadius: 1,
        transition: 'background 0.25s',
      }} />
      <div style={{
        width: 6, height: 3,
        background: 'rgba(0,0,0,0.4)',
        borderRadius: '50%',
        filter: 'blur(1px)',
      }} />
    </button>
  )
}

// ─── Compass rose ──────────────────────────────────────────────────────────

function Compass() {
  return (
    <div style={{
      position: 'absolute', top: 16, right: 16,
      width: 36, height: 36,
      background: 'rgba(26,29,40,0.85)',
      border: '1px solid #252a3e',
      borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(8px)',
    }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <polygon points="10,2 12,10 10,9 8,10" fill="#F7C12E" />
        <polygon points="10,18 12,10 10,11 8,10" fill="#3a4060" />
        <text x="10" y="5" textAnchor="middle" fill="#F7C12E" fontSize="4" fontWeight="bold">N</text>
      </svg>
    </div>
  )
}

// ─── Scale bar ────────────────────────────────────────────────────────────

function ScaleBar() {
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 16,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
    }}>
      <div style={{ display: 'flex', gap: 0 }}>
        <div style={{ width: 40, height: 4, background: '#eee', borderRadius: '2px 0 0 2px' }} />
        <div style={{ width: 40, height: 4, background: '#3a4060', borderRadius: '0 2px 2px 0' }} />
      </div>
      <span style={{ fontSize: 9, color: '#4b5563' }}>200 m</span>
    </div>
  )
}

// ─── Attribution ──────────────────────────────────────────────────────────

function Attribution() {
  return (
    <div style={{
      position: 'absolute', bottom: 16, right: 16,
      fontSize: 9, color: '#374151',
      background: 'rgba(26,29,40,0.7)',
      padding: '2px 6px', borderRadius: 4,
      backdropFilter: 'blur(4px)',
    }}>
      © Times Parking Navigator · Алматы
    </div>
  )
}

// ─── Lot summary card (sidebar list item) ──────────────────────────────────

function LotSummaryCard({ lotId, name, status, free, total, active, onClick }: {
  lotId: string
  name: string
  status: string | null
  free: number | null
  total: number | null
  active: boolean
  onClick: () => void
}) {
  const statusColor = status ? STATUS_PIN_COLOR[status] ?? '#6b7280' : '#6b7280'
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        background: active ? '#252a3e' : 'transparent',
        border: active ? '1px solid #3a4060' : '1px solid transparent',
        borderRadius: 10,
        padding: '10px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        textAlign: 'left',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#1e2130' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Status dot */}
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: statusColor,
        boxShadow: status ? `0 0 6px ${statusColor}66` : 'none',
      }} />
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: active ? '#eee' : '#9ca3af',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </div>
        <div style={{ fontSize: 10, color: '#4b5563', marginTop: 1 }}>
          {lotId}
        </div>
      </div>
      {/* Free count */}
      {free !== null && total !== null && (
        <div style={{
          fontSize: 13, fontWeight: 800, color: statusColor, flexShrink: 0,
        }}>
          {free}<span style={{ fontSize: 10, fontWeight: 500, color: '#6b7280' }}>/{total}</span>
        </div>
      )}
    </button>
  )
}

// ─── Language dropdown (gear icon) ────────────────────────────────────────

function LangDropdown() {
  const { lang, setLang, t } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title={t.settings}
        style={{
          background: open ? '#252a3e' : 'transparent',
          border: '1px solid ' + (open ? '#3a4060' : 'transparent'),
          borderRadius: 8,
          padding: '5px 7px',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: '#1a1d28', border: '1px solid #252a3e', borderRadius: 10,
          padding: '6px', minWidth: 130, zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#4b5563', padding: '4px 8px 6px',
          }}>
            {t.language}
          </div>
          {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([code, label]) => (
            <button
              key={code}
              onClick={() => { setLang(code); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '7px 10px',
                background: lang === code ? '#252a3e' : 'transparent',
                border: 'none', borderRadius: 7, cursor: 'pointer',
                fontSize: 12,
                fontWeight: lang === code ? 700 : 500,
                color: lang === code ? '#F7C12E' : '#9ca3af',
                textAlign: 'left', transition: 'background 0.12s',
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: lang === code ? '#F7C12E' : 'transparent',
                border: lang === code ? 'none' : '1px solid #374151',
              }} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Per-lot panel wrapper ─────────────────────────────────────────────────

function LotPanel({ lotId }: { lotId: string }) {
  const { data, error, loading, lastPoll, transport } = useParkingLot(lotId)
  return (
    <ParkingPanel
      data={data}
      error={error}
      loading={loading}
      lastPoll={lastPoll}
      transport={transport}
      compact
    />
  )
}

// ─── Main app ─────────────────────────────────────────────────────────────

export default function App() {
  const { lots, loading: lotsLoading } = useLots()
  const { t } = useLang()
  const [activeLot, setActiveLot] = useState<string | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  // Auto-select first lot when loaded
  useEffect(() => {
    if (lots.length > 0 && !activeLot) {
      setActiveLot(lots[0].id)
    }
  }, [lots, activeLot])

  // Fetch data for the active lot (for the header chip and map pin)
  const { data: activeData } = useParkingLot(activeLot ?? undefined)

  // Build per-lot status from the lot list + active data
  // For lots we don't have live data for, show null
  const lotStatuses = lots.map(lot => ({
    id: lot.id,
    name: lot.name,
    enabled: lot.enabled,
    status: activeLot === lot.id ? activeData?.status ?? null : null,
    free: activeLot === lot.id ? activeData?.free_spaces ?? null : null,
    total: activeLot === lot.id ? activeData?.total_spaces ?? null : null,
  }))

  // Overall free count across all lots (for the header chip)
  const totalFree = lotStatuses.reduce((s, l) => s + (l.free ?? 0), 0)
  const totalSpaces = lotStatuses.reduce((s, l) => s + (l.total ?? 0), 0)

  return (
    <div style={{
      width: '100vw', height: '100dvh',
      display: 'flex', flexDirection: 'column',
      background: '#12141a',
      fontFamily: "'Space Grotesk', 'DM Sans', sans-serif",
      overflow: 'hidden',
    }}>
      {/* ── Top bar ── */}
      <div style={{
        height: 52, background: '#1a1d28',
        borderBottom: '1px solid #252a3e',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 12,
        flexShrink: 0, zIndex: 20,
      }}>
        <div style={{
          background: '#F7C12E', color: '#111',
          fontWeight: 900, fontSize: 13,
          padding: '2px 7px', borderRadius: 5,
          letterSpacing: '0.04em',
        }}>T</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#eee', lineHeight: 1.2 }}>
            {t.appTitle}
          </div>
          <div style={{ fontSize: 10, color: '#4b5563' }}>{t.appSubtitle}</div>
        </div>

        {/* Lot status chip */}
        {totalSpaces > 0 && (
          <div style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#252a3e', borderRadius: 999,
            padding: '4px 12px', fontSize: 11, fontWeight: 600,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: totalFree > 0 ? '#4ade80' : '#f87171',
            }} />
            <span style={{ color: '#d1d5db' }}>
              {t.freeChip(totalFree, totalSpaces)}
            </span>
          </div>
        )}

        <div style={{ marginLeft: totalSpaces > 0 ? 8 : 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <a
            href="/stats"
            style={{
              fontSize: 11, color: '#6b7280', textDecoration: 'none',
              padding: '4px 8px', borderRadius: 6, transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F7C12E')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
          >Stats</a>
          <a
            href="/admin"
            style={{
              fontSize: 11, color: '#6b7280', textDecoration: 'none',
              padding: '4px 8px', borderRadius: 6, transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F7C12E')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
          >Admin</a>
          <LangDropdown />
        </div>
      </div>

      {/* ── Map + panel layout ── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>

        {/* Map fills all available space */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapView>
            {/* One pin per lot, offset so they don't overlap */}
            {lotStatuses.map((lot, i) => (
              <ParkingPin
                key={lot.id}
                onClick={() => { setActiveLot(lot.id); setPanelOpen(true) }}
                active={activeLot === lot.id}
                free={lot.free}
                status={lot.status}
                offsetX={i * 8 - (lotStatuses.length - 1) * 4}
              />
            ))}
            <Compass />
            <ScaleBar />
            <Attribution />
          </MapView>
        </div>

        {/* ── Desktop side panel ── */}
        <div
          className="parking-desktop-panel"
          style={{
            width: panelOpen ? 340 : 0,
            overflow: 'hidden',
            transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
            flexShrink: 0,
            borderLeft: panelOpen ? '1px solid #252a3e' : 'none',
          }}
        >
          {panelOpen && (
            <div style={{ width: 340, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Lot selector */}
              <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid #252a3e',
                background: '#1a1d28',
                flexShrink: 0,
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: '#4b5563', marginBottom: 8,
                }}>
                  Parking Spots
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {lotStatuses.map(lot => (
                    <LotSummaryCard
                      key={lot.id}
                      lotId={lot.id}
                      name={lot.name}
                      status={lot.status}
                      free={lot.free}
                      total={lot.total}
                      active={activeLot === lot.id}
                      onClick={() => setActiveLot(lot.id)}
                    />
                  ))}
                </div>
              </div>
              {/* Active lot detail */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeLot && <LotPanel key={activeLot} lotId={activeLot} />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile bottom sheet ── */}
      <div
        className="parking-mobile-panel"
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
          transform: panelOpen ? 'translateY(0)' : 'translateY(calc(100% - 52px))',
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Drag handle */}
        <div
          onClick={() => setPanelOpen(p => !p)}
          style={{
            background: '#1a1d28',
            borderTop: '1px solid #252a3e',
            borderRadius: '14px 14px 0 0',
            padding: '10px 18px 0',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div style={{
            width: 32, height: 4, borderRadius: 2, background: '#374151',
            margin: '0 auto 8px', position: 'absolute', left: '50%', top: 8,
            transform: 'translateX(-50%)',
          }} />
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
            {totalSpaces > 0 ? (
              <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
                {t.mobileStrip(totalFree, totalSpaces)}
                {' · '}{panelOpen ? t.hidePanel : t.showPanel}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: '#4b5563' }}>
                {panelOpen ? t.hidePanel : t.showPanel}
              </span>
            )}
          </div>
        </div>

        {/* Mobile lot tabs + active panel */}
        <div style={{ background: '#1a1d28' }}>
          {/* Lot tabs */}
          <div style={{
            display: 'flex', gap: 6, padding: '0 14px 10px',
            overflowX: 'auto',
          }}>
            {lotStatuses.map(lot => (
              <button
                key={lot.id}
                onClick={() => setActiveLot(lot.id)}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 7,
                  background: activeLot === lot.id ? '#252a3e' : 'transparent',
                  border: activeLot === lot.id ? '1px solid #3a4060' : '1px solid transparent',
                  color: activeLot === lot.id ? '#eee' : '#6b7280',
                  fontSize: 11, fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {lot.name}
              </button>
            ))}
          </div>

          {/* Active lot panel */}
          {activeLot && <LotPanel key={`mobile-${activeLot}`} lotId={activeLot} />}
        </div>
      </div>

      {/* Responsive: show/hide desktop vs mobile panels */}
      <style>{`
        @media (min-width: 640px) {
          .parking-mobile-panel { display: none !important; }
          .parking-desktop-panel { display: flex !important; }
        }
        @media (max-width: 639px) {
          .parking-mobile-panel { display: block !important; }
          .parking-desktop-panel { display: none !important; }
        }
      `}</style>
    </div>
  )
}
