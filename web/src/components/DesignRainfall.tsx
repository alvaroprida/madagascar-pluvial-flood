import { useEffect, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { dataUrl } from '../data'
import { fmt } from '../format'
import { POP_LABEL, POP_SLOT, type Palette } from '../theme'
import type { DesignStorms } from '../types'
import { Card, Chart, DataTable, Figure, Info, Segmented, Stat, Steps } from './ui'

const REPORT = 'IRD/ORSTOM (1993), Fleuves et rivières de Madagascar, §7.4'

const axisStyle = (p: Palette) => ({
  axisLabel: { color: p['text-secondary'] },
  axisLine: { lineStyle: { color: p.axis } },
  axisTick: { show: false },
  splitLine: { lineStyle: { color: p.grid } },
  nameTextStyle: { color: p['text-secondary'] },
})

/** Small static table (always visible): the numbers are the point of these cards. */
function Table({ head, rows, caption }: { head: string[]; rows: (string | number)[][]; caption: string }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-sm tabular">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-ink-3">
            {head.map((h) => <th key={h} className="py-1.5 pr-4 align-bottom font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line align-top last:border-0">
              {r.map((c, j) => <td key={j} className={`py-1.5 pr-4 ${j === 0 ? 'font-medium text-ink' : 'text-ink-2'}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DesignRainfall({ palette }: { palette: Palette }) {
  const [d, setD] = useState<DesignStorms>()
  const [basin, setBasin] = useState<string>()
  const [rp, setRp] = useState('100')
  useEffect(() => {
    fetch(dataUrl('design_storms.json')).then((r) => r.json()).then((x: DesignStorms) => {
      setD(x)
      setBasin(x.catchments.find((c) => c.slot.startsWith('urban'))?.basin_id ?? x.catchments[0].basin_id)
    })
  }, [])
  if (!d || !basin) return <Card title="Design storms"><p className="text-sm text-ink-3">Loading…</p></Card>

  const law = d.law, cfg = d.config
  const c = d.catchments.find((x) => x.basin_id === basin)!
  const storm = (pop: 'nontc' | 'tc', D: number, T: number) =>
    c.storms.find((s) => s.population === pop && s.duration_h === D && s.rp === T)!
  const shares3 = d.tc_day_shares.shares['3d']
  const ev = d.tc_day_shares.event_length_days
  const cap = cfg.report_peak_mm_hr

  const stormChart = (pop: 'nontc' | 'tc'): EChartsOption => {
    const s = storm(pop, cfg[pop].duration_h, Number(rp))
    const D = cfg[pop].duration_h
    return {
      grid: { left: 56, right: 16, top: 16, bottom: 44 },
      tooltip: { trigger: 'axis', valueFormatter: (v) => `${fmt(Number(v), 1)} mm/h` },
      xAxis: { type: 'value', min: 0, max: D, interval: D > 24 ? 12 : 0.5, name: 'Time (h)', nameLocation: 'middle',
               nameGap: 28, ...axisStyle(palette) },
      yAxis: { type: 'value', name: 'Intensity (mm/h)', ...axisStyle(palette) },
      series: [
        { name: POP_LABEL[pop], type: 'line', symbol: 'none', lineStyle: { width: 2 }, itemStyle: { color: palette[POP_SLOT[pop]] },
          areaStyle: { opacity: 0.1 },
          data: s.intensity_mm_hr.flatMap((v, i) => [[i * s.step_h, v], [(i + 1) * s.step_h, v]]),
          ...(pop === 'tc' ? { markLine: { symbol: 'none', silent: true, lineStyle: { color: palette['text-muted'], type: 'dashed' },
            label: { color: palette['text-muted'], formatter: `${cap} mm/h, highest cyclone intensity recorded by ORSTOM`, position: 'insideEndTop' },
            data: [{ yAxis: cap }] } } : {}) },
      ],
    }
  }

  // GPM: how long the largest cyclone events last
  const lengthDays = Object.keys(ev.share_by_days)
  const lengthChart: EChartsOption = {
    grid: { left: 48, right: 12, top: 12, bottom: 44 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => `${fmt(Number(v) * 100, 0)}% of events` },
    xAxis: { type: 'category', data: lengthDays.map((k) => `${k} d`), name: 'Consecutive days with ≥ 10 mm of cyclone rain',
             nameLocation: 'middle', nameGap: 28, ...axisStyle(palette) },
    yAxis: { type: 'value', name: 'Share of events', ...axisStyle(palette),
             axisLabel: { color: palette['text-secondary'], formatter: (v: number) => `${Math.round(v * 100)}%` } },
    series: [{ type: 'bar', barCategoryGap: '30%', data: lengthDays.map((k) => ev.share_by_days[k]),
               itemStyle: { color: palette[POP_SLOT.tc], borderRadius: [4, 4, 0, 0] } }],
  }

  const rc = d.radius_check
  const nested = d.nested_test
  const nestedRow = (D: number, T: number) => nested?.rows.find((r) => r.duration_h === D && r.rp === T)
  const pct = (v: number) => `${fmt(v * 100, 0)}%`

  return (
    <div className="space-y-4">
      <Card title="From design depths to design storms" subtitle="The steps followed to define the rainfall that drives the flood model, and where each is documented below.">
        <Steps items={[
          { title: 'Design depths', body: <>Daily design depths per population (cyclone, non-cyclone, total) from the extreme value analysis above; 2-, 3- and 4-day depths from running sums of the daily record.</> },
          { title: 'Sub-daily depths', body: <>A local depth-duration law turns the daily depth into depths for any duration of up to 24 hours.</> },
          { title: 'A first duration test, and its lesson', body: <>Nested storms (one shape containing every shorter duration) were run for 1–48 h. They cannot identify a critical duration: the flood can only grow with duration by construction.</> },
          { title: 'Two storm types', body: <>The ORSTOM rainfall study of Madagascar separates short, intense thunderstorms from long, moderate cyclone rain. Each type gets its own storm shape, duration and soil moisture.</> },
          { title: 'Design durations', body: <>3 hours for non-cyclone storms, 72 hours for cyclone storms, from the report and from the cyclone events in the GPM record.</> },
          { title: 'Storm shapes and soil moisture', body: <>A front-loaded double triangle for thunderstorms; a 3-day storm with one shaped wettest day for cyclones, on wet soils.</> },
          { title: 'Intensity checks', body: <>Peak intensities compared with the intensities recorded in Madagascar.</> },
          { title: 'Validation runs', body: <>Flood runs over a range of durations confirm (or correct) the design durations before the national runs. <b>Planned.</b></> },
        ]} />
      </Card>

      <Card title="Sub-daily depths: the depth-duration law" subtitle="With a daily rainfall record, depths for shorter durations come from a law fitted on sub-daily gauges.">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="text-sm text-ink-2">
              <b className="text-ink">P(T, t) = {fmt(law.coefficient, 3)} · t<sup>{fmt(law.exponent, 1)}</sup> · PJ(T)</b>, with t the duration in
              hours, PJ(T) the daily depth of return period T and P(T, t) the depth of the same return period over t hours. The law
              comes from a local urban drainage study in Antananarivo.
            </p>
            <Table caption="Depth over t hours as a share of the daily depth"
              head={['Duration', ...law.ratios.map((r) => r.t_h < 1 ? `${Math.round(r.t_h * 60)} min` : `${r.t_h} h`)]}
              rows={[['P(t) / PJ', ...law.ratios.map((r) => fmt(r.p_over_pj, 2))]]} />
          </div>
          <div>
            <Info>
              At 24 h the law gives <b>1.19 PJ</b>. Daily totals are counted over fixed calendar days and miss part of storms that
              straddle two days; the usual correction (about 1.13) is therefore already included, and no separate factor is
              applied. Beyond 24 h, depths are fitted on 2–4 day running sums.
            </Info>
            <Info>
              It replaces an earlier, uncalibrated law P(t) = P<sub>24h</sub>·(t/24)<sup>1/3</sup>. As a check against the
              gauge statistics quoted by ORSTOM (BCEOM 1967, Antananarivo, 10-year): 67 mm in 1 h and 93 mm in 3 h, an exponent
              of about 0.30 between 1 and 3 hours, against 0.4 here. Both are fitted on highland gauges; the law is still to be
              checked on GPM half-hourly data for the coasts and the west.
            </Info>
          </div>
        </div>
      </Card>

      <Card title="Two kinds of extreme rain" subtitle={`What the ORSTOM rainfall study of Madagascar says about storm types (${REPORT}).`}>
        <Table caption="Characteristics of thunderstorm and cyclone rainfall in Madagascar"
          head={['', 'Thunderstorms (convective)', 'Cyclones and tropical depressions']}
          rows={[
            ['Structure', 'Very short or no preliminary phase (< 10 mm/h); a core of 10–20 min at 80–100 mm/h, with 5-min bursts of 200 mm/h and more; a tail of several hours falling from 30 to 5 mm/h', 'Regular, long-lasting rain with moderate intensities'],
            ['Duration', 'Core under an hour, tail of a few hours (e.g. 29 Nov 1962, Antananarivo: 78 mm, core of 50 min, 90 min of tail)', 'Tens of hours: 68 h almost without a break over the upper Ikopa (25–28 Mar 1959); 50 h at Morombe (12–14 Jan 1959)'],
            ['Intensity', '519 mm/h over 6 min (15 Nov 1962, Antananarivo); 312 mm/h over a few minutes (Tafaina basin, 2 Dec 1965)', 'At most 36 mm/h (Antananarivo, 1959) and 88 mm/h over 15 min (Morombe, 1959)'],
            ['Totals', '30–150 mm in the recorded storms', '300–800 mm in 3–6 days: Toamasina 603 mm in 4 days, Mananara-Nord 515 mm in 3 days, Isalo 807 mm in 4 days'],
            ['Extent', 'Local', 'Whole river basins along the track'],
            ['Season', 'Most frequent from late October, at the end of the dry season, then all through the rainy season', 'Mostly January–March (GPM record)'],
            ['Soils', 'Not documented', 'Bring soils near saturation: runoff of at least 70% of rain over the upper Ikopa in 1959'],
            ['Our population', 'Most of the non-cyclone rainfall', 'The cyclone rainfall (cell-days within 500 km of a storm centre)'],
          ]} />
        <Info>
          Non-cyclone rainfall also holds rain from non-cyclonic depressions, southern winter rain from polar-front lows and
          multi-day series of thunderstorms on the highlands (5–15 days, sometimes 20). The report only describes these series
          qualitatively and only for the highlands: they are not given a design storm of their own. Highest daily records by
          region, as context for the design depths: east coast 543 mm (Vatomandry), north 533 mm (Antsiranana), west 398 mm
          (Tsaratanana), south 225 mm (Toliara), highlands 166–188 mm.
        </Info>
      </Card>

      {nested && (
        <Card title="A first duration test, and why it could not justify a duration"
          subtitle={`Nested design storms of 1–48 h on ${nested.n_catchments} test catchments (10- and 100-year, total rainfall, average soil moisture), flood metrics as a ratio to the 24 h storm.`}>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Figure src={dataUrl('figures/duration_test_nested.png')} alt="Flood area, volume, buildings flooded and building loss against storm duration, as a ratio to the 24 h storm, one line per catchment" />
            <div>
              <Table caption="Building loss as a ratio to the 24 h storm (median, range over catchments)"
                head={['Duration', '10-year', '100-year']}
                rows={[1, 3, 6, 12, 48].map((D) => [`${D} h`, ...[10, 100].map((T) => {
                  const r = nestedRow(D, T)?.building_loss_usd_vs_24h
                  return r ? `${fmt(r.median, 2)} (${fmt(r.min, 2)}–${fmt(r.max, 2)})` : '–'
                })])} />
              <Info>
                Every storm was built with the alternating-block method from one depth-duration curve, so each storm is the
                central part of the next longer one: the 48 h storm is the 24 h storm plus more rain on either side. Flood
                area, volume and losses then rise with duration in every catchment (shorter storms stay below 24 h, with at most{' '}
                {fmt(nested.max_share_deeper_than_24h_pct, 1)}% of the flooded area more than 5 cm deeper; 48 h exceeds 24 h
                everywhere). The result is fixed by the construction, not by the hydrology: it cannot show a critical duration.
                It also stacks thunderstorm peaks inside cyclone volumes, two mechanisms that do not occur together.
              </Info>
            </div>
          </div>
        </Card>
      )}

      <Card title="Design durations" subtitle="Chosen a priori from the storm types and the GPM record, then validated with flood runs.">
        <Table caption="Design and validation durations per storm type"
          head={['Storm type', 'Design duration', 'Validation durations', 'Basis']}
          rows={[
            ['Non-cyclone (thunderstorm)', `${cfg.nontc.duration_h} h`, d.validation_durations.nontc.map((x) => `${x} h`).join(', '),
              'Core under an hour plus a tail of a few hours; beyond about 3 h, rain is no longer part of the same thunderstorm. A larger catchment may need 6 h, when its response is slower than the storm.'],
            ['Cyclone', `${cfg.tc.duration_h} h`, d.validation_durations.tc.map((x) => `${x} h`).join(', '),
              `Recorded cyclone rain lasts 50–68 h without a break; the median cyclone event in GPM lasts ${fmt(ev.median, 0)} days. Moderate intensities make the flood depend on volume, so on the longest realistic duration.`],
            ['Non-cyclone multi-day series', 'not modelled', '–', 'Only described qualitatively, and only for the highlands; the 72 h cyclone storm covers the high-volume case.'],
          ]} />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 className="text-sm font-semibold text-ink">How long the largest cyclone events last (GPM, 1998–2025)</h3>
            <Chart option={lengthChart} height={260} label="Share of the largest cyclone events by number of consecutive days with at least 10 mm of cyclone rain" />
            <DataTable caption="Event length distribution" head={['Days', 'Share of events']}
              rows={lengthDays.map((k) => [k, pct(ev.share_by_days[k])])} />
          </div>
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Median event length" value={`${fmt(ev.median, 0)} days`} sub={`75th percentile ${fmt(ev.p75, 0)} d, 90th ${fmt(ev.p90, 0)} d`} />
              <Stat label="Events analysed" value={fmt(shares3.n_events)} sub="5 largest seasonal events per catchment" />
            </div>
            <Info>
              For every catchment, the five largest seasonal cyclone events (the 3-day windows behind the seasonal maxima) are
              pooled over the island. {pct(ev.share_by_days['3'])} last exactly 3 days, {pct(ev.share_by_days['2'])} two
              and {pct(ev.share_by_days['4'])} four. Split by day, the wettest day holds {pct(shares3.median[0])} of the
              3-day total, the second {pct(shares3.median[1])} and the third {pct(shares3.median[2])}. A fourth day adds
              about {pct(d.tc_day_shares.shares['4d'].median[3])} of a 4-day total (median), which is why 96 h is only a
              validation duration.
            </Info>
          </div>
        </div>
      </Card>

      <Card title="Design storm shapes"
        subtitle="One shape per storm type, with the depths from the law and the fitted multi-day depths. Pick a test catchment and a return period."
        actions={<div className="flex flex-wrap gap-2">
          <Segmented label="Return period" value={rp} onChange={setRp} options={[{ value: '10', label: '10-year' }, { value: '100', label: '100-year' }]} />
        </div>}>
        <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Test catchment">
          {d.catchments.map((x) => (
            <button key={x.basin_id} role="radio" aria-checked={x.basin_id === basin} onClick={() => setBasin(x.basin_id)}
              className={`rounded-md border px-2 py-1 text-xs ${x.basin_id === basin ? 'border-accent bg-accent text-white' : 'border-line text-ink-2 hover:text-ink'}`}>
              {x.slot}
            </button>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {(['nontc', 'tc'] as const).map((pop) => {
            const s = storm(pop, cfg[pop].duration_h, Number(rp))
            return (
              <div key={pop}>
                <h3 className="text-sm font-semibold text-ink">
                  {pop === 'nontc' ? `Non-cyclone thunderstorm, ${cfg.nontc.duration_h} h` : `Cyclone storm, ${cfg.tc.duration_h} h`}:{' '}
                  {fmt(s.depth_mm)} mm, peak {fmt(s.peak_mm_hr)} mm/h
                </h3>
                <Chart option={stormChart(pop)} height={260} label={`${rp}-year ${POP_LABEL[pop]} design storm for catchment ${basin}`} />
              </div>
            )
          })}
        </div>
        <p className="mt-1 text-xs text-ink-3">Catchment {c.basin_id} ({fmt(c.area_km2)} km²). Daily depth PJ, {rp}-year: non-cyclone {fmt(c.daily_depth_mm.nontc[rp])} mm, cyclone {fmt(c.daily_depth_mm.tc[rp])} mm.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Steps items={[
            { title: 'Non-cyclone: double triangle', body: <>The Desbordes double-triangle storm used in French urban drainage practice. The storm holds P({cfg.nontc.duration_h} h) from the law. An intense period of {fmt(cfg.nontc.intense_h * 60)} min holds P({fmt(cfg.nontc.intense_h, 1)} h) and is centred at {fmt(cfg.nontc.centre_frac * 100)}% of the storm, snapped to the {cfg.nontc.step_min}-min blocks: thunderstorms start abruptly. An outer triangle over the whole storm carries the background rain and an inner triangle over the intense period tops it up, so both depths are met exactly.</> },
            { title: 'Non-cyclone: soil moisture', body: <>Average antecedent conditions (GCN250 {cfg.nontc.gcn250_arc}).</> },
          ]} />
          <Steps items={[
            { title: 'Cyclone: daily split', body: <>The fitted 3-day cyclone depth is split by day with the median shares of the largest observed events ({pct(shares3.median[0])} / {pct(shares3.median[1])} / {pct(shares3.median[2])}). The wettest day sits in the middle, the second wettest before it.</> },
            { title: 'Cyclone: within the days', body: <>The wettest day is shaped with alternating blocks of the law (rainbands embed bursts in the main rain); the other days rain at a constant rate. {cfg.tc.step_min}-min blocks.</> },
            { title: 'Cyclone: soil moisture', body: <>Wet antecedent conditions (GCN250 {cfg.tc.gcn250_arc}): long cyclone rain brings soils near saturation.</> },
          ]} />
        </div>
      </Card>

      <Card title="Intensity checks" subtitle={`Design peak intensities of the ${d.catchments.length} test catchments against the intensities recorded in Madagascar (${REPORT}).`}>
        <Table caption="Peak intensities of the design storms per test catchment"
          head={['Catchment', 'Non-cyclone 3 h, 10-min peak (10 / 100-yr, mm/h)', 'Cyclone 72 h, 30-min peak (10 / 100-yr, mm/h)', 'Cyclone wettest day ÷ 24 h design depth (100-yr)']}
          rows={d.catchments.map((x) => {
            const n10 = x.storms.find((s) => s.population === 'nontc' && s.duration_h === cfg.nontc.duration_h && s.rp === 10)!
            const n100 = x.storms.find((s) => s.population === 'nontc' && s.duration_h === cfg.nontc.duration_h && s.rp === 100)!
            const t10 = x.storms.find((s) => s.population === 'tc' && s.duration_h === cfg.tc.duration_h && s.rp === 10)!
            const t100 = x.storms.find((s) => s.population === 'tc' && s.duration_h === cfg.tc.duration_h && s.rp === 100)!
            const flag = (v: number) => `${fmt(v)}${v > cap ? ' ▲' : ''}`
            return [x.slot, `${fmt(n10.peak_mm_hr)} / ${fmt(n100.peak_mm_hr)}`, `${flag(t10.peak_mm_hr)} / ${flag(t100.peak_mm_hr)}`,
              fmt(t100.wettest_day_over_24h ?? 0, 2)]
          })} />
        <p className="mt-1 text-xs text-ink-3">▲ above {cap} mm/h, the highest cyclone intensity recorded by ORSTOM.</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <Info>
            <b>Thunderstorms.</b> The 10-min peaks are of the order of the recorded thunderstorm cores (80–100 mm/h, 5-min bursts of
            200 mm/h and more) and below the 100-year intensities at a single gauge in Antananarivo (Tsimbazaza: 260 mm/h over 15
            min, 124 mm/h over 1 h). Lower values are expected: the design depths are catchment averages, not point rainfall.
          </Info>
          <Info>
            <b>Cyclones.</b> The wettest day always stays below the 24 h design depth of the same return period (ratio below 1),
            so the 72 h storm never contains a day rarer than the storm itself. Its 30-min peak follows the Antananarivo law,
            fitted on storms that are mostly thunderstorms, and exceeds the {cap} mm/h recorded in cyclones at 100 years in some
            catchments. This is kept on purpose: it errs on the safe side, the recorded ceiling rests on two events, and cyclone
            floods depend mostly on volume. The validation runs show whether the peak matters.
          </Info>
        </div>
      </Card>

      <Card title="Validation of the design durations" subtitle="Planned: flood runs over a range of durations per storm type, before the national runs.">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Steps items={[
            { title: 'Runs', body: <>The {d.catchments.length - 2} test catchments of the first test (the two largest, about 750 km², follow on cloud machines), at 10 and 100 years: non-cyclone storms of {d.validation_durations.nontc.join(', ')} h on average soils and cyclone storms of {d.validation_durations.tc.join(', ')} h on wet soils, with the shapes above. Each run continues 12 h after the rain.</> },
            { title: 'Critical duration', body: <>For each storm type, the maximum depth of every cell over all its durations (the envelope), and the duration that produces it.</> },
            { title: 'Acceptance', body: <>A design duration is kept when its flood map reproduces the envelope: depth within 5 cm on at least 99% of the flooded area and at least 99% of the envelope's building loss. Otherwise the duration closing the gap is added, or the duration is tied to catchment properties (time of concentration, area, slope, closed basins) so that it carries over to the catchments not tested.</> },
            { title: 'Peak sensitivity', body: <>The cyclone runs also show whether the 30-min peak above {cap} mm/h changes the flood maps.</> },
          ]} />
          <div>
            {rc && (
              <>
                <h3 className="text-sm font-semibold text-ink">Already checked: the cyclone attribution radius</h3>
                <Info>
                  Re-running the split with {rc.radius_tested_km} km instead of {rc.radius_adopted_km} km leaves the total design depth
                  unchanged (100-year depth within 5% in {pct(rc.depth_ratio_tested_over_adopted.total_rp100.share_within_5pct)} of
                  catchments) and lowers the cyclone share of rainfall from {pct(rc.tc_share_of_rainfall_island_mean[`${rc.radius_adopted_km}km`])} to{' '}
                  {pct(rc.tc_share_of_rainfall_island_mean[`${rc.radius_tested_km}km`])}. But the 100-year non-cyclone depth rises by
                  more than 10% in {fmt(rc.outer_band_check.catchments_nontc_rp100_up_more_than_10pct)} of{' '}
                  {fmt(rc.outer_band_check.n_catchments)} catchments, mostly in the east, and there{' '}
                  {pct(rc.outer_band_check.top3_nontc_maxima_on_tc_days_at_adopted_radius.those_catchments)} of the three largest
                  non-cyclone seasonal maxima fall on days with a storm {rc.radius_tested_km}–{rc.radius_adopted_km} km away (against{' '}
                  {pct(rc.outer_band_check.top3_nontc_maxima_on_tc_days_at_adopted_radius.other_catchments)} elsewhere): outer-band
                  cyclone rain that the smaller radius would count as non-cyclone. {rc.radius_adopted_km} km keeps the non-cyclone
                  population, and so the thunderstorm design storm, free of it.
                </Info>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
