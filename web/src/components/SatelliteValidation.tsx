import type { EChartsOption } from 'echarts'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useState, type ReactNode } from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import { dataUrl } from '../data'
import { fmt } from '../format'
import type { Palette } from '../theme'
import { Chart, Info, Stat, Toggle } from './ui'

setWorkerUrl(workerUrl)

type Corners = [[number, number], [number, number], [number, number], [number, number]]
type Bounds = [[number, number], [number, number]]
interface Img { file: string; coordinates: Corners }
interface Scores {
  csi: number; hit_rate: number; far: number; bias: number; obs_flooded_ha: number; mod_flooded_ha: number; valid_km2: number; mod_flooded_domain_km2: number
}
interface Ev {
  event: string; slug: string; area: string; source: string; sensor: string; image_date: string; image_time: string; image_note: string; window: [string, string]
  n_catchments: number; cells: number; domain_km2: number; analysed_km2: number; sat_flooded_km2: number
  setup: string; catchments: string; satellite_image: Img | null; bounds: { analysed: Bounds; domain: Bounds }
  rain: { product: string; series: { t: string; mean: number; max: number }[]; total_mm: { min: number; mean: number; max: number }; peak_mm_hr: number; wettest: string }
  results?: { n_done: number; scores: Scores; depth: Img; compare: Img }
}
interface Data { events: Ev[]; legend: Record<'depth' | 'compare' | 'satellite', { value: string; color: string }[]> }

const SAT = {
  version: 8 as const,
  sources: { esri: { type: 'raster' as const, tileSize: 256, attribution: 'Esri World Imagery',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] } },
  layers: [{ id: 'esri', type: 'raster' as const, source: 'esri' }],
}
const STREETS = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }
const OUTLINE: Record<string, { color: string; width: number; label: string }> = {
  catchments: { color: '#ffd400', width: 1.2, label: 'Simulated catchments' },
  analysed: { color: '#ffffff', width: 2, label: 'Analysed by the satellite (within the catchments)' },
}
const DESCRIPTION: Record<string, string> = {
  'Gezani 2026': 'Intense tropical cyclone of February 2026, centred on Toamasina; Copernicus EMS mapped flooding in Antananarivo, Toamasina and Ambatondrazaka from very-high-resolution optical images. Only the Antananarivo areas fall in the simulated catchments.',
  'Batsirai 2022': 'Intense tropical cyclone, landfall near Mananjary on 5 February 2022, then across the Fianarantsoa highlands. UNOSAT mapped flood water from KOMPSAT-5 radar images.',
  'Emnati 2022': 'Intense tropical cyclone, landfall near Manakara on 22–23 February 2022, three weeks after Batsirai and over the same highlands. UNOSAT mapped flood water from RCM radar images.',
}

function EventMap({ e, dark, images, opacity, legends, fit = 'analysed', perCatchment = false }: {
  e: Ev; dark: boolean; images: { id: string; img: Img }[]; opacity: number
  legends: { title: string; items: { value: string; color: string }[] }[]; fit?: 'analysed' | 'domain'; perCatchment?: boolean
}) {
  const [sat, setSat] = useState(true)
  return (
    <div className="relative h-[560px] overflow-hidden rounded-lg border border-line">
      <Map key={`${e.slug}-${fit}`} initialViewState={{ bounds: e.bounds[fit], fitBoundsOptions: { padding: 12 } }}
        mapStyle={sat ? SAT : dark ? STREETS.dark : STREETS.light} onLoad={(x) => x.target.resize()}
        attributionControl={{ compact: true, customAttribution: `${e.source} · GPM IMERG · FABDEM · HydroBASINS` }}>
        {images.map(({ id, img }) => (
          <Source key={id} id={id} type="image" url={dataUrl(img.file)} coordinates={img.coordinates}>
            <Layer id={`${id}-r`} type="raster" paint={{ 'raster-opacity': opacity, 'raster-fade-duration': 0, 'raster-resampling': 'nearest' }} />
          </Source>
        ))}
        {perCatchment && (
          <Source id={`cat-${e.slug}`} type="geojson" data={dataUrl(e.catchments)}>
            <Layer id={`cat-${e.slug}-l`} type="line" paint={{ 'line-color': '#ffd400', 'line-width': 1, 'line-opacity': 0.8 }} />
            <Layer id={`cat-${e.slug}-t`} type="symbol" layout={{ 'text-field': ['concat', ['get', 'analysed_pct'], '%'], 'text-size': 11 }}
              paint={{ 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.2 }} />
          </Source>
        )}
        <Source id={`setup-${e.slug}`} type="geojson" data={dataUrl(e.setup)}>
          {['catchments', 'analysed'].filter((id) => !(perCatchment && id === 'catchments')).map((id) => (
            <Layer key={id} id={`ol-${e.slug}-${id}`} type="line" filter={['==', ['get', 'id'], id]}
              paint={{ 'line-color': OUTLINE[id].color, 'line-width': OUTLINE[id].width }} />
          ))}
        </Source>
      </Map>
      <label className="absolute right-2 top-2 flex items-center gap-1.5 rounded bg-white/90 px-2 py-1 text-xs text-neutral-800 shadow">
        <input type="checkbox" checked={sat} onChange={(x) => setSat(x.target.checked)} /> Satellite
      </label>
      <div className="absolute bottom-8 left-2 max-w-[65%] space-y-1.5 rounded bg-white/90 p-2 text-xs text-neutral-800 shadow">
        {legends.map((l) => (
          <div key={l.title}>
            <div className="mb-0.5 font-semibold">{l.title}</div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              {l.items.map((x) => <span key={x.value} className="flex items-center gap-1"><span className="h-2.5 w-4" style={{ background: x.color }} />{x.value}</span>)}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-x-3">
          {Object.entries(OUTLINE).map(([id, o]) => <span key={id} className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: o.color }} />{o.label}</span>)}
        </div>
      </div>
    </div>
  )
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`rounded border px-2 py-0.5 text-sm ${on ? 'border-accent text-accent' : 'border-line text-ink-2'}`}>{children}</button>
}

function Opacity({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-ink-2">Opacity
      <input type="range" min={0.2} max={1} step={0.05} value={value} onChange={(x) => onChange(Number(x.target.value))} className="w-24" />
    </label>
  )
}

function rainChart(p: Palette, e: Ev): EChartsOption {
  const axis = { axisLabel: { color: p['text-secondary'] }, axisLine: { lineStyle: { color: p.axis } }, splitLine: { lineStyle: { color: p.grid } }, nameTextStyle: { color: p['text-secondary'] } }
  const ms = (t: string) => new Date(t.replace(' ', 'T') + (t.length <= 16 ? ':00Z' : 'Z')).getTime()
  const img = e.image_time ? ms(e.image_time) : undefined
  const t0 = ms(e.rain.series[0].t)
  const t1 = Math.max(ms(e.rain.series[e.rain.series.length - 1].t), (img ?? 0) + 12 * 3600e3)
  return {
    grid: { left: 56, right: 24, top: 40, bottom: 40 },
    legend: { top: 0, textStyle: { color: p['text-secondary'] } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'time', ...axis, min: t0, max: t1 },
    yAxis: { type: 'value', name: 'Rain (mm/h)', ...axis },
    series: [
      { name: 'Mean of the simulated catchments', type: 'bar', barWidth: '90%', itemStyle: { color: p.accent }, data: e.rain.series.map((r) => [ms(r.t), r.mean]),
        markArea: { itemStyle: { color: 'rgba(44,160,44,0.08)' }, label: { color: p['text-secondary'], fontSize: 11, position: 'insideTopLeft' },
          data: [[{ name: 'Simulated window', xAxis: ms(`${e.window[0]} 00:00`) }, { xAxis: ms(`${e.window[1]} 00:00`) + 24 * 3600e3 }]] },
        markLine: img ? { symbol: 'none', lineStyle: { color: '#e45756', type: 'dashed', width: 1.5 },
          label: { formatter: `satellite image ${e.image_time.slice(0, 10)}${e.image_time.endsWith('00:00') ? '' : ` ${e.image_time.slice(11)} UTC`}`, color: '#e45756', position: 'insideEndTop' },
          data: [{ xAxis: img }] } : undefined },
      { name: `Wettest catchment (${e.rain.wettest})`, type: 'line', step: 'end', showSymbol: false, lineStyle: { width: 1, color: p['text-muted'] },
        itemStyle: { color: p['text-muted'] }, data: e.rain.series.map((r) => [ms(r.t), r.max]) },
    ],
  }
}

/** Chapter 3.2: event simulations of the production set-up against satellite flood extents. */
export function SatelliteValidation({ palette, dark }: { palette: Palette; dark: boolean }) {
  const [d, setD] = useState<Data>()
  const [ev, setEv] = useState('Batsirai 2022')
  const [showSat, setShowSat] = useState(true)
  const [op, setOp] = useState(0.8)
  useEffect(() => { fetch(dataUrl('satellite_validation.json')).then((r) => r.json()).then(setD).catch(() => undefined) }, [])
  if (!d) return null
  const e = d.events.find((x) => x.event === ev) ?? d.events[0]
  const picker = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-2">Event</span>
      {d.events.map((x) => <Pill key={x.event} on={x.event === e.event} onClick={() => setEv(x.event)}>{x.event}</Pill>)}
    </div>
  )
  return (
    <Toggle title="3.2 · Validation against satellite flood maps: Gezani 2026, Batsirai 2022, Emnati 2022">
      <div className="space-y-3 text-sm text-ink-2">
        <p><b className="text-ink">Purpose.</b> Check the production set-up (whole catchments, 100 m grid with 25 m sub-grid, depths downscaled to
          30 m on FABDEM, land-cover roughness, wet-soil curve numbers, satellite rainfall) against flood extents mapped from satellite images during
          real events, with the parameters left as in the benchmark (3.1). The three events are those where rain-fed flooding is most plausible: the
          Fianarantsoa highlands, far from the coast and the large river plains (Batsirai, Emnati), and Antananarivo, the only very-high-resolution
          urban flood map (Gezani).</p>
        <p><b className="text-ink">How it is scored.</b> Maximum depth over the event window (ending on the last image) above 15 cm, compared
          with the satellite flood extent only inside the area the satellite analysed and that the simulated catchments cover. The satellite extent is
          water detected after the event minus normal water. Limits: images are taken after the peak, when rain-fed water has partly drained; radar
          misses water among buildings and under vegetation; the satellite also sees river flooding, which a pluvial model does not represent. Scores
          are therefore read as plausibility (where the model floods and does not), not as accuracy.</p>
      </div>
      {picker}
      <p className="text-sm text-ink-2">{DESCRIPTION[e.event]}</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Simulated catchments" value={`${e.n_catchments}`} sub={`${fmt(e.domain_km2)} km², ${fmt(e.cells)} cells at 100 m`} />
        <Stat label="Analysed by the satellite" value={`${fmt(e.analysed_km2, 1)} km²`} sub={`within the catchments; image ${e.image_time ? e.image_time.slice(0, 10) : '–'} (${e.image_note})`} />
        <Stat label="Satellite flood extent" value={`${fmt(e.sat_flooded_km2, 2)} km²`} sub="inside the analysed area" />
        <Stat label="Rain over the window" value={`${fmt(e.rain.total_mm.mean)} mm`} sub={`catchments ${e.rain.total_mm.min}–${e.rain.total_mm.max} mm; peak ${e.rain.peak_mm_hr} mm/h`} />
      </div>

      <Toggle title="Model domain and satellite map">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-2">
          <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-accent" checked={showSat} onChange={() => setShowSat(!showSat)} />Satellite flood extent</label>
          <Opacity value={op} onChange={setOp} />
          <span className="text-xs text-ink-3">Labels: share of each catchment analysed by the satellite.</span>
        </div>
        <EventMap e={e} dark={dark} opacity={op} fit="domain" perCatchment
          images={showSat && e.satellite_image ? [{ id: `sat-${e.slug}`, img: e.satellite_image }] : []}
          legends={showSat ? [{ title: `${e.source} (${e.sensor})`, items: d.legend.satellite }] : []} />
        <table className="w-full text-sm"><tbody className="[&_td]:border-b [&_td]:border-line [&_td]:py-1.5 [&_td]:pr-3">
          {[
            ['Domain', `Whole pluvial catchments (production models), those with at least 10% of their area analysed by the satellite: ${e.n_catchments} catchments, ${fmt(e.domain_km2)} km²`],
            ['Grid', '100 m, UTM 38S; sub-grid 25 m from FABDEM; output downscaled to 30 m on FABDEM; isolated flooded patches under 0.1 ha removed'],
            ['Roughness', 'Manning from land cover (ESA/VITO classes), as in the benchmark'],
            ['Infiltration', 'SCS curve number, ARCIII (wet soils, as for cyclone design storms)'],
            ['Boundaries', 'Free outflow on the catchment edge (inland catchments: no tide)'],
            ['Rainfall', `${e.rain.product}, half-hourly, averaged over each catchment and applied uniformly; window ${e.window[0]} to ${e.window[1]} (+24 h drainage)`],
            ['Ground truth', `${e.source}, ${e.image_note}${e.image_time ? `, image of ${e.image_time}${e.image_time.endsWith('00:00') ? '' : ' UTC'}` : ''}; flood extent and analysed area`],
          ].map(([k, v]) => <tr key={k}><td className="w-36 font-medium text-ink">{k}</td><td className="text-ink-2">{v}</td></tr>)}
        </tbody></table>
      </Toggle>

      <Toggle title="Rainfall">
        <Chart option={rainChart(palette, e)} height={320} label={`Half-hourly IMERG rainfall over the simulated catchments for ${e.event}`} />
        <Info>
          {e.rain.product}, averaged over each simulated catchment: {fmt(e.rain.total_mm.mean)} mm on average over the window
          ({e.rain.total_mm.min}–{e.rain.total_mm.max} mm between catchments), peak {e.rain.peak_mm_hr} mm/h. In Mahajanga (3.1) the same IMERG release
          gave about half the rainfall of the series used by the local study, so these totals may be low.
          {e.event === 'Gezani 2026' && ' Over Antananarivo the rain is light; the flooding Copernicus EMS mapped there lies mostly in the Ikopa plain and is likely driven by the river.'}
        </Info>
      </Toggle>

      <Results d={d} e={e} dark={dark} picker={picker} />
    </Toggle>
  )
}

function Results({ d, e, dark, picker }: { d: Data; e: Ev; dark: boolean; picker: ReactNode }) {
  const [show, setShow] = useState({ sat: false, model: false, compare: true })
  const [op, setOp] = useState(0.8)
  const done = d.events.filter((x) => x.results)
  const r = e.results
  const images = [
    ...(show.sat && e.satellite_image ? [{ id: `rs-${e.slug}`, img: e.satellite_image }] : []),
    ...(show.model && r ? [{ id: `rm-${e.slug}`, img: r.depth }] : []),
    ...(show.compare && r ? [{ id: `rc-${e.slug}`, img: r.compare }] : []),
  ]
  const legends = [
    ...(show.sat ? [{ title: 'Satellite flood extent', items: d.legend.satellite }] : []),
    ...(show.model ? [{ title: 'Maximum depth (above 15 cm)', items: d.legend.depth }] : []),
    ...(show.compare ? [{ title: 'Flooded above 15 cm', items: d.legend.compare }] : []),
  ]
  const toggle = (k: keyof typeof show) => setShow((x) => ({ ...x, [k]: !x[k] }))
  const f = (v: number, n = 2) => fmt(v, n)
  return (
    <>
      <h4 className="pt-2 text-base font-semibold text-ink">Results</h4>
      {picker}
      {r ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-2">
            {([['sat', 'Satellite flood extent'], ['model', 'This model depth (30 m)'], ['compare', 'Comparison']] as const).map(([k, lab]) => (
              <label key={k} className="flex items-center gap-1.5"><input type="checkbox" className="accent-accent" checked={show[k]} onChange={() => toggle(k)} />{lab}</label>
            ))}
            <Opacity value={op} onChange={setOp} />
            {r.n_done < e.n_catchments && <span className="text-xs text-accent">{r.n_done} of {e.n_catchments} catchments done; runs in progress</span>}
          </div>
          <EventMap e={e} dark={dark} opacity={op} images={images} legends={legends} />
        </>
      ) : <Info>Simulations of {e.event} are running; the map and scores appear here when they are done.</Info>}
      {done.length > 0 && (
        <>
          <table className="w-full text-sm"><thead><tr className="text-left text-ink-3 [&_th]:pb-1 [&_th]:pr-3">
            <th>Event</th><th>Catchments</th><th>Analysed (km²)</th><th>Flooded, model / satellite (ha)</th><th>CSI</th><th>Hit rate</th><th>False alarms</th><th>Bias</th>
          </tr></thead><tbody className="[&_td]:border-t [&_td]:border-line [&_td]:py-1.5 [&_td]:pr-3">
            {done.map((x) => (
              <tr key={x.event} className={x.event === e.event ? 'bg-accent/10 font-semibold text-ink' : 'text-ink-2'}>
                <td>{x.event}</td><td>{x.results!.n_done} / {x.n_catchments}</td><td>{f(x.results!.scores.valid_km2, 1)}</td>
                <td>{fmt(x.results!.scores.mod_flooded_ha, 0)} / {fmt(x.results!.scores.obs_flooded_ha, 0)}</td>
                <td>{f(x.results!.scores.csi)}</td><td>{f(x.results!.scores.hit_rate)}</td><td>{f(x.results!.scores.far)}</td><td>{f(x.results!.scores.bias)}</td>
              </tr>))}
          </tbody></table>
          <p className="text-xs text-ink-3">Inside the analysed area within the simulated catchments, 30 m grid. Hit rate = share of the satellite flood extent
            the model floods; false alarms = share of the modelled flooding the satellite does not see; bias = modelled / satellite flooded area.</p>
        </>
      )}
      <h4 className="pt-2 text-base font-semibold text-ink">Conclusions</h4>
      <Info>To be written when the three events have finished.</Info>
    </>
  )
}
