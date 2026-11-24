import type { EChartsOption } from 'echarts'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useState, type ReactNode } from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import { dataUrl } from '../data'
import { fmt } from '../format'
import type { Palette } from '../theme'
import { Chart, Stat, Toggle } from './ui'

setWorkerUrl(workerUrl)

type Corners = [[number, number], [number, number], [number, number], [number, number]]
type Bounds = [[number, number], [number, number]]
interface Img { file: string; coordinates: Corners }
interface StaticImg extends Img { name: string; legend: { value: number | string; color: string }[] }
interface Score {
  tag: string; rain: string; obs_flooded_ha: number; mod_flooded_ha: number; csi: number; hit_rate: number; far: number; bias: number
  depth_median_error_m: number; depth_p90_abs_error_m: number; mod_max_m: number; obs_max_m: number
}
interface Setup {
  event: string; basin_id: string; res_m: number; subgrid_m: number; downscale_m: number; gcn_arc: string
  cn_mean_catchment: number; gescod_cn: number; areas_km2: Record<string, number>; cells: { catchment: number; domain: number }
  window_utc: [string, string]; rain_window_mm: number; rain_event_mm: number; rain_peak_mm_hr: number; rain_catchment_window_mm: number
  imerg_max_acc_mm: Record<string, number>
  tide: { datum: string; source: string; max: number; min: number }
  rainfall: { t: string; i: number }[]; tide_series: { t: string; z: number }[]
  rainfall_gescod?: { t: string; i: number }[]
  gescod_rain?: { window_mm: number; peak_mm_hr: number; max_acc_mm: Record<string, number> }
  images: Record<string, StaticImg>; layers: string; bounds: Record<'catchment' | 'valley' | 'gescod', Bounds>
  scores?: Score[]; result_layers?: Record<string, { depth: Img; compare: Img }>; gescod_layer?: Img
  depth_legend?: { value: string; color: string }[]; compare_legend?: { value: string; color: string }[]
}

const SAT = {
  version: 8 as const,
  sources: { esri: { type: 'raster' as const, tileSize: 256, attribution: 'Esri World Imagery',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] } },
  layers: [{ id: 'esri', type: 'raster' as const, source: 'esri' }],
}
const STREETS = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }
const OUTLINE: Record<string, { color: string; width: number; label: string }> = {
  domain: { color: '#ffd400', width: 2.5, label: 'Benchmark model domain (GESCOD area + 1 km)' },
  h4_footprint: { color: '#ffffff', width: 2, label: 'GESCOD model area (Metzinger basin)' },
}

/** Satellite map of the Metzinger valley with image overlays (bottom first) and the two outlines. */
function ValleyMap({ s, dark, images, opacity, legends, outlines = ['domain', 'h4_footprint'], fit = 'valley' }: {
  s: Setup; dark: boolean; fit?: 'valley' | 'gescod'; images: { id: string; img: Img; nearest?: boolean }[]; opacity: number
  legends: { title: string; items: { value: string | number; color: string }[] }[]; outlines?: string[]
}) {
  const [sat, setSat] = useState(true)
  return (
    <div className="space-y-2">
      <div className="relative h-[560px] overflow-hidden rounded-lg border border-line">
        <Map initialViewState={{ bounds: s.bounds[fit], fitBoundsOptions: { padding: 10 } }} mapStyle={sat ? SAT : dark ? STREETS.dark : STREETS.light}
          onLoad={(e) => e.target.resize()} attributionControl={{ compact: true, customAttribution: 'FABDEM · ESA WorldCover · GCN250 · GESCOD (2023)' }}>
          {images.map(({ id, img, nearest }) => (
            <Source key={id} id={id} type="image" url={dataUrl(img.file)} coordinates={img.coordinates}>
              <Layer id={`${id}-r`} type="raster" paint={{ 'raster-opacity': opacity, 'raster-fade-duration': 0, 'raster-resampling': nearest ? 'nearest' : 'linear' }} />
            </Source>
          ))}
          <Source id="valley-outlines" type="geojson" data={dataUrl(s.layers)}>
            {outlines.map((id) => (
              <Layer key={id} id={`ol-${id}`} type="line" filter={['==', ['get', 'id'], id]}
                paint={{ 'line-color': OUTLINE[id].color, 'line-width': OUTLINE[id].width }} />
            ))}
          </Source>
        </Map>
        <label className="absolute right-2 top-2 flex items-center gap-1.5 rounded bg-white/90 px-2 py-1 text-xs text-neutral-800 shadow">
          <input type="checkbox" checked={sat} onChange={(e) => setSat(e.target.checked)} /> Satellite
        </label>
        <div className="absolute bottom-8 left-2 max-w-[60%] space-y-1.5 rounded bg-white/90 p-2 text-xs text-neutral-800 shadow">
          {legends.map((l) => (
            <div key={l.title}>
              <div className="mb-0.5 font-semibold">{l.title}</div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {l.items.map((x) => <span key={String(x.value)} className="flex items-center gap-1"><span className="h-2.5 w-4" style={{ background: x.color }} />{x.value}</span>)}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-x-3">
            {outlines.map((id) => <span key={id} className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: OUTLINE[id].color }} />{OUTLINE[id].label}</span>)}
          </div>
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
      <input type="range" min={0.2} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-24" />
    </label>
  )
}

function forcingChart(p: Palette, s: Setup): EChartsOption {
  const axis = { axisLabel: { color: p['text-secondary'] }, axisLine: { lineStyle: { color: p.axis } }, splitLine: { lineStyle: { color: p.grid } }, nameTextStyle: { color: p['text-secondary'] } }
  const ms = (t: string) => new Date(t.replace(' ', 'T') + 'Z').getTime()
  return {
    grid: { left: 56, right: 60, top: 40, bottom: 40 },
    legend: { top: 0, textStyle: { color: p['text-secondary'] } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'time', ...axis, min: ms('2023-01-18 00:00:00'), max: ms('2023-01-27 00:00:00') },
    yAxis: [
      { type: 'value', name: 'Rain (mm/h)', ...axis },
      { type: 'value', name: 'Tide (m NGM)', ...axis, splitLine: { show: false }, min: -2.5, max: 2.5 },
    ],
    series: [
      { name: 'GESCOD rainfall over the basin (used)', type: 'bar', barWidth: '90%', itemStyle: { color: p.accent },
        data: (s.rainfall_gescod ?? []).map((r) => [ms(r.t), r.i]),
        markArea: { itemStyle: { color: 'rgba(44,160,44,0.10)' }, label: { color: p['text-secondary'], fontSize: 11 },
          data: [[{ name: 'Simulated (GESCOD window)', xAxis: ms(s.window_utc[0]) }, { xAxis: ms(s.window_utc[1]) }]] } },
      { name: 'IMERG V07B over the same basin (sensitivity run)', type: 'line', step: 'end', showSymbol: false, lineStyle: { width: 1.2, color: '#e45756' },
        itemStyle: { color: '#e45756' }, data: s.rainfall.map((r) => [ms(r.t), r.i]) },
      { name: 'Tide at Mahajanga (GESCOD)', type: 'line', yAxisIndex: 1, showSymbol: false, lineStyle: { width: 1.5, color: '#8c564b' },
        itemStyle: { color: '#8c564b' }, data: s.tide_series.map((r) => [ms(r.t), r.z]) },
    ],
  }
}

/** Chapter 2.1.1: benchmark of the production set-up against the GESCOD local model for Cheneso. */
export function CalibrationSetup({ palette, dark }: { palette: Palette; dark: boolean }) {
  const [s, setS] = useState<Setup>()
  const [img, setImg] = useState('dem')
  const [op, setOp] = useState(0.75)
  useEffect(() => { fetch(dataUrl('calibration_setup.json')).then((r) => r.json()).then(setS).catch(() => undefined) }, [])
  if (!s) return null
  const a = s.areas_km2
  const ratio = a.catchment / a.h4_footprint
  const acc = (o?: Record<string, number>) => Object.values(o ?? {}).map((v) => fmt(v, 0)).join(', ')
  const cur = s.images[img]
  return (
    <Toggle title="2.1.1 · Benchmark against a local model: Cyclone Cheneso, Mahajanga (January 2023)">
      <div className="space-y-3 text-sm text-ink-2">
        <p><b className="text-ink">Purpose.</b> Check that the production set-up ({s.res_m} m grid with {s.subgrid_m} m sub-grid, depths
          downscaled to {s.downscale_m} m on FABDEM, land-cover roughness, wet-soil curve numbers) gives a flood of the same order of magnitude as
          a detailed local model: GESCOD's 1 m HEC-RAS model of the Metzinger valley for Cheneso. No parameter is tuned: a fit to one urban basin
          would absorb its embankment, survey and drainage network and would not hold elsewhere. Sensitivity runs show whether the conclusion
          depends on the parameters.</p>
        <p><b className="text-ink">Event and forcing.</b> Cyclone Cheneso, 19–23 January 2023, the period GESCOD simulated, when heavy rain
          coincided with exceptional spring tides (22–23 January). Both models get the same rainfall (GESCOD's half-hourly GPM series over the
          basin, digitised from their figure 8) and the same tide at the sea edge (their figure 10). Differences therefore come from the models:
          terrain, structures, roughness, infiltration and grid.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="GESCOD model area" value={`${fmt(a.h4_footprint, 1)} km²`} sub="Metzinger basin, 500 ha in the report" />
        <Stat label="Benchmark model domain" value={`${fmt(a.domain, 1)} km²`} sub={`${fmt(s.cells.domain)} cells at ${s.res_m} m`} />
        <Stat label="Rain in window (GESCOD)" value={`${fmt(s.gescod_rain?.window_mm ?? 0, 0)} mm`} sub={`peak ${s.gescod_rain?.peak_mm_hr ?? '–'} mm/h`} />
        <Stat label="IMERG V07B, same basin" value={`${fmt(s.rain_window_mm, 0)} mm`} sub={`peak ${s.rain_peak_mm_hr} mm/h`} />
      </div>

      <Toggle title="Model domain and static inputs">
        <div className="flex flex-wrap items-center gap-2">
          <Pill on={img === ''} onClick={() => setImg('')}>Outlines only</Pill>
          {Object.entries(s.images).map(([k, v]) => <Pill key={k} on={img === k} onClick={() => setImg(k)}>{v.name}</Pill>)}
          <Opacity value={op} onChange={setOp} />
        </div>
        <ValleyMap s={s} dark={dark} opacity={op} images={cur ? [{ id: `st-${img}`, img: cur, nearest: img === 'msk' }] : []}
          legends={cur ? [{ title: cur.name, items: cur.legend }] : []} />
        <table className="w-full text-sm"><tbody className="[&_td]:border-b [&_td]:border-line [&_td]:py-1.5 [&_td]:pr-3">
          {[
            ['Domain', `GESCOD model area plus 1 km (${fmt(a.domain, 1)} km², ${fmt(s.cells.domain)} cells), reaching the sea for the tide. The production model of this place is the whole catchment ${s.basin_id} (${fmt(a.catchment, 0)} km², ${fmt(ratio, 0)} times the GESCOD area, ${fmt(s.cells.catchment)} cells), most of which does not drain to the valley.`, 'GESCOD: the 500 ha basin'],
            ['Grid', `${s.res_m} m, UTM 38S; sub-grid ${s.subgrid_m} m from FABDEM (bare-earth, 30 m); output downscaled to ${s.downscale_m} m`, 'GESCOD: 1 m mesh on a local survey, RN4 embankment and FITIM bridge culverts included'],
            ['Roughness', 'Manning from land cover (ESA/VITO classes: built-up 0.10, cropland 0.037, grass 0.034, shrubs 0.05, forest 0.10–0.11), in the sub-grid tables; varied by a factor in the sensitivity runs', 'GESCOD: 0.04 everywhere'],
            ['Infiltration', `SCS curve number, ${s.gcn_arc} (wet soils, as for cyclone design storms)`, `GESCOD: CN ${s.gescod_cn} (basin mean)`],
            ['Boundaries', 'GESCOD tide as water level on every edge cell the sea reaches: cells next to the sea and edge cells whose lowest point is below 2.5 m (highest tide + 0.4 m: estuary, mudflats); free outflow on the higher land edge', 'GESCOD: tide at the downstream limit'],
            ['Drainage network', 'Not represented (no culverts, canal only as resolved by the terrain)', 'GESCOD: main canal and culverts'],
          ].map(([k, v, g]) => <tr key={k}><td className="font-medium text-ink">{k}</td><td className="text-ink-2">{v}</td><td className="text-ink-3">{g}</td></tr>)}
        </tbody></table>
      </Toggle>

      <Toggle title="Rainfall and tide">
        <Chart option={forcingChart(palette, s)} height={340} label="Half-hourly rainfall over the Metzinger basin from GESCOD and from IMERG V07B, 18 to 27 January 2023, with the simulated window shaded, and the predicted tide at Mahajanga" />
        <div className="space-y-2 text-sm text-ink-2">
          <p><b className="text-ink">Rainfall used.</b> GESCOD's series (their figure 8: half-hourly GPM averaged over the basin polygon, from NASA
            Giovanni in 2023), digitised and checked against their figure 9: maxima over 1, 3, 6, 12 and 24 h of {acc(s.gescod_rain?.max_acc_mm)} mm;
            {' '}{fmt(s.gescod_rain?.window_mm ?? 0, 0)} mm in the window, applied uniformly.</p>
          <p><b className="text-ink">IMERG V07B over the same polygon.</b> Area-weighted over the IMERG cells that the GESCOD basin overlaps (95% in one
            0.1° cell): {fmt(s.rain_window_mm, 0)} mm in the window, peak {s.rain_peak_mm_hr} mm/h, maxima {acc(s.imerg_max_acc_mm)} mm — about half
            of GESCOD's at every duration. Averaging over the whole model catchment gives almost the same ({fmt(s.rain_catchment_window_mm, 0)} mm), so
            the difference is the product version, not the area: GESCOD probably used an earlier IMERG release. It is run as a sensitivity case.</p>
          <p><b className="text-ink">Tide.</b> {s.tide.source}; converted to {s.tide.datum}, taken as equal to FABDEM's mean sea level, and shifted
            from local time to UTC (−3 h); range {fmt(s.tide.min, 2)} to +{fmt(s.tide.max, 2)} m. The rainfall chart is taken as UTC.</p>
        </div>
      </Toggle>

      {s.scores && <Results s={s} dark={dark} />}
    </Toggle>
  )
}

const RUN_LABEL: Record<string, string> = {
  base: 'Base: production set-up', rough_x0p5: 'Roughness × 0.5', rough_x2: 'Roughness × 2', arcii: 'Average soil moisture (ARCII)',
  gescod_inputs: "GESCOD's roughness (0.04) and curve number (84.3)", res50: 'Grid 50 m instead of 100 m', imerg_valley: 'IMERG V07B rainfall over the same basin',
  imerg_catchment: 'IMERG V07B rainfall, whole-catchment mean',
}
const ORDER = ['base', 'rough_x0p5', 'rough_x2', 'arcii', 'gescod_inputs', 'res50', 'imerg_valley', 'imerg_catchment']
const RAIN_RUNS = ['imerg_valley', 'imerg_catchment']

function Results({ s, dark }: { s: Setup; dark: boolean }) {
  const [run, setRun] = useState('base')
  const [show, setShow] = useState({ gescod: false, model: false, compare: true })
  const [op, setOp] = useState(0.8)
  const sc = ORDER.map((t) => s.scores!.find((x) => x.tag === t)).filter((x): x is Score => !!x)
  const b = sc.find((x) => x.tag === 'base')!
  const sens = sc.filter((x) => !RAIN_RUNS.includes(x.tag) && x.tag !== 'res50')
  const iv = sc.find((x) => x.tag === 'imerg_valley')
  const r50 = sc.find((x) => x.tag === 'res50')
  const ratios = sens.map((x) => x.obs_flooded_ha / x.mod_flooded_ha)
  const csis = sens.map((x) => x.csi)
  const err = sens.map((x) => x.depth_median_error_m)
  const f = (v: number, d = 2) => fmt(v, d)
  const lay = s.result_layers?.[run]
  const images = [
    ...(show.gescod && s.gescod_layer ? [{ id: 'r-gescod', img: s.gescod_layer }] : []),
    ...(show.model && lay ? [{ id: `r-model-${run}`, img: lay.depth, nearest: true }] : []),
    ...(show.compare && lay ? [{ id: `r-cmp-${run}`, img: lay.compare, nearest: true }] : []),
  ]
  const legends = [
    ...((show.gescod || show.model) && s.depth_legend ? [{ title: 'Maximum depth (above 15 cm)', items: s.depth_legend }] : []),
    ...(show.compare && s.compare_legend ? [{ title: `Flooded above 15 cm: ${RUN_LABEL[run]}`, items: s.compare_legend }] : []),
  ]
  const toggle = (k: keyof typeof show) => setShow((x) => ({ ...x, [k]: !x[k] }))
  return (
    <>
      <h4 className="pt-2 text-base font-semibold text-ink">Results</h4>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-2">
        {([['gescod', 'GESCOD model depth (1 m)'], ['model', 'This model depth (30 m)'], ['compare', 'Comparison']] as const).map(([k, lab]) => (
          <label key={k} className="flex items-center gap-1.5"><input type="checkbox" className="accent-accent" checked={show[k]} onChange={() => toggle(k)} />{lab}</label>
        ))}
        <label className="flex items-center gap-1.5">Run
          <select value={run} onChange={(e) => setRun(e.target.value)} className="rounded border border-line bg-surface px-1.5 py-0.5">
            {sc.map((x) => <option key={x.tag} value={x.tag}>{RUN_LABEL[x.tag] ?? x.tag}</option>)}
          </select>
        </label>
        <Opacity value={op} onChange={setOp} />
      </div>
      <ValleyMap s={s} dark={dark} opacity={op} images={images} legends={legends} outlines={['h4_footprint']} fit="gescod" />
      <table className="w-full text-sm"><thead><tr className="text-left text-ink-3 [&_th]:pb-1 [&_th]:pr-3">
        <th>Run</th><th>Flooded (ha)</th><th>GESCOD / model</th><th>CSI</th><th>Hit rate</th><th>False alarms</th><th>Median depth error</th>
      </tr></thead><tbody className="[&_td]:border-t [&_td]:border-line [&_td]:py-1.5 [&_td]:pr-3">
        {sc.map((x) => (
          <tr key={x.tag} onClick={() => setRun(x.tag)} className={`cursor-pointer ${x.tag === run ? 'bg-accent/10' : ''} ${x.tag === 'base' ? 'font-semibold text-ink' : RAIN_RUNS.includes(x.tag) ? 'text-ink-3' : 'text-ink-2'}`}>
            <td>{RUN_LABEL[x.tag] ?? x.tag}</td><td>{fmt(x.mod_flooded_ha, 0)} / {fmt(x.obs_flooded_ha, 0)}</td>
            <td>×{f(x.obs_flooded_ha / x.mod_flooded_ha, 1)}</td><td>{f(x.csi)}</td><td>{f(x.hit_rate)}</td><td>{f(x.far)}</td><td>{f(x.depth_median_error_m)} m</td>
          </tr>))}
      </tbody></table>
      <p className="text-xs text-ink-3">Click a row to show that run on the map. Flooded = maximum depth above 15 cm, inside the GESCOD model area, on a 30 m grid
        (GESCOD's 1 m depths averaged). False alarms = false alarm ratio. Depth error = this model minus GESCOD where GESCOD floods. The last two rows
        change the rainfall, not the model.</p>

      <h4 className="pt-2 text-base font-semibold text-ink">Conclusions</h4>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-2">
        <li><b className="text-ink">Same order of magnitude, on the low side.</b> With the same rainfall and tide, the production set-up floods {fmt(b.mod_flooded_ha, 0)} ha
          against {fmt(b.obs_flooded_ha, 0)} ha for GESCOD (×{f(b.obs_flooded_ha / b.mod_flooded_ha, 1)}), with depths {f(Math.abs(b.depth_median_error_m))} m
          shallower (median) where GESCOD floods: within the factor 2 and ±0.5 m set as criteria, but always below the local model.</li>
        <li><b className="text-ink">Where it agrees and where it does not.</b> The flooded valley axis is reproduced (hit rate {f(b.hit_rate)}, few false alarms: {f(b.far)}).
          The deep basin behind the RN4 embankment near the canal outlet (1.5–2 m in GESCOD) and the side valleys are missed: our model has neither
          the embankment nor the culverts that the high tides block, and FABDEM has half of the surveyed area below 2 m (49 against 101 ha).</li>
        <li><b className="text-ink">Not a parameter problem.</b> Across the sensitivity runs the ratio stays between ×{f(Math.min(...ratios), 1)} and ×{f(Math.max(...ratios), 1)},
          the CSI between {f(Math.min(...csis))} and {f(Math.max(...csis))} and the median depth error between {f(Math.min(...err))} and {f(Math.max(...err))} m.
          Rougher land floods slightly more; soil moisture hardly matters with about 490 mm of rain; GESCOD's own roughness and curve number flood
          less, not more. Tuning would not close the gap, which comes from terrain and structures.</li>
        <li><b className="text-ink">Tide on the whole low boundary.</b> Free outflow on the estuary and mudflat edges let the low basin drain even at
          high tide; giving the tide to every edge cell below 2.5 m (the highest tide + 0.4 m) raised the flooded area by about 15% and the CSI to
          {' '}{f(b.csi)}, mostly in the south-east basin near the estuary.</li>
        {r50 && <li><b className="text-ink">A finer grid does not help.</b> At 50 m (same 25 m sub-grid terrain) the model floods {fmt(r50.mod_flooded_ha, 0)} ha
          with a CSI of {f(r50.csi)} and more false alarms ({f(r50.far)}), for four times the cells and about seven times the run time: the sub-grid
          already carries the 25 m terrain, and the remaining gap comes from the terrain data and the missing structures, not the grid.</li>}
        {iv && <li><b className="text-ink">Rainfall matters most.</b> With IMERG V07B over the same basin (about half of GESCOD's rain) the flooded area drops
          to {fmt(iv.mod_flooded_ha, 0)} ha (×{f(iv.obs_flooded_ha / iv.mod_flooded_ha, 1)}): the rainfall product weighs more than any parameter, which matters
          for the design storms built from IMERG.</li>}
        <li><b className="text-ink">Implication for the national maps.</b> Keep the production parameters. Expect depths and extents to be underestimated in
          low-lying towns behind embankments where the tide blocks drainage; in such places local models or surveyed terrain are needed.</li>
      </ul>
    </>
  )
}
