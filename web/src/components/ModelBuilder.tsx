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
const STORMS = [
  { value: 'nontc', label: 'Non-cyclone · 12 h · ARC II' },
  { value: 'tc', label: 'Cyclone · 72 h · ARC III' },
] as const
type Pop = (typeof STORMS)[number]['value']

interface Check { check: string; status: 'pass' | 'warn' | 'fail'; detail: string }
interface QA {
  status: Check['status']; checks: Check[]; run?: string; run_dir?: string; model_dir?: string
  active_cells?: number; active_km2?: number; basin_km2?: number; run_hours?: number; est_run_minutes?: number
  storm_depth_mm?: number; peak_mm_hr?: number; run_command?: string
}
interface Job { id: string; status: 'queued' | 'running' | 'done' | 'failed'; stage: string; log: string[]; result: QA | null; error: string | null; seconds?: number }
interface ModelInfo { built: boolean; model_dir: string; figure: boolean; runs: (QA & { run: string })[] }
interface Health { ok: boolean; models_dir: string; run_image: string }

const BADGE: Record<Check['status'], string> = { pass: 'bg-[#1a7f37] text-white', warn: 'bg-[#bf8700] text-white', fail: 'bg-[#cf222e] text-white' }
const ICON: Record<Check['status'], string> = { pass: '✓', warn: '!', fail: '✗' }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, init)
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json() as Promise<T>
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

/** Pick a catchment, build its SFINCS model for one design storm on this machine (local server), check it. */
export function ModelBuilder({ catchments, palette, dark }: { catchments: FeatureCollection; palette: Palette; dark: boolean }) {
  const [selected, setSelected] = useState<string>()
  const [hover, setHover] = useState<{ id: string; area: number; lng: number; lat: number } | null>(null)
  const [pop, setPop] = useState<Pop>('nontc')
  const [rp, setRp] = useState('100')
  const [overwrite, setOverwrite] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const [info, setInfo] = useState<ModelInfo>()
  const [job, setJob] = useState<Job>()
  const [figKey, setFigKey] = useState(0)

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

  const refresh = useCallback(() => {
    if (!selected || !health) return setInfo(undefined)
    api<ModelInfo>(`/models/${selected}`).then(setInfo).catch(() => setInfo(undefined))
    setFigKey((k) => k + 1)
  }, [selected, health])
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

  const build = () => {
    if (!selected) return
    api<{ job: string }>('/build', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ basin_id: selected, population: pop, return_period: Number(rp), overwrite }),
    }).then((r) => setJob({ id: r.job, status: 'queued', stage: 'queued', log: [], result: null, error: null }))
      .catch((e) => setJob({ id: '-', status: 'failed', stage: '', log: [], result: null, error: String(e) }))
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
    e.target.fitBounds([[x0, y0], [x1, y1]], { padding: 80, maxZoom: 11, duration: 800 })
  }

  const runName = `design_${pop}_rp${rp}`
  const thisRun = info?.runs.find((r) => r.run === runName)
  const qa = job?.status === 'done' && job.result?.run === runName ? job.result : thisRun
  const busy = job && (job.status === 'queued' || job.status === 'running')

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
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
              'fill-color': ['case', ['==', ['to-string', ['get', 'basin_id']], selected ?? ''], palette.accent, palette.accent],
              'fill-opacity': ['case', ['==', ['to-string', ['get', 'basin_id']], selected ?? ''], 0.6, 0.08] }} />
            <Layer id="mb-line" type="line" paint={{ 'line-color': palette['text-secondary'], 'line-width': 0.3, 'line-opacity': 0.6 }} />
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
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="Design storm" value={pop} onChange={setPop} options={STORMS.map((s) => ({ value: s.value, label: s.label }))} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-ink-2">Return period
              <select value={rp} onChange={(e) => setRp(e.target.value)} className="rounded-md border border-line bg-surface px-2 py-1 text-ink">
                {RPS.map((r) => <option key={r} value={r}>{r}-year</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-ink-2">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="accent-accent" />
              Rebuild from scratch
            </label>
            <span className="text-ink-3">Baseline climate</span>
          </div>
        </div>

        {health ? (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={build} disabled={!selected || !!busy}
              className="rounded-md bg-accent px-3 py-1.5 font-medium text-white disabled:opacity-40">
              {busy ? 'Building…' : info?.built ? 'Generate run files and check' : 'Generate SFINCS model and check'}
            </button>
            <span className="flex items-center gap-1.5 text-ink-3"><span className="h-2 w-2 rounded-full bg-[#1a7f37]" />Local builder connected</span>
          </div>
        ) : (
          <div className="rounded-lg border border-line p-3">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-ink"><span className="h-2 w-2 rounded-full bg-ink-3" />Local builder not running</div>
            <p className="text-ink-2">Model files are generated on your machine by the pipeline. In the code repository, with its environment active:</p>
            <pre className="mt-2 overflow-x-auto rounded bg-banner px-2 py-1.5 text-xs text-ink">python scripts/model_builder_server.py</pre>
            <p className="mt-1 text-ink-3">This page finds it automatically (it checks every 5 s). Needs access to the code repository; works in Chrome, Edge and Firefox.</p>
          </div>
        )}

        {job && (busy || job.status === 'failed') && (
          <div className="rounded-lg border border-line p-3">
            <div className="mb-1 font-medium text-ink">
              {job.status === 'failed' ? 'Build failed' : `${job.status === 'queued' ? 'Queued' : 'Running'}: ${job.stage}`}
            </div>
            {job.error && <p className="mb-1 text-[#cf222e]">{job.error}</p>}
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-ink-3">{job.log.slice(-8).join('\n') || '…'}</pre>
          </div>
        )}

        {qa && <QAReport qa={qa} />}

        {qa?.run_dir && (
          <div className="rounded-lg border border-line p-3">
            <div className="mb-1 font-medium text-ink">Run this model</div>
            <ul className="list-disc space-y-1 pl-5 text-ink-2">
              <li>Docker running, with the image <code>{health?.run_image ?? 'deltares/sfincs-cpu:sfincs-v2.4.1'}</code> (pulled on first use).</li>
              <li>About {fmt(qa.active_cells ?? 0)} active cells, {qa.run_hours} h simulated: roughly {qa.est_run_minutes} min on the pilot machine (5 emulated CPUs).</li>
              <li>On Apple Silicon the image runs emulated (it is x86 only); set <code>run.platform: linux/amd64</code> in the settings if Docker does not pick it.</li>
            </ul>
            <pre className="mt-2 overflow-x-auto rounded bg-banner px-2 py-1.5 text-xs text-ink">{qa.run_command ?? `docker run --rm -v "${qa.run_dir}:/data" ${health?.run_image ?? 'deltares/sfincs-cpu:sfincs-v2.4.1'}`}</pre>
            <p className="mt-1 text-ink-3">The run folder is self-contained (static files hard-linked to the base model): it can be copied and run elsewhere. Maximum depth is written to <code>sfincs_map.nc</code>.</p>
          </div>
        )}

        {info?.runs && info.runs.length > 0 && (
          <div>
            <div className="mb-1 font-medium text-ink">Runs already prepared for this catchment</div>
            <ul className="flex flex-wrap gap-1.5">
              {info.runs.map((r) => (
                <li key={r.run} className="flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-xs text-ink-2">
                  <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] ${BADGE[r.status]}`}>{ICON[r.status]}</span>{r.run}
                </li>
              ))}
            </ul>
          </div>
        )}

        {info?.figure && selected && (
          <figure>
            <img src={`${API}/models/${selected}/figure?k=${figKey}`} alt={`SFINCS model overview for catchment ${selected}`} className="w-full rounded-lg border border-line" />
            <figcaption className="mt-1 text-xs text-ink-3">Base model as built: mask and outflow boundary, subgrid elevation, infiltration (ARC II) and its default forcing.</figcaption>
          </figure>
        )}
      </div>
    </div>
  )
}
