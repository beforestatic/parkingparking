import { useEffect, useRef, useState } from 'react'
import type { ParkingSpace } from '../types/parking'

// ─── Individual space card ─────────────────────────────────────────────────

interface SpaceCardProps {
  space: ParkingSpace
}

function SpaceCard({ space }: SpaceCardProps) {
  const [pulse, setPulse] = useState(false)
  const prevChangedRef = useRef(space.changed)

  // Trigger a brief pulse animation whenever `changed` flips to true
  useEffect(() => {
    if (space.changed && !prevChangedRef.current) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 1200)
      return () => clearTimeout(t)
    }
    prevChangedRef.current = space.changed
  }, [space.changed])

  const base = space.free
    ? 'bg-emerald-950/80 border-emerald-700/50 text-emerald-300'
    : 'bg-red-950/80 border-red-700/50 text-red-300'

  const pulseRing = pulse
    ? space.free
      ? 'ring-2 ring-emerald-400/70 ring-offset-1 ring-offset-background'
      : 'ring-2 ring-red-400/70 ring-offset-1 ring-offset-background'
    : ''

  return (
    <div
      className={`
        relative flex flex-col items-center justify-between
        border rounded-lg px-2 pt-2 pb-2.5 select-none
        transition-all duration-300
        ${base} ${pulseRing}
      `}
      style={{ aspectRatio: '1 / 1.75', minWidth: 0 }}
    >
      {/* Centre divider line — visual parking marking */}
      <div className="absolute top-3 bottom-6 left-1/2 -translate-x-1/2 w-px opacity-20 rounded-full"
        style={{ background: 'currentColor' }} />

      {/* Status dot */}
      <span className={`
        w-2 h-2 rounded-full flex-shrink-0 mt-0.5
        ${space.free ? 'bg-emerald-400' : 'bg-red-400'}
        ${pulse ? 'animate-ping' : ''}
      `} />

      {/* Space ID label */}
      <span className="text-[11px] font-bold tracking-wide z-10 mt-auto">
        {space.id}
      </span>

      {/* "changed" flash overlay */}
      {pulse && (
        <div className={`
          absolute inset-0 rounded-lg opacity-30 pointer-events-none
          ${space.free ? 'bg-emerald-400' : 'bg-red-400'}
          animate-ping
        `} />
      )}
    </div>
  )
}

// ─── Tier row ──────────────────────────────────────────────────────────────

interface TierRowProps {
  label: string
  spaces: ParkingSpace[]
}

function TierRow({ label, spaces }: TierRowProps) {
  const freeCount = spaces.filter(s => s.free).length
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className={`text-[10px] font-semibold ${freeCount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {freeCount}/{spaces.length} free
        </span>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${spaces.length}, 1fr)` }}>
        {spaces.map(sp => <SpaceCard key={sp.id} space={sp} />)}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="space-y-4">
      {[['Upper Deck', 5], ['Lower Deck', 5]].map(([label, count]) => (
        <div key={label as string}>
          <div className="flex justify-between mb-2">
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            <div className="h-3 w-10 rounded bg-muted animate-pulse" />
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
            {Array.from({ length: count as number }).map((_, i) => (
              <div key={i} className="rounded-lg bg-muted animate-pulse"
                style={{ aspectRatio: '1 / 1.75' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main grid ─────────────────────────────────────────────────────────────

interface Props {
  spaces: ParkingSpace[] | undefined
  loading: boolean
}

export default function ParkingGrid({ spaces, loading }: Props) {
  if (loading || !spaces) return <GridSkeleton />

  const upper = spaces.filter(s => s.id.startsWith('U'))
  const lower = spaces.filter(s => s.id.startsWith('L'))
  const other = spaces.filter(s => !s.id.startsWith('U') && !s.id.startsWith('L'))

  return (
    <div className="space-y-4">
      {upper.length > 0 && <TierRow label="Upper Deck" spaces={upper} />}
      {lower.length > 0 && <TierRow label="Lower Deck (Covered)" spaces={lower} />}
      {other.length > 0 && <TierRow label="Other" spaces={other} />}
    </div>
  )
}
