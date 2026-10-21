import { useState, type ReactNode } from 'react'
import type { EChartsOption } from 'echarts'
import {
  CLIMATES, DURATIONS, POPULATIONS, PRESETS, RESOLUTIONS, estimate,
  type Assumptions, type Benchmark, type Prices, type Scenario,
} from '../compute'
import { fmt } from '../format'
import type { Palette } from '../theme'
import { Card, Chart, DataTable, Info, Segmented, Stat } from './ui'

/** Human duration from days: hours, days, months or years. */
function span(days: number): string {
  if (days < 1) return `${fmt(days * 24, 1)} h`
  if (days < 60) return `${fmt(days, 1)} days`
  if (days < 730) return `${fmt(days / 30.4, 1)} months`
  return `${fmt(days / 365, 1)} years`
}
const usd = (v: number) => `$${fmt(v, 0)}`
/** Short axis label for a duration in hours (log axis ticks are powers of ten). */
const hoursTick = (h: number) =>
  h < 24 ? `${Math.round(h)} h` : h < 24 * 365 ? `${Math.round(h / 24)} d` : `${Math.round(h / 24 / 365)} yr`

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ink-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--accent)]" />
      {label}
    </label>
  )
}

function Slider({ label, value, min, max, step, onChange, show }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; show?: ReactNode
}) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between text-ink-2"><span>{label}</span><span className="tabular text-ink">{show ?? value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]" />
    </label>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2 border-t border-line pt-3 first:border-0 first:pt-0">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">{title}</legend>
      {children}
    </fieldset>
  )
}

const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v))

export function Compute({ benchmark, prices, palette }: { benchmark: Benchmark; prices: Prices; palette: Palette }) {
  const [sc, setSc] = useState<Scenario>({
    rps: 8, populations: ['total', 'tc', 'nontc'], durations: [...DURATIONS], climates: [...CLIMATES],
    res_m: 50, share: 1, drain_h: 12,
  })
  const [region, setRegion] = useState('us-east-1')
  const families = prices.regions[region].families
  const [family, setFamily] = useState('c7a')
  const fam = families[family] ?? Object.values(families)[0]
  const emulatedPerCore = benchmark.runs.reduce((t, r) => t + r.cell_steps_per_s, 0) / benchmark.runs.length / 5
  const [as, setAs] = useState({ dt50_s: 4, native_m: 4, local_cores: 5, local_native: false, vcpus: 2000 })
  const assumptions: Assumptions = {
    dt50_s: as.dt50_s, native_per_vcpu: as.native_m * 1e6, emulated_per_core: emulatedPerCore,
    local_cores: as.local_cores, local_native: as.local_native, vcpus: as.vcpus,
    spot: fam.spot ?? fam.on_demand * 0.4, on_demand: fam.on_demand,
  }
  const set = <K extends keyof Scenario>(k: K, v: Scenario[K]) => setSc((p) => ({ ...p, [k]: v }))
  const valid = sc.populations.length > 0 && sc.durations.length > 0 && sc.climates.length > 0
  const est = estimate(valid ? sc : { ...sc, durations: [24] }, assumptions, benchmark.domain)

  const rows = [
    ...PRESETS.map((p) => ({ label: p.label, e: estimate({ ...p.scenario, share: sc.share, drain_h: sc.drain_h }, assumptions, benchmark.domain) })),
    { label: 'Your selection', e: est },
  ]

  const axis = {
    axisLabel: { color: palette['text-secondary'] }, axisLine: { lineStyle: { color: palette.axis } },
    axisTick: { show: false }, splitLine: { lineStyle: { color: palette.grid } }, nameTextStyle: { color: palette['text-secondary'] },
  }
  const legend = { top: 0, textStyle: { color: palette['text-secondary'] }, itemWidth: 12, itemHeight: 12 }

  const timeChart: EChartsOption = {
    legend, grid: { left: 230, right: 70, top: 32, bottom: 44 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => span(Number(v) / 24) },
    // hours on a log axis starting at 1 h, so every bar grows from the left edge
    xAxis: { type: 'log', min: 1, name: 'Time to finish (log scale)', nameLocation: 'middle', nameGap: 28, ...axis,
      axisLabel: { color: palette['text-secondary'], hideOverlap: true, formatter: (v: number) => hoursTick(v) } },
    yAxis: { type: 'category', inverse: true, data: rows.map((r) => r.label), ...axis,
      axisLabel: { color: palette['text-secondary'], fontWeight: 400 } },
    series: [
      { name: `AWS, ${fmt(as.vcpus)} vCPUs`, type: 'bar', barGap: '15%', data: rows.map((r) => Math.max(r.e.awsDays * 24, 1)),
        itemStyle: { color: palette['cat-1'], borderRadius: [0, 4, 4, 0] } },
      { name: `Local, ${as.local_cores} cores ${as.local_native ? '(native build)' : '(Docker, emulated)'}`, type: 'bar',
        data: rows.map((r) => Math.max(r.e.localDays * 24, 1)), itemStyle: { color: palette['cat-2'], borderRadius: [0, 4, 4, 0] } },
    ],
  }
  const costChart: EChartsOption = {
    legend, grid: { left: 230, right: 70, top: 32, bottom: 44 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => usd(Number(v)) },
    xAxis: { type: 'log', min: 1, name: 'AWS compute cost, USD (log scale)', nameLocation: 'middle', nameGap: 28, ...axis },
    yAxis: { type: 'category', inverse: true, data: rows.map((r) => r.label), ...axis },
    series: [
      { name: 'Spot', type: 'bar', barGap: '15%', data: rows.map((r) => Math.max(r.e.spotUsd, 1)), itemStyle: { color: palette['cat-3'], borderRadius: [0, 4, 4, 0] } },
      { name: 'On-demand', type: 'bar', data: rows.map((r) => Math.max(r.e.onDemandUsd, 1)), itemStyle: { color: palette.neutral, borderRadius: [0, 4, 4, 0] } },
    ],
  }
  const byRes = RESOLUTIONS.map((r) => ({ r, e: estimate({ ...(valid ? sc : { ...sc, durations: [24] }), res_m: r }, assumptions, benchmark.domain) }))
  const resChart: EChartsOption = {
    legend, grid: { left: 64, right: 16, top: 32, bottom: 44 },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps) => {
        const i = (ps as { dataIndex: number }[])[0].dataIndex
        const x = byRes[i].e
        return `<b>${byRes[i].r} m grid</b><br/>${fmt(x.vcpuHours)} vCPU-hours<br/>AWS Spot ${usd(x.spotUsd)} · on-demand ${usd(x.onDemandUsd)}` +
          `<br/>AWS ${span(x.awsDays)} · local ${span(x.localDays)}`
      },
    },
    xAxis: { type: 'category', data: RESOLUTIONS.map((r) => `${r} m`), name: 'Grid resolution', nameLocation: 'middle', nameGap: 28, ...axis },
    yAxis: { type: 'log', min: 1, name: 'USD (log scale)', ...axis },
    series: [
      { name: 'Spot', type: 'bar', data: byRes.map((x) => Math.max(x.e.spotUsd, 1)), itemStyle: { color: palette['cat-3'], borderRadius: [4, 4, 0, 0] } },
      { name: 'On-demand', type: 'bar', data: byRes.map((x) => Math.max(x.e.onDemandUsd, 1)), itemStyle: { color: palette.neutral, borderRadius: [4, 4, 0, 0] } },
    ],
  }
  const durChart: EChartsOption = {
    grid: { left: 64, right: 16, top: 16, bottom: 44 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps) => {
        const d = est.byDuration[(ps as { dataIndex: number }[])[0].dataIndex]
        return `<b>${d.duration} h storm</b> (+${sc.drain_h} h drain)<br/>${fmt(d.vcpuHours)} vCPU-hours · ${fmt((100 * d.vcpuHours) / est.vcpuHours, 0)}% of the total`
      } },
    xAxis: { type: 'category', data: est.byDuration.map((d) => `${d.duration} h`), name: 'Storm duration', nameLocation: 'middle', nameGap: 28, ...axis },
    yAxis: { type: 'value', name: 'vCPU-hours', ...axis },
    series: [{ type: 'bar', data: est.byDuration.map((d) => d.vcpuHours), barCategoryGap: '30%',
      itemStyle: { color: palette.accent, borderRadius: [4, 4, 0, 0] } }],
  }
  const conc = [64, 128, 256, 512, 1000, 2000, 3000, 5000]
  const concChart: EChartsOption = {
    grid: { left: 64, right: 16, top: 16, bottom: 44 },
    tooltip: { trigger: 'axis', valueFormatter: (v) => span(Number(v) / 24) },
    xAxis: { type: 'category', data: conc.map(String), name: 'Concurrent vCPUs on AWS', nameLocation: 'middle', nameGap: 28, boundaryGap: false, ...axis },
    yAxis: { type: 'log', min: 1, name: 'Time to finish (log)', ...axis,
      axisLabel: { color: palette['text-secondary'], hideOverlap: true, formatter: (v: number) => hoursTick(v) } },
    series: [{ type: 'line', data: conc.map((v) => Math.max(est.vcpuHours / v, 1)), symbolSize: 8, lineStyle: { width: 2 },
      itemStyle: { color: palette['cat-1'], borderColor: palette.surface, borderWidth: 2 } }],
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
        <Card title="Scenario" subtitle="What to simulate">
          <div className="space-y-4">
            <Group title="Return periods">
              <Slider label="Number of return periods" value={sc.rps} min={1} max={10} step={1} onChange={(v) => set('rps', v)} />
            </Group>
            <Group title="Rainfall population">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {POPULATIONS.map((p) => <Check key={p.key} label={p.label} checked={sc.populations.includes(p.key)}
                  onChange={(on) => set('populations', toggle(sc.populations, p.key, on))} />)}
              </div>
            </Group>
            <Group title="Storm duration">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {DURATIONS.map((d) => <Check key={d} label={`${d} h`} checked={sc.durations.includes(d)}
                  onChange={(on) => set('durations', toggle(sc.durations, d, on).sort((a, b) => a - b))} />)}
              </div>
            </Group>
            <Group title="Climate">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {CLIMATES.map((c) => <Check key={c} label={c} checked={sc.climates.includes(c)}
                  onChange={(on) => set('climates', toggle(sc.climates, c, on))} />)}
              </div>
            </Group>
            <Group title="Grid resolution">
              <Segmented label="Grid resolution" value={String(sc.res_m)} onChange={(v) => set('res_m', Number(v))}
                options={RESOLUTIONS.map((r) => ({ value: String(r), label: `${r} m` }))} />
            </Group>
            <Group title="Coverage">
              <Slider label="Share of the island modelled" value={sc.share} min={0.05} max={1} step={0.05}
                onChange={(v) => set('share', v)} show={`${fmt(sc.share * 100, 0)}% · ~${fmt(Math.round(benchmark.domain.n_basins * sc.share))} catchments`} />
              <Slider label="Drain time after the storm" value={sc.drain_h} min={0} max={24} step={1}
                onChange={(v) => set('drain_h', v)} show={`${sc.drain_h} h`} />
            </Group>
          </div>
        </Card>
        <Card title="Assumptions" subtitle="Change them to test sensitivity" className="mt-4">
          <div className="space-y-4">
            <Group title="AWS">
              <label className="block text-sm text-ink-2">Region
                <select value={region} onChange={(e) => { setRegion(e.target.value); setFamily(Object.keys(prices.regions[e.target.value].families)[0]) }}
                  className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-ink">
                  {Object.entries(prices.regions).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
                </select>
              </label>
              <label className="block text-sm text-ink-2">Instance family
                <select value={family} onChange={(e) => setFamily(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-ink">
                  {Object.entries(families).map(([k, v]) => (
                    <option key={k} value={k}>{k} · ${v.on_demand.toFixed(4)} on-demand{v.spot ? ` · $${v.spot.toFixed(4)} Spot` : ' · no Spot price'}</option>
                  ))}
                </select>
              </label>
              <Slider label="Concurrent vCPUs" value={as.vcpus} min={64} max={5000} step={64}
                onChange={(v) => setAs({ ...as, vcpus: v })} show={fmt(as.vcpus)} />
            </Group>
            <Group title="Model speed">
              <Slider label="Native speed per vCPU" value={as.native_m} min={1} max={10} step={0.5}
                onChange={(v) => setAs({ ...as, native_m: v })} show={`${as.native_m} M cell-steps/s`} />
              <Slider label="Average time step at 50 m" value={as.dt50_s} min={2} max={8} step={0.5}
                onChange={(v) => setAs({ ...as, dt50_s: v })} show={`${as.dt50_s} s`} />
            </Group>
            <Group title="Local machine">
              <Slider label="Cores" value={as.local_cores} min={1} max={10} step={1} onChange={(v) => setAs({ ...as, local_cores: v })}
                show={`${as.local_cores}${as.local_cores === 5 ? ' (as benchmarked)' : ''}`} />
              <Check label="Native SFINCS build (not tested)" checked={as.local_native} onChange={(v) => setAs({ ...as, local_native: v })} />
            </Group>
          </div>
        </Card>
      </aside>

      <main className="min-w-0 space-y-4">
        <div role="note" className="rounded-lg bg-banner px-4 py-2 text-sm text-ink">
          <strong>Indicative only.</strong> Extrapolated from two test runs and approximate prices; real costs can differ
          by a factor of two or more. Benchmark one basin natively on AWS before committing to a budget.
        </div>
        {!valid && <div className="rounded-lg border border-line px-4 py-2 text-sm text-ink-2">Select at least one population, duration and climate; a 24 h storm is assumed meanwhile.</div>}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="Simulations" value={fmt(est.runs)} sub={`${sc.rps} RP × ${sc.populations.length} pop × ${sc.durations.length} dur × ${sc.climates.length} clim × ~${fmt(Math.round(benchmark.domain.n_basins * sc.share))} basins`} />
          <Stat label="Compute" value={`${fmt(est.vcpuHours)} vCPU-h`} sub={`${est.cellSteps.toExponential(1)} cell-steps`} />
          <Stat label="AWS" value={span(est.awsDays)} sub={`Spot ${usd(est.spotUsd)} · on-demand ${usd(est.onDemandUsd)}`} />
          <Stat label="Local" value={span(est.localDays)} sub={`${as.local_cores} cores, ${as.local_native ? 'native build' : 'Docker emulated'} · storage ~${fmt(est.storageGb)} GB`} />
        </div>

        <Card title="Options compared" subtitle="Presets A–E and your selection, with the current assumptions. Click a legend item to hide or show it.">
          <div className="grid gap-4 xl:grid-cols-2">
            <Chart option={timeChart} height={320} label="Time to finish each option, on AWS and locally" />
            <Chart option={costChart} height={320} label="AWS compute cost of each option, Spot and on-demand" />
          </div>
          <DataTable caption="Options" head={['Option', 'Simulations', 'vCPU-hours', 'AWS time', 'AWS Spot', 'AWS on-demand', 'Local time']}
            rows={rows.map((r) => [r.label, fmt(r.e.runs), fmt(r.e.vcpuHours), span(r.e.awsDays), usd(r.e.spotUsd), usd(r.e.onDemandUsd), span(r.e.localDays)])} />
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card title="Grid resolution" subtitle="Your selection at each resolution. Cost scales with the cube of the cell size: 4× more cells and a 2× shorter time step for every halving.">
            <Chart option={resChart} height={300} label="AWS cost of the selection by grid resolution" />
            <Info>
              <b>30 m</b> matches FABDEM itself, so the subgrid adds no detail. <b>50 m</b> (current) uses 25 m subgrid
              pixels. <b>100 m</b> keeps 25 m terrain detail in the subgrid at an eighth of the cost. <b>200 m</b> is
              64× cheaper than 50 m but blurs small drainage paths. Compare 50 m and 100 m on the pilots before choosing.
            </Info>
          </Card>
          <Card title="Where the compute goes" subtitle="Your selection by storm duration: long storms dominate, because each simulates storm + drain time.">
            <Chart option={durChart} height={300} label="Compute by storm duration" />
            <Info>
              A 24 h alternating-block storm already contains the 1, 3, 6 and 12 h depths of the same return period,
              so it reproduces the peak of every critical duration up to a day. With daily rainfall only, sub-daily
              durations rest on the uncalibrated depth-duration exponent. Recommended: <b>24 h</b>, plus <b>48 h</b> for
              multi-day cyclone rain; 6 h only for small urban catchments once sub-daily data exist.
            </Info>
          </Card>
        </div>

        <Card title="Parallel runs on AWS" subtitle="Total compute and cost do not change with the number of vCPUs; the time to finish does.">
          <Chart option={concChart} height={260} label="Time to finish on AWS by number of concurrent vCPUs" />
          <Info>
            New AWS accounts have low vCPU quotas (often a few dozen); request an increase for the instance family and
            Spot well ahead of a large batch. Spot instances can be interrupted: the pipeline skips finished basins, so an
            interrupted batch resumes where it stopped.
          </Info>
        </Card>

        <Card title="How the estimate is made">
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
            <li><b className="text-ink">Benchmark.</b> Two pilot runs ({benchmark.runs.map((r) => `${r.basin_km2} km², ${fmt(r.active_cells)} cells, ${fmt(r.wall_s / 60, 1)} min`).join('; ')}) on {benchmark.date}: {benchmark.machine}; {benchmark.sfincs}; {benchmark.grid_m} m grid, {benchmark.design_storm}. Both processed {fmt(emulatedPerCore * 5 / 1e6, 1)} million cell-steps per second.</li>
            <li><b className="text-ink">Scaling.</b> Compute = cells × time steps. Cells = area ÷ resolution²; the time step grows with the cell size (stability limit). Simulated time = storm duration + drain time. Each combination of return period, population, duration and climate is one run per catchment.</li>
            <li><b className="text-ink">Native speed.</b> {as.native_m} million cell-steps per second per vCPU is an <b>assumption</b> for SFINCS running natively on x86 (no emulation). It is the largest uncertainty; a 30-minute benchmark on one AWS instance (under $1) would fix it.</li>
            <li><b className="text-ink">Time step.</b> {as.dt50_s} s at 50 m, from the pilots (3.9 s on the 424 km² basin, 7.1 s on the 68 km² one, both for the 100-year storm). Intense, short storms run slower; frequent events faster.</li>
            <li><b className="text-ink">Prices.</b> {prices.unit}. On-demand: AWS public price list, published {prices.on_demand_published.slice(0, 10)} (<a className="underline" href={prices.sources.on_demand}>source</a>). Spot: AWS Spot price feed, retrieved {prices.spot_retrieved} (<a className="underline" href={prices.sources.spot}>source</a>); Spot prices change continuously. Compute only: storage, data transfer and orchestration are extra but small.</li>
            <li><b className="text-ink">Storage.</b> Maximum-depth maps at the subgrid resolution, 2 bytes per pixel, about 10× compression.</li>
          </ul>
        </Card>
      </main>
    </div>
  )
}
