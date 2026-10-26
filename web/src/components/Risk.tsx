import { useEffect, useMemo, useState } from 'react'
import Map, { Layer, Popup, Source, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { EChartsOption } from 'echarts'
import { dataUrl } from '../data'
import { fmt } from '../format'
import { SCENARIO_SLOT, type Palette } from '../theme'
import type { FeatureCollection, Scenario, Units } from '../types'
import { SCENARIO_LABEL } from './Exposure'
import { Card, Chart, DataTable, Info, Legend, Segmented, Stat, Steps } from './ui'

const BASEMAP = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
const MDG: [[number, number], [number, number]] = [[43.1, -25.7], [50.6, -11.9]]

type Metric = 'econ' | 'pop_affected' | 'pop_exposed' | 'agri'
type Level = 'adm1' | 'adm2' | 'adm3' | 'adm4'
type Measure = 'aal' | 'relative' | 'change'
type ByScen<T> = Record<Scenario, T>

interface National {
  aal: ByScen<number>; aal_hazard: ByScen<number>; aal_exposure: ByScen<number>; aal_flooded_only: ByScen<number>
  loss: ByScen<number[]>; aal_outside: ByScen<number>; exposure?: ByScen<number>
}
interface RiskDoc {
  hazard: { tag: string; label: string; placeholder: boolean }
  hmin_exposed: number
  return_periods: number[]
  scenarios: Scenario[]
  metrics: Record<Metric, { label: string; unit: string }>
  national: Record<Metric, National>
  agri_usd_per_ha: { cropland: number; grassland: number }
  qc: {
    wet_km2: ByScen<number[]>; depth_classes_m: number[]; wet_km2_by_class: ByScen<number[][]>
    n_assets: Record<string, number>; wet_assets: Record<string, ByScen<number[]>>
    buildings_depth_drops_with_rp: ByScen<number>; buildings_deeper_than_10m_rp100: ByScen<number>; buildings_wet_rp100: ByScen<number>
  }
  reference?: Partial<Record<Metric, ByScen<{ ids: string[]; previous: number[]; this_run: number[] }>>>
}
interface LevelDoc {
  ids: string[]
  metrics: Record<Metric, { aal: ByScen<number[]>; aal_hazard?: ByScen<number[]>; aal_exposure?: ByScen<number[]>; loss?: ByScen<number[][]> }>
}
interface LossChunk { ids: string[]; loss: Record<Metric, ByScen<number[][]>> }

const METRIC_LABEL: Record<Metric, string> = {
  econ: 'Building loss', pop_affected: 'People affected', pop_exposed: 'People in flooded area', agri: 'Agricultural loss',
}
const LEVEL_LABEL: Record<Level, [string, string, string]> = {
  adm1: ['Region', 'regions', 'adm1_region'], adm2: ['District', 'districts', 'adm2_district'],
  adm3: ['Commune', 'communes', 'adm3_commune'], adm4: ['Fokontany', 'fokontany', 'adm4_fokontany'],
}
const OPACITY = [0.1, 0.25, 0.4, 0.55, 0.7, 0.88]
// change vs baseline: diverging classes, symmetric on a ratio scale, grey around × 1
const CHANGE_BREAKS = [0.5, 0.8, 1 / 1.05, 1.05, 1.25, 2, 5]
const CHANGE_CLASSES: { role: 'cat-1' | 'neutral' | 'cat-2'; opacity: number }[] = [
  { role: 'cat-1', opacity: 0.85 }, { role: 'cat-1', opacity: 0.55 }, { role: 'cat-1', opacity: 0.3 }, { role: 'neutral', opacity: 0.2 },
  { role: 'cat-2', opacity: 0.3 }, { role: 'cat-2', opacity: 0.55 }, { role: 'cat-2', opacity: 0.75 }, { role: 'cat-2', opacity: 0.92 },
]
const isUsd = (m: Metric) => m === 'econ' || m === 'agri'

const money = (v: number) => (Math.abs(v) >= 1e9 ? `${fmt(v / 1e9, 2)} bn` : Math.abs(v) >= 1e6 ? `${fmt(v / 1e6, 1)} M` : Math.abs(v) >= 1e3 ? `${fmt(v / 1e3, 1)} k` : fmt(v))
const pct = (r: number) => `${r >= 1 ? '+' : '−'}${fmt(Math.abs(100 * (r - 1)), 1)}%`
const show = (m: Metric, v: number) => (isUsd(m) ? `${money(v)} USD` : `${money(v)} people`)

/** Sextile breaks of the positive values, so each map class holds about the same number of polygons. */
function breaks(values: number[]): number[] {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b)
  if (!v.length) return [0]
  const q = [1, 2, 3, 4, 5].map((k) => v[Math.floor((k / 6) * (v.length - 1))])
  return [...new Set(q.map((x) => Number(x.toPrecision(2))))]
}

/** AAL contribution of each return-period band (trapezoids over 1/T) and of the tail beyond the rarest event. */
function bands(loss: number[], rps: number[]): number[] {
  const p = rps.map((t) => 1 / t)
  return [...p.slice(0, -1).map((pk, k) => ((pk - p[k + 1]) * (loss[k] + loss[k + 1])) / 2), p[p.length - 1] * loss[loss.length - 1]]
}

export function Risk({ palette, dark }: { palette: Palette; dark: boolean }) {
  const [doc, setDoc] = useState<RiskDoc>()
  const [metric, setMetric] = useState<Metric>('econ')
  const [level, setLevel] = useState<Level>('adm1')
  const [scenario, setScenario] = useState<Scenario>('hist_baseline')
  const [measure, setMeasure] = useState<Measure>('aal')
  const [data, setData] = useState<Partial<Record<Level, { fc: FeatureCollection; units: Units; risk: LevelDoc }>>>({})
  const [hover, setHover] = useState<{ i: number; lng: number; lat: number } | null>(null)
  const [selected, setSelected] = useState<string>()
  const [chunk, setChunk] = useState<LossChunk>()

  useEffect(() => { fetch(dataUrl('risk.json')).then((r) => r.json()).then(setDoc) }, [])
  useEffect(() => {
    if (data[level]) return
    const n = level.slice(3)
    Promise.all([`admin/adm${n}.geojson`, `admin/adm${n}.json`, `admin/risk_adm${n}.json`].map((f) => fetch(dataUrl(f)).then((r) => r.json())))
      .then(([fc, units, risk]) => setData((d) => ({ ...d, [level]: { fc, units, risk } })))
  }, [level, data])
  // fokontany loss curves are stored per region and fetched on selection
  useEffect(() => {
    if (level !== 'adm4' || !selected) return
    const reg = selected.slice(0, 4)
    if (chunk?.ids[0]?.startsWith(reg)) return
    fetch(dataUrl(`admin/risk_adm4_loss/${reg}.json`)).then((r) => r.json()).then(setChunk)
  }, [level, selected, chunk])

  const cur = data[level]
  const rates = doc?.agri_usd_per_ha
  const view = useMemo(() => {
    if (!cur || !rates) return null
    const { units, risk } = cur
    const uidx = Object.fromEntries(units.ids.map((id, i) => [id, i]))
    const m = risk.metrics[metric]
    const exposureOf = (i: number, s: Scenario) => {
      const u = uidx[risk.ids[i]]
      if (u == null) return NaN
      if (metric === 'econ') return units.usd[s][u]
      if (metric === 'agri') return 100 * (units.cropland_km2[u] * rates.cropland + units.grassland_km2[u] * rates.grassland)
      return units.pop[s][u]
    }
    const values = risk.ids.map((_, i) => {
      const v = m.aal[scenario][i]
      if (measure === 'relative') { const e = exposureOf(i, scenario); return e > 0 ? (100 * v) / e : NaN }
      if (measure === 'change') { const b = m.aal.hist_baseline[i]; return b > 0 ? v / b : NaN }
      return v
    })
    const name = (i: number) => {
      const u = uidx[risk.ids[i]]
      return u == null ? risk.ids[i] : `${units.names?.[u] ?? risk.ids[i]}${units.parents?.[u] ? ` (${units.parents[u]})` : ''}`
    }
    return { values, name, exposureOf, m, ridx: Object.fromEntries(risk.ids.map((id, i) => [id, i])) as Record<string, number> }
  }, [cur, metric, scenario, measure, rates])

  const label = measure === 'relative'
    ? `AAL as % of the exposed ${isUsd(metric) ? 'value' : 'population'}`
    : measure === 'change' ? `AAL, ${SCENARIO_LABEL[scenario]} / baseline` : `AAL, ${METRIC_LABEL[metric].toLowerCase()} (${isUsd(metric) ? 'USD' : 'people'} per year)`
  const fmtValue = (v: number) => (measure === 'relative' ? `${fmt(v, v < 0.1 ? 3 : 2)}%` : measure === 'change' ? `× ${fmt(v, 2)}` : show(metric, v))

  const br = useMemo(() => (measure === 'change' ? CHANGE_BREAKS : breaks(view?.values ?? [])), [view, measure])
  const colored = useMemo(() => {
    if (!cur || !view) return null
    return {
      ...cur.fc,
      features: cur.fc.features.map((f) => {
        const i = view.ridx[f.properties!.id]
        const v = i == null ? NaN : view.values[i]
        return { ...f, properties: { ...f.properties, i: i ?? -1, v: Number.isFinite(v) ? v : -1 } }
      }),
    }
  }, [cur, view])
  // ranked by AAL, except for the share of exposure; a ratio to a tiny baseline would lead the change view
  const ranked = useMemo(() => {
    if (!view) return []
    const key = measure === 'relative' ? view.values : view.m.aal[scenario]
    return key.map((_, i) => i).filter((i) => Number.isFinite(key[i]) && key[i] > 0).sort((a, b) => key[b] - key[a]).slice(0, 50)
  }, [view, measure, scenario])

  if (!doc) return <Card title="Flood risk"><p className="text-sm text-ink-3">Loading…</p></Card>
  const S = doc.scenarios
  const rps = doc.return_periods
  const nat = doc.national[metric]
  const diverging = measure === 'change'
  const fillOpacity = (diverging
    ? ['step', ['get', 'v'], 0, 0, CHANGE_CLASSES[0].opacity, ...br.flatMap((b, k) => [b, CHANGE_CLASSES[k + 1].opacity])]
    : ['step', ['get', 'v'], 0, 0, OPACITY[0], ...br.flatMap((b, k) => [b, OPACITY[k + 1]])]) as unknown as number
  const fillColor = (diverging
    ? ['step', ['get', 'v'], palette.neutral, 0, palette[CHANGE_CLASSES[0].role], ...br.flatMap((b, k) => [b, palette[CHANGE_CLASSES[k + 1].role]])]
    : palette.accent) as unknown as string
  const swatch = (k: number) => (diverging ? { background: palette[CHANGE_CLASSES[k].role], opacity: CHANGE_CLASSES[k].opacity } : { background: palette.accent, opacity: OPACITY[k] })
  const axis = {
    axisLabel: { color: palette['text-secondary'] }, axisLine: { lineStyle: { color: palette.axis } },
    axisTick: { show: false }, splitLine: { lineStyle: { color: palette.grid } }, nameTextStyle: { color: palette['text-secondary'] },
  }
  const unitWord = isUsd(metric) ? 'USD' : 'people'
  const onMove = (e: MapLayerMouseEvent) => {
    const p = e.features?.[0]?.properties
    setHover(p && p.i >= 0 ? { i: p.i, lng: e.lngLat.lng, lat: e.lngLat.lat } : null)
  }
  const onClick = (e: MapLayerMouseEvent) => {
    const p = e.features?.[0]?.properties
    if (p?.id) setSelected(p.id)
  }

  // the selected unit: loss per return period (one line per scenario) and its AAL split
  const si = selected && view ? view.ridx[selected] : undefined
  const unitLoss: ByScen<number[]> | undefined = si == null || !cur ? undefined
    : level !== 'adm4' ? Object.fromEntries(S.map((s) => [s, cur.risk.metrics[metric].loss![s][si]])) as ByScen<number[]>
      : chunk && chunk.ids.includes(selected!) ? Object.fromEntries(S.map((s) => [s, chunk.loss[metric][s][chunk.ids.indexOf(selected!)]])) as ByScen<number[]> : undefined
  const lossChart = (loss: ByScen<number[]>): EChartsOption => ({
    grid: { left: 64, right: 16, top: 16, bottom: 40 },
    tooltip: { trigger: 'axis', valueFormatter: (v) => show(metric, Number(v)) },
    xAxis: { type: 'category', data: rps.map(String), name: 'Return period (years)', nameLocation: 'middle', nameGap: 26, boundaryGap: false, ...axis },
    yAxis: { type: 'value', name: `Loss per event (${unitWord})`, axisLabel: { ...axis.axisLabel, formatter: (v: number) => money(v) }, ...{ axisLine: axis.axisLine, splitLine: axis.splitLine, nameTextStyle: axis.nameTextStyle } },
    series: S.map((s) => ({
      name: SCENARIO_LABEL[s], type: 'line' as const, data: loss[s], symbolSize: 8, lineStyle: { width: 2, color: palette[SCENARIO_SLOT[s]] },
      itemStyle: { color: palette[SCENARIO_SLOT[s]], borderColor: palette.surface, borderWidth: 2 },
    })),
  })
  const scenLegend = <Legend palette={palette} items={S.map((s) => ({ label: SCENARIO_LABEL[s], role: SCENARIO_SLOT[s], line: true }))} />

  // national AAL split into hazard and exposure change
  const split = [
    { key: 'aal_hazard' as const, label: 'Hazard change only', role: 'cat-3' as const },
    { key: 'aal_exposure' as const, label: 'Exposure change only', role: 'cat-2' as const },
    { key: 'aal' as const, label: 'Both (scenario)', role: 'cat-1' as const },
  ]
  const splitChart: EChartsOption = {
    grid: { left: 64, right: 16, top: 16, bottom: 44 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => show(metric, Number(v)) },
    xAxis: { type: 'category', data: S.map((s) => SCENARIO_LABEL[s].replace(' · ', '\n')), ...axis, axisLabel: { ...axis.axisLabel, interval: 0 } },
    yAxis: { type: 'value', name: `AAL (${unitWord} per year)`, ...axis, axisLabel: { ...axis.axisLabel, formatter: (v: number) => money(v) } },
    series: split.map((x) => ({
      name: x.label, type: 'bar' as const, barGap: '10%', barCategoryGap: '30%', data: S.map((s) => nat[x.key][s]),
      itemStyle: { color: palette[x.role], borderRadius: [4, 4, 0, 0] },
    })),
  }
  const bandLabels = [...rps.slice(0, -1).map((t, k) => `${t}–${rps[k + 1]}`), `> ${rps[rps.length - 1]}`]
  const bandChart: EChartsOption = {
    grid: { left: 56, right: 16, top: 16, bottom: 40 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => `${fmt(Number(v), 1)}% of the AAL` },
    xAxis: { type: 'category', data: bandLabels, name: 'Return-period band (years)', nameLocation: 'middle', nameGap: 26, ...axis, axisLabel: { ...axis.axisLabel, interval: 0, fontSize: 10 } },
    yAxis: { type: 'value', name: '% of the AAL', ...axis },
    series: [{
      type: 'bar', barCategoryGap: '35%', itemStyle: { color: palette[SCENARIO_SLOT[scenario]], borderRadius: [4, 4, 0, 0] },
      data: (() => { const b = bands(nat.loss[scenario], rps); const t = b.reduce((a, x) => a + x, 0); return b.map((x) => (t > 0 ? (100 * x) / t : 0)) })(),
    }],
  }

  const qc = doc.qc
  const wetChart: EChartsOption = {
    grid: { left: 64, right: 16, top: 16, bottom: 40 },
    tooltip: { trigger: 'axis', valueFormatter: (v) => `${fmt(Number(v))} km²` },
    xAxis: { type: 'category', data: rps.map(String), name: 'Return period (years)', nameLocation: 'middle', nameGap: 26, boundaryGap: false, ...axis },
    yAxis: { type: 'value', name: 'Flooded area (km²)', ...axis },
    series: S.map((s) => ({
      name: SCENARIO_LABEL[s], type: 'line' as const, data: qc.wet_km2[s], symbolSize: 8, lineStyle: { width: 2, color: palette[SCENARIO_SLOT[s]] },
      itemStyle: { color: palette[SCENARIO_SLOT[s]], borderColor: palette.surface, borderWidth: 2 },
    })),
  }
  const k100 = rps.indexOf(100)
  const classLabels = qc.depth_classes_m.map((d, k) => (k === qc.depth_classes_m.length - 1 ? `≥ ${d} m` : `${d}–${qc.depth_classes_m[k + 1]} m`))
  const classChart: EChartsOption = {
    grid: { left: 64, right: 16, top: 16, bottom: 40 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => `${fmt(Number(v))} km²` },
    xAxis: { type: 'category', data: classLabels, name: 'Flood depth', nameLocation: 'middle', nameGap: 26, ...axis, axisLabel: { ...axis.axisLabel, interval: 0, fontSize: 10 } },
    yAxis: { type: 'value', name: 'Flooded area at 100 years (km²)', ...axis },
    series: [{ type: 'bar', barCategoryGap: '30%', data: qc.wet_km2_by_class.hist_baseline[k100], itemStyle: { color: palette.neutral, borderRadius: [4, 4, 0, 0] } }],
  }
  const ref = doc.reference?.[metric === 'pop_exposed' || metric === 'agri' ? 'econ' : metric]?.[scenario]
  const refMetric: Metric = metric === 'pop_affected' ? 'pop_affected' : 'econ'
  const refPts = ref ? ref.ids.map((id, k) => [ref.previous[k], ref.this_run[k], data.adm1?.units.names?.[data.adm1.units.ids.indexOf(id)] ?? id] as [number, number, string])
    .filter(([a, b]) => a > 0 && b > 0) : []
  const refMin = refPts.length ? 10 ** Math.floor(Math.log10(Math.min(...refPts.flatMap(([a, b]) => [a, b])))) : 1
  const refMax = refPts.length ? 10 ** Math.ceil(Math.log10(Math.max(...refPts.flatMap(([a, b]) => [a, b])))) : 10
  const refChart: EChartsOption | null = ref ? {
    grid: { left: 72, right: 24, top: 16, bottom: 48 },
    tooltip: { trigger: 'item', formatter: (p: unknown) => { const d = (p as { data: [number, number, string] }).data; return `${d[2]}<br/>Earlier: ${show(refMetric, d[0])}<br/>This run: ${show(refMetric, d[1])}` } },
    xAxis: { type: 'log', name: 'Earlier PostGIS workflow (log scale)', nameLocation: 'middle', nameGap: 30, min: refMin, max: refMax, ...axis, axisLabel: { ...axis.axisLabel, formatter: (v: number) => money(v) } },
    yAxis: { type: 'log', name: 'This run', min: refMin, max: refMax, ...axis, axisLabel: { ...axis.axisLabel, formatter: (v: number) => money(v) } },
    series: [
      { type: 'line', data: [[refMin, refMin], [refMax, refMax]], showSymbol: false, silent: true, lineStyle: { color: palette.axis, type: 'dashed', width: 1 } },
      { type: 'scatter', symbolSize: 10, data: refPts,
        itemStyle: { color: palette[SCENARIO_SLOT[scenario]], borderColor: palette.surface, borderWidth: 2 } },
    ],
  } : null

  const h = hover?.i ?? null
  const relTile = (m: Metric) => {
    const e = doc.national[m].exposure?.[scenario]
    if (m === 'agri') return 'per year, one year of production at risk'
    return e ? `${fmt((100 * doc.national[m].aal[scenario]) / e, 2)}% of the ${isUsd(m) ? 'building value' : 'population'} per year` : ''
  }

  return (
    <div className="space-y-4">
      {doc.hazard.placeholder && (
        <div role="note" className="rounded-lg border border-line bg-banner px-4 py-3 text-sm text-ink">
          <strong>Placeholder results, for demonstration only.</strong> The pluvial design runs are not finished, so the
          risk chain below runs on riverine (fluvial) flood depth maps instead. They have the same scenarios and return
          periods as the pluvial maps will have. The numbers show how the method and the website work; they are not
          pluvial flood risk and should not be quoted. They will be replaced once the national pluvial depth maps are merged.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
          <Stat key={m} label={`${METRIC_LABEL[m]}, AAL · ${SCENARIO_LABEL[scenario]}`} value={show(m, doc.national[m].aal[scenario])} sub={relTile(m)} />
        ))}
      </div>

      <Card
        title="Average annual loss by administrative unit"
        subtitle={measure === 'change' ? 'Click a unit to see its loss for each return period. Classes are fixed ratios to the baseline AAL.' : 'Click a unit to see its loss for each return period. Classes hold about equal numbers of units.'}
        actions={<Segmented label="Metric" value={metric} onChange={setMetric}
          options={(Object.keys(METRIC_LABEL) as Metric[]).map((m) => ({ value: m, label: METRIC_LABEL[m] }))} />}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Segmented label="Administrative level" value={level} onChange={(v) => { setLevel(v); setHover(null); setSelected(undefined) }}
            options={(Object.keys(LEVEL_LABEL) as Level[]).map((k) => ({ value: k, label: LEVEL_LABEL[k][0] }))} />
          <Segmented label="Scenario" value={scenario} onChange={(v) => { setScenario(v); if (v === 'hist_baseline' && measure === 'change') setMeasure('aal') }}
            options={S.map((s) => ({ value: s, label: SCENARIO_LABEL[s] }))} />
          <Segmented label="Measure" value={measure} onChange={setMeasure}
            options={[{ value: 'aal', label: 'AAL' }, { value: 'relative', label: '% of exposure' },
              ...(scenario !== 'hist_baseline' ? [{ value: 'change' as const, label: 'Change vs baseline' }] : [])]} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="relative h-[600px] overflow-hidden rounded-lg border border-line">
            <Map
              initialViewState={{ bounds: MDG, fitBoundsOptions: { padding: 16 } }}
              mapStyle={dark ? BASEMAP.dark : BASEMAP.light}
              interactiveLayerIds={['risk-fill']}
              cursor={hover ? 'pointer' : 'grab'}
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
              onClick={onClick}
              onLoad={(e) => e.target.resize()}
              attributionControl={{ compact: true, customAttribution: 'Placeholder hazard · WorldPop · LitPop · Google Open Buildings · ESA WorldCover · OCHA' }}
            >
              {colored && (
                <Source id="risk" type="geojson" data={colored}>
                  <Layer id="risk-fill" type="fill" paint={{ 'fill-color': fillColor, 'fill-opacity': fillOpacity }} />
                  <Layer id="risk-line" type="line" paint={{ 'line-color': palette.surface, 'line-width': 0.4 }} />
                  <Layer id="risk-hover" type="line" filter={['==', ['get', 'i'], h ?? -2]} paint={{ 'line-color': palette['text-primary'], 'line-width': 2 }} />
                  <Layer id="risk-sel" type="line" filter={['==', ['get', 'id'], selected ?? '']} paint={{ 'line-color': palette['text-primary'], 'line-width': 3 }} />
                </Source>
              )}
              {hover && h != null && view && (
                <Popup longitude={hover.lng} latitude={hover.lat} closeButton={false} offset={12}>
                  <div className="font-medium">{view.name(h)}</div>
                  <div className="tabular text-ink-2">AAL {show(metric, view.m.aal[scenario][h])} per year</div>
                  {Number.isFinite(view.values[h]) && measure !== 'aal' && <div className="tabular text-ink">{fmtValue(view.values[h])}</div>}
                </Popup>
              )}
            </Map>
            <div className="absolute left-2 top-2 max-w-[240px] rounded-md bg-surface/90 px-2.5 py-2 text-xs text-ink-2 shadow-sm">
              <div className="mb-1 font-medium text-ink">{label}</div>
              {[...br, Infinity].map((b, k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm" style={swatch(k)} />
                  {k === 0 ? `< ${fmtValue(b)}` : k === br.length ? `≥ ${fmtValue(br[k - 1])}` : `${fmtValue(br[k - 1])} – ${fmtValue(b)}`}
                </div>
              ))}
              <div className="mt-1 text-ink-3">{diverging ? 'Blue: lower than the baseline; orange: higher. Unshaded: no baseline loss.' : 'Unshaded: no loss.'}</div>
              {!cur && <div className="mt-1 text-ink">Loading {LEVEL_LABEL[level][1]}…</div>}
            </div>
          </div>
          <div>
            {si == null || !view ? (
              <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed border-line p-6 text-sm text-ink-3">
                Click a {LEVEL_LABEL[level][0].toLowerCase()} on the map, or in the table below, to see its loss per event and how its AAL changes.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{view.name(si)}</h3>
                  <p className="text-sm text-ink-2">{METRIC_LABEL[metric]}: loss for each return period (one map per event) and per scenario.</p>
                </div>
                {scenLegend}
                {unitLoss ? <Chart option={lossChart(unitLoss)} height={260} label={`Loss per return period in ${view.name(si)}`} /> : <p className="text-sm text-ink-3">Loading…</p>}
                <DataTable name="AAL table" caption="AAL of the selected unit" head={['Scenario', `AAL (${unitWord}/yr)`, '% of exposure', 'Hazard change only', 'Exposure change only']}
                  rows={S.map((s) => {
                    const a = view.m.aal[s][si], e = view.exposureOf(si, s)
                    return [SCENARIO_LABEL[s], show(metric, a), e > 0 ? `${fmt((100 * a) / e, 3)}%` : '–',
                      view.m.aal_hazard ? show(metric, view.m.aal_hazard[s][si]) : '–', view.m.aal_exposure ? show(metric, view.m.aal_exposure[s][si]) : '–']
                  })} />
                {unitLoss && <DataTable name="loss per event table" caption="Loss per event of the selected unit" head={['Return period', ...S.map((s) => SCENARIO_LABEL[s])]}
                  rows={rps.map((t, j) => [`${t} years`, ...S.map((s) => show(metric, unitLoss[s][j]))])} />}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink">
            The {Math.min(50, ranked.length)} {LEVEL_LABEL[level][1]} with the highest {measure === 'relative' ? 'AAL as a share of their exposure' : `AAL, ${SCENARIO_LABEL[scenario]}`}
          </h3>
          <p className="mt-1 text-sm text-ink-2">
            Every {LEVEL_LABEL[level][0].toLowerCase()} with all metrics and scenarios{level !== 'adm4' ? ', including the loss per return period' : ''}:{' '}
            <a className="text-accent underline underline-offset-2" href={dataUrl(`admin/risk_${LEVEL_LABEL[level][2]}.csv`)} download>risk_{LEVEL_LABEL[level][2]}.csv</a>
          </p>
          {view && (
            <div className="mt-2 max-h-[320px] overflow-y-auto">
              <table className="w-full text-sm tabular">
                <thead>
                  <tr className="border-b border-line text-left text-ink-3">
                    {[LEVEL_LABEL[level][0], `AAL (${unitWord}/yr)`, measure === 'change' ? 'Change vs baseline' : '% of exposure'].map((x, k) => (
                      <th key={x} className={`py-1.5 pr-4 font-medium ${k ? 'text-right' : ''}`}>{x}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((i) => {
                    const id = cur!.risk.ids[i], a = view.m.aal[scenario][i], e = view.exposureOf(i, scenario)
                    return (
                      <tr key={id} onClick={() => setSelected(id)} aria-selected={id === selected}
                        className={`cursor-pointer border-b border-line last:border-0 hover:bg-banner ${id === selected ? 'bg-banner' : ''}`}>
                        <td className="py-1.5 pr-4 text-ink-2">{view.name(i)}</td>
                        <td className="py-1.5 pr-4 text-right text-ink">{show(metric, a)}</td>
                        <td className="py-1.5 pr-4 text-right text-ink">{measure === 'aal' ? (e > 0 ? `${fmt((100 * a) / e, 3)}%` : '–') : fmtValue(view.values[i])}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="National AAL: what drives the change" subtitle={`${METRIC_LABEL[metric]}. Each future scenario is also run with only its hazard maps changed (baseline exposure), and with only its exposure changed (baseline hazard).`}>
          <Legend palette={palette} items={split.map((x) => ({ label: x.label, role: x.role }))} />
          <Chart option={splitChart} height={300} label="National AAL per scenario, split into hazard and exposure change" />
          <Info>
            Against the baseline AAL of {show(metric, nat.aal.hist_baseline)}, the hazard change alone gives{' '}
            {S.slice(1).map((s) => `${pct(nat.aal_hazard[s] / nat.aal.hist_baseline)} (${SCENARIO_LABEL[s]})`).join(', ')}
            {metric !== 'agri' && <>; the exposure change alone gives {S.slice(1).map((s) => `× ${fmt(nat.aal_exposure[s] / nat.aal.hist_baseline, 1)}`).join(', ')}</>}.
          </Info>
          <DataTable caption="National AAL per scenario" head={['Scenario', 'AAL', 'Hazard change only', 'vs baseline', 'Exposure change only', 'vs baseline', 'Outside every fokontany']}
            rows={S.map((s) => [SCENARIO_LABEL[s], show(metric, nat.aal[s]), show(metric, nat.aal_hazard[s]), pct(nat.aal_hazard[s] / nat.aal.hist_baseline),
              show(metric, nat.aal_exposure[s]), `× ${fmt(nat.aal_exposure[s] / nat.aal.hist_baseline, 2)}`, show(metric, nat.aal_outside[s])])} />
          {metric === 'agri' && <Info>Agricultural value is the same in every scenario (no projection of land use or prices), so only the hazard changes it.</Info>}
        </Card>
        <Card title="National loss per event" subtitle={`${METRIC_LABEL[metric]} for each return-period map: the points the AAL integrates.`}>
          {scenLegend}
          <Chart option={lossChart(nat.loss)} height={300} label="National loss per return period and scenario" />
          <DataTable caption="National loss per event" head={['Return period', ...S.map((s) => SCENARIO_LABEL[s])]}
            rows={rps.map((t, j) => [`${t} years`, ...S.map((s) => show(metric, nat.loss[s][j]))])} />
        </Card>
      </div>

      <Card title="Quality control" subtitle="Checks on the hazard maps, the overlay and the integration, recomputed with every run.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">Flooded area per return period</h3>
            <p className="text-sm text-ink-2">Should grow with the return period in every scenario.</p>
            {scenLegend}
            <Chart option={wetChart} height={260} label="Flooded area per return period and scenario" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Depth of the flooded area, baseline 100-year map</h3>
            <p className="text-sm text-ink-2">Depths of several metres are river channels and reservoirs in these riverine maps.</p>
            <Chart option={classChart} height={280} label="Flooded area by depth class" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Where the AAL comes from, {SCENARIO_LABEL[scenario]}</h3>
            <p className="text-sm text-ink-2">Share of the national AAL from each band between two return periods; the last bar holds the rarest map down to probability zero.</p>
            <Chart option={bandChart} height={260} label="Share of the AAL by return-period band" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Reproduction of the earlier PostGIS workflow, by region</h3>
            <p className="text-sm text-ink-2">
              {refMetric === 'econ' ? 'Building loss' : 'People affected'}, {SCENARIO_LABEL[scenario]}, computed here with the earlier
              integration convention (only the flooded return periods). Points on the dashed line agree.
            </p>
            {refChart ? <Chart option={refChart} height={260} label="AAL per region, this run against the earlier workflow" /> : <p className="text-sm text-ink-3">No reference.</p>}
          </div>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>{fmt(qc.n_assets.buildings)} buildings, {fmt(qc.n_assets.population)} population cells and {fmt(qc.n_assets.agriculture)} cropland or grassland pixels that can flood were overlaid with {S.length * rps.length} depth maps.</li>
          <li>{fmt(qc.buildings_wet_rp100.hist_baseline)} buildings are wet on the baseline 100-year map; {fmt(qc.buildings_deeper_than_10m_rp100.hist_baseline)} of them under more than 10 m of water, in river channels or reservoirs (they count as fully damaged).</li>
          <li>Depth falls by more than 5 cm from one return period to the next at {fmt(100 * qc.buildings_depth_drops_with_rp.hist_baseline, 2)}% of the wet buildings (baseline): the maps of successive return periods come from separate runs.</li>
          <li>AAL outside every fokontany (coast and islets), not counted in any unit: {show(metric, nat.aal_outside[scenario])}.</li>
          <li>Integrating only the flooded return periods, as the earlier workflow did, gives a national AAL of {show(metric, nat.aal_flooded_only[scenario])} instead of {show(metric, nat.aal[scenario])}.</li>
        </ul>
      </Card>

      <Card title="Method" subtitle="Hazard × exposure × vulnerability, for every scenario and return period.">
        <Steps items={[
          { title: 'Hazard', body: <>{S.length} scenarios × {rps.length} return periods ({rps.join(', ')} years) = {S.length * rps.length} national maps of maximum flood depth on one ~30 m grid. Currently: {doc.hazard.label.toLowerCase()}.</> },
          { title: 'Overlay', body: <>Each building footprint and each 100 m population cell takes the maximum depth over the hazard pixels its bounding box touches. Every map is read once, in strips, and the depths are picked by array indexing. This replaces the polygon overlays of the earlier PostGIS workflow and gives the same depths: 746,341 of 746,341 buildings agree on the baseline 100-year map. For cropland and grassland, each hazard pixel that is wet in any scenario takes the ESA WorldCover class at its centre (read at 20 m).</> },
          { title: 'Vulnerability', body: <>Buildings: Englhardt et al. (2019) Class I (rural) or Class IIIa (urban) curve, by settlement type. People affected: the rural curve read as the share of residents affected, as in the earlier riverine assessment. People in flooded area: residents × the share of their 100 m cell at least {doc.hmin_exposed} m deep. Agriculture: JRC curve for Africa on one year of production (USD {doc.agri_usd_per_ha.cropland}/ha cropland, {doc.agri_usd_per_ha.grassland}/ha grassland).</> },
          { title: 'Loss per event', body: <>Exposed value × damage ratio, for every asset and map, summed per fokontany (by asset centre) and then per commune, district and region (pcodes), so every level adds up to the same national total.</> },
          { title: 'Average annual loss', body: <>Trapezoids of loss against annual exceedance probability 1/T, from 1/{rps[0]} to 1/{rps[rps.length - 1]}, with the {rps[rps.length - 1]}-year loss held down to probability zero; nothing is counted for events more frequent than {rps[0]} years. An asset not flooded at a return period has zero loss there.</> },
          { title: 'Drivers of change', body: <>Losses are linear in the exposed value, so each scenario is also computed with baseline exposure (hazard change only) and with baseline hazard (exposure change only).</> },
        ]} />
        <Info>
          <b className="text-ink">Run time.</b> Exporting the assets from the database, about 30 s, once. Overlaying the 40 maps
          with 10 million buildings, 2 million population cells and the agricultural pixels takes a few minutes on a laptop
          (4 processes); losses, AALs and the aggregation to the four administrative levels take seconds.
        </Info>
      </Card>
    </div>
  )
}
