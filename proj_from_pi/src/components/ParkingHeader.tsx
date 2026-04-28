import type { ParkingState } from '../types/parking'

interface Props {
  state: ParkingState | null
  error: string | null
  loading: boolean
}

const AVAILABILITY_COLOR = (free: number, total: number) => {
  if (total === 0) return 'text-muted-foreground'
  const pct = free / total
  if (pct === 0) return 'text-red-400'
  if (pct <= 0.3) return 'text-amber-400'
  return 'text-emerald-400'
}

export default function ParkingHeader({ state, error, loading }: Props) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-b border-border bg-card">
      {/* Logo + title */}
      <div className="flex items-center gap-2 mr-2">
        <div className="bg-primary text-primary-foreground font-black text-sm px-2 py-0.5 rounded-[5px] tracking-wide">
          T
        </div>
        <span className="font-bold text-sm text-foreground tracking-tight whitespace-nowrap">
          Times Parking
        </span>
      </div>

      {/* Big free/total counter */}
      {!loading && state && (
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-black leading-none ${AVAILABILITY_COLOR(state.free, state.total)}`}>
            {state.free}
          </span>
          <span className="text-muted-foreground text-base font-semibold">
            / {state.total}
          </span>
          <span className="text-muted-foreground text-xs ml-1 hidden sm:inline">
            spaces free
          </span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="h-8 w-24 rounded bg-muted animate-pulse" />
      )}

      {/* Badges — push right on wider screens */}
      <div className="flex items-center gap-2 ml-auto flex-wrap">
        {state && (
          <>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${
              state.mode === 'live'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            }`}>
              {state.mode}
            </span>

            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
              {state.fps.toFixed(1)} fps
            </span>

            {state.paused && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest bg-blue-500/15 text-blue-400 border border-blue-500/30">
                paused
              </span>
            )}

            {state.baseline_set && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest bg-violet-500/15 text-violet-400 border border-violet-500/30">
                baseline ✓
              </span>
            )}
          </>
        )}

        {error && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse">
            offline
          </span>
        )}
      </div>
    </header>
  )
}
