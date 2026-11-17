import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Layer, Popup, Source, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre'
import { dataUrl } from '../data'
import { fmt } from '../format'

setWorkerUrl(workerUrl)

const BASEMAP = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
  satellite: {
    version: 8 as const,
    sources: { esri: { type: 'raster' as const, tileSize: 256, attribution: 'Esri World Imagery',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] } },
    layers: [{ id: 'esri', type: 'raster' as const, source: 'esri' }],
  },
}
const MDG: [[number, number], [number, number]] = [[43.1, -25.7], [50.6, -11.9]]

type Bounds = [[number, number], [number, number]]
interface MapLayer {
  id: string; group: string; name: string; kind: 'fill' | 'line' | 'image' | 'district'
  file: string; color?: string; n?: number; kb: number; bounds: Bounds
  event?: string; date?: string; sensor?: string; simplify_m?: number; min_patch_ha?: number
  coordinates?: [number, number][]; legend?: { label: string; color: string }[]; table?: string
}
interface DistrictTable { metrics: string[]; events: { event: string; datasets: string[]; values: Record<string, number[]> }[] }

/** Validation boxes of the event run sheet (Chapter 3), and context layers already on the site. */
const PRIORITY: { name: string; box: [number, number, number, number] }[] = [
  { name: 'Haute Matsiatra (Batsirai, Emnati 2022)', box: [46.97, -21.77, 47.37, -21.22] },
  { name: 'Antananarivo (Gezani 2026, Ana 2022, 2015 rains)', box: [47.40, -19.05, 47.65, -18.75] },
  { name: 'Manakara (Freddy 2023)', box: [47.90, -21.87, 48.20, -21.65] },
]
const priorityGeo = {
  type: 'FeatureCollection' as const,
  features: PRIORITY.map(({ name, box: [x0, y0, x1, y1] }) => ({
    type: 'Feature' as const, properties: { name },
    geometry: { type: 'Polygon' as const, coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] },
  })),
}
const CONTEXT = [
  { id: 'ctx_catchments', name: 'Pluvial model catchments', color: '#7f7f7f' },
  { id: 'ctx_tracks', name: 'Cyclone tracks since 2000 (IBTrACS)', color: '#8c564b' },
  { id: 'ctx_priority', name: 'Priority validation areas (Chapter 3)', color: '#2ca02c' },
]
const METRIC_LABEL: Record<string, string> = {
  deaths: 'Deaths', affected: 'People affected', victims: 'Victims (sinistrés)',
  houses_destroyed: 'Houses destroyed', houses_damaged: 'Houses damaged',
}
const RAMP = ['#fee6ce', '#fdae6b', '#fd8d3c', '#e6550d', '#a63603']
const DEFAULT_ON = ['ctx_priority', 'fl_gezani_2026', 'aa_gezani_2026', 'h2', 'h3']

const fillPaint = (color: string, opacity: number) => ({ 'fill-color': color, 'fill-opacity': opacity, 'fill-outline-color': color })

/** Every geospatial calibration/validation dataset on one map, one checkbox per layer (per event for H5/H6). */
export function CalibrationMap({ dark }: { dark: boolean }) {
  const map = useRef<MapRef>(null)
  const [layers, setLayers] = useState<MapLayer[]>()
  const [on, setOn] = useState<Set<string>>(new Set(DEFAULT_ON))
  const [base, setBase] = useState<'map' | 'satellite'>('map')
  const [opacity, setOpacity] = useState(0.55)
  const [table, setTable] = useState<DistrictTable>()
  const [event, setEvent] = useState('Enawo 2017')
  const [metric, setMetric] = useState('victims')
  const [popup, setPopup] = useState<{ lng: number; lat: number; lines: [string, string][] } | null>(null)

  useEffect(() => {
    fetch(dataUrl('calibration_map.json')).then((r) => r.json()).then((j) => setLayers(j.layers)).catch(() => setLayers([]))
  }, [])
  const district = layers?.find((l) => l.kind === 'district')
  useEffect(() => {
    if (district?.table && on.has(district.id) && !table)
      fetch(dataUrl(district.table)).then((r) => r.json()).then(setTable).catch(() => undefined)
  }, [district, on, table])

  const groups = useMemo(() => {
    const g: Record<string, MapLayer[]> = {}
    for (const l of layers ?? []) (g[l.group] ??= []).push(l)
    return Object.entries(g)
  }, [layers])

  const toggle = (ids: string[], value: boolean) => setOn((s) => {
    const n = new Set(s)
    ids.forEach((id) => (value ? n.add(id) : n.delete(id)))
    return n
  })
  const zoom = (b: Bounds) => map.current?.fitBounds(b, { padding: 40, maxZoom: 14, duration: 800 })

  // District choropleth for the selected event and metric
  const ev = table?.events.find((e) => e.event === event)
  const mi = table?.metrics.indexOf(metric) ?? -1
  const breaks = useMemo(() => {
    const v = Object.values(ev?.values ?? {}).map((x) => x[mi]).filter((x) => x > 0).sort((a, b) => a - b)
    if (!v.length) return [1, 2, 3, 4]
    const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * v.length))]
    return [...new Set([q(0.2), q(0.4), q(0.6), q(0.8)])].sort((a, b) => a - b)
  }, [ev, mi])
  const districtColor = useMemo(() => {
    const pairs = Object.entries(ev?.values ?? {}).filter(([, x]) => x[mi] > 0)
      .flatMap(([p, x]) => [p, RAMP[breaks.filter((b) => x[mi] >= b).length] ?? RAMP[4]])
    return pairs.length ? ['match', ['get', 'pcode'], ...pairs, 'rgba(0,0,0,0)'] : 'rgba(0,0,0,0)'
  }, [ev, mi, breaks])

  const interactive = [
    ...(layers ?? []).filter((l) => on.has(l.id) && (l.kind === 'fill' || l.kind === 'district')).map((l) => `${l.id}-fill`),
    ...(on.has('ctx_tracks') ? ['ctx_tracks-line'] : []),
  ]

  const onClick = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (!f) return setPopup(null)
    const lid = f.layer.id.replace(/-(fill|line)$/, '')
    const p = f.properties ?? {}
    const l = layers?.find((x) => x.id === lid)
    let lines: [string, string][] = []
    if (lid === 'ctx_tracks') lines = [['Cyclone', `${p.name} ${p.year}`], ['Category', String(p.category)], ['Max wind', `${p.vmax_kn} kn`]]
    else if (l?.kind === 'district') {
      const v = ev?.values[p.pcode]
      lines = [['District', p.name], ['Event', event],
        ...(v ? table!.metrics.map((m, i) => [METRIC_LABEL[m], fmt(v[i], 0)] as [string, string]).filter(([, x]) => x !== '0')
          : [['Reported', 'nothing for this district'] as [string, string]]),
        ...(ev ? [['Source', ev.datasets.join(', ')] as [string, string]] : [])]
    } else if (l?.id === 'h1') lines = [['Groundsource event', `${p.start_date} → ${p.end_date}`], ['Footprint', `${p.area_km2} km²`], ['Cyclone', p.storm || 'none matched']]
    else if (l) lines = [['Layer', l.name], ...(l.sensor ? [['Sensor', l.sensor] as [string, string]] : []), ...(l.date ? [['Image date', l.date] as [string, string]] : [])]
    setPopup({ lng: e.lngLat.lng, lat: e.lngLat.lat, lines })
  }

  const swatch = (l: { kind?: string; color?: string }) => (
    <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={l.kind === 'line'
      ? { border: `2px dashed ${l.color}` } : { background: l.color ?? '#999', opacity: 0.85 }} />
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
        <label className="flex items-center gap-1.5">Basemap
          <select value={base} onChange={(e) => setBase(e.target.value as 'map' | 'satellite')} className="rounded border border-line bg-surface px-1.5 py-0.5">
            <option value="map">Streets</option><option value="satellite">Satellite</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">Fill opacity
          <input type="range" min={0.15} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-24" />
        </label>
        <button className="rounded border border-line px-2 py-0.5 hover:bg-line/40" onClick={() => zoom(MDG)}>Whole island</button>
        <button className="rounded border border-line px-2 py-0.5 hover:bg-line/40" onClick={() => setOn(new Set())}>Clear all</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative h-[680px] overflow-hidden rounded-lg border border-line">
          <Map ref={map}
            initialViewState={{ bounds: MDG, fitBoundsOptions: { padding: 16 } }}
            mapStyle={base === 'satellite' ? BASEMAP.satellite : dark ? BASEMAP.dark : BASEMAP.light}
            interactiveLayerIds={interactive}
            onClick={onClick}
            onLoad={(e) => e.target.resize()}
            attributionControl={{ compact: true, customAttribution: 'Google Groundsource · CPGU · GESCOD · UNITAR-UNOSAT · Copernicus EMS · DesInventar (UNDRR/BNGRC) · OCHA · IBTrACS' }}
          >
            {on.has('ctx_catchments') && (
              <Source id="ctx_catchments" type="geojson" data={dataUrl('catchments.geojson')}>
                <Layer id="ctx_catchments-line" type="line" paint={{ 'line-color': '#7f7f7f', 'line-width': 0.4, 'line-opacity': 0.6 }} />
              </Source>
            )}
            {(layers ?? []).filter((l) => on.has(l.id)).map((l) => {
              if (l.kind === 'image') return (
                <Source key={l.id} id={l.id} type="image" url={dataUrl(l.file)} coordinates={l.coordinates as [[number, number], [number, number], [number, number], [number, number]]}>
                  <Layer id={`${l.id}-raster`} type="raster" paint={{ 'raster-opacity': Math.min(1, opacity + 0.3), 'raster-fade-duration': 0 }} />
                </Source>)
              if (l.kind === 'district') return (
                <Source key={l.id} id={l.id} type="geojson" data={dataUrl(l.file)}>
                  <Layer id={`${l.id}-fill`} type="fill" paint={{ 'fill-color': districtColor as never, 'fill-opacity': Math.min(1, opacity + 0.2) }} />
                  <Layer id={`${l.id}-line`} type="line" paint={{ 'line-color': '#8c6d31', 'line-width': 0.5, 'line-opacity': 0.6 }} />
                </Source>)
              return (
                <Source key={l.id} id={l.id} type="geojson" data={dataUrl(l.file)}>
                  {l.kind === 'fill'
                    ? <Layer id={`${l.id}-fill`} type="fill" paint={fillPaint(l.color ?? '#1f77b4', opacity)} />
                    : <Layer id={`${l.id}-line`} type="line" paint={{ 'line-color': l.color ?? '#333', 'line-width': 1.6, 'line-dasharray': [3, 2] }} />}
                </Source>)
            })}
            {on.has('ctx_tracks') && (
              <Source id="ctx_tracks" type="geojson" data={dataUrl('tc_tracks.geojson')}>
                <Layer id="ctx_tracks-line" type="line" filter={['>=', ['get', 'year'], 2000]}
                  paint={{ 'line-color': '#8c564b', 'line-width': 1.2, 'line-opacity': 0.7 }} />
              </Source>
            )}
            {on.has('ctx_priority') && (
              <Source id="ctx_priority" type="geojson" data={priorityGeo}>
                <Layer id="ctx_priority-line" type="line" paint={{ 'line-color': '#2ca02c', 'line-width': 2.5 }} />
              </Source>
            )}
            {popup && (
              <Popup longitude={popup.lng} latitude={popup.lat} onClose={() => setPopup(null)} closeOnClick={false} maxWidth="300px">
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 text-xs text-neutral-800">
                  {popup.lines.map(([k, v]) => <div key={k} className="contents"><dt className="font-semibold">{k}</dt><dd>{v}</dd></div>)}
                </dl>
              </Popup>
            )}
          </Map>
          {on.has('h4') && layers?.find((l) => l.id === 'h4')?.legend && (
            <div className="absolute bottom-8 left-2 rounded bg-white/90 p-2 text-xs text-neutral-800 shadow">
              <div className="mb-1 font-semibold">Cheneso depth (H4)</div>
              {layers.find((l) => l.id === 'h4')!.legend!.map((x) => (
                <div key={x.label} className="flex items-center gap-1.5"><span className="h-2.5 w-4" style={{ background: x.color }} />{x.label}</div>))}
            </div>
          )}
        </div>

        <div className="max-h-[680px] space-y-3 overflow-y-auto pr-1 text-sm">
          <LayerGroup title="Context" items={CONTEXT.map((c) => ({ ...c, kind: c.id === 'ctx_catchments' ? 'line' : 'fill' }))}
            on={on} toggle={toggle} swatch={swatch} />
          {groups.map(([g, ls]) => (
            <LayerGroup key={g} title={g} items={ls} on={on} toggle={toggle} swatch={swatch} zoom={zoom}>
              {ls.some((l) => l.kind === 'district') && on.has(ls[0].id) && table && (
                <div className="mt-2 space-y-1.5 rounded border border-line p-2">
                  <label className="block text-xs">Event
                    <select value={event} onChange={(e) => setEvent(e.target.value)} className="mt-0.5 w-full rounded border border-line bg-surface px-1 py-0.5">
                      {table.events.map((e) => <option key={e.event} value={e.event}>{e.event} ({Object.keys(e.values).length} districts)</option>)}
                    </select>
                  </label>
                  <label className="block text-xs">Metric
                    <select value={metric} onChange={(e) => setMetric(e.target.value)} className="mt-0.5 w-full rounded border border-line bg-surface px-1 py-0.5">
                      {table.metrics.map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-ink-3">
                    {RAMP.slice(0, breaks.length + 1).map((c, i) => (
                      <span key={c} className="flex items-center gap-0.5"><span className="h-2.5 w-3" style={{ background: c }} />
                        {i === 0 ? `< ${fmt(breaks[0], 0)}` : `≥ ${fmt(breaks[i - 1], 0)}`}</span>))}
                  </div>
                  {ev && !Object.values(ev.values).some((x) => x[mi] > 0) && (
                    <p className="text-[11px] font-medium text-accent">Not reported for this event: try another metric.</p>)}
                  <p className="text-[11px] text-ink-3">Source: {ev?.datasets.join(', ') ?? '–'}. Districts without colour reported nothing.</p>
                </div>
              )}
            </LayerGroup>
          ))}
          {!layers && <p className="text-ink-3">Loading layers…</p>}
        </div>
      </div>
    </div>
  )
}

function LayerGroup({ title, items, on, toggle, swatch, zoom, children }: {
  title: string
  items: { id: string; name: string; kind?: string; color?: string; n?: number; kb?: number; bounds?: Bounds; sensor?: string; date?: string; simplify_m?: number }[]
  on: Set<string>
  toggle: (ids: string[], v: boolean) => void
  swatch: (l: { kind?: string; color?: string }) => React.ReactNode
  zoom?: (b: Bounds) => void
  children?: React.ReactNode
}) {
  const all = items.every((l) => on.has(l.id))
  return (
    <div className="rounded-lg border border-line p-2.5">
      <label className="mb-1.5 flex items-center gap-2 font-semibold text-ink">
        <input type="checkbox" className="accent-accent" checked={all} onChange={(e) => toggle(items.map((l) => l.id), e.target.checked)} />
        {title}
      </label>
      <ul className="space-y-1">
        {items.map((l) => (
          <li key={l.id} className="flex items-start gap-2 text-ink-2">
            <input type="checkbox" className="mt-0.5 accent-accent" checked={on.has(l.id)} onChange={(e) => toggle([l.id], e.target.checked)} />
            <span className="mt-0.5">{swatch(l)}</span>
            <span className="min-w-0 flex-1 leading-tight">
              {l.name}
              {(l.sensor || l.kb) && (
                <span className="block text-[11px] text-ink-3">
                  {[l.sensor, l.date && `${l.date.slice(0, 4)}-${l.date.slice(4, 6)}-${l.date.slice(6)}`, l.n && l.kind !== 'line' ? `${fmt(l.n, 0)} shapes` : '', l.kb ? `${fmt(l.kb, 0)} kB` : '',
                    l.simplify_m && l.simplify_m > 11 ? `simplified ${l.simplify_m} m` : ''].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
            {zoom && l.bounds && <button title="Zoom to layer" className="text-xs text-accent hover:underline" onClick={() => zoom(l.bounds!)}>zoom</button>}
          </li>
        ))}
      </ul>
      {children}
    </div>
  )
}
