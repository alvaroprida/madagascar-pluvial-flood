/** Chapter 7 of the Rainfall tab: validation of the GPM IMERG daily record against rain gauges
 *  (gpm_validation.json and figures/gpmval_*.png, from scripts/gpm_station_validation.py). */
import { useEffect, useState, type ReactNode } from 'react'
import { dataUrl } from '../data'
import { fmt } from '../format'
import { Card, Figure, Info, Ref, Stat, Steps } from './ui'

interface Ratio { n: number; obs_mean: number; gpm_mean: number; bias_pct: number; ratio_median: number; ratio_p25: number;
  ratio_p75: number; mae_pct: number; rmse: number; r: number; within_20pct: number }
interface E1Station { station: string; n_days: number; years_with_data: number; obs_mean: number; gpm_mean: number;
  bias_pct: number; rmse: number; r_daily: number; r_monthly: number | null; n_months: number; q99_obs: number; q99_gpm: number;
  wetday_freq_obs: number; wetday_freq_gpm: number; [k: string]: number | string | null }
interface Basin { river: string; gauge: string; status: string; area_km2: number; obs_annual: number; gpm_annual: number;
  ratio: number; r_monthly: number; nse_monthly: number; region: string }
interface RegionSeason { n: number; median_r: number; median_mad_pp: number; dry_season_ratio: number }
interface Validation {
  gpm: { product: string; start: string; end: string; full_years: number[] }
  e0: { n_register: number; n_located: number; ncei_days_1998_2025: Record<string, number>; kinds: Record<string, number> }
  e1: { lag_days: number; pooled_r_by_lag: Record<string, number>; stations: E1Station[]; pooled: Ratio }
  e2: { summary: (Ratio & { group: string })[]; n_stations: number }
  e3: { summary: { all_ok: Ratio; n_ok: number; n_flagged: number; median_r_monthly: number; median_nse_monthly: number;
    monthly_ratio_median: Record<string, number> }; basins: Basin[] }
  e4: { summary: { median_r: number; median_mad_pp: number; same_wettest_month: number; wet_share_bias_pp: number;
    by_region: Record<string, RegionSeason> } }
  e5: { ncei_ams: { n: number; pixel: Ratio; block3x3: Ratio; gpm_on_obs_day_median_ratio: number }
    exceedance: { threshold_mm: number; n_stations: number; events_per_station_year_obs: number;
      events_per_station_year_gpm: number; events_per_station_year_gpm_3x3: number }
    records: { pixel: Ratio; block3x3: Ratio; by_region: Record<string, Ratio>;
      top: { table: string; station: string; region: string; record_mm: number; gpm_max_pixel: number; gpm_max_3x3: number }[] }
    arf_expected: number }
  e6: { multiday: { station: string; year: number; days: number; obs_mm: number; gpm_max_pixel: number; gpm_max_3x3: number; gpm_date: string }[]
    multiday_ratio: Ratio
    envelope: { k: number[]; episodes_max: number[]; envelope: number[]; gpm_max: number[]; gpm_max_rectangle: number[];
      n_cells: number; pixel_years: number; n_cells_rectangle: number; station_years_obs: number } }
  e7: { summary: { n: number; k3_ratio_median: number; cv_ratio_median: number; r_k3: number; r_cv: number;
    r_k3_vs_p_obs: number; r_k3_vs_p_gpm: number } }
  e8: { summary: { n_files: number; n_stations: number; i60_ratio_median: number; shape_ratio_gpm_median: number;
    shape_ratio_idf_median: number } }
}

const pct = (v: number, d = 0) => `${fmt(v * 100, d)}%`
const sgn = (v: number, d = 0) => `${v > 0 ? '+' : ''}${fmt(v, d)}%`
const r2 = (v: number | null | undefined) => (v == null ? '–' : v.toFixed(2))
const fig = (f: string) => dataUrl(`figures/${f}`)

function Table({ head, rows, caption }: { head: string[]; rows: ReactNode[][]; caption: string }) {
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

function Section({ id, ...card }: { id: string } & Parameters<typeof Card>[0]) {
  return <div id={id} className="scroll-mt-4"><Card {...card} /></div>
}

/** The four parts of every comparison: what, how it is measured, what comes out, what it means. */
function Parts({ compared, metrics, results, conclusion }: { compared: ReactNode; metrics: ReactNode; results: ReactNode; conclusion: ReactNode }) {
  const P = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="text-sm leading-relaxed text-ink-2"><h3 className="mb-1 text-sm font-semibold text-ink">{label}</h3>{children}</div>
  )
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <P label="What is compared">{compared}</P>
      <P label="Metrics">{metrics}</P>
      <P label="Results">{results}</P>
      <div className="rounded-lg border border-accent/40 bg-banner p-3"><P label="Conclusion">{conclusion}</P></div>
    </div>
  )
}

function Verdict({ v }: { v: 'good' | 'fair' | 'poor' }) {
  const s = { good: ['Good', 'bg-emerald-100 text-emerald-900'], fair: ['Fair, with known biases', 'bg-amber-100 text-amber-900'],
    poor: ['Poor', 'bg-red-100 text-red-900'] }[v]
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${s[1]}`}>{s[0]}</span>
}

export function useValidation() {
  const [v, setV] = useState<Validation>()
  useEffect(() => { fetch(dataUrl('gpm_validation.json')).then((r) => r.json()).then(setV) }, [])
  return v
}

export function GpmValidation() {
  const v = useValidation()
  if (!v) return <p className="text-sm text-ink-3">Loading…</p>
  const g = (name: string) => v.e2.summary.find((s) => s.group.startsWith(name))!
  const e1 = v.e1.stations
  const east1 = e1.filter((s) => ['Toamasina', 'Mananjary', 'Taolagnaro'].includes(s.station))
  const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
  const okBasins = v.e3.basins.filter((b) => b.status === 'ok')
  const eastBasins = okBasins.filter((b) => b.region === 'East')
  const mr = v.e3.summary.monthly_ratio_median
  const env = v.e6.envelope
  const k = (d: number) => env.k.indexOf(d)
  const sr = v.e4.summary.by_region

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------------- 7.1 datasets */}
      <Section id="s7-1" title="7.1 Rain-gauge data available" subtitle="Three sources, geolocated and merged into one station register.">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Figure src={fig('gpmval_e0_datasets.png')} alt="Map of the rain gauges by dataset and NCEI days with data per year"
            caption="Left: stations by dataset (grey: located from a gazetteer, approximate). Right: days with data per year at the seven NCEI stations over the GPM period." />
          <div>
            <Table caption="Rain-gauge datasets"
              head={['Dataset', 'Content', 'Period', 'Use here']}
              rows={[
                ['NCEI GHCN-Daily', '7 synoptic stations, daily rainfall', '1973–2025', 'Only data overlapping GPM: day-by-day comparison (7.3), annual maxima (7.7)'],
                ['SIEREM (HSM)', '13 WMO stations (monthly) and a list of 560 stations with coordinates', '1881–2000', 'Station coordinates'],
                ['ORSTOM/IRD 1993, ch. 2 §7', 'Station means (~340), annual quantiles (35), monthly means (40), Thiessen basin means (38), 24 h records and lists, multi-day cyclone totals, IDF curves, recorded storms', 'mostly 1930–1970', 'Climatological comparisons (7.4–7.10)'],
                ['GPM IMERG V07B Final', 'Daily, 0.1° (~11 km); half-hourly on 460 heavy-rain days', `${v.gpm.start.slice(0, 4)}–${v.gpm.end.slice(0, 7)}`, 'Record under test'],
              ]} />
            <Info>
              {fmt(v.e0.n_located)} of {fmt(v.e0.n_register)} stations are located: from NCEI or SIEREM coordinates where the name
              matches, otherwise from the GeoNames gazetteer (town or commune centre, a few km uncertain, {fmt(v.e0.kinds['ORSTOM station, gazetteer location'])} stations).
              Names matching several places are left out.
            </Info>
            <Info>
              <b className="text-ink">Two caveats run through the chapter.</b> (1) Except for NCEI, the gauge data <b>predate GPM</b> by
              30–60 years: they are compared as climatologies (means, regimes, frequencies), not day by day, and part of any difference may
              be climate change or network change. (2) A gauge measures a <b>point</b>, a GPM cell the <b>average of ~120 km²</b>:
              cell averages are smoother, so cell extremes are expected about 10% lower than point extremes even with no error.
            </Info>
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- 7.2 metrics */}
      <Section id="s7-2" title="7.2 How GPM is compared" subtitle="Standard validation metrics; GPM is always the estimate and the gauge the reference.">
        <Table caption="Validation metrics"
          head={['Metric', 'Definition', 'Perfect value', 'Reads as']}
          rows={[
            ['Ratio GPM / gauge', 'GPM value divided by the gauge value; median over stations', '1', '0.8 = GPM 20% lower'],
            ['Relative bias', 'Σ GPM / Σ gauge − 1', '0%', 'Systematic over- or underestimation'],
            ['MAE (%)', 'Mean of |ratio − 1|', '0%', 'Typical error at one station'],
            ['Pearson r', 'Correlation of paired values (days, months, stations)', '1', 'Timing (daily) or spatial pattern (across stations)'],
            ['RMSE', '√ mean (GPM − gauge)²', '0 mm', 'Error size in mm'],
            ['NSE', '1 − Σ(GPM − obs)² / Σ(obs − mean obs)², over the 12 monthly means', '1', '> 0.75 very good, < 0.5 poor'],
            ['POD, FAR, CSI', 'Hits / observed events; false alarms / GPM events; hits / (hits + misses + false alarms), for days above a threshold', '1, 0, 1', 'Does GPM detect rain days?'],
            ['Frequency bias', 'GPM events / observed events', '1', '< 1: GPM gives too few such days'],
            ['K3, CV', 'Wet 10-year / dry 10-year annual rainfall; standard deviation / mean', 'Same as gauge', 'Year-to-year variability'],
          ]} />
        <Info>
          Each gauge is compared with the GPM cell that contains it. Gauge days end at 06 UTC and GPM days at 24 UTC: the daily correlation is
          {' '}{r2(v.e1.pooled_r_by_lag['0'])} with GPM on the same date and {r2(v.e1.pooled_r_by_lag['1'])} with GPM one day earlier, so each gauge
          day is paired with the previous GPM day.
        </Info>
      </Section>

      {/* ---------------------------------------------------------------- 7.3 E1 daily */}
      <Section id="s7-3" title="7.3 Day by day at the NCEI stations (1998–2025)" subtitle="The only comparison where gauge and GPM cover the same days.">
        <Figure src={fig('gpmval_e1_daily.png')} alt="Quantile-quantile plots of daily rainfall at seven stations and detection scores"
          caption="Quantile-quantile plots: each curve ranks gauge and GPM days separately and plots equal percentiles (50th to 99.9th); on the 1:1 line the two distributions match. Dotted lines: ±20%." />
        <Table caption="Daily comparison per station"
          head={['Station', 'Paired days', 'Bias', 'r daily', 'r monthly', 'POD ≥1 mm', 'FAR ≥1 mm', 'CSI ≥10 mm', 'Freq. bias ≥50 mm', '99th pct gauge / GPM']}
          rows={e1.map((s) => [s.station.replace('/Ivato', ' (Ivato)'), fmt(s.n_days), sgn(s.bias_pct), r2(s.r_daily),
            s.n_months ? `${r2(s.r_monthly)} (${s.n_months})` : '–', r2(s.pod_1 as number), r2(s.far_1 as number), r2(s.csi_10 as number),
            r2(s.fbi_50 as number), `${fmt(s.q99_obs)} / ${fmt(s.q99_gpm)} mm`])} />
        <div className="mt-4">
          <Parts
            compared={<>Daily gauge rainfall at the 7 NCEI stations against the GPM cell, on every day both report ({fmt(v.e1.pooled.n)} days).
              Monthly totals only for months with at least 25 reported days.</>}
            metrics={<>Relative bias, daily and monthly correlation, and detection scores for days above 1, 10 and 50 mm. The 99th percentile
              compares the heavy end of the distributions.</>}
            results={<>
              Daily correlation is {r2(med(e1.map((s) => s.r_daily)))} (median), typical of satellite rainfall at a point; monthly
              correlation is high (0.85–0.99). Bias depends on the coast: about {sgn(med(east1.map((s) => s.bias_pct)))} at the three
              east-coast stations (Toamasina, Mananjary, Taolagnaro), within ±10% at Antsiranana, Analalava and Ivato, and +20% at Toliara.
              GPM detects most rain days (POD ≥1 mm {r2(med(e1.map((s) => s.pod_1 as number)))}) but only a third of days above 50 mm
              (POD {r2(med(e1.map((s) => s.pod_50 as number)))}), and gives fewer such days than the gauges at all east-coast stations
              (frequency bias {r2(med(east1.map((s) => s.fbi_50 as number)))}).
            </>}
            conclusion={<>
              GPM captures <b>when</b> it rains well at the monthly scale and fairly at the daily scale, but on the <b>east coast it
              misses about 40% of the rain</b> and most very wet days. Caveat: dry days are largely missing from the NCEI series (mean on reported days{" "}
              {fmt(Math.min(...e1.map((s) => s.obs_mean)))}–{fmt(Math.max(...e1.map((s) => s.obs_mean)))} mm/day, up to four times the
              climatological daily mean), so these scores are conditional on reported days, false alarms are undercounted, and annual
              totals cannot be computed from NCEI.
            </>} />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- 7.4 E2 annual */}
      <Section id="s7-4" title="7.4 Mean annual rainfall" subtitle={`${fmt(v.e2.n_stations)} ORSTOM station means against the GPM 1998–2024 mean.`}>
        <Figure src={fig('gpmval_e2_annual.png')} alt="GPM mean annual rainfall map, map of GPM/station ratios and scatter plot"
          caption="Middle: red = GPM drier than the station, blue = GPM wetter. Right: dotted lines ±20%; regions as labelled on the map." />
        <Table caption="Mean annual rainfall: GPM against stations"
          head={['Group', 'Stations', 'Median ratio (25–75%)', 'Bias', 'MAE', 'r', 'Within ±20%']}
          rows={v.e2.summary.map((s) => [s.group, fmt(s.n), `${r2(s.ratio_median)} (${r2(s.ratio_p25)}–${r2(s.ratio_p75)})`,
            sgn(s.bias_pct), `${fmt(s.mae_pct)}%`, r2(s.r), pct(s.within_20pct)])} />
        <div className="mt-4">
          <Parts
            compared={<>The long-term mean annual rainfall of each ORSTOM station (map of isohyets, 1993) against the 1998–2024 GPM mean of its
              cell; also the median of the 35 long records (40–90 years).</>}
            metrics={<>Ratio GPM / station, bias, MAE, spatial correlation across stations, share within ±20%; split by region, by rainfall
              amount, and by how the station was located.</>}
            results={<>
              Over all stations GPM is unbiased in the median (ratio {r2(g('All').ratio_median)}, {pct(g('All').within_20pct)} of stations
              within ±20%) and reproduces the spatial pattern (r = {r2(g('All').r)}). The error depends on the amount: GPM is
              {' '}{sgn(g('Station rainfall < 800').bias_pct)} at stations below 800 mm/yr and {sgn(g('Station rainfall > 2500').bias_pct)}
              {' '}above 2500 mm/yr; by region, the East is {sgn(g('Region: East').bias_pct)} while the Highlands, West and North are within
              ±7%. Stations located from the gazetteer give the same results as the others, so location uncertainty does not drive the result.
            </>}
            conclusion={<>
              GPM <b>compresses the rainfall gradient</b>: the windward east coast and escarpment (2000–4000 mm) are underestimated by
              20–40%, the dry south-west slightly overestimated, and the highlands and west, where most of the domain lies, are well
              represented. This is the known behaviour of satellite rainfall over orographic, shallow warm rain.
            </>} />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- 7.5 E3 basins */}
      <Section id="s7-5" title="7.5 Basin-average rainfall" subtitle="ORSTOM Thiessen basin means against GPM averaged over the same basins.">
        <Figure src={fig('gpmval_e3_basins.png')} alt="Map of gauged basins coloured by GPM/ORSTOM ratio, scatter of annual means and monthly ratio box plots"
          caption="Basins are delineated from the gauge location with HydroBASINS level 10. Boxes: spread of the GPM / ORSTOM monthly ratio across basins." />
        <div className="grid gap-4 lg:grid-cols-4">
          <Stat label="Basins compared" value={fmt(v.e3.summary.n_ok)} sub={`${v.e3.summary.n_flagged} flagged (rounded coordinates)`} />
          <Stat label="Median annual ratio" value={r2(v.e3.summary.all_ok.ratio_median)} sub={`bias ${sgn(v.e3.summary.all_ok.bias_pct)}`} />
          <Stat label="Monthly correlation" value={r2(v.e3.summary.median_r_monthly)} sub="median over basins" />
          <Stat label="Monthly NSE" value={r2(v.e3.summary.median_nse_monthly)} sub="median over basins" />
        </div>
        <div className="mt-4">
          <Parts
            compared={<>Monthly mean basin rainfall computed by ORSTOM with Thiessen polygons (1945–1970) for 38 gauged basins, against the
              1998–2024 GPM mean over the basin upstream of the gauge. Basin areas check out against known values (Betsiboka at
              Ambodiroka 11 800 km², Ikopa at Antsatrana 18 400 km², Mangoky at Banian 52 900 km²); 5 basins with coordinates rounded to
              0.5° or a shared gauge location are left out of the statistics.</>}
            metrics={<>Annual ratio and bias; correlation and NSE of the 12 monthly means; monthly ratio across basins.</>}
            results={<>
              Basin totals agree well: median ratio {r2(v.e3.summary.all_ok.ratio_median)}, {pct(v.e3.summary.all_ok.within_20pct)} within
              ±20%, seasonal cycle almost perfect (NSE {r2(v.e3.summary.median_nse_monthly)}). Highland and western basins (Ikopa,
              Betsiboka, Mangoky, Tsiribihina) mostly lie within ±10%; the {eastBasins.length} east-coast basins are
              {' '}{fmt(Math.min(...eastBasins.map((b) => b.ratio)), 2)}–{fmt(Math.max(...eastBasins.map((b) => b.ratio)), 2)}.
              By month, GPM is close from November to May (Dec {r2(mr.Dec)}, Jan {r2(mr.Jan)}, Mar {r2(mr.Mar)}) and low from June to
              September ({r2(mr.Jun)}–{r2(mr.Aug)}).
            </>}
            conclusion={<>
              At the catchment scale used by the flood model, GPM rainfall is <b>reliable in the rainy season and outside the east
              coast</b>. ORSTOM itself warns that its east-coast basin means are indices biased low (gauges in valleys), so the true
              east-coast deficit of GPM is probably larger than shown here.
            </>} />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- 7.6 E4 seasonal */}
      <Section id="s7-6" title="7.6 Seasonal regime" subtitle="Share of the annual rainfall falling in each month.">
        <Figure src={fig('gpmval_e4_seasonal.png')} alt="Heat map of monthly GPM/station ratios and monthly profiles at six stations"
          caption="Left: GPM / station monthly rainfall (red: GPM lower), stations ordered by region. Right: monthly share of the annual total, station bars and GPM line." />
        <Table caption="Seasonal regime by region"
          head={['Region', 'Stations', 'r of 12-month profile', 'Mean share difference', 'GPM / station, May–Oct']}
          rows={Object.entries(sr).map(([k, s]) => [k, s.n, r2(s.median_r), `${fmt(s.median_mad_pp, 1)} pts`, r2(s.dry_season_ratio)])} />
        <div className="mt-4">
          <Parts
            compared={<>Mean monthly rainfall at 30 ORSTOM stations (1930–1970), as a share of the annual total, against GPM 1998–2024.</>}
            metrics={<>Correlation of the 12-month profiles, mean absolute difference of monthly shares (percentage points), wettest month, and the
              GPM / station ratio in the dry season.</>}
            results={<>
              The profiles match (median r {r2(v.e4.summary.median_r)}, shares within {fmt(v.e4.summary.median_mad_pp, 1)} points, same
              wettest month at {pct(v.e4.summary.same_wettest_month)} of stations). The exception is the dry season on the east coast, where
              GPM gives about half of the observed May–October rain ({r2(sr.East?.dry_season_ratio ?? NaN)}): the trade-wind showers of the
              austral winter are shallow, warm rain that satellite sensors detect poorly.
            </>}
            conclusion={<>
              The <b>timing of the rainy season is right everywhere</b>. The east-coast winter rain deficit matters little for the design
              storms, which come from the cyclone season, but it lowers the east-coast annual totals of 7.4.
            </>} />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- 7.7 E5 extremes */}
      <Section id="s7-7" title="7.7 Daily extremes" subtitle="The part of the record the design rainfall depends on.">
        <Figure src={fig('gpmval_e5_extremes.png')} alt="Scatter of annual maxima, bar chart of exceedance frequencies, scatter of 24 h records"
          caption={`(a) dashed: GPM = ${v.e5.arf_expected} × gauge, the expected cell-average reduction. (b) ORSTOM lists of 24 h rainfalls (table 2.13). (c) largest 24 h value per station (tables 2.13–2.16) against the largest GPM day of 1998–2025.`} />
        <Table caption="Daily extremes: GPM against gauges"
          head={['Comparison', 'n', 'Median ratio GPM / gauge', 'Bias', 'r']}
          rows={[
            ['Annual maxima, NCEI (same years), GPM cell', v.e5.ncei_ams.n, r2(v.e5.ncei_ams.pixel.ratio_median), sgn(v.e5.ncei_ams.pixel.bias_pct), r2(v.e5.ncei_ams.pixel.r)],
            ['Annual maxima, NCEI, wettest of 3×3 cells', v.e5.ncei_ams.n, r2(v.e5.ncei_ams.block3x3.ratio_median), sgn(v.e5.ncei_ams.block3x3.bias_pct), r2(v.e5.ncei_ams.block3x3.r)],
            ['24 h records (30–70 yr) vs GPM maximum (28 yr)', v.e5.records.pixel.n, r2(v.e5.records.pixel.ratio_median), sgn(v.e5.records.pixel.bias_pct), r2(v.e5.records.pixel.r)],
            ...Object.entries(v.e5.records.by_region).map(([k, s]) => [`   records, ${k}`, s.n, r2(s.ratio_median), sgn(s.bias_pct), r2(s.r)]),
          ]} />
        <div className="mt-4">
          <Parts
            compared={<>(a) The largest day of each year at NCEI stations against the largest GPM day of the same year ({v.e5.ncei_ams.n}
              station-years with at least 100 reported wet-season days). (b) How often a day exceeds {v.e5.exceedance.threshold_mm} mm
              at {v.e5.exceedance.n_stations} highland and western stations (ORSTOM lists, 1930–1965) and in GPM. (c) Station 24 h
              records against the largest GPM day at the same cell.</>}
            metrics={<>Ratio and bias of maxima, correlation across station-years; exceedances per year. The reference value for an unbiased
              GPM is a ratio of about {v.e5.arf_expected} (cell average against a point), and below that for the records, which
              span longer periods than GPM.</>}
            results={<>
              Annual maxima: median ratio {r2(v.e5.ncei_ams.pixel.ratio_median)} at the cell and {r2(v.e5.ncei_ams.block3x3.ratio_median)}
              {' '}for the wettest neighbouring cell, correlation {r2(v.e5.ncei_ams.pixel.r)}: GPM catches the heavy years. Exceedances
              of {v.e5.exceedance.threshold_mm} mm: {fmt(v.e5.exceedance.events_per_station_year_obs, 2)} days per station-year in the
              gauges against {fmt(v.e5.exceedance.events_per_station_year_gpm, 2)} in GPM. Records: median ratio
              {' '}{r2(v.e5.records.pixel.ratio_median)}, near 1 in the highlands and west, lower on the east coast
              ({r2(v.e5.records.by_region.East?.ratio_median)}) and in the south ({r2(v.e5.records.by_region.South?.ratio_median)}). The
              largest east-coast records (Vatomandry 543 mm, Mahanoro 453 mm) are 30–40% above anything GPM shows there.
            </>}
            conclusion={<>
              In the highlands and the west, <b>GPM daily extremes are at the level expected from a ~10 km cell</b> (ratios 0.85–1.0)
              and as frequent as in the gauge record. On the east coast and in the south they are about 15–25% lower than the gauges.
              Design depths there are therefore conservative estimates for a cell average, but not for a point.
            </>} />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- 7.8 E6 multi-day */}
      <Section id="s7-8" title="7.8 Multi-day cyclone rainfall" subtitle="Rain accumulated over 2–15 days, which drives cyclone floods.">
        <Figure src={fig('gpmval_e6_multiday.png')} alt="Depth-duration curves near Tsiazompaniry and bar chart of historical multi-day totals against GPM"
          caption={`(a) Highest k-day total: the 9 intense episodes found in ${fmt(env.station_years_obs)} station-years around Tsiazompaniry (EDF/ORSTOM 1963), their +10% envelope, and GPM at the ${env.n_cells} station cells (${fmt(env.pixel_years)} cell-years) and over all ${env.n_cells_rectangle} cells of the study area. (b) Multi-day totals of 1956–1959 cyclones against the GPM 1998–2025 maximum of the same duration.`} />
        <div className="mt-4">
          <Parts
            compared={<>Two historical sources: the 15-day envelope hyetograph built for the Tsiazompaniry reservoir (highlands) from 9 intense
              episodes, and multi-day cyclone totals of 1956–1959 at 6 stations. Both against the largest GPM running totals of the same
              duration over 1998–2025.</>}
            metrics={<>Maximum k-day depth (k = 1–15 days) and the ratio GPM / observed for the cyclone totals.</>}
            results={<>
              Around Tsiazompaniry the largest single day is similar ({fmt(env.episodes_max[0])} mm observed, {fmt(env.gpm_max[0])} mm in
              GPM, ratio {r2(env.gpm_max[0] / env.episodes_max[0])}), but the gap widens with duration: {fmt(env.episodes_max[k(5)])} against
              {' '}{fmt(env.gpm_max[k(5)])} mm over 5 days and {fmt(env.episodes_max[k(15)])} against {fmt(env.gpm_max[k(15)])} mm over 15
              days (ratio {r2(env.gpm_max[k(15)] / env.episodes_max[k(15)])}). Even the whole study area (~{fmt(env.n_cells_rectangle)}
              cells) stays below the observed 15-day maximum. The six 1956–1959 cyclone totals are met or exceeded by GPM at three stations
              and not at the others (median ratio {r2(v.e6.multiday_ratio.ratio_median)}).
            </>}
            conclusion={<>
              GPM reproduces single-day highland extremes but the <b>wettest multi-day sequences of the past (e.g. January 1948, March 1959)
              have no equal in 1998–2025</b>. This may be partly chance (28 years against ~500 station-years) and partly underestimation of
              long, moderate-intensity cyclonic rain. The 2–4 day cyclone design depths should therefore be checked against these historical
              totals.
            </>} />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- 7.9 E7 interannual */}
      <Section id="s7-9" title="7.9 Year-to-year variability" subtitle="Does GPM vary from year to year as much as the long gauge records?">
        <Figure src={fig('gpmval_e7_interannual.png')} alt="Scatter plots of K3 and coefficient of variation, stations against GPM"
          caption="Station values from the ORSTOM annual quantiles (40–90 years); GPM from 27 annual totals." />
        <div className="mt-4">
          <Parts
            compared={<>Spread of annual rainfall at the 35 long-record stations (ORSTOM table 2.7) against the 1998–2024 GPM annual totals of
              their cells.</>}
            metrics={<>K3 = 10-year wet / 10-year dry annual rainfall (ORSTOM's index) and the coefficient of variation; their ratio GPM / gauge
              and their correlation across stations.</>}
            results={<>
              GPM variability is slightly lower (K3 ratio {r2(v.e7.summary.k3_ratio_median)}, CV ratio {r2(v.e7.summary.cv_ratio_median)})
              and follows the station pattern (r = {r2(v.e7.summary.r_k3)} for K3, {r2(v.e7.summary.r_cv)} for CV), including the rise of
              variability towards the dry south-west noted by ORSTOM (K3 against rainfall: r = {r2(v.e7.summary.r_k3_vs_p_obs)} in the
              gauges, {r2(v.e7.summary.r_k3_vs_p_gpm)} in GPM).
            </>}
            conclusion={<>Interannual variability is <b>well represented</b>; the slightly lower GPM spread is expected from a shorter record and
              cell averaging.</>} />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- 7.10 E8 sub-daily */}
      <Section id="s7-10" title="7.10 Sub-daily intensities" subtitle="Half-hourly IMERG on the heavy-rain days of section 3.2, against gauge IDF curves.">
        <Figure src={fig('gpmval_e8_subdaily.png')} alt="Bar charts of hourly intensity and storm peakedness, gauges against IMERG"
          caption="(a) 1-year 60-min intensity of the gauge IDF curves (BCEOM 1967, ORSTOM) against the highest 60-min IMERG intensity over the sampled days. (b) Depth of the wettest hour over that of the wettest 3 hours; 1/3 means rain spread evenly over the 3 hours." />
        <div className="mt-4">
          <Parts
            compared={<>Intensity–duration–frequency curves of {v.e8.summary.n_stations} stations (5 min – 3 h) against half-hourly IMERG at the
              same cells on the {v.e8.summary.n_files} heavy-rain days downloaded for section 3.2.</>}
            metrics={<>Peak 60-min intensity, and the share of the wettest 3 hours that falls in the wettest hour (peakedness).</>}
            results={<>
              The highest IMERG hourly intensity found on all these days only reaches the gauge 1-year value (median ratio
              {' '}{r2(v.e8.summary.i60_ratio_median)}). In IMERG the wettest hour holds {pct(v.e8.summary.shape_ratio_gpm_median)} of the
              wettest 3 hours, against {pct(v.e8.summary.shape_ratio_idf_median)} in the gauge curves: IMERG spreads the burst of a
              storm over 2–3 hours.
            </>}
            conclusion={<>
              IMERG <b>cannot be used for intensities below about 3 hours</b>. This confirms the choice of section 4.2: sub-daily depths come
              from the gauge-based depth-duration law, GPM only supplies the daily depth.
            </>} />
        </div>
      </Section>

      {/* ---------------------------------------------------------------- 7.11 conclusion */}
      <Section id="s7-11" title="7.11 Overall assessment" subtitle="How well does GPM IMERG represent the rainfall measured at Madagascar's gauges?">
        <Table caption="Scorecard"
          head={['Aspect', 'Key result', 'Assessment']}
          rows={[
            ['Spatial pattern of annual rainfall', `r = ${r2(g('All').r)}; median ratio ${r2(g('All').ratio_median)}; ${pct(g('All').within_20pct)} within ±20%`, <Verdict key="a" v="good" />],
            ['Basin-average rainfall (highlands, west, north)', `median ratio ${r2(v.e3.summary.all_ok.ratio_median)}; monthly NSE ${r2(v.e3.summary.median_nse_monthly)}`, <Verdict key="b" v="good" />],
            ['Seasonal cycle', `profile r ${r2(v.e4.summary.median_r)}`, <Verdict key="c" v="good" />],
            ['Interannual variability', `K3 ratio ${r2(v.e7.summary.k3_ratio_median)}, r ${r2(v.e7.summary.r_k3)}`, <Verdict key="d" v="good" />],
            ['Daily timing and detection', `r daily ${r2(med(e1.map((s) => s.r_daily)))}, monthly 0.85–0.99; POD ≥50 mm ${r2(med(e1.map((s) => s.pod_50 as number)))}`, <Verdict key="e" v="fair" />],
            ['East coast and escarpment totals', `annual ${sgn(g('Region: East').bias_pct)}; NCEI east-coast stations ${sgn(med(east1.map((s) => s.bias_pct)))}; dry season ×${r2(sr.East?.dry_season_ratio)}`, <Verdict key="f" v="poor" />],
            ['Daily extremes, highlands and west', `records ratio ${r2(v.e5.records.by_region.Highlands?.ratio_median)}–${r2(v.e5.records.by_region.West?.ratio_median)}; annual maxima ${r2(v.e5.ncei_ams.pixel.ratio_median)}`, <Verdict key="g" v="good" />],
            ['Daily extremes, east coast and south', `records ratio ${r2(v.e5.records.by_region.East?.ratio_median)} and ${r2(v.e5.records.by_region.South?.ratio_median)}`, <Verdict key="h" v="fair" />],
            ['Multi-day (5–15 day) maxima', `15-day ${r2(env.gpm_max[k(15)] / env.episodes_max[k(15)])} of the historical maximum`, <Verdict key="i" v="fair" />],
            ['Sub-daily intensities', `hourly peak share ${pct(v.e8.summary.shape_ratio_gpm_median)} vs ${pct(v.e8.summary.shape_ratio_idf_median)} in gauges`, <Verdict key="j" v="poor" />],
          ]} />
        <div className="mt-4">
          <Steps items={[
            { title: 'GPM is a sound basis for the daily design rainfall over most of the island', body: <>Over the highlands, the west and the
              north, where most catchments and exposure lie, GPM matches the gauges in annual and basin totals (within ±10%), seasonal cycle,
              year-to-year variability and daily extremes, at the level expected for a 10 km cell average.</> },
            { title: 'It underestimates the wet east coast', body: <>On the windward coast and escarpment GPM is 20–45% low in totals and about
              20% low in daily extremes, a known limitation of satellite rainfall for orographic, shallow rain. Design depths there are
              likely underestimated; a regional correction factor of about 1.2 on daily extremes (1.3–1.7 on annual totals) would bring them in line
              with the gauges and should be considered or tested as a sensitivity.</> },
            { title: 'Multi-day cyclone totals need a historical check', body: <>The longest and wettest historical sequences (5–15 days)
              exceed anything GPM recorded in 1998–2025. The cyclone design storms should be compared with these totals (Isalo 807 mm in 4
              days, Mahanoro 746 mm in 6 days, Tsiazompaniry 15-day envelope).</> },
            { title: 'Short durations come from the gauges, not from GPM', body: <>IMERG smooths storm bursts over 2–3 hours; the sub-daily design
              storm correctly relies on the gauge-based law (<Ref to="s4-2">section 4.2</Ref>).</> },
          ]} />
          <Info>
            Limits of this assessment: the gauge climatologies predate GPM by 30–60 years; only seven stations overlap GPM in time, with
            mostly reported rain days; about 40% of the stations are located from a gazetteer; and point gauges are compared with ~120 km² cells.
            None of these changes the direction of the conclusions, which agree across the independent comparisons.
          </Info>
        </div>
      </Section>
    </div>
  )
}
