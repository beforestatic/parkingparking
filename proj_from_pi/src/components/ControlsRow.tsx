import { useState } from 'react'
import type { ParkingState } from '../types/parking'

function toLabel(scenario: string) {
  return scenario
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

interface Props {
  state: ParkingState | null
  onScenario: (name: string) => Promise<void>
  onPause: (paused: boolean) => Promise<void>
  onBaseline: () => Promise<void>
}

export default function ControlsRow({ state, onScenario, onPause, onBaseline }: Props) {
  const [scenarioBusy, setScenarioBusy] = useState(false)
  const [pauseBusy, setPauseBusy] = useState(false)
  const [baselineBusy, setBaselineBusy] = useState(false)

  async function handleScenario(e: React.ChangeEvent<HTMLSelectElement>) {
    setScenarioBusy(true)
    try { await onScenario(e.target.value) } finally { setScenarioBusy(false) }
  }

  async function handlePause() {
    setPauseBusy(true)
    try { await onPause(!state?.paused) } finally { setPauseBusy(false) }
  }

  async function handleBaseline() {
    setBaselineBusy(true)
    try { await onBaseline() } finally { setBaselineBusy(false) }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* ── Scenario selector ── */}
      <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
          Scenario
        </label>
        <select
          disabled={scenarioBusy || !state}
          onChange={handleScenario}
          defaultValue=""
          className="flex-1 min-w-0 text-xs font-medium rounded-md border border-border bg-card
            text-foreground px-2.5 py-1.5 appearance-none
            focus:outline-none focus:ring-1 focus:ring-primary/50
            disabled:opacity-50 disabled:cursor-not-allowed
            cursor-pointer"
        >
          <option value="" disabled>
            {state ? `— select —` : 'Loading…'}
          </option>
          {state?.scenarios.map(s => (
            <option key={s} value={s}>{toLabel(s)}</option>
          ))}
        </select>
      </div>

      {/* ── Pause toggle ── */}
      <button
        onClick={handlePause}
        disabled={pauseBusy || !state}
        className={`
          flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${state?.paused
            ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30'
            : 'bg-card border-border text-foreground hover:bg-muted'
          }
        `}
      >
        {pauseBusy ? (
          <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : state?.paused ? (
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            <polygon points="4,2 14,8 4,14" />
          </svg>
        ) : (
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="4" height="12" />
            <rect x="9" y="2" width="4" height="12" />
          </svg>
        )}
        {state?.paused ? 'Resume' : 'Pause'}
      </button>

      {/* ── Set Baseline ── */}
      <button
        onClick={handleBaseline}
        disabled={baselineBusy || !state || state.mode !== 'live'}
        title={state?.mode !== 'live' ? 'Only available in live mode' : undefined}
        className="
          flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border
          bg-card border-border text-foreground
          hover:bg-muted transition-colors
          disabled:opacity-40 disabled:cursor-not-allowed
        "
      >
        {baselineBusy ? (
          <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        ) : (
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 8h12M8 2v12" />
          </svg>
        )}
        Set Baseline
        {state?.baseline_set && (
          <span className="text-violet-400 text-[10px] font-bold">✓</span>
        )}
      </button>
    </div>
  )
}
