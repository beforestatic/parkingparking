/**
 * /admin — Multi-lot admin panel
 *
 * Features:
 * - List all parking lots with status
 * - Create / edit / delete lots
 * - Assign camera index per lot
 * - Enable / disable lots
 * - Camera feed preview per lot
 * - Detection controls per lot
 * - Calibration
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useParkingLot } from '../hooks/useParkingLot'
import { useLots } from '../hooks/useLots'
import type { LotRegistryItem } from '../hooks/useLots'
import { useLang } from '../i18n/LanguageContext'

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
      : variant === 'danger' ? '#7f1d1d'
      : '#252a3e',
    color:
      variant === 'primary' ? '#111'
      : variant === 'danger' ? '#fca5a5'
      : '#d1d5db',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    lineHeight: 1,
  }),
  input: {
    padding: '7px 10px',
    borderRadius: 7,
    border: '1px solid #252a3e',
    background: '#12141a',
    color: '#e5e7eb',
    fontSize: 12,
    outline: 'none',
    width: '100%',
  } as React.CSSProperties,
}

const SPACE_BG: Record<string, { bg: string; color: string }> = {
  free:     { bg: '#14532d', color: '#86efac' },
  occupied: { bg: '#7f1d1d', color: '#fca5a5' },
  unknown:  { bg: '#1f2937', color: '#6b7280' },
}

// ─── API helpers ───────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function apiPost<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function apiPatch<T>(path: string, body: object): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
}

// ─── Camera Feed ───────────────────────────────────────────────────────────

function CameraFeed({ cameraIndex, lotName }: { cameraIndex: number; lotName: string }) {
  const [error, setError] = useState(false)
  const { t } = useLang()
  const src = `/stream`  // TODO: support /stream/{index} when multi-camera backend is ready

  return (
    <div style={S.card}>
      <span style={S.label}>{t.cameraFeed} — {lotName}</span>
      {error ? (
        <div style={{
          background: '#12141a', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          aspectRatio: '16/9', color: '#4b5563', fontSize: 12,
        }}>
          {t.cameraOffline} — <code style={{ margin: '0 4px', color: '#6b7280' }}>camera {cameraIndex}</code>
        </div>
      ) : (
        <img
          src={src}
          alt={`Camera ${cameraIndex} — ${lotName}`}
          onError={() => setError(true)}
          style={{ width: '100%', borderRadius: 8, display: 'block' }}
        />
      )}
    </div>
  )
}

// ─── Space Grid ────────────────────────────────────────────────────────────

function SpaceGrid({ lotId }: { lotId: string }) {
  const { data, error } = useParkingLot(lotId)
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
                    flex: 1, aspectRatio: '1 / 1.6',
                    background: c.bg, color: c.color,
                    borderRadius: 6,
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    paddingBottom: 4, fontSize: 10, fontWeight: 700,
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

// ─── Lot Editor (create / edit) ────────────────────────────────────────────

interface LotFormData {
  id: string
  name: string
  address: string
  camera_index: number
}

function LotEditor({ lot, onSave, onCancel }: {
  lot?: LotRegistryItem | null
  onSave: (data: LotFormData) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useLang()
  const [form, setForm] = useState<LotFormData>({
    id: lot?.id ?? '',
    name: lot?.name ?? '',
    address: lot?.address ?? '',
    camera_index: lot?.camera_index ?? 0,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave(form)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const isNew = !lot

  return (
    <form onSubmit={handleSubmit} style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={S.label}>{isNew ? t.newLot : `${t.editLot}: ${lot?.name}`}</span>

      {error && (
        <p style={{ fontSize: 11, color: '#f87171', margin: 0 }}>{error}</p>
      )}

      <div>
        <label style={{ ...S.label, marginBottom: 4 }}>{t.lotId}</label>
        <input
          style={{ ...S.input, opacity: isNew ? 1 : 0.5 }}
          value={form.id}
          onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
          disabled={!isNew}
          required
          placeholder="spot-01"
        />
      </div>

      <div>
        <label style={{ ...S.label, marginBottom: 4 }}>{t.lotName}</label>
        <input
          style={S.input}
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          required
          placeholder="East Parking"
        />
      </div>

      <div>
        <label style={{ ...S.label, marginBottom: 4 }}>{t.lotAddress}</label>
        <input
          style={S.input}
          value={form.address}
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          placeholder="123 Main St"
        />
      </div>

      <div>
        <label style={{ ...S.label, marginBottom: 4 }}>{t.cameraIndex}</label>
        <input
          style={{ ...S.input, width: 80 }}
          type="number"
          min={0}
          value={form.camera_index}
          onChange={e => setForm(f => ({ ...f, camera_index: parseInt(e.target.value) || 0 }))}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button type="submit" style={S.btn('primary')} disabled={busy}>
          {busy ? 'Saving…' : isNew ? t.createLot : t.saveChanges}
        </button>
        <button type="button" style={S.btn('ghost')} onClick={onCancel} disabled={busy}>
          {t.cancel}
        </button>
      </div>
    </form>
  )
}

// ─── Lot Card (list item) ──────────────────────────────────────────────────

function LotCard({ lot, onEdit, onDelete, onToggle, onSelect, selected }: {
  lot: LotRegistryItem
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onSelect: () => void
  selected: boolean
}) {
  const { data } = useParkingLot(lot.id)
  const { t } = useLang()
  const statusColor = data?.status === 'available' ? '#4ade80'
    : data?.status === 'limited' ? '#facc15'
    : data?.status === 'full' ? '#f87171'
    : '#4b5563'

  return (
    <div style={{
      ...S.card,
      borderColor: selected ? '#F7C12E44' : '#252a3e',
      opacity: lot.enabled ? 1 : 0.5,
      cursor: 'pointer',
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} onClick={onSelect}>
        {/* Status dot */}
        <span style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: lot.enabled ? statusColor : '#374151',
          boxShadow: lot.enabled ? `0 0 8px ${statusColor}44` : 'none',
        }} />

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#eee', lineHeight: 1.3 }}>
            {lot.name}
            {!lot.enabled && (
              <span style={{
                marginLeft: 8, fontSize: 9, fontWeight: 600,
                color: '#f87171', letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                {t.disabled}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
            {lot.id} · cam {lot.camera_index} · {lot.total_spaces} spaces
          </div>
          {lot.address && (
            <div style={{ fontSize: 10, color: '#374151', marginTop: 1 }}>{lot.address}</div>
          )}
        </div>

        {/* Live count */}
        {data && lot.enabled && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: statusColor, lineHeight: 1 }}>
              {data.free_spaces}
            </div>
            <div style={{ fontSize: 10, color: '#6b7280' }}>/ {data.total_spaces}</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px solid #252a3e' }}>
        <button style={S.btn('ghost')} onClick={onEdit}>{t.editLot}</button>
        <button
          style={S.btn(lot.enabled ? 'ghost' : 'primary')}
          onClick={onToggle}
        >
          {lot.enabled ? t.disable : t.enable}
        </button>
        <button
          style={{ ...S.btn('danger'), marginLeft: 'auto' }}
          onClick={onDelete}
        >
          {t.delete}
        </button>
      </div>
    </div>
  )
}

// ─── Detection Controls ────────────────────────────────────────────────────

function DetectionControls({ lotId }: { lotId: string }) {
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
      <span style={S.label}>{t.detectionControls} — {lotId}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          style={S.btn('primary')}
          disabled={busy}
          onClick={() => run(t.setBaseline, () => apiPost('/admin-api/baseline'))}
        >
          {t.setBaseline}
        </button>
        <button
          style={S.btn('ghost')}
          disabled={busy}
          onClick={() => run(t.captureSnapshot, async () => {
            const res = await fetch('/admin-api/capture_snapshot', { method: 'POST' })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `baseline_${lotId}.jpg`
            a.click()
            URL.revokeObjectURL(url)
          })}
        >
          {t.captureSnapshot}
        </button>
      </div>
      {status && (
        <p style={{
          marginTop: 10, fontSize: 11,
          color: status.startsWith('✓') ? '#4ade80' : '#f87171',
        }}>{status}</p>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { lots, loading, refresh } = useLots()
  const { t } = useLang()
  const [selectedLot, setSelectedLot] = useState<string | null>(null)
  const [editing, setEditing] = useState<LotRegistryItem | null>(null)  // null = not editing, LotRegistryItem = editing, undefined = creating
  const [creating, setCreating] = useState(false)
  const [pageStatus, setPageStatus] = useState<string | null>(null)

  // Auto-select first lot
  useEffect(() => {
    if (lots.length > 0 && !selectedLot) {
      setSelectedLot(lots[0].id)
    }
  }, [lots, selectedLot])

  const showStatus = useCallback((msg: string) => {
    setPageStatus(msg)
    setTimeout(() => setPageStatus(null), 4000)
  }, [])

  async function handleCreate(data: LotFormData) {
    await apiPost('/admin/lots', {
      id: data.id,
      name: data.name,
      address: data.address,
      camera_index: data.camera_index,
      enabled: true,
      tiers: [{ id: 'main', label: 'Main', spaces: [] }],  // empty tiers, user adds later
    })
    setCreating(false)
    showStatus(`✓ Created lot "${data.name}"`)
    await refresh()
    setSelectedLot(data.id)
  }

  async function handleEdit(data: LotFormData) {
    if (!editing) return
    await apiPatch(`/admin/lots/${editing.id}`, {
      name: data.name,
      address: data.address,
      camera_index: data.camera_index,
    })
    setEditing(null)
    showStatus(`✓ Updated "${data.name}"`)
    await refresh()
  }

  async function handleDelete(lotId: string) {
    if (!confirm(`Delete lot "${lotId}"? This cannot be undone.`)) return
    try {
      await apiDelete(`/admin/lots/${lotId}`)
      showStatus(`✓ Deleted lot "${lotId}"`)
      if (selectedLot === lotId) setSelectedLot(null)
      await refresh()
    } catch (e: any) {
      showStatus(`✗ ${e.message}`)
    }
  }

  async function handleToggle(lot: LotRegistryItem) {
    try {
      await apiPatch(`/admin/lots/${lot.id}`, { enabled: !lot.enabled })
      showStatus(`✓ ${lot.enabled ? 'Disabled' : 'Enabled'} "${lot.name}"`)
      await refresh()
    } catch (e: any) {
      showStatus(`✗ ${e.message}`)
    }
  }

  const selectedLotData = lots.find(l => l.id === selectedLot)

  return (
    <div style={{
      minHeight: '100dvh', background: '#12141a', color: '#e5e7eb',
      fontFamily: "'Space Grotesk', 'DM Sans', sans-serif",
      padding: '20px 16px 40px', boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Back link */}
        <a href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: '#6b7280', textDecoration: 'none', marginBottom: 20,
        }}>
          {t.backToMap}
        </a>

        {/* Header */}
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
              Multi-lot management · {lots.length} lot{lots.length !== 1 ? 's' : ''} registered
            </div>
          </div>
        </div>

        {/* Status message */}
        {pageStatus && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            fontSize: 12, fontWeight: 600,
            background: pageStatus.startsWith('✓') ? '#14532d22' : '#7f1d1d22',
            color: pageStatus.startsWith('✓') ? '#4ade80' : '#f87171',
            border: `1px solid ${pageStatus.startsWith('✓') ? '#14532d' : '#7f1d1d'}`,
          }}>
            {pageStatus}
          </div>
        )}

        {/* Lot list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={S.label}>{t.parkingLots}</span>
            <button
              style={S.btn('primary')}
              onClick={() => { setCreating(true); setEditing(null) }}
            >
              {t.addLot}
            </button>
          </div>

          {loading && (
            <p style={{ fontSize: 12, color: '#4b5563' }}>Loading…</p>
          )}

          {!loading && lots.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', padding: 30 }}>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
                No parking lots registered yet.
              </p>
              <button style={S.btn('primary')} onClick={() => setCreating(true)}>
                {t.createLot}
              </button>
            </div>
          )}

          {lots.map(lot => (
            <LotCard
              key={lot.id}
              lot={lot}
              selected={selectedLot === lot.id}
              onSelect={() => setSelectedLot(lot.id)}
              onEdit={() => { setEditing(lot); setCreating(false) }}
              onDelete={() => handleDelete(lot.id)}
              onToggle={() => handleToggle(lot)}
            />
          ))}
        </div>

        {/* Create / Edit form */}
        {(creating || editing) && (
          <div style={{ marginBottom: 20 }}>
            <LotEditor
              lot={editing}
              onSave={editing ? handleEdit : handleCreate}
              onCancel={() => { setCreating(false); setEditing(null) }}
            />
          </div>
        )}

        {/* Selected lot details */}
        {selectedLotData && !creating && !editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CameraFeed
              cameraIndex={selectedLotData.camera_index}
              lotName={selectedLotData.name}
            />
            <SpaceGrid lotId={selectedLotData.id} />
            <DetectionControls lotId={selectedLotData.id} />
          </div>
        )}
      </div>
    </div>
  )
}
