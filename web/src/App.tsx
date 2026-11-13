import { useEffect, useState } from 'react'
import { Calibration } from './components/Calibration'
import { Compute } from './components/Compute'
import { Domain } from './components/Domain'
import { Exposure } from './components/Exposure'
import { Method } from './components/Method'
import { ModelSetup } from './components/ModelSetup'
import { Overview } from './components/Overview'
import { Rainfall } from './components/Rainfall'
import { Risk } from './components/Risk'
import { StaticInputs } from './components/StaticInputs'
import { Vulnerability } from './components/Vulnerability'
import { loadData } from './data'
import { usePalette } from './theme'
import type { SiteData } from './types'

const TABS = [
  ['overview', 'Overview'],
  ['domain', 'Modelling domain'],
  ['inputs', 'Static inputs'],
  ['rainfall', 'Rainfall'],
  ['setup', 'Model setup'],
  ['compute', 'Compute planner'],
  ['exposure', 'Exposure'],
  ['vulnerability', 'Vulnerability'],
  ['risk', 'Risk'],
  ['calibration', 'Calibration & validation'],
  ['method', 'Method & sources'],
] as const
export type TabKey = (typeof TABS)[number][0]

/** Sub-tabs grouped under the Hazard tab (each keeps its own URL hash). */
const HAZARD: readonly TabKey[] = ['domain', 'inputs', 'rainfall', 'setup', 'compute']
const label = (k: TabKey) => TABS.find(([t]) => t === k)![1]
/** Top-level navigation: Hazard replaces its sub-tabs, at the position of the first one. */
const TOP: readonly (TabKey | 'hazard')[] = TABS.map(([k]) => k)
  .filter((k) => !HAZARD.includes(k) || k === HAZARD[0])
  .map((k) => (k === HAZARD[0] ? 'hazard' : k))

function initialTab(): TabKey {
  const h = window.location.hash.slice(1)
  return (TABS.find(([k]) => k === h)?.[0] ?? 'overview') as TabKey
}

export default function App() {
  const { palette, dark } = usePalette()
  const [data, setData] = useState<SiteData>()
  const [error, setError] = useState<string>()
  const [tab, setTab] = useState<TabKey>(initialTab)

  useEffect(() => {
    loadData().then(setData).catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    const onHash = () => setTab(initialTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (k: TabKey) => {
    window.location.hash = k
    setTab(k)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
      <header>
        <p className="text-sm font-medium text-accent">Prevention · pluvial flood hazard</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Madagascar · Pluvial flood modelling</h1>
        <p className="max-w-3xl text-sm text-ink-2">
          Rain-on-grid flood modelling with SFINCS, one model per catchment, built from public global data. How the
          modelling domain, the static inputs and the design rainfall are set up, with the figures produced along the way.
        </p>
      </header>

      <div role="note" className="rounded-lg bg-banner px-4 py-2 text-sm text-ink">
        <strong>Work in progress.</strong> Inputs and model setup are complete; the design flood runs are pending, so
        no pluvial flood hazard results are shown yet. The Risk tab demonstrates the loss computation on placeholder
        (riverine) depth maps.
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-line" aria-label="Sections">
        {TOP.map((k) => {
          const active = k === 'hazard' ? HAZARD.includes(tab) : tab === k
          return (
            <button
              key={k}
              onClick={() => go(k === 'hazard' ? HAZARD[0] : k)}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm ${
                active ? 'border-accent font-medium text-ink' : 'border-transparent text-ink-2 hover:text-ink'
              }`}
            >
              {k === 'hazard' ? 'Hazard' : label(k)}
            </button>
          )
        })}
      </nav>

      {HAZARD.includes(tab) && (
        <nav className="-mt-2 flex gap-1 overflow-x-auto border-b border-line" aria-label="Hazard sections">
          {HAZARD.map((k) => (
            <button
              key={k}
              onClick={() => go(k)}
              aria-current={tab === k ? 'page' : undefined}
              className={`-mb-px shrink-0 border-b-2 px-3 py-1.5 text-[13px] ${
                tab === k ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink'
              }`}
            >
              {label(k)}
            </button>
          ))}
        </nav>
      )}

      {error && <div className="p-8 text-ink">Could not load data: {error}</div>}
      {!data && !error && <div className="p-8 text-ink-3">Loading…</div>}
      {data && (
        <main className="min-w-0">
          {tab === 'overview' && <Overview data={data} go={go} />}
          {tab === 'domain' && <Domain domain={data.domain} catchments={data.catchments} palette={palette} dark={dark} />}
          {tab === 'inputs' && <StaticInputs catchments={data.catchments} palette={palette} dark={dark} />}
          {tab === 'rainfall' && <Rainfall rainfall={data.rainfall} cyclones={data.cyclones} tracks={data.tracks} catchments={data.catchments} palette={palette} dark={dark} />}
          {tab === 'setup' && <ModelSetup catchments={data.catchments} palette={palette} dark={dark} />}
          {tab === 'exposure' && <Exposure exposure={data.exposure} catchments={data.catchments} palette={palette} dark={dark} />}
          {tab === 'vulnerability' && <Vulnerability curves={data.vulnerability} exposure={data.exposure} palette={palette} />}
          {tab === 'risk' && <Risk palette={palette} dark={dark} />}
          {tab === 'calibration' && <Calibration palette={palette} />}
          {tab === 'compute' && <Compute benchmark={data.benchmark} prices={data.prices} palette={palette} />}
          {tab === 'method' && <Method />}
        </main>
      )}

      <footer className="pt-4 text-sm text-ink-3">
        © 2026 Alvaro Prida · Site code under the MIT licence; data and figures follow the licences of their sources
        (see Method &amp; sources). Research work in progress, not an official hazard map.
      </footer>
    </div>
  )
}
