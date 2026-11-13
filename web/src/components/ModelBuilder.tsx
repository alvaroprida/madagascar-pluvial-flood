import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Map, { Layer, Popup, Source, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import { fmt } from '../format'
import type { Palette } from '../theme'
import type { FeatureCollection } from '../types'
import { Segmented } from './ui'

setWorkerUrl(workerUrl)

const API = 'http://127.0.0.1:8765/api'
const BASEMAP = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
const MDG: [[number, number], [number, number]] = [[43.1, -25.7], [50.6, -11.9]]
const RPS = ['5', '10', '20', '50', '100', '200', '500', '1000']
const RES_PRESETS = [25, 30, 50, 100, 200]
const STORMS = [
  { value: 'nontc', label: 'Non-cyclone · 12 h · ARC II', hours: 12 },
  { value: 'tc', label: 'Cyclone · 72 h · ARC III', hours: 72 },
] as const
const DRAIN_H = 12
type Pop = (typeof STORMS)[number]['value']

interface Check { check: string; status: 'pass' | 'warn' | 'fail'; detail: string }
interface QA {
  status: Check['status']; checks: Check[]; run?: string; run_dir?: string; model_dir?: string
  active_cells?: number; active_km2?: number; basin_km2?: number; run_hours?: number; est_run_minutes?: number
  storm_depth_mm?: number; peak_mm_hr?: number; run_command?: string; res_m?: number
}
interface Summary {
  active_area_km2: number; flooded_area_km2: number; flooded_share_pct: number; max_depth_m: number
  mean_depth_flooded_m: number; p95_depth_flooded_m: number; flooded_volume_m3: number
  area_by_depth_km2: Record<string, number>
  water_balance_mm: { rainfall: number; infiltration: number; effective_rainfall: number; runoff_coefficient: number | null }
  depth_raster_resolution_m: number
}
interface Results {
  run: string; res_m: number; done: boolean; summary?: Summary; figure?: boolean; hmax_tif?: string; results_dir?: string
  overlay?: { coordinates: [[number, number], [number, number], [number, number], [number, number]]; classes: number[] } | null
  sfincs_seconds?: number | null; avg_dt_s?: number | null
}
interface Job {
  id: string; kind?: 'build' | 'run'; status: 'queued' | 'running' | 'done' | 'failed'; stage: string; log: string[]
  result: (QA & Results) | null; error: string | null; seconds?: number
}
interface ModelInfo { built: boolean; model_dir: string; figure: boolean; runs: (QA & { run: string; has_results: boolean })[] }
interface Health {
  ok: boolean; models_dir: string; run_image: string; res_range: [number, number]
  machine: {
    host: { os: string; arch: string; cpu: string; cores: number | null; ram_gb: number | null }
    docker: { running?: boolean; cpus?: number; ram_gb?: number; version?: string; arch?: string; image?: string; image_arch?: string; emulated?: boolean }
  }
  timing: { k_low: number; k_mid: number; k_high: number; n_runs: number; n_measured_here: number }
}

const BADGE: Record<Check['status'], string> = { pass: 'bg-[#1a7f37] text-white', warn: 'bg-[#bf8700] text-white', fail: 'bg-[#cf222e] text-white' }
const ICON: Record<Check['status'], string> = { pass: '✓', warn: '!', fail: '✗' }
// depth classes, light to dark (matplotlib Blues 0.35 -> 1.0, as drawn by the server)
const DEPTH_COLOURS = ['#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08306b']

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, init)
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `${r.status}`)
  return r.json() as Promise<T>
}

const duration = (s: number) => s < 60 ? `${Math.max(1, Math.round(s))} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${fmt(s / 3600, 1)} h`

/** Resolution advice for a catchment of *area* km². */
function advice(area: number) {
  if (area < 100) return { res: 30, text: 'Small catchment: 25–30 m is affordable and resolves streets and small drainage paths. Below 25 m adds no terrain detail (FABDEM is ~30 m).' }
  if (area > 1000) return { res: 100, text: 'Large catchment: 50 m is the reference; 100 m is fine for a first screening (the 25 m subgrid keeps storage and conveyance), at an eighth of the cost.' }
  return { res: 50, text: 'The default: 50 m cells with a 25 m subgrid keep the terrain detail of FABDEM at a moderate cost. Use 25–30 m for urban areas or validation.' }
}

function QAReport({ qa }: { qa: QA }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${BADGE[qa.status]}`}>{qa.status}</span>
        <span className="text-sm text-ink-2">
          {qa.status === 'pass' ? 'The model is complete and consistent with its catchment and storm.'
            : qa.status === 'warn' ? 'Built, with points to look at before running.' : 'Do not run: fix the failed checks first.'}
        </span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {qa.checks.map((c) => (
            <tr key={c.check} className="border-b border-line align-top last:border-0">
              <td className="w-6 py-1.5"><span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${BADGE[c.status]}`}>{ICON[c.status]}</span></td>
              <td className="py-1.5 pr-3 font-medium text-ink">{c.check}</td>
              <td className="py-1.5 text-ink-2">{c.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResultsPanel({ r, figUrl }: { r: Results; figUrl: string }) {
  const s = r.summary!
  const classes = Object.entries(s.area_by_depth_km2)
  const max = Math.max(...classes.map(([, v]) => v), 1e-9)
  const wb = s.water_balance_mm
  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <div className="font-medium text-ink">Results · maximum flood depth</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {[
          ['Flooded area', `${fmt(s.flooded_area_km2, 2)} km²`, `${fmt(s.flooded_share_pct, 1)}% of the catchment`],
          ['Maximum depth', `${fmt(s.max_depth_m, 2)} m`, `95th percentile ${fmt(s.p95_depth_flooded_m, 2)} m`],
          ['Mean depth (flooded)', `${fmt(s.mean_depth_flooded_m, 2)} m`, `volume ${fmt(s.flooded_volume_m3 / 1e6, 2)} M m³`],
          ['Rainfall', `${fmt(wb.rainfall)} mm`, `infiltration ${fmt(wb.infiltration)} mm`],
          ['Runoff coefficient', wb.runoff_coefficient == null ? '–' : fmt(wb.runoff_coefficient, 2), `effective rain ${fmt(wb.effective_rainfall)} mm`],
          ['SFINCS run', r.sfincs_seconds ? duration(r.sfincs_seconds) : '–', r.avg_dt_s ? `mean time step ${fmt(r.avg_dt_s, 1)} s` : ''],
        ].map(([l, v, sub]) => (
          <div key={l}>
            <div className="text-xs text-ink-3">{l}</div>
            <div className="tabular font-semibold text-ink">{v}</div>
            <div className="tabular text-xs text-ink-3">{sub}</div>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-1 text-xs text-ink-3">Flooded area by depth (depths under {fmt(0.1, 1)} m not counted)</div>
        {classes.map(([k, v], i) => (
          <div key={k} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-ink-2">{k}</span>
            <span className="h-3 rounded-sm" style={{ width: `${(v / max) * 70}%`, background: DEPTH_COLOURS[i] }} />
            <span className="tabular text-ink-2">{fmt(v, 2)} km²</span>
          </div>
        ))}
      </div>
      <div className="text-xs text-ink-3">
        Depth raster ({fmt(s.depth_raster_resolution_m)} m, GeoTIFF, open in QGIS): <code className="break-all">{r.hmax_tif}</code>
      </div>
      {r.figure && <a href={figUrl} target="_blank" rel="noreferrer" className="text-sm text-accent underline underline-offset-2">Flood depth figure (full size) →</a>}
    </div>
  )
}

/** Pick a catchment, build its SFINCS model on this machine (local server), check it, run it, look at the flood. */
export function ModelBuilder({ catchments, palette, dark }: { catchments: FeatureCollection; palette: Palette; dark: boolean }) {
  const [selected, setSelected] = useState<string>()
  const [hover, setHover] = useState<{ id: string; area: number; lng: number; lat: number } | null>(null)
  const [pop, setPop] = useState<Pop>('nontc')
  const [rp, setRp] = useState('100')
  const [resText, setResText] = useState('50')
  const [overwrite, setOverwrite] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const [info, setInfo] = useState<ModelInfo>()
  const [results, setResults] = useState<Results>()
  const [showDepth, setShowDepth] = useState(true)
  const [job, setJob] = useState<Job>()
  const [figKey, setFigKey] = useState(0)

  const range = health?.res_range ?? [20, 500]
  const resNum = Number(resText)
  const resOk = Number.isInteger(resNum) && resNum >= range[0] && resNum <= range[1]
  const res = resOk ? String(resNum) : '50'

  const props = useMemo(() => {
    const f = catchments.features.find((x) => String(x.properties?.basin_id) === selected)
    return f?.properties as { basin_id: string; area_km2: number; level: number; endo: number; upstream_inflow_km2: number } | undefined
  }, [catchments, selected])

  // look for the local server, and keep looking while it is absent
  useEffect(() => {
    let stop = false
    const probe = () => api<Health>('/health').then((h) => !stop && setHealth(h)).catch(() => !stop && setHealth(null))
    probe()
    const t = setInterval(probe, 5000)
    return () => { stop = true; clearInterval(t) }
  }, [])
  const connected = !!health

  const runName = `design_${pop}_rp${rp}`
  const refresh = useCallback(() => {
    if (!selected || !connected || !resOk) { setInfo(undefined); setResults(undefined); return }
    api<ModelInfo>(`/models/${selected}?res=${res}`).then(setInfo).catch(() => setInfo(undefined))
    api<Results>(`/results/${selected}?res=${res}&run=${runName}`).then(setResults).catch(() => setResults(undefined))
    setFigKey((k) => k + 1)
  }, [selected, connected, res, resOk, runName])
  useEffect(refresh, [refresh])

  // poll the running job
  useEffect(() => {
    if (!job || job.status === 'done' || job.status === 'failed') return
    const t = setInterval(() => api<Job>(`/jobs/${job.id}`).then((j) => {
      setJob(j)
      if (j.status === 'done' || j.status === 'failed') refresh()
    }).catch(() => undefined), 2000)
    return () => clearInterval(t)
  }, [job, refresh])

  const submit = (kind: 'build' | 'run') => {
    if (!selected || !resOk) return
    api<{ job: string }>(`/${kind}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basin_id: selected, population: pop, return_period: Number(rp), res: resNum, overwrite }),
    }).then((r) => setJob({ id: r.job, kind, status: 'queued', stage: 'queued', log: [], result: null, error: null }))
      .catch((e) => setJob({ id: '-', kind, status: 'failed', stage: '', log: [], result: null, error: String(e) }))
  }

  const onMove = (e: MapLayerMouseEvent) => {
    const p = e.features?.[0]?.properties
    setHover(p ? { id: String(p.basin_id), area: p.area_km2, lng: e.lngLat.lng, lat: e.lngLat.lat } : null)
  }
  const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    const id = f?.properties?.basin_id
    if (!f || !id) return
    setSelected(String(id)); setJob(undefined)
    // zoom to the catchment: at national scale a 50 km² basin is a few pixels
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    const walk = (c: unknown): void => {
      if (Array.isArray(c) && typeof c[0] === 'number') {
        x0 = Math.min(x0, c[0] as number); x1 = Math.max(x1, c[0] as number)
        y0 = Math.min(y0, c[1] as number); y1 = Math.max(y1, c[1] as number)
      } else if (Array.isArray(c)) c.forEach(walk)
    }
    walk((f.geometry as { coordinates: unknown }).coordinates)
    e.target.fitBounds([[x0, y0], [x1, y1]], { padding: 80, maxZoom: 12, duration: 800 })
  }

  const thisRun = info?.runs.find((r) => r.run === runName)
  const qa = job?.kind === 'build' && job.status === 'done' && job.result?.run === runName && String(job.result.res_m) === res ? job.result : thisRun
  const busy = job && (job.status === 'queued' || job.status === 'running')
  const canRun = !!qa && qa.status !== 'fail' && !!health?.machine.docker.running && !busy
  const done = results?.done ? results : undefined

  // run time estimates for the selected catchment and storm
  const storm = STORMS.find((s) => s.value === pop)!
  const hours = storm.hours + DRAIN_H
  const tips = props ? advice(props.area_km2) : undefined
  const estRows = useMemo(() => {
    if (!props || !health) return []
    const rows = [...new Set([...RES_PRESETS, ...(resOk ? [resNum] : [])])].sort((a, b) => a - b)
    return rows.map((r) => {
      const cells = props.area_km2 * 1e6 / (r * r)
      const f = cells * hours * 50 / r
      return { r, cells, lo: f * health.timing.k_low, mid: f * health.timing.k_mid, hi: f * health.timing.k_high }
    })
  }, [props, health, hours, resNum, resOk])
  const m = health?.machine

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="space-y-2">
        <div className="relative h-[640px] overflow-hidden rounded-lg border border-line">
          <Map
            initialViewState={{ bounds: MDG, fitBoundsOptions: { padding: 16 } }}
            mapStyle={dark ? BASEMAP.dark : BASEMAP.light}
            interactiveLayerIds={['mb-fill']}
            cursor={hover ? 'pointer' : 'grab'}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            onClick={onClick}
            onLoad={(e) => e.target.resize()}
            attributionControl={{ compact: true, customAttribution: 'Catchments: HydroSHEDS / HydroBASINS' }}
          >
            <Source id="mb-catchments" type="geojson" data={catchments}>
              <Layer id="mb-fill" type="fill" paint={{
                'fill-color': palette.accent,
                'fill-opacity': ['case', ['==', ['to-string', ['get', 'basin_id']], selected ?? ''], done && showDepth ? 0 : 0.45, 0.08] }} />
              <Layer id="mb-line" type="line" paint={{ 'line-color': palette['text-secondary'], 'line-width': 0.3, 'line-opacity': 0.6 }} />
            </Source>
            {done?.overlay && showDepth && (
              <Source key={`${selected}-${res}-${runName}-${figKey}`} id="mb-depth" type="image"
                url={`${API}/results/${selected}/overlay.png?res=${res}&run=${runName}&k=${figKey}`} coordinates={done.overlay.coordinates}>
                <Layer id="mb-depth-raster" type="raster" paint={{ 'raster-opacity': 0.9, 'raster-resampling': 'nearest', 'raster-fade-duration': 0 }} />
              </Source>
            )}
            <Source id="mb-outlines" type="geojson" data={catchments}>
              <Layer id="mb-hover" type="line" filter={['==', ['to-string', ['get', 'basin_id']], hover?.id ?? '']}
                paint={{ 'line-color': palette['text-primary'], 'line-width': 2 }} />
              <Layer id="mb-selected" type="line" filter={['==', ['to-string', ['get', 'basin_id']], selected ?? '']}
                paint={{ 'line-color': palette.accent, 'line-width': 2.5 }} />
            </Source>
            {hover && (
              <Popup longitude={hover.lng} latitude={hover.lat} closeButton={false} offset={12}>
                <div className="font-medium">{hover.id}</div>
                <div className="tabular text-ink-2">{fmt(hover.area)} km² · click to select</div>
              </Popup>
            )}
          </Map>
        </div>
        {done?.overlay && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-2">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={showDepth} onChange={(e) => setShowDepth(e.target.checked)} className="accent-accent" />
              Maximum flood depth
            </label>
            {done.overlay.classes.map((c, i) => (
              <span key={c} className="flex items-center gap-1">
                <span className="h-3 w-3 rounded-sm" style={{ background: DEPTH_COLOURS[i] }} />
                {i === done.overlay!.classes.length - 1 ? `≥ ${c} m` : `${c}–${done.overlay!.classes[i + 1]} m`}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 text-sm">
        {!props ? (
          <p className="text-ink-3">Click a catchment on the map to select it.</p>
        ) : (
          <div>
            <div className="text-base font-semibold text-ink">Catchment {props.basin_id}</div>
            <div className="tabular text-ink-2">
              {fmt(props.area_km2)} km² · HydroBASINS level {props.level}
              {props.endo === 2 && ' · endorheic sink (closed boundaries)'}
              {props.upstream_inflow_km2 > 0 && ` · receives ${fmt(props.upstream_inflow_km2)} km² from upstream (not modelled)`}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Segmented label="Design storm" value={pop} onChange={setPop} options={STORMS.map((s) => ({ value: s.value, label: s.label }))} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-ink-2">Return period
              <select value={rp} onChange={(e) => setRp(e.target.value)} className="rounded-md border border-line bg-surface px-2 py-1 text-ink">
                {RPS.map((r) => <option key={r} value={r}>{r}-year</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-ink-2">Grid resolution
              <input type="number" min={range[0]} max={range[1]} step={1} value={resText} onChange={(e) => setResText(e.target.value)}
                className={`w-20 rounded-md border bg-surface px-2 py-1 text-ink ${resOk ? 'border-line' : 'border-[#cf222e]'}`} /> m
            </label>
            <span className="flex gap-1">
              {RES_PRESETS.map((r) => (
                <button key={r} onClick={() => setResText(String(r))}
                  className={`rounded border px-1.5 py-0.5 text-xs ${resNum === r ? 'border-accent bg-accent text-white' : 'border-line text-ink-2 hover:text-ink'}`}>{r}</button>
              ))}
            </span>
          </div>
          {!resOk && <p className="text-xs text-[#cf222e]">Whole number of metres between {range[0]} and {range[1]}.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-ink-2">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="accent-accent" />
              Rebuild from scratch
            </label>
            <span className="text-ink-3">Baseline climate</span>
          </div>
        </div>

        {props && health && tips && (
          <div className="rounded-lg border border-line p-3">
            <div className="mb-1 font-medium text-ink">Resolution and run time</div>
            <p className="mb-2 text-ink-2"><b className="text-ink">Recommended: {tips.res} m.</b> {tips.text}</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th className="py-1 pr-2 font-medium">Cells</th><th className="py-1 pr-2 font-medium">Grid</th>
                  <th className="py-1 pr-2 font-medium">SFINCS run, {storm.hours} h storm + {DRAIN_H} h drain</th><th className="py-1 font-medium">Range</th>
                </tr>
              </thead>
              <tbody>
                {estRows.map((row) => (
                  <tr key={row.r} className={`border-b border-line last:border-0 ${row.r === resNum ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                    <td className="tabular py-1 pr-2">{fmt(row.cells)}</td>
                    <td className="tabular py-1 pr-2">{row.r} m{row.r === tips.res ? ' · recommended' : ''}</td>
                    <td className="tabular py-1 pr-2">~{duration(row.mid)}</td>
                    <td className="tabular py-1">{duration(row.lo)} – {duration(row.hi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-3">
              Orders of magnitude for this machine: {m!.host.cpu}, {m!.host.cores} cores, {m!.host.ram_gb} GB RAM ({m!.host.arch});{' '}
              {m!.docker.running
                ? <>Docker {m!.docker.version} with {m!.docker.cpus} CPUs and {m!.docker.ram_gb} GB; SFINCS image {m!.docker.image_arch}{m!.docker.emulated ? ', emulated on Apple Silicon (a native x86 or Linux machine is several times faster)' : ''}.</>
                : <>Docker is not running: start Docker Desktop to run models.</>}{' '}
              Based on {health.timing.n_runs} measured runs ({health.timing.n_runs - health.timing.n_measured_here} pilot benchmarks
              {health.timing.n_measured_here > 0 ? `, ${health.timing.n_measured_here} made here` : ''}); steep catchments sit at the top of the range.
              Cost grows about eight-fold when the cell size halves. Model setup itself takes 1–6 min (inputs downloaded once per catchment).
            </p>
          </div>
        )}

        {health ? (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => submit('build')} disabled={!selected || !!busy || !resOk}
              className="rounded-md bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-40">
              {busy && job?.kind === 'build' ? 'Building…' : info?.built ? 'Generate run files and check' : 'Generate SFINCS model and check'}
            </button>
            <button onClick={() => submit('run')} disabled={!canRun}
              title={!qa ? 'Generate the model first' : qa.status === 'fail' ? 'QA failed' : !health.machine.docker.running ? 'Start Docker' : ''}
              className="rounded-md border border-accent px-3 py-1.5 font-medium text-accent disabled:opacity-40">
              {busy && job?.kind === 'run' ? 'Running…' : done ? 'Run again' : 'Run model'}
            </button>
            <span className="flex items-center gap-1.5 text-ink-3"><span className="h-2 w-2 rounded-full bg-[#1a7f37]" />Local builder connected</span>
          </div>
        ) : (
          <div className="rounded-lg border border-line p-3">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-ink"><span className="h-2 w-2 rounded-full bg-ink-3" />Local builder not running</div>
            <p className="text-ink-2">Models are built and run on your machine by the pipeline. In the code repository, with its environment active:</p>
            <pre className="mt-2 overflow-x-auto rounded bg-banner px-2 py-1.5 text-xs text-ink">python scripts/model_builder_server.py</pre>
            <p className="mt-1 text-ink-3">On Windows, double-click <code>scripts\start_builder.bat</code>. This page checks for it every 5 s and connects on its own. Running models also needs Docker Desktop. Works in Chrome, Edge and Firefox.</p>
            <button onClick={() => document.getElementById('setup-guide')?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-2 text-accent underline underline-offset-2">First time on this computer? Setup guide ↓</button>
          </div>
        )}

        {job && (busy || job.status === 'failed') && (
          <div className="rounded-lg border border-line p-3">
            <div className="mb-1 font-medium text-ink">
              {job.status === 'failed' ? (job.kind === 'run' ? 'Run failed' : 'Build failed') : `${job.status === 'queued' ? 'Queued' : 'Running'}: ${job.stage}`}
            </div>
            {job.error && <p className="mb-1 whitespace-pre-wrap text-[#cf222e]">{job.error}</p>}
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-ink-3">{job.log.slice(-10).join('\n') || '…'}</pre>
          </div>
        )}

        {done?.summary && <ResultsPanel r={done} figUrl={`${API}/results/${selected}/figure.png?res=${res}&run=${runName}&k=${figKey}`} />}

        {qa && <QAReport qa={qa} />}

        {qa?.run_dir && (
          <div className="rounded-lg border border-line p-3">
            <div className="mb-1 font-medium text-ink">Run outside the page</div>
            <p className="text-ink-2">The run folder is self-contained (static files hard-linked to the base model): copy it anywhere and run</p>
            <pre className="mt-2 overflow-x-auto rounded bg-banner px-2 py-1.5 text-xs text-ink">{qa.run_command ?? `docker run --rm -v "${qa.run_dir}:/data" ${health?.run_image ?? 'deltares/sfincs-cpu:sfincs-v2.4.1'}`}</pre>
            <p className="mt-1 text-ink-3">Output: <code>sfincs_map.nc</code> (water levels). The Run button also post-processes it into the depth map and summary above.</p>
          </div>
        )}

        {info?.runs && info.runs.length > 0 && (
          <div>
            <div className="mb-1 font-medium text-ink">Runs prepared for this catchment at {res} m</div>
            <ul className="flex flex-wrap gap-1.5">
              {info.runs.map((r) => (
                <li key={r.run} className="flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-xs text-ink-2">
                  <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] ${BADGE[r.status]}`}>{ICON[r.status]}</span>
                  {r.run}{r.has_results ? ' · results' : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {info?.figure && selected && (
          <figure>
            <img src={`${API}/models/${selected}/figure?res=${res}&k=${figKey}`} alt={`SFINCS model overview for catchment ${selected}`} className="w-full rounded-lg border border-line" />
            <figcaption className="mt-1 text-xs text-ink-3">Base model as built: mask and outflow boundary, subgrid elevation, infiltration (ARC II) and its default forcing.</figcaption>
          </figure>
        )}
      </div>
    </div>
  )
}
