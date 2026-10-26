import { useEffect, useMemo, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { dataUrl } from '../data'
import { fmt } from '../format'
import { POP_LABEL, SCENARIO_SLOT, type Palette } from '../theme'
import type { ClimateFactors, FutureScenario, PopKey } from '../types'
import type { CatchmentDoc, Summary } from './CatchmentRainfall'
import { SCENARIO_LABEL } from './Exposure'
import { Card, Chart, DataTable, Figure, Info, Segmented, Stat, Steps } from './ui'

const FUTURE: FutureScenario[] = ['ssp2_2050', 'ssp5_2050', 'ssp2_2085', 'ssp5_2085']
const POPS: PopKey[] = ['total', 'tc', 'nontc']
type Index = 'rx1day' | 'rx5day'

/** Index whose change factor applies to a duration (h). */
const indexFor = (d: number): Index => (d <= 24 ? 'rx1day' : 'rx5day')

export function FutureRainfall({ palette, initial }: { palette: Palette; initial: string }) {
  const [cf, setCf] = useState<ClimateFactors>()
  const [summary, setSummary] = useState<Summary>()
  const [index, setIndex] = useState<Index>('rx1day')
  const [id, setId] = useState(initial)
  const [query, setQuery] = useState('')
  const [doc, setDoc] = useState<CatchmentDoc>()
  const [pop, setPop] = useState<PopKey>('total')
  const [dur, setDur] = useState(24)
  const [band, setBand] = useState<FutureScenario | 'none'>('ssp5_2085')

  useEffect(() => {
    fetch(dataUrl('climate_factors.json')).then((r) => r.json()).then(setCf)
    fetch(dataUrl('catchment_rainfall_summary.json')).then((r) => r.json()).then(setSummary)
  }, [])
  useEffect(() => {
    setDoc(undefined)
    fetch(dataUrl(`catchment_rainfall/${id}.json`)).then((r) => r.json()).then(setDoc)
  }, [id])
  const ids = useMemo(() => new Set(summary?.catchments.map((c) => c.id) ?? []), [summary])

  if (!cf || !summary) return <Card title="Future projected rainfall"><p className="text-sm text-ink-3">Loading…</p></Card>

  const color = (s: FutureScenario | 'hist_baseline') => palette[SCENARIO_SLOT[s]]
  const axis = {
    axisLabel: { color: palette['text-secondary'] }, axisLine: { lineStyle: { color: palette.axis } },
    axisTick: { show: false }, splitLine: { lineStyle: { color: palette.grid } }, nameTextStyle: { color: palette['text-secondary'] },
  }
  const legend = { top: 0, textStyle: { color: palette['text-secondary'] }, itemWidth: 14, itemHeight: 10 }

  // ---- factors: every model, the median, the 7%/degree reference
  const models = cf.models
  const factorChart: EChartsOption = {
    legend, grid: { left: 56, right: 24, top: 40, bottom: 40 },
    tooltip: { trigger: 'item', formatter: (p) => {
      const q = p as unknown as { seriesName: string; name: string; value: [number, number]; data: { model?: string } }
      return `${q.seriesName}${q.data?.model ? ` · ${q.data.model}` : ''}<br/>${SCENARIO_LABEL[FUTURE[Math.round(q.value[0])]]}: × ${q.value[1].toFixed(3)}`
    } },
    xAxis: { type: 'value', min: -0.5, max: FUTURE.length - 0.5, ...axis, splitLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: palette['text-secondary'], customValues: FUTURE.map((_, i) => i),
        formatter: (v: number) => SCENARIO_LABEL[FUTURE[v]] ?? '' } },
    yAxis: { type: 'value', name: 'Change factor', scale: true, ...axis,
      axisLine: { onZero: false, lineStyle: { color: palette.axis } } },
    series: [
      { name: 'Individual models', type: 'scatter', symbolSize: 7,
        itemStyle: { color: palette.accent, opacity: 0.45, borderColor: palette.surface, borderWidth: 1 },
        data: FUTURE.flatMap((s, i) => models.map((m, j) => ({
          value: [i + ((j % 9) - 4) * 0.035, cf.scenarios[s][index].per_model[m]], model: m }))),
        markLine: { symbol: 'none', silent: true, lineStyle: { color: palette['text-muted'], type: 'solid', width: 1 },
          label: { show: false }, data: [{ yAxis: 1 }] } },
      { name: 'Multi-model median (adopted)', type: 'scatter', symbol: 'rect', symbolSize: [34, 4],
        itemStyle: { color: palette['text-primary'] },
        data: FUTURE.map((s, i) => [i, cf.scenarios[s][index].median]) },
      { name: '7% per °C reference', type: 'scatter', symbol: 'diamond', symbolSize: 11,
        itemStyle: { color: palette['cat-2'], borderColor: palette.surface, borderWidth: 1.5 },
        data: FUTURE.map((s, i) => [i, cf.scenarios[s].cc_reference.factor]) },
    ],
  }

  // ---- catchment: baseline and future curves (depth against return period)
  let ddfChart: EChartsOption = {}
  const rps = summary.return_periods
  const durs = summary.durations
  if (doc) {
    const j = durs.indexOf(dur)
    const base = rps.map((_, i) => doc.populations[pop].ddf[i][j] ?? 0)
    const idx = indexFor(dur)
    const scaled = (s: FutureScenario, k: 'median' | 'p10' | 'p90') => base.map((v, i) => [rps[i], v * cf.scenarios[s][idx][k]])
    ddfChart = {
      legend: { ...legend, data: ['Baseline (GPM 1998–2024)', ...FUTURE.map((s) => SCENARIO_LABEL[s])] },
      grid: { left: 56, right: 24, top: 40, bottom: 44 },
      tooltip: { trigger: 'axis', formatter: (ps) => {
        const list = (ps as unknown as { seriesName: string; value: [number, number]; color: string }[]).filter((q) => !q.seriesName.startsWith('band'))
        return `<b>${list[0]?.value[0]}-year, ${dur} h</b><br/>` + list.map((q) => `<span style="color:${q.color}">●</span> ${q.seriesName}: ${fmt(q.value[1])} mm`).join('<br/>')
      } },
      xAxis: { type: 'log', min: rps[0], max: rps[rps.length - 1], name: 'Return period (years, log scale)',
        nameLocation: 'middle', nameGap: 28, ...axis, axisLabel: { color: palette['text-secondary'], formatter: (v: number) => `${v}` } },
      yAxis: { type: 'value', name: `${dur} h depth (mm)`, ...axis },
      series: [
        ...(band !== 'none' ? [
          { name: 'band-lo', type: 'line' as const, data: scaled(band, 'p10'), stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, silent: true },
          { name: 'band-hi', type: 'line' as const, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, silent: true,
            areaStyle: { color: color(band), opacity: 0.15 },
            data: scaled(band, 'p90').map(([x, y], i) => [x, y - (scaled(band, 'p10')[i][1] as number)]) },
        ] : []),
        { name: 'Baseline (GPM 1998–2024)', type: 'line', data: rps.map((T, i) => [T, base[i]]), symbolSize: 6,
          lineStyle: { width: 2.5, color: color('hist_baseline') }, itemStyle: { color: color('hist_baseline') } },
        ...FUTURE.map((s) => ({ name: SCENARIO_LABEL[s], type: 'line' as const, data: scaled(s, 'median'), symbolSize: 5,
          lineStyle: { width: 2, color: color(s) }, itemStyle: { color: color(s) } })),
      ],
    }
  }
  const sig = cf.spatial_signal_l5.filter((r) => r.index === 'rx1day')
  const sigText = (sc: string, per: string) => sig.find((r) => r.scenario === sc && r.period === per)

  return (
    <div className="space-y-4">
      <div role="note" className="rounded-lg bg-banner px-4 py-2 text-sm text-ink">
        <strong>Projections, not predictions.</strong> One national change factor per scenario, the median of {cf.n_models} CMIP6
        models, applied to the observed baseline curves of every catchment. Models disagree substantially; the 10th–90th
        percentile range across models is shown throughout.
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {FUTURE.map((s) => {
          const f = cf.scenarios[s]
          return <Stat key={s} label={SCENARIO_LABEL[s]} value={`× ${f.rx1day.median.toFixed(3)}`}
            sub={`24 h; models ${f.rx1day.p10.toFixed(2)}–${f.rx1day.p90.toFixed(2)} · ${fmt(f.rx1day.share_increase * 100, 0)}% project an increase · 48 h × ${f.rx5day.median.toFixed(3)}`} />
        })}
      </div>

      <Card title="Change factors per scenario"
        subtitle={`Ratio of mean annual maximum rainfall in ${cf.windows['2050'].join('–')} and ${cf.windows['2085'].join('–')} to ${cf.baseline_period.join('–')}, area-averaged over Madagascar. Each dot is one model; the bar is the median used.`}
        actions={<Segmented label="Index" value={index} onChange={setIndex}
          options={[{ value: 'rx1day', label: 'Rx1day (≤ 24 h)' }, { value: 'rx5day', label: 'Rx5day (48 h)' }]} />}>
        <Chart option={factorChart} height={340} label="Change factor per scenario: individual models, multi-model median and 7% per degree reference" />
        <DataTable caption="Change factors"
          head={['Scenario', 'Rx1day median (10–90%)', 'Rx5day median (10–90%)', 'Models with an increase (Rx1day)', 'Rx1day vs 1995–2014', '7% per °C reference']}
          rows={FUTURE.map((s) => {
            const f = cf.scenarios[s]
            return [SCENARIO_LABEL[s], `${f.rx1day.median.toFixed(3)} (${f.rx1day.p10.toFixed(3)}–${f.rx1day.p90.toFixed(3)})`,
              `${f.rx5day.median.toFixed(3)} (${f.rx5day.p10.toFixed(3)}–${f.rx5day.p90.toFixed(3)})`,
              `${fmt(f.rx1day.share_increase * 100, 0)}%`, f.rx1day.vs_1995_2014.median.toFixed(3),
              `${f.cc_reference.factor.toFixed(3)} (+${f.cc_reference.additional_warming_c.toFixed(1)} °C)`]
          })} />
        <Info>
          The models project modest increases in extreme daily rainfall over Madagascar: a few per cent by 2050 and
          +{fmt((cf.scenarios.ssp5_2085.rx1day.median - 1) * 100, 0)}% by 2085 under SSP5-8.5, but some models project decreases in every scenario.
          The model medians are about half of what the simple scaling of 7% per degree of warming gives (diamonds). That
          scaling is kept as a high-end reference; coarse climate models are known to underestimate changes in extremes,
          particularly for tropical cyclones, which they barely resolve.
        </Info>
      </Card>

      <Card title="Future curves for a catchment" subtitle="The catchment's observed baseline curve multiplied by each scenario's national factor (Rx1day factor up to 24 h, Rx5day factor for 48 h).">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (ids.has(query.trim())) setId(query.trim()) }}>
            <input list="future-ids" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Catchment id (now ${id})`}
              className="w-56 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink" />
            <datalist id="future-ids">{summary.catchments.map((c) => <option key={c.id} value={c.id} />)}</datalist>
            <button className="rounded-md border border-line px-3 py-1 text-sm text-ink hover:border-ink-3">Go</button>
          </form>
          <Segmented label="Population" value={pop} onChange={setPop} options={POPS.map((p) => ({ value: p, label: POP_LABEL[p] }))} />
          <Segmented label="Duration" value={String(dur)} onChange={(v) => setDur(Number(v))} options={durs.map((d) => ({ value: String(d), label: `${d} h` }))} />
          <Segmented label="Model range shown for" value={band} onChange={setBand}
            options={[{ value: 'none', label: 'No band' }, ...FUTURE.map((s) => ({ value: s, label: SCENARIO_LABEL[s] }))]} />
        </div>
        {!doc ? <p className="text-sm text-ink-3">Loading catchment…</p> : (
          <>
            <Chart option={ddfChart} height={340} label="Baseline and future depth against return period for the selected catchment" />
            <p className="mt-1 text-xs text-ink-3">
              Catchment {id}, {fmt(doc.area_km2)} km². Shading: 10th–90th percentile of the models for the selected scenario.
              {dur < 24 && ' 1–12 h baseline depths are themselves derived from the 24 h depth.'} Beyond 100 years the baseline extrapolates the 26-season record.
            </p>
            <DataTable caption="Depths by scenario"
              head={['Return period', 'Baseline (mm)', ...FUTURE.map((s) => `${SCENARIO_LABEL[s]} (mm)`)]}
              rows={rps.map((T, i) => {
                const b = doc.populations[pop].ddf[i][durs.indexOf(dur)] ?? 0
                return [`${T} yr`, fmt(b), ...FUTURE.map((s) => fmt(b * cf.scenarios[s][indexFor(dur)].median))]
              })} />
          </>
        )}
      </Card>

      <Card title="Why one national factor" subtitle="Median factor per HydroBASINS level-5 unit (17 units), for information.">
        <Figure src={dataUrl('figures/climate_rx1day_by_l5_unit.png')} alt="Median Rx1day change factor per HydroBASINS level-5 unit for the four scenarios" />
        <Info>
          Differences between units ({fmt((sigText('ssp245', '2050')?.unit_median_range ?? 0) * 100, 0)}–{fmt((sigText('ssp585', '2085')?.unit_median_range ?? 0) * 100, 0)} percentage
          points between the highest and lowest unit) are small next to the disagreement between models
          ({fmt((sigText('ssp585', '2050')?.typical_model_spread_p10_p90 ?? 0) * 100, 0)}–{fmt((sigText('ssp585', '2085')?.typical_model_spread_p10_p90 ?? 0) * 100, 0)} points between the 10th and
          90th percentile within a unit). Whether models agree on which units change more was tested by shuffling the units
          within each model: agreement is at chance level for 2050 ({fmt((sigText('ssp245', '2050')?.agreement ?? 0) * 100, 0)}% against
          {' '}{fmt((sigText('ssp245', '2050')?.agreement_chance_mean ?? 0) * 100, 0)}% by chance) and only modestly above it for 2085
          ({fmt((sigText('ssp585', '2085')?.agreement ?? 0) * 100, 0)}% under SSP5-8.5, 95% chance threshold {fmt((sigText('ssp585', '2085')?.agreement_chance_p95 ?? 0) * 100, 0)}%),
          where the south and south-west tend to increase more than the north. That pattern is too weak to justify separate
          factors, so one national factor is used.
        </Info>
      </Card>

      <Card title="Method and assumptions">
        <Steps items={[
          { title: 'Data', body: <>Annual maximum 1-day (Rx1day) and 5-day (Rx5day) precipitation from the C3S dataset of ETCCDI indices computed on CMIP6 output (climdex.pcic, base-independent), for {cf.n_models} models with historical, SSP2-4.5 and SSP5-8.5 runs; one ensemble member per model (r1i1p1f1 where available) so models with many members do not dominate. Native grids from 0.5° to 2.8°.</> },
          { title: 'Change per model', body: <>Mean of the annual index over {cf.windows['2050'].join('–')} and {cf.windows['2085'].join('–')} divided by its mean over the baseline, both from the same model, so the model's own bias cancels. Each model is interpolated to a common 1° grid and averaged over Madagascar (area-weighted) before the ratio is taken.</> },
          { title: 'Baseline correction', body: <>The observed curves come from GPM {cf.baseline_period.join('–')}, not the IPCC AR6 reference period {cf.ar6_reference_period.join('–')}. Each model's own {cf.baseline_period.join('–')} mean (historical run to 2014, then the same model's scenario run) is used as the baseline, so the warming already in the record is not counted twice. The correction is small: models put {cf.baseline_period.join('–')} {fmt((cf.scenarios.ssp2_2050.rx1day.baseline_shift_median - 1) * 100, 1)}% above {cf.ar6_reference_period.join('–')}.</> },
          { title: 'Central value and range', body: <>The adopted factor is the median across models; the 10th–90th percentile is the uncertainty range. The share of models projecting an increase is reported as a measure of agreement.</> },
          { title: 'Application', body: <>Future depth = baseline depth × factor, for every catchment and return period. The Rx1day factor applies to 1–24 h (sub-daily intensities are assumed to change like daily totals) and the Rx5day factor to 48 h. The same factor applies to the three rainfall populations: the models do not resolve tropical cyclones, so cyclone and non-cyclone rainfall cannot be projected separately.</> },
          { title: 'Same relative change for all return periods', body: <>The factor is derived from the mean annual maximum (roughly a 2–3 year event) and assumed to hold for rare events too. This is standard practice; rare extremes may in reality change more.</> },
          { title: 'Reference scaling', body: <>7% more extreme rainfall per °C of additional global warming (IPCC AR6), with warming levels from AR6 Table SPM.1 ({cf.windows['2050'].join('–')}: SSP2-4.5 2.0 °C, SSP5-8.5 2.4 °C; {cf.windows['2085'].join('–')}: 2.7 °C and 4.4 °C, relative to 1850–1900) minus 1.0 °C already in the GPM period. Shown for comparison, not used.</> },
        ]} />
      </Card>
    </div>
  )
}
