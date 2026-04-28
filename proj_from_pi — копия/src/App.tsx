import { useState, useRef, useEffect } from 'react'
import MapView from './components/MapView'
import ParkingPanel from './components/ParkingPanel'
import { useParkingLot } from './hooks/useParkingLot'
import { useLang, LANG_LABELS } from './i18n/LanguageContext'
import type { Lang } from './i18n/translations'

// ─── Parking pin on the map ────────────────────────────────────────────────

// Status → bubble colour when panel is open
const STATUS_PIN_COLOR: Record<string, string> = {
  available: '#4ade80',
  limited:   '#facc15',
  full:      '#f87171',
}

function ParkingPin({ onClick, active, free, status }: {
  onClick: () => void
  active: boolean
  free: number | null
  status: string | null
}) {
  // Colour logic:
  //   active + status known → status colour with dark text
  //   active + no status   → yellow (existing brand default)
  //   inactive             → dark bg with yellow P
  const pinColor = active
    ? (status ? STATUS_PIN_COLOR[status] ?? '#F7C12E' : '#F7C12E')
    : '#1a1d28'
  const textColor = active ? '#111' : '#F7C12E'

  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        left: '43%',
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
      {/* Bubble */}
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
      {/* Pointer stem */}
      <div style={{
        width: 2,
        height: 8,
        background: active ? pinColor : '#3a4060',
        borderRadius: 1,
        transition: 'background 0.25s',
      }} />
      {/* Shadow dot */}
      <div style={{
        width: 6, height: 3,
        background: 'rgba(0,0,0,0.4)',
        borderRadius: '50%',
        filter: 'blur(1px)',
        marginTop: 0,
      }} />
    </button>
  )
}

// ─── Compass rose ──────────────────────────────────────────────────────────

function Compass() {
  return (
    <div style={{
      position: 'absolute',
      top: 16, right: 16,
      width: 36, height: 36,
      background: 'rgba(26,29,40,0.85)',
      border: '1px solid #252a3e',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
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
      position: 'absolute',
      bottom: 16,
      left: 16,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 2,
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
      position: 'absolute',
      bottom: 16,
      right: 16,
      fontSize: 9,
      color: '#374151',
      background: 'rgba(26,29,40,0.7)',
      padding: '2px 6px',
      borderRadius: 4,
      backdropFilter: 'blur(4px)',
    }}>
      © Times Parking Navigator · Алматы
    </div>
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s',
        }}
      >
        {/* Gear SVG */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          background: '#1a1d28',
          border: '1px solid #252a3e',
          borderRadius: 10,
          padding: '6px',
          minWidth: 130,
          zIndex: 100,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#4b5563',
            padding: '4px 8px 6px',
          }}>
            {t.language}
          </div>
          {(Object.entries(LANG_LABELS) as [Lang, string][]).map(([code, label]) => (
            <button
              key={code}
              onClick={() => { setLang(code); setOpen(false) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '7px 10px',
                background: lang === code ? '#252a3e' : 'transparent',
                border: 'none',
                borderRadius: 7,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: lang === code ? 700 : 500,
                color: lang === code ? '#F7C12E' : '#9ca3af',
                textAlign: 'left',
                transition: 'background 0.12s',
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

// ─── Main app ─────────────────────────────────────────────────────────────

export default function App() {
  const { data, error, loading, lastPoll } = useParkingLot()
  const [panelOpen, setPanelOpen] = useState(true)
  const { t } = useLang()

  return (
    <div style={{
      width: '100vw',
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: '#12141a',
      fontFamily: "'Space Grotesk', 'DM Sans', sans-serif",
      overflow: 'hidden',
    }}>
      {/* ── Top bar ── */}
      <div style={{
        height: 52,
        background: '#1a1d28',
        borderBottom: '1px solid #252a3e',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        flexShrink: 0,
        zIndex: 20,
      }}>
        <div style={{
          background: '#F7C12E',
          color: '#111',
          fontWeight: 900,
          fontSize: 13,
          padding: '2px 7px',
          borderRadius: 5,
          letterSpacing: '0.04em',
        }}>T</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#eee', lineHeight: 1.2 }}>
            {t.appTitle}
          </div>
          <div style={{ fontSize: 10, color: '#4b5563' }}>{t.appSubtitle}</div>
        </div>

        {/* Lot status chip */}
        {data && (
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#252a3e',
            borderRadius: 999,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 600,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: data.status === 'available' ? '#4ade80'
                : data.status === 'limited' ? '#facc15' : '#f87171',
            }} />
            <span style={{ color: '#d1d5db' }}>
              {t.freeChip(data.free_spaces, data.total_spaces)}
            </span>
          </div>
        )}

        {/* Gear / language selector */}
        <div style={{ marginLeft: data ? 8 : 'auto' }}>
          <LangDropdown />
        </div>
      </div>

      {/* ── Map + panel layout ── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>

        {/* Map fills all available space */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapView>
            <ParkingPin
              onClick={() => setPanelOpen(p => !p)}
              active={panelOpen}
              free={data?.free_spaces ?? null}
              status={data?.status ?? null}
            />
            <Compass />
            <ScaleBar />
            <Attribution />
          </MapView>
        </div>

        {/* ── Desktop side panel (hidden on mobile via media query) ── */}
        <div
          className="parking-desktop-panel"
          style={{
            width: panelOpen ? 320 : 0,
            overflow: 'hidden',
            transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
            flexShrink: 0,
            borderLeft: panelOpen ? '1px solid #252a3e' : 'none',
          }}
        >
          {panelOpen && (
            <div style={{ width: 320, height: '100%', overflow: 'hidden' }}>
              <ParkingPanel
                data={data}
                error={error}
                loading={loading}
                lastPoll={lastPoll}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile bottom sheet ── */}
      <div
        className="parking-mobile-panel"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          transform: panelOpen ? 'translateY(0)' : 'translateY(calc(100% - 52px))',
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Drag handle / peek strip */}
        <div
          onClick={() => setPanelOpen(p => !p)}
          style={{
            background: '#1a1d28',
            borderTop: '1px solid #252a3e',
            borderRadius: '14px 14px 0 0',
            padding: '10px 18px 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 4, borderRadius: 2,
              background: '#374151',
              margin: '0 auto 8px',
              position: 'absolute',
              left: '50%',
              top: 8,
              transform: 'translateX(-50%)',
            }} />
          </div>
          <div style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            paddingBottom: 8,
          }}>
            {data ? (
              <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
                {t.mobileStrip(data.free_spaces, data.total_spaces)}
                {' · '}{panelOpen ? t.hidePanel : t.showPanel}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: '#4b5563' }}>
                {panelOpen ? t.hidePanel : t.showPanel}
              </span>
            )}
          </div>
        </div>

        <ParkingPanel
          data={data}
          error={error}
          loading={loading}
          lastPoll={lastPoll}
          compact
        />
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