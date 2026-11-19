import type { EChartsOption } from 'echarts'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useState } from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import { dataUrl } from '../data'
import { fmt } from '../format'
import type { Palette } from '../theme'
import { Chart, Figure, Info, Stat, Toggle } from './ui'

setWorkerUrl(workerUrl)

type Corners = [[number, number], [number, number], [number, number], [number, number]]
interface Img { name: string; file: string; coordinates: Corners; legend: { value: number | string; color: string }[] }
interface Score {
  tag: string; rain: string; obs_flooded_ha: number; mod_flooded_ha: number; csi: number; hit_rate: number; far: number; bias: number
  depth_median_error_m: number; depth_p90_abs_error_m: number; mod_max_m: number; obs_max_m: number
}
interface Setup {
  event: string; basin_id: string; res_m: number; subgrid_m: number; downscale_m: number; manning: number; gcn_arc: string
  cn_mean_catchment: number; gescod_cn: number; areas_km2: Record<string, number>; cells: { catchment: number; domain: number }
  window_utc: [string, string]; rain_window_mm: number; rain_event_mm: number; rain_peak_mm_hr: number
  tide: { datum: string; source: string; max: number; min: number }
  rainfall: { t: string; i: number }[]; tide_series: { t: string; z: number }[]
  images: Record<string, Img>; layers: string; h4_image: { file: string; coordinates: Corners }
  bounds: Record<'catchment' | 'valley', [[number, number], [number, number]]>
  rainfall_gescod?: { t: string; i: number }[]
  gescod_rain?: { window_mm: number; peak_mm_hr: number; max_acc_mm: Record<string, number> }
  scores?: Score[]; compare_figure?: string
}

const SAT = {
  version: 8 as const,
  sources: { esri: { type: 'raster' as const, tileSize: 256, attribution: 'Esri World Imagery',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] } },
  layers: [{ id: 'esri', type: 'raster' as const, source: 'esri' }],
}
const STREETS = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }
const OUTLINE: Record<string, { color: string; width: number; dash?: number[]; fill?: number }> = {
  catchment: { color: '#7f7f7f', width: 1.5 },
  draining: { color: '#ff7f0e', width: 1.5, dash: [2, 2] },
  domain: { color: '#2ca02c', width: 2.5, fill: 0.08 },
  h4_footprint: { color: '#d62728', width: 2 },
}

function SetupMap({ s, dark, image, outlines, h4, focus }: {
  s: Setup; dark: boolean; image?: string; outlines: string[]; h4: boolean; focus: 'catchment' | 'valley'
}) {
  const [sat, setSat] = useState(true)
  const img = image ? s.images[image] : undefined
  const bounds = s.bounds[focus]
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-sm text-ink-2">
        <input type="checkbox" className="accent-accent" checked={sat} onChange={(e) => setSat(e.target.checked)} /> Satellite basemap
      </label>
      <div className="relative h-[520px] overflow-hidden rounded-lg border border-line">
        <Map key={focus} initialViewState={{ bounds, fitBoundsOptions: { padding: 20 } }} mapStyle={sat ? SAT : dark ? STREETS.dark : STREETS.light}
          onLoad={(e) => e.target.resize()} attributionControl={{ compact: true, customAttribution: 'FABDEM · GCN250 · GESCOD (2023) · HydroBASINS' }}>
          {img && (
            <Source key={image} id={`img-${image}`} type="image" url={dataUrl(img.file)} coordinates={img.coordinates}>
              <Layer id={`img-${image}-r`} type="raster" paint={{ 'raster-opacity': 0.8, 'raster-fade-duration': 0, 'raster-resampling': image === 'msk' ? 'nearest' : 'linear' }} />
            </Source>
          )}
          {h4 && (
            <Source id="h4img" type="image" url={dataUrl(s.h4_image.file)} coordinates={s.h4_image.coordinates}>
              <Layer id="h4img-r" type="raster" paint={{ 'raster-opacity': 0.9, 'raster-fade-duration': 0 }} />
            </Source>
          )}
          <Source id="setup-layers" type="geojson" data={dataUrl(s.layers)}>
            {outlines.map((id) => (
              <Layer key={`${id}-f`} id={`${id}-f`} type="fill" filter={['==', ['get', 'id'], id]}
                paint={{ 'fill-color': OUTLINE[id].color, 'fill-opacity': OUTLINE[id].fill ?? 0 }} />
            ))}
            {outlines.map((id) => (
              <Layer key={id} id={id} type="line" filter={['==', ['get', 'id'], id]}
                paint={{ 'line-color': OUTLINE[id].color, 'line-width': OUTLINE[id].width, ...(OUTLINE[id].dash ? { 'line-dasharray': OUTLINE[id].dash } : {}) }} />
            ))}
          </Source>
        </Map>
        {img && (
          <div className="absolute bottom-8 left-2 rounded bg-white/90 p-2 text-xs text-neutral-800 shadow">
            <div className="mb-1 font-semibold">{img.name}</div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              {img.legend.map((l) => <span key={String(l.value)} className="flex items-center gap-1"><span className="h-2.5 w-4" style={{ background: l.color }} />{l.value}</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function forcingChart(p: Palette, s: Setup): EChartsOption {
  const axis = { axisLabel: { color: p['text-secondary'] }, axisLine: { lineStyle: { color: p.axis } }, splitLine: { lineStyle: { color: p.grid } }, nameTextStyle: { color: p['text-secondary'] } }
  const ms = (t: string) => new Date(t.replace(' ', 'T') + 'Z').getTime()
  return {
    grid: { left: 56, right: 60, top: 36, bottom: 40 },
    legend: { top: 0, textStyle: { color: p['text-secondary'] } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'time', ...axis, min: ms('2023-01-18 00:00:00'), max: ms('2023-01-28 00:00:00') },
    yAxis: [
      { type: 'value', name: 'Rain (mm/h)', ...axis },
      { type: 'value', name: 'Tide (m NGM)', ...axis, splitLine: { show: false }, min: -2.5, max: 2.5 },
    ],
    series: [
      { name: 'GESCOD rainfall, basin (used)', type: 'bar', barWidth: '90%', itemStyle: { color: p.accent },
        data: (s.rainfall_gescod ?? []).map((r) => [ms(r.t), r.i]),
        markArea: { itemStyle: { color: 'rgba(44,160,44,0.10)' }, label: { color: p['text-secondary'], fontSize: 11 },
          data: [[{ name: 'Simulated (GESCOD window)', xAxis: ms(s.window_utc[0]) }, { xAxis: ms(s.window_utc[1]) }]] } },
      { name: 'IMERG V07B, catchment mean (not used)', type: 'line', step: 'end', showSymbol: false, lineStyle: { width: 1, color: p['text-muted'] },
        itemStyle: { color: p['text-muted'] }, data: s.rainfall.map((r) => [ms(r.t), r.i]) },
      { name: 'Tide at Mahajanga (GESCOD)', type: 'line', yAxisIndex: 1, showSymbol: false, lineStyle: { width: 1.5, color: '#8c564b' },
        itemStyle: { color: '#8c564b' }, data: s.tide_series.map((r) => [ms(r.t), r.z]) },
    ],
  }
}

/** Chapter 3.1: benchmark of the production set-up against the GESCOD local model for Cheneso. */
export function CalibrationSetup({ palette, dark }: { palette: Palette; dark: boolean }) {
  const [s, setS] = useState<Setup>()
  const [img, setImg] = useState('dem')
  const [focus, setFocus] = useState<'catchment' | 'valley'>('catchment')
  useEffect(() => { fetch(dataUrl('calibration_setup.json')).then((r) => r.json()).then(setS).catch(() => undefined) }, [])
  if (!s) return null
  const a = s.areas_km2
  const ratio = a.catchment / a.h4_footprint
  return (
    <Toggle title="3.1 · Benchmark against a local model: Cyclone Cheneso, Mahajanga (January 2023)">
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
        <Stat label="GESCOD model area" value={`${fmt(a.h4_footprint, 1)} km²`} sub="basin of 500 ha (report)" />
        <Stat label="Our catchment" value={`${fmt(a.catchment, 0)} km²`} sub={`${fmt(ratio, 0)}× larger; ${fmt(s.cells.catchment)} cells`} />
        <Stat label="Benchmark domain" value={`${fmt(a.domain, 1)} km²`} sub={`about ${fmt(s.cells.domain)} cells at ${s.res_m} m`} />
        <Stat label="Rain in window (GESCOD)" value={`${fmt(s.gescod_rain?.window_mm ?? 0, 0)} mm`} sub={`peak ${s.gescod_rain?.peak_mm_hr ?? '–'} mm/h; IMERG V07B: ${fmt(s.rain_window_mm, 0)} mm`} />
      </div>

      <Toggle title="Model domain">
        <div className="flex gap-2 text-sm">
          {(['catchment', 'valley'] as const).map((f) => (
            <button key={f} onClick={() => setFocus(f)} className={`rounded border px-2 py-0.5 ${focus === f ? 'border-accent text-accent' : 'border-line text-ink-2'}`}>
              {f === 'catchment' ? 'Whole catchment' : 'Metzinger valley'}</button>))}
        </div>
        <SetupMap s={s} dark={dark} outlines={['catchment', 'draining', 'domain', 'h4_footprint']} h4 focus={focus} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {[['catchment', 'Model catchment 1070036890'], ['h4_footprint', 'GESCOD model area (H4, depth shown)'], ['draining', 'Area draining to it on FABDEM'], ['domain', 'Benchmark domain (H4 area + 1 km)']].map(([id, lab]) => (
            <span key={id} className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5" style={{ background: OUTLINE[id].color }} />{lab} ({fmt(a[id], 1)} km²)</span>
          ))}
        </div>
        <Info>
          The national set-up models whole catchments; this one ({fmt(a.catchment, 0)} km²) is about {fmt(ratio, 0)} times the GESCOD
          area, and most of it lies inland and does not drain to the valley. On FABDEM {fmt(a.draining, 0)} km² route
          through the valley, probably because the 30 m terrain model misses the RN4 road embankment and the canal works that close the 500 ha basin
          described by GESCOD. Adopted: model only the GESCOD area plus a 1 km halo, with the GESCOD tide on the sea edge, as GESCOD did. This cuts the cells
          by about {fmt(s.cells.catchment / Math.max(s.cells.domain, 1), 0)} times (minutes per run instead of tens of minutes) and keeps the
          comparison like for like. The parameters found apply to the whole-catchment production runs.
        </Info>
      </Toggle>

      <Toggle title="Static inputs">
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.entries(s.images).map(([k, v]) => (
            <button key={k} onClick={() => setImg(k)} className={`rounded border px-2 py-0.5 ${img === k ? 'border-accent text-accent' : 'border-line text-ink-2'}`}>{v.name}</button>
          ))}
        </div>
        <SetupMap s={s} dark={dark} image={img} outlines={['catchment', 'domain', 'h4_footprint']} h4={false} focus="catchment" />
        <table className="w-full text-sm"><tbody className="[&_td]:border-b [&_td]:border-line [&_td]:py-1.5 [&_td]:pr-3">
          {[
            ['Grid', `${s.res_m} m, UTM 38S; sub-grid ${s.subgrid_m} m from FABDEM (bare-earth, 30 m); output downscaled to ${s.downscale_m} m`, 'GESCOD: 1 m mesh on a local survey, RN4 embankment and FITIM bridge culverts included'],
            ['Roughness', 'Manning from land cover (ESA/VITO classes: built-up 0.10, cropland 0.037, grass 0.034, shrubs 0.05, forest 0.10–0.11), in the sub-grid tables; varied by a factor in the sensitivity runs', 'GESCOD: 0.04 everywhere'],
            ['Infiltration', `SCS curve number, ${s.gcn_arc} (wet soils, as for cyclone design storms); catchment mean ${s.cn_mean_catchment}`, `GESCOD: CN ${s.gescod_cn} (basin mean)`],
            ['Boundaries', 'Sea edge: GESCOD tide as water level; land edge: free outflow', 'GESCOD: tide at the downstream limit'],
            ['Drainage network', 'Not represented (no culverts, canal only as resolved by the terrain)', 'GESCOD: main canal and culverts'],
          ].map(([k, v, g]) => <tr key={k}><td className="font-medium text-ink">{k}</td><td className="text-ink-2">{v}</td><td className="text-ink-3">{g}</td></tr>)}
        </tbody></table>
      </Toggle>

      <Toggle title="Rainfall and tide">
        <Chart option={forcingChart(palette, s)} height={340} label="Half-hourly IMERG rainfall over the catchment from 18 to 28 January 2023 with the simulated window shaded, and the predicted tide at Mahajanga" />
        <Info>
          Rainfall: GESCOD's series (figure 8: half-hourly GPM averaged over the 500 ha basin, from NASA Giovanni in 2023), digitised and
          checked against their figure 9 (maxima over 1, 3, 6, 12 and 24 h of {Object.values(s.gescod_rain?.max_acc_mm ?? {}).map((v) => fmt(v, 0)).join(', ')} mm);
          applied uniformly; {fmt(s.gescod_rain?.window_mm ?? 0, 0)} mm in the window. The current IMERG Final V07B gives about half as much,
          even in the single cell over the valley ({fmt(s.rain_window_mm, 0)} mm, peak {s.rain_peak_mm_hr} mm/h for the catchment mean): GESCOD
          probably used an earlier IMERG version. Tide: {s.tide.source}; converted to {s.tide.datum}, taken as equal to FABDEM's mean sea level,
          and shifted from local time to UTC (−3 h); range {fmt(s.tide.min, 2)} to +{fmt(s.tide.max, 2)} m. The rainfall chart is taken as UTC.
        </Info>
      </Toggle>

      {s.scores && <Results s={s} />}
    </Toggle>
  )
}

const RUN_LABEL: Record<string, string> = {
  base: 'Base: production set-up', rough_x0p5: 'Roughness × 0.5', rough_x2: 'Roughness × 2', arcii: 'Average soil moisture (ARCII)',
  gescod_inputs: "GESCOD's roughness (0.04) and curve number (84.3)", imerg_catchment: 'Base with IMERG V07B catchment rainfall (not GESCOD forcing)',
}
const ORDER = ['base', 'rough_x0p5', 'rough_x2', 'arcii', 'gescod_inputs', 'imerg_catchment']

function Results({ s }: { s: Setup }) {
  const sc = ORDER.map((t) => s.scores!.find((x) => x.tag === t)).filter((x): x is Score => !!x)
  const b = sc.find((x) => x.tag === 'base')!
  const sens = sc.filter((x) => x.tag !== 'imerg_catchment')
  const ratios = sens.map((x) => x.obs_flooded_ha / x.mod_flooded_ha)
  const csis = sens.map((x) => x.csi)
  const err = sens.map((x) => x.depth_median_error_m)
  const f = (v: number, d = 2) => fmt(v, d)
  return (
    <>
      <h4 className="pt-2 text-base font-semibold text-ink">Results</h4>
      {s.compare_figure && <Figure src={dataUrl(s.compare_figure)} alt="Maximum depth from the GESCOD model and from this model for Cheneso in the Metzinger valley, and a map of where both, only GESCOD or only this model flood" />}
      <table className="w-full text-sm"><thead><tr className="text-left text-ink-3 [&_th]:pb-1 [&_th]:pr-3">
        <th>Run</th><th>Flooded (ha)</th><th>GESCOD / model</th><th>CSI</th><th>Hit rate</th><th>False alarms</th><th>Median depth error</th>
      </tr></thead><tbody className="[&_td]:border-t [&_td]:border-line [&_td]:py-1.5 [&_td]:pr-3">
        {sc.map((x) => (
          <tr key={x.tag} className={x.tag === 'base' ? 'font-semibold text-ink' : x.tag === 'imerg_catchment' ? 'text-ink-3' : 'text-ink-2'}>
            <td>{RUN_LABEL[x.tag] ?? x.tag}</td><td>{fmt(x.mod_flooded_ha, 0)} / {fmt(x.obs_flooded_ha, 0)}</td>
            <td>×{f(x.obs_flooded_ha / x.mod_flooded_ha, 1)}</td><td>{f(x.csi)}</td><td>{f(x.hit_rate)}</td><td>{f(x.far)}</td><td>{f(x.depth_median_error_m)} m</td>
          </tr>))}
      </tbody></table>
      <p className="text-xs text-ink-3">Flooded = maximum depth above 15 cm, inside the GESCOD model area, on a 30 m grid (GESCOD's 1 m depths averaged). False alarms = false alarm ratio. Depth error = this model minus GESCOD where GESCOD floods.</p>

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
        <li><b className="text-ink">Forcing matters most.</b> With the current IMERG V07B catchment rainfall (about half of GESCOD's) the flooded area drops to
          {' '}{fmt(sc.find((x) => x.tag === 'imerg_catchment')?.mod_flooded_ha ?? 0, 0)} ha: the rainfall product and its spatial averaging weigh more than any parameter.</li>
        <li><b className="text-ink">Implication for the national maps.</b> Keep the production parameters. Expect depths and extents to be underestimated in
          low-lying towns behind embankments where the tide blocks drainage; in such places local models or surveyed terrain are needed.</li>
      </ul>
    </>
  )
}
