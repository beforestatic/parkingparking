import type { NavigatorLogEntry } from '../types/parking'

function formatTs(ts: string) {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ts
  }
}

interface Props {
  entries: NavigatorLogEntry[] | undefined
  loading: boolean
}

export default function NavigatorLog({ entries, loading }: Props) {
  const recent = entries ? [...entries].reverse().slice(0, 5) : []

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Navigator Log
        </span>
        <span className="text-[10px] text-muted-foreground/50 font-mono">
          last {recent.length} entries
        </span>
      </div>

      <div className="divide-y divide-border">
        {loading && !entries && (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5">
              <div className="h-3 w-16 bg-muted animate-pulse rounded" />
              <div className="h-3 w-24 bg-muted animate-pulse rounded ml-auto" />
            </div>
          ))
        )}

        {!loading && recent.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted-foreground/50 text-center">
            No log entries yet
          </div>
        )}

        {recent.map((entry, i) => {
          const pct = entry.total_spaces
            ? Math.round((entry.free_spaces / entry.total_spaces) * 100)
            : 0
          const color = pct === 0
            ? 'text-red-400'
            : pct <= 30 ? 'text-amber-400'
            : 'text-emerald-400'

          return (
            <div key={i} className="flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted/30 transition-colors">
              {/* Lot ID */}
              <span className="font-mono text-[10px] text-muted-foreground/60 truncate max-w-[100px]">
                {entry.lot_id}
              </span>

              {/* Free / total */}
              <span className={`font-bold ml-auto whitespace-nowrap ${color}`}>
                {entry.free_spaces}
                <span className="text-muted-foreground font-normal">/{entry.total_spaces}</span>
              </span>

              {/* Timestamp */}
              <span className="font-mono text-[10px] text-muted-foreground/50 whitespace-nowrap">
                {formatTs(entry.timestamp)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
