import type { EChartsOption } from 'echarts'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useState } from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import { dataUrl } from '../data'
import { fmt } from '../format'
import type { Palette } from '../theme'
import { Chart, Info, Stat, Toggle } from './ui'

setWorkerUrl(workerUrl)

type Corners = [[number, number], [number, number], [number, number], [number, number]]
interface Img { name: string; file: string; coordinates: Corners; legend: { value: number | string; color: string }[] }
interface Setup {
  event: string; basin_id: string; res_m: number; subgrid_m: number; downscale_m: number; manning: number; gcn_arc: string
  cn_mean_catchment: number; gescod_cn: number; areas_km2: Record<string, number>; cells: { catchment: number; domain: number }
  window_utc: [string, string]; rain_window_mm: number; rain_event_mm: number; rain_peak_mm_hr: number
  tide: { datum: string; source: string; max: number; min: number }
  rainfall: { t: string; i: number }[]; tide_series: { t: string; z: number }[]
  images: Record<string, Img>; layers: string; h4_image: { file: string; coordinates: Corners }
  bounds: Record<'catchment' | 'valley', [[number, number], [number, number]]>
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
      { name: 'IMERG rainfall, catchment mean (30 min)', type: 'bar', barWidth: '90%', itemStyle: { color: p.accent },
        data: s.rainfall.map((r) => [ms(r.t), r.i]),
        markArea: { itemStyle: { color: 'rgba(44,160,44,0.10)' }, label: { color: p['text-secondary'], fontSize: 11 },
          data: [[{ name: 'Simulated (GESCOD window)', xAxis: ms(s.window_utc[0]) }, { xAxis: ms(s.window_utc[1]) }]] } },
      { name: 'Tide at Mahajanga (GESCOD)', type: 'line', yAxisIndex: 1, showSymbol: false, lineStyle: { width: 1.5, color: '#8c564b' },
        itemStyle: { color: '#8c564b' }, data: s.tide_series.map((r) => [ms(r.t), r.z]) },
    ],
  }
}

/** Chapter 3.1: Cheneso calibration set-up (results added after the runs). */
export function CalibrationSetup({ palette, dark }: { palette: Palette; dark: boolean }) {
  const [s, setS] = useState<Setup>()
  const [img, setImg] = useState('dem')
  const [focus, setFocus] = useState<'catchment' | 'valley'>('catchment')
  useEffect(() => { fetch(dataUrl('calibration_setup.json')).then((r) => r.json()).then(setS).catch(() => undefined) }, [])
  if (!s) return null
  const a = s.areas_km2
  const ratio = a.catchment / a.h4_footprint
  return (
    <Toggle title="3.1 · Model calibration: Cyclone Cheneso, Mahajanga (January 2023)">
      <div className="space-y-3 text-sm text-ink-2">
        <p><b className="text-ink">Purpose.</b> Fix the parameters of the pluvial model (roughness, infiltration, rainfall factor) by
          reproducing the only detailed depth map available: GESCOD's 1 m HEC-RAS model of the Metzinger valley for Cheneso. The parameters are
          then frozen for the validation events (3.2) and the national flood maps. The run uses the production set-up: {s.res_m} m grid with
          {' '}{s.subgrid_m} m sub-grid, depths downscaled to {s.downscale_m} m on FABDEM.</p>
        <p><b className="text-ink">Event.</b> Cyclone Cheneso brought heavy rain over Mahajanga during 19–26 January 2023; GESCOD simulated
          19–23 January, when rain coincided with exceptional spring tides (22–23 January), and found return periods close to 5 years for
          the rainfall. The comparison uses the same window, rainfall product and tide, so differences come from the models.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="GESCOD model area" value={`${fmt(a.h4_footprint, 1)} km²`} sub="basin of 500 ha (report)" />
        <Stat label="Our catchment" value={`${fmt(a.catchment, 0)} km²`} sub={`${fmt(ratio, 0)}× larger; ${fmt(s.cells.catchment)} cells`} />
        <Stat label="Proposed domain" value={`${fmt(a.domain, 1)} km²`} sub={`about ${fmt(s.cells.domain)} cells at ${s.res_m} m`} />
        <Stat label="Rain in window" value={`${fmt(s.rain_window_mm, 0)} mm`} sub={`peak ${s.rain_peak_mm_hr} mm/h (IMERG, 30 min)`} />
      </div>

      <Toggle title="Model domain">
        <div className="flex gap-2 text-sm">
          {(['catchment', 'valley'] as const).map((f) => (
            <button key={f} onClick={() => setFocus(f)} className={`rounded border px-2 py-0.5 ${focus === f ? 'border-accent text-accent' : 'border-line text-ink-2'}`}>
              {f === 'catchment' ? 'Whole catchment' : 'Metzinger valley'}</button>))}
        </div>
        <SetupMap s={s} dark={dark} outlines={['catchment', 'draining', 'domain', 'h4_footprint']} h4 focus={focus} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          {[['catchment', 'Model catchment 1070036890'], ['h4_footprint', 'GESCOD model area (H4, depth shown)'], ['draining', 'Area draining to it on FABDEM'], ['domain', 'Proposed calibration domain (H4 area + 1 km)']].map(([id, lab]) => (
            <span key={id} className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5" style={{ background: OUTLINE[id].color }} />{lab} ({fmt(a[id], 1)} km²)</span>
          ))}
        </div>
        <Info>
          The national set-up models whole catchments; this one ({fmt(a.catchment, 0)} km²) is about {fmt(ratio, 0)} times the GESCOD
          area, and most of it lies inland and does not drain to the valley. On FABDEM {fmt(a.draining, 0)} km² route
          through the valley, probably because the 30 m terrain model misses the RN4 road embankment and the canal works that close the 500 ha basin
          described by GESCOD. Proposed: model only the GESCOD area plus a 1 km halo, with the GESCOD tide on the sea edge, as GESCOD did. This cuts the cells
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
            ['Roughness', `Manning ${s.manning} everywhere (calibration parameter)`, `GESCOD: ${s.manning} everywhere`],
            ['Infiltration', `SCS curve number, ${s.gcn_arc} (wet soils, as for cyclone design storms); catchment mean ${s.cn_mean_catchment}`, `GESCOD: CN ${s.gescod_cn} (basin mean)`],
            ['Boundaries', 'Sea edge: GESCOD tide as water level; land edge: free outflow', 'GESCOD: tide at the downstream limit'],
            ['Drainage network', 'Not represented (no culverts, canal only as resolved by the terrain)', 'GESCOD: main canal and culverts'],
          ].map(([k, v, g]) => <tr key={k}><td className="font-medium text-ink">{k}</td><td className="text-ink-2">{v}</td><td className="text-ink-3">{g}</td></tr>)}
        </tbody></table>
      </Toggle>

      <Toggle title="Rainfall and tide">
        <Chart option={forcingChart(palette, s)} height={340} label="Half-hourly IMERG rainfall over the catchment from 18 to 28 January 2023 with the simulated window shaded, and the predicted tide at Mahajanga" />
        <Info>
          Rainfall: GPM IMERG Final V07B, half-hourly, averaged over the catchment and applied uniformly; {fmt(s.rain_window_mm, 0)} mm in the
          simulated window ({fmt(s.rain_event_mm, 0)} mm over the whole event). GESCOD used the same product (NASA Giovanni). IMERG smooths short
          bursts, so peaks are likely underestimated; a rainfall factor is one of the calibration parameters. Tide: {s.tide.source}; converted to
          {' '}{s.tide.datum}, taken as equal to FABDEM's mean sea level, and shifted from local time to UTC (−3 h); range {fmt(s.tide.min, 2)} to
          +{fmt(s.tide.max, 2)} m. Rain and tide are not available for 24–26 January in the GESCOD study, so these days are left out.
        </Info>
      </Toggle>

      <Info>Results and conclusions will be added here after the calibration runs.</Info>
    </Toggle>
  )
}
