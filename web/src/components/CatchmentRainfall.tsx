import { useEffect, useMemo, useState } from 'react'
import Map, { Layer, Source, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { EChartsOption } from 'echarts'
import { dataUrl } from '../data'
import { fmt } from '../format'
import { POP_LABEL, POP_SLOT, type Palette } from '../theme'
import type { FeatureCollection, PopKey } from '../types'
import { Card, Chart, Info, Segmented, Stat } from './ui'

const BASEMAP = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
const POPS: PopKey[] = ['total', 'tc', 'nontc']
const EULER = 0.5772

interface Fit { p0: number | null; mu: number | null; beta: number | null; ppcc: number | null; ks: number | null
  maxima: (number | null)[]; depth: (number | null)[]; ci90: (number | null)[] }
interface CatchmentDoc {
  basin_id: string; area_km2: number; level: number; gpm_cells: number
  populations: Record<PopKey, { fits: Record<'24' | '48', Fit>; ddf: (number | null)[][] }>
  total_direct: Record<'24' | '48', (number | null)[]>
  cell_median_total_24h: Record<string, number | null>
}
interface Summary {
  seasons: string[]; return_periods: number[]; durations: number[]; fit_durations: number[]
  dd_exponent: number; n_seasons: number; tc_majority: number
  catchments: { id: string; area: number; ppcc: Record<PopKey, number | null>; ppcc_min: number; d100: number; tc_share100: number; arf100: number | null }[]
}
type Metric = 'd100' | 'ppcc_min' | 'arf100'

// ---------------------------------------------------------------- statistics
const reduced = (F: number) => -Math.log(-Math.log(F))              // Gumbel reduced variate
const rpOf = (y: number) => 1 / (1 - Math.exp(-Math.exp(-y)))

function mixedQuantile(F: number, f: Fit): number | null {
  if (f.mu == null || f.beta == null || f.p0 == null) return null
  if (F <= f.p0) return 0
  const g = Math.min(Math.max((F - f.p0) / (1 - f.p0), 1e-12), 1 - 1e-12)
  return f.mu - f.beta * Math.log(-Math.log(g))
}
function ciHalf(F: number, f: Fit): number | null {
  if (f.mu == null || f.beta == null || f.p0 == null || F <= f.p0) return null
  const g = (F - f.p0) / (1 - f.p0)
  const K = (-Math.sqrt(6) / Math.PI) * (EULER + Math.log(-Math.log(g)))
  const sd = (f.beta * Math.PI) / Math.sqrt(6)
  const n = f.maxima.filter((v) => v != null && v > 0).length
  return (1.645 * Math.sqrt(1 + 1.1396 * K + 1.1 * K * K) * sd) / Math.sqrt(Math.max(n, 1))
}
/** Depth at duration t (h) by log-log interpolation of the DDF points. */
function ddfAt(t: number, durations: number[], depths: number[], exponent: number): number {
  if (t <= durations[0]) return depths[durations.indexOf(24)] * (t / 24) ** exponent
  for (let i = 0; i < durations.length - 1; i++) {
    const [a, b] = [durations[i], durations[i + 1]]
    if (t <= b) {
      const w = Math.log(t / a) / Math.log(b / a)
      return Math.exp(Math.log(Math.max(depths[i], 1e-6)) * (1 - w) + Math.log(Math.max(depths[i + 1], 1e-6)) * w)
    }
  }
  return depths[depths.length - 1]
}
/** Alternating-block hyetograph: intensities (mm/h) of blocks of dt hours over D hours. */
function hyetograph(D: number, dt: number, depthAt: (t: number) => number): number[] {
  const n = Math.round(D / dt)
  const cum = Array.from({ length: n }, (_, i) => depthAt((i + 1) * dt))
  const inc = cum.map((c, i) => c - (i ? cum[i - 1] : 0)).sort((a, b) => b - a)
  const out = new Array(n).fill(0)
  let right = Math.floor(n / 2), left = right - 1
  inc.forEach((v, i) => { if (i % 2 === 0) out[right++] = v; else out[left--] = v })
  return out.map((v) => v / dt)
}

// ---------------------------------------------------------------- component
export function CatchmentRainfall({ catchments, palette, dark, initial }: {
  catchments: FeatureCollection; palette: Palette; dark: boolean; initial: string
}) {
  const [summary, setSummary] = useState<Summary>()
  const [id, setId] = useState(initial)
  const [doc, setDoc] = useState<CatchmentDoc>()
  const [metric, setMetric] = useState<Metric>('ppcc_min')
  const [ddfPop, setDdfPop] = useState<PopKey>('total')
  const [ddfMode, setDdfMode] = useState<'rp' | 'pop'>('rp')
  const [rp, setRp] = useState(100)
  const [stormH, setStormH] = useState(24)
  const [fitDur, setFitDur] = useState<'24' | '48'>('24')
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetch(dataUrl('catchment_rainfall_summary.json')).then((r) => r.json()).then(setSummary)
  }, [])
  useEffect(() => {
    setDoc(undefined)
    fetch(dataUrl(`catchment_rainfall/${id}.json`)).then((r) => r.json()).then(setDoc)
  }, [id])

  const byId = useMemo(() => Object.fromEntries((summary?.catchments ?? []).map((c) => [c.id, c])), [summary])
  const worst = useMemo(() => [...(summary?.catchments ?? [])].sort((a, b) => a.ppcc_min - b.ppcc_min).slice(0, 12), [summary])
  const colored = useMemo(() => ({
    ...catchments,
    features: catchments.features.map((f) => ({ ...f, properties: { ...f.properties, ...(byId[f.properties!.basin_id] ?? {}) } })),
  }), [catchments, byId])

  if (!summary) return <Card title="Catchment rainfall explorer"><p className="text-sm text-ink-3">Loading…</p></Card>
  const rps = summary.return_periods
  const durs = summary.durations

  // map colouring: one hue, light to dark, by the chosen metric
  const ramp: Record<Metric, { stops: number[]; label: string; reverse?: boolean }> = {
    d100: { stops: [120, 160, 200, 240, 280, 320], label: '100-yr 24 h depth (mm)' },
    ppcc_min: { stops: [0.85, 0.916, 0.947, 0.97, 0.98, 0.99], label: 'Fit quality, lowest PPCC of the 3 populations (< 0.916 fails the 1% test, < 0.947 the 5% test)', reverse: true },
    arf100: { stops: [0.85, 0.9, 0.93, 0.96, 0.98, 1.0], label: 'Areal / single-cell 100-yr depth', reverse: true },
  }
  const r = ramp[metric]
  const opac = r.stops.map((_, i) => (r.reverse ? 0.9 - i * 0.14 : 0.15 + i * 0.14))
  const fillOpacity = ['step', ['get', metric], opac[0], ...r.stops.slice(1).flatMap((s, i) => [s, opac[i + 1]])] as unknown as number

  const onClick = (e: MapLayerMouseEvent) => { const f = e.features?.[0]; if (f) setId(f.properties.basin_id) }
  const axis = {
    axisLabel: { color: palette['text-secondary'] }, axisLine: { lineStyle: { color: palette.axis } },
    axisTick: { show: false }, splitLine: { lineStyle: { color: palette.grid } }, nameTextStyle: { color: palette['text-secondary'] },
  }
  const legend = { top: 0, type: 'scroll' as const, textStyle: { color: palette['text-secondary'] }, itemWidth: 14, itemHeight: 10 }
  const rpShades = rps.map((_, i) => 0.25 + (0.75 * i) / (rps.length - 1))

  let ddfChart: EChartsOption = {}, hyetoChart: EChartsOption = {}, fitChart: EChartsOption = {}
  if (doc) {
    const pts = (pop: PopKey, rIdx: number) => durs.map((d, j) => [d, doc.populations[pop].ddf[rIdx][j]])
    ddfChart = {
      legend, grid: { left: 56, right: 24, top: 40, bottom: 44 },
      tooltip: { trigger: 'axis', valueFormatter: (v) => `${fmt(Number(v))} mm` },
      xAxis: { type: 'log', logBase: 2, min: 1, max: 48, name: 'Duration (h, log scale)', nameLocation: 'middle', nameGap: 28, ...axis,
        axisLabel: { color: palette['text-secondary'], formatter: (v: number) => `${v}` } },
      yAxis: { type: 'value', name: 'Depth (mm)', ...axis },
      series: ([
        ...(ddfMode === 'rp'
          ? rps.map((T, i) => ({ name: `${T} yr`, type: 'line' as const, data: pts(ddfPop, i), symbolSize: 6,
              lineStyle: { width: T === rp ? 3 : 1.5 },
              itemStyle: { color: palette[POP_SLOT[ddfPop]], opacity: rpShades[i] } }))
          : POPS.map((p) => ({ name: POP_LABEL[p], type: 'line' as const, data: pts(p, rps.indexOf(rp)), symbolSize: 6,
              lineStyle: { width: 2 }, itemStyle: { color: palette[POP_SLOT[p]] } }))),
      ] as object[]).map((ser, i) => (i === 0 ? { ...ser, markLine: { symbol: 'none', silent: true,
        lineStyle: { color: palette['text-muted'], type: 'solid', width: 1 },
        label: { color: palette['text-muted'], position: 'insideEndTop', formatter: '← 1–12 h derived from 24 h' },
        data: [{ xAxis: 12 }] } } : ser)),
    } as EChartsOption
    const dt = stormH <= 3 ? 1 / 6 : 0.5
    hyetoChart = {
      legend, grid: { left: 56, right: 24, top: 40, bottom: 44 },
      tooltip: { trigger: 'axis', valueFormatter: (v) => `${fmt(Number(v), 1)} mm/h` },
      xAxis: { type: 'value', min: 0, max: stormH, name: 'Time (h)', nameLocation: 'middle', nameGap: 28, ...axis },
      yAxis: { type: 'value', name: 'Intensity (mm/h)', ...axis },
      series: POPS.map((p) => {
        const depths = doc.populations[p].ddf[rps.indexOf(rp)].map((v) => v ?? 0)
        const h = hyetograph(stormH, dt, (t) => ddfAt(t, durs, depths, summary.dd_exponent))
        const data = h.flatMap((v, i) => [[i * dt, v], [(i + 1) * dt, v]])
        return { name: `${POP_LABEL[p]} (${fmt(depths[durs.indexOf(stormH)] ?? 0)} mm)`, type: 'line' as const, data, symbol: 'none',
          lineStyle: { width: 2 }, itemStyle: { color: palette[POP_SLOT[p]] }, areaStyle: { opacity: 0.08 } }
      }),
    }
    const Fs = Array.from({ length: 80 }, (_, i) => 0.02 + (0.998 - 0.02) * (i / 79))
    const n = summary.n_seasons
    fitChart = {
      legend, grid: { left: 56, right: 24, top: 40, bottom: 52 },
      tooltip: { trigger: 'item', formatter: (p) => {
        const q = p as unknown as { seriesName: string; value: [number, number] }
        return `${q.seriesName}<br/>${fmt(q.value[1])} mm · return period ${fmt(rpOf(q.value[0]), 1)} yr` } },
      xAxis: { type: 'value', min: reduced(0.02), max: reduced(0.998), name: 'Return period (years, Gumbel scale)',
        nameLocation: 'middle', nameGap: 32, ...axis, axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { type: 'value', min: 0, name: `${fitDur} h seasonal maximum (mm)`, ...axis, axisLine: { onZero: false, lineStyle: { color: palette.axis } } },
      series: POPS.flatMap((p) => {
        const f = doc.populations[p].fits[fitDur]
        const xs = f.maxima.filter((v): v is number => v != null).sort((a, b) => a - b)
        const obs = xs.map((v, i) => [reduced((i + 1 - 0.44) / (n + 0.12)), v]).filter((d) => (d[1] as number) > 0)
        // below p0 (seasons without rain of the population) the fitted depth is 0: not drawn
        const above = (F: number) => f.p0 != null && F > f.p0 + 0.005
        const curve = Fs.map((F) => [reduced(F), above(F) ? mixedQuantile(F, f) : null])
        const lo = Fs.map((F) => {
          const q = mixedQuantile(F, f), c = ciHalf(F, f)
          return [reduced(F), above(F) && q != null && c != null ? Math.max(q - c, 0) : null]
        })
        const band = Fs.map((F, i) => {
          const q = mixedQuantile(F, f), c = ciHalf(F, f), l = lo[i][1]
          return [reduced(F), above(F) && q != null && c != null && l != null ? q + c - l : null]
        })
        const color = palette[POP_SLOT[p]]
        const name = POP_LABEL[p]
        return [
          { name, type: 'line' as const, data: lo, stack: `ci-${p}`, symbol: 'none', itemStyle: { color }, lineStyle: { opacity: 0 }, silent: true, tooltip: { show: false } },
          { name, type: 'line' as const, data: band, stack: `ci-${p}`, symbol: 'none', itemStyle: { color }, lineStyle: { opacity: 0 }, areaStyle: { color, opacity: 0.12 }, silent: true, tooltip: { show: false } },
          { name, type: 'line' as const, data: curve, symbol: 'none', itemStyle: { color }, lineStyle: { color, width: 2 }, tooltip: { show: false } },
          { name, type: 'scatter' as const, data: obs, symbolSize: 8, itemStyle: { color, borderColor: palette.surface, borderWidth: 1.5 } },
        ]
      }),
    }
    ;(fitChart.series as object[]).push({
      type: 'line', data: [], silent: true,
      markLine: { symbol: 'none', silent: true, lineStyle: { color: palette.grid, type: 'solid' },
        label: { color: palette['text-muted'], formatter: (p: { name: string }) => p.name, position: 'start' },
        data: [2, 5, 10, 25, 50, 100, 200, 500].map((T) => ({ name: String(T), xAxis: reduced(1 - 1 / T) })) },
    })
  }

  const s = byId[id]
  return (
    <Card
      title="Catchment rainfall explorer"
      subtitle={`Extreme value analysis of each catchment's own rainfall (area-weighted mean of the GPM cells it overlaps), per population. Pick a catchment on the map, by id, or from the worst fits.`}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented label="Colour the map by" value={metric} onChange={setMetric}
              options={[{ value: 'ppcc_min', label: 'Fit quality' }, { value: 'd100', label: '100-yr depth' }, { value: 'arf100', label: 'Areal reduction' }]} />
          </div>
          <div className="relative h-[460px] overflow-hidden rounded-lg border border-line">
            <Map initialViewState={{ bounds: [[43.1, -25.7], [50.6, -11.9]], fitBoundsOptions: { padding: 12 } }}
              mapStyle={dark ? BASEMAP.dark : BASEMAP.light} interactiveLayerIds={['c-fill']} cursor="pointer"
              onClick={onClick} onLoad={(e) => e.target.resize()}
              attributionControl={{ compact: true, customAttribution: 'Catchments: HydroBASINS · Rainfall: GPM IMERG' }}>
              <Source id="c" type="geojson" data={colored}>
                <Layer id="c-fill" type="fill" paint={{ 'fill-color': palette.accent, 'fill-opacity': fillOpacity }} />
                <Layer id="c-line" type="line" paint={{ 'line-color': palette.surface, 'line-width': 0.3 }} />
                <Layer id="c-sel" type="line" filter={['==', ['get', 'basin_id'], id]} paint={{ 'line-color': palette['cat-2'], 'line-width': 3 }} />
              </Source>
            </Map>
            <div className="absolute left-2 top-2 rounded-md bg-surface/90 px-2.5 py-2 text-xs text-ink-2 shadow-sm">
              <div className="mb-1 max-w-[180px] font-medium text-ink">{r.label}</div>
              {r.stops.map((st, i) => (
                <div key={st} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm" style={{ background: palette.accent, opacity: opac[i] }} />
                  {i === 0 ? `< ${r.stops[1]}` : i === r.stops.length - 1 ? `≥ ${st}` : `${st} – ${r.stops[i + 1]}`}
                </div>
              ))}
            </div>
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (byId[query.trim()]) setId(query.trim()) }}>
            <input list="catchment-ids" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Catchment id (hybas_id)"
              className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink" />
            <datalist id="catchment-ids">{summary.catchments.map((c) => <option key={c.id} value={c.id} />)}</datalist>
            <button className="rounded-md border border-line px-3 py-1 text-sm text-ink hover:border-ink-3">Go</button>
          </form>
          <div>
            <h3 className="text-sm font-semibold text-ink">Worst fits (lowest PPCC, 24 h)</h3>
            <table className="mt-1 w-full text-sm tabular">
              <thead><tr className="border-b border-line text-left text-ink-3">
                <th className="py-1 font-medium">Catchment</th><th className="py-1 text-right font-medium">km²</th>
                {POPS.map((p) => <th key={p} className="py-1 text-right font-medium">{POP_LABEL[p]}</th>)}</tr></thead>
              <tbody>
                {worst.map((c) => (
                  <tr key={c.id} onClick={() => setId(c.id)}
                    className={`cursor-pointer border-b border-line last:border-0 hover:bg-banner ${c.id === id ? 'bg-banner' : ''}`}>
                    <td className="py-1 text-ink">{c.id}</td><td className="py-1 text-right text-ink-2">{fmt(c.area)}</td>
                    {POPS.map((p) => <td key={p} className={`py-1 text-right ${c.ppcc[p] === c.ppcc_min ? 'font-semibold text-ink' : 'text-ink-2'}`}>{c.ppcc[p]?.toFixed(3)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Catchment" value={id} sub={doc ? `${fmt(doc.area_km2)} km² · level ${doc.level} · ${doc.gpm_cells} GPM cells` : '…'} />
            <Stat label="100-yr 24 h depth, total" value={s ? `${fmt(s.d100)} mm` : '…'}
              sub={doc ? `TC ${fmt(doc.populations.tc.fits['24'].depth[rps.indexOf(100)] ?? 0)} mm · non-TC ${fmt(doc.populations.nontc.fits['24'].depth[rps.indexOf(100)] ?? 0)} mm` : ''} />
            <Stat label="Areal reduction" value={s?.arf100 != null ? fmt(s.arf100, 2) : '–'} sub="catchment ÷ single-cell 100-yr depth" />
            <Stat label="Fit quality (PPCC)" value={s ? fmt(s.ppcc_min, 3) : '…'} sub="lowest of the 3 populations, 24 h" />
          </div>
          {!doc ? <p className="text-sm text-ink-3">Loading catchment…</p> : (
            <>
              <section>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">Depth-duration-frequency</h3>
                  <div className="flex flex-wrap gap-2">
                    <Segmented label="Lines" value={ddfMode} onChange={setDdfMode} options={[{ value: 'rp', label: 'Return periods' }, { value: 'pop', label: 'Populations' }]} />
                    {ddfMode === 'rp'
                      ? <Segmented label="Population" value={ddfPop} onChange={setDdfPop} options={POPS.map((p) => ({ value: p, label: POP_LABEL[p] }))} />
                      : <Segmented label="Return period" value={String(rp)} onChange={(v) => setRp(Number(v))} options={rps.map((T) => ({ value: String(T), label: `${T}` }))} />}
                  </div>
                </div>
                <Chart option={ddfChart} height={320} label="Depth-duration-frequency curves" />
              </section>
              <section>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">Design hyetograph ({rp}-year, {stormH} h)</h3>
                  <div className="flex flex-wrap gap-2">
                    <Segmented label="Return period" value={String(rp)} onChange={(v) => setRp(Number(v))} options={rps.map((T) => ({ value: String(T), label: `${T}` }))} />
                    <Segmented label="Storm duration" value={String(stormH)} onChange={(v) => setStormH(Number(v))} options={durs.map((d) => ({ value: String(d), label: `${d} h` }))} />
                  </div>
                </div>
                <Chart option={hyetoChart} height={280} label="Design hyetograph per population" />
              </section>
              <section>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">Gumbel fit check</h3>
                  <Segmented label="Fitted duration" value={fitDur} onChange={setFitDur} options={[{ value: '24', label: '24 h' }, { value: '48', label: '48 h' }]} />
                </div>
                <Chart option={fitChart} height={340} label="Observed seasonal maxima against the fitted Gumbel distribution" />
                <table className="mt-2 w-full text-sm tabular">
                  <thead><tr className="border-b border-line text-left text-ink-3">
                    {['Population', 'Seasons with rain', 'µ (mm)', 'β (mm)', 'PPCC', 'KS D', `${rp}-yr depth (90% CI)`].map((h, i) =>
                      <th key={h} className={`py-1 pr-3 font-medium ${i ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
                  <tbody>
                    {POPS.map((p) => {
                      const f = doc.populations[p].fits[fitDur]
                      const k = rps.indexOf(rp)
                      const nPos = f.maxima.filter((v) => v != null && v > 0).length
                      return (
                        <tr key={p} className="border-b border-line last:border-0">
                          <td className="py-1 pr-3 text-ink-2">{POP_LABEL[p]}{p === 'total' ? ' (fitted directly)' : ''}</td>
                          <td className="py-1 pr-3 text-right text-ink">{nPos} / {summary.n_seasons}</td>
                          <td className="py-1 pr-3 text-right text-ink">{f.mu?.toFixed(1)}</td>
                          <td className="py-1 pr-3 text-right text-ink">{f.beta?.toFixed(1)}</td>
                          <td className="py-1 pr-3 text-right text-ink">{f.ppcc?.toFixed(3)}</td>
                          <td className="py-1 pr-3 text-right text-ink">{f.ks?.toFixed(3)}</td>
                          <td className="py-1 pr-3 text-right text-ink">
                            {p === 'total' ? fmt(doc.total_direct[fitDur][k] ?? 0) : `${fmt(f.depth[k] ?? 0)} (± ${fmt(f.ci90[k] ?? 0)})`}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="font-medium">
                      <td className="py-1 pr-3 text-ink" colSpan={6}>Total used for design (derived from TC and non-TC)</td>
                      <td className="py-1 pr-3 text-right text-ink">{fmt(doc.populations.total.fits[fitDur].depth[rps.indexOf(rp)] ?? 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </>
          )}
        </div>
      </div>
      <Info>
        <b>How to read it.</b> In the fit check, points are the observed seasonal maxima (Gringorten plotting positions; seasons
        without rain of a population are not drawn), lines the fitted Gumbel, shading its 90% confidence band (frequency-factor
        method). Points that leave the band in a systematic way, a curved trend, or one isolated extreme indicate a poor fit.
        PPCC is the correlation between the sorted maxima and the fitted quantiles (1 = perfect). Even genuinely Gumbel data
        of {summary.n_seasons} seasons scatter: in 20,000 simulated samples, 5% fell below 0.947 and 1% below 0.916, which are
        therefore the test thresholds. Cyclone fits behave as expected (9% below 0.947, 2% below 0.916). Total and non-TC fits
        have about twice the expected share below 0.947 and four to five times below 0.916, mostly from single outlier seasons
        that inflate the method-of-moments fit; 182 catchments (8.5%) have at least one population below 0.916. With {summary.n_seasons} seasons, depths beyond about 100
        years are extrapolations, and 1–12 h depths are derived from the 24 h depth with the uncalibrated exponent
        n = {fmt(summary.dd_exponent, 2)}. A catchment-day counts as cyclone rain when at least {fmt(summary.tc_majority * 100, 0)}% of the
        catchment's area is attributed to a storm. GPM daily totals use fixed calendar days, which tends to underestimate true
        24-hour maxima; no correction is applied yet.
      </Info>
    </Card>
  )
}
