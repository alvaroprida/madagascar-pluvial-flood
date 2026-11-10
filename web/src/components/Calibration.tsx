/** Calibration & validation tab. Chapter 1: inventory of existing flood calibration and validation datasets
 *  (calibration_inventory.json and figures/calinv_*.png, from scripts/calibration_inventory.py). */
import type { EChartsOption } from 'echarts'
import { useEffect, useState, type ReactNode } from 'react'
import { dataUrl } from '../data'
import type { Palette } from '../theme'
import { ANNUAL_LOSSES, MAJOR_EVENTS } from './calibrationLosses'
import { Card, Chapter, ChapterIndex, Chart, DataTable, Figure, Info, Stat, Steps, type ChapterEntry } from './ui'

const fig = (f: string) => dataUrl(`figures/${f}`)
const fmt = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d })

type Drivers = Record<string, number>
interface Inventory {
  haruna: { n_polygons: number; area_km2: number; n_catchments: number; driver_pct: Drivers }
  v7v: { n_polygons: number; area_km2: number; n_catchments: number; driver_pct: Drivers; inside_fluvial_rp10_pct: number; fluvial_rp10_inside_obs_pct: number }
  mahajanga: { wet_km2: number; median_m: number; p99_m: number; max_m: number; area_gt_0p5m_km2: number }
  groundsource: {
    n_events: number; first: string; last: string; n_tc: number; n_storms: number; median_area_km2: number
    pct_under_10km2: number; median_duration_days: number; since_2022_pct: number
    driver_pct: { coastal: number; fluvial_prone: number; headwater: number }
    top_storms: [string, number][]; top_nontc_months: [string, number][]
  }
}

const CHAPTERS: ChapterEntry[] = [
  { id: 'inventory', number: 1, title: 'Inventory of existing calibration and validation datasets', summary: 'What observed and modelled flood data exist for Madagascar, where they lie, what they can and cannot show about pluvial flooding, and which events to simulate next.' },
]

const nYears = ANNUAL_LOSSES.length
const meanAffected = ANNUAL_LOSSES.reduce((s, r) => s + r[1], 0) / nYears
const meanReported = ANNUAL_LOSSES.reduce((s, r) => s + (r[2] ?? 0), 0) / nYears
const yearsReported = ANNUAL_LOSSES.filter((r) => r[2] !== null).length
const meanEstimated = ANNUAL_LOSSES.reduce((s, r) => s + r[3], 0) / nYears

const pct = (d: Drivers, k: string) => {
  const key = Object.keys(d).find((x) => x.toLowerCase().startsWith(k))
  return key === undefined ? '…' : `${fmt(d[key], 0)}%`
}

function TextTable({ head, rows, caption }: { head: string[]; rows: (string | number)[][]; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
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
      <p className="mt-2 text-xs text-ink-3">{caption}</p>
    </div>
  )
}

function Dataset({ id, title, kind, rows, children }: { id: string; title: string; kind: string; rows: [string, ReactNode][]; children?: ReactNode }) {
  return (
    <Card title={`${id} · ${title}`} subtitle={kind}>
      <dl className="grid gap-x-4 gap-y-2 text-sm md:grid-cols-[11rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-medium text-ink">{k}</dt>
            <dd className="text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
      {children && <div className="mt-3">{children}</div>}
    </Card>
  )
}

const CHALLENGES = [
  ['No flood-type label', 'No dataset says whether flooding came from rain, rivers or the sea. Cyclones bring all three at once, so even an event extent mixes them.'],
  ['Extents dominated by rivers and coast', 'The regional maps follow river corridors and deltas: only about a tenth of their area lies in headwater catchments where the pluvial model is complete.'],
  ['Presence only', 'Groundsource reports where flooding was in the news, not where it was not: hit rates can be measured, false alarms cannot.'],
  ['Locations, not extents', 'Groundsource footprints are the places named in the news (two thirds smaller than 10 km²), not mapped water.'],
  ['Reporting bias', 'News coverage grows over time (most Groundsource events date from 2022 onwards) and favours towns and roads; flooded rice fields and remote areas are under-reported.'],
  ['One depth map, and it is modelled', 'The only depth information (Mahajanga) is another model, including a canal network that a catchment-scale SFINCS model does not resolve.'],
  ['Losses from all causes', 'The impact catalogue adds wind, surge, river and rain damage and skips floods without a cyclone; its estimated damage is people affected × 354 USD, so not independent.'],
  ['Unknown mapping methods', 'The Haruna and Vatovavy polygons come without date, method or attributes; the Sava polygons named in the report are missing.'],
]

const DRIVER_STEPS = [
  { title: '1 · Remove water that is not a flood', body: 'Permanent and seasonal water (JRC Global Surface Water) and flooded rice paddies (WorldCover cropland on flat valley floors).' },
  { title: '2 · Coastal', body: 'For cyclones that made landfall or passed close: connected to the sea and below the event storm tide (FABDEM against surge plus tide). The figures use a simple proxy: within 10 km of the shore.' },
  { title: '3 · Fluvial', body: 'Connected to a river draining a large upstream area, low above the nearest drainage (HAND below about 3–5 m) and with heavy rainfall upstream. The figures use a simple proxy: inside a catchment that receives water from upstream (886 of 2,129).' },
  { title: '4 · Pluvial (what is left)', body: 'Headwater catchments, local depressions and towns, on a day of heavy local rainfall. Calibration and validation scores use these pixels and locations only.' },
]

function lossChart(p: Palette): EChartsOption {
  const axis = {
    axisLabel: { color: p['text-secondary'] }, axisLine: { lineStyle: { color: p.axis } },
    axisTick: { show: false }, splitLine: { lineStyle: { color: p.grid } }, nameTextStyle: { color: p['text-secondary'] },
  }
  const avg = (v: number, color: string, label: string) => ({
    symbol: 'none', silent: true, lineStyle: { color, type: 'dashed' as const, width: 1.5 },
    label: { formatter: label, color, position: 'insideEndTop' as const }, data: [{ yAxis: v }],
  })
  return {
    grid: { left: 64, right: 72, top: 40, bottom: 36 },
    legend: { top: 0, textStyle: { color: p['text-secondary'] } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: ANNUAL_LOSSES.map((r) => String(r[0])), ...axis, splitLine: { show: false } },
    yAxis: [
      { type: 'value', name: 'People affected (millions)', ...axis, axisLabel: { ...axis.axisLabel, formatter: (v: number) => fmt(v, 1) } },
      { type: 'value', name: 'Damage (M USD 2020)', ...axis, splitLine: { show: false } },
    ],
    series: [
      {
        name: 'People affected', type: 'bar', barCategoryGap: '25%', itemStyle: { color: p['cat-1'], borderRadius: [3, 3, 0, 0] },
        data: ANNUAL_LOSSES.map((r) => +(r[1] / 1e6).toFixed(3)),
        tooltip: { valueFormatter: (v) => `${fmt(Number(v), 2)} M people` },
        markLine: avg(meanAffected / 1e6, p['cat-1'], `mean ${fmt(meanAffected / 1e6, 2)} M`),
      },
      {
        name: 'Estimated damage (2020 USD)', type: 'line', yAxisIndex: 1, symbolSize: 6,
        itemStyle: { color: p['cat-2'] }, lineStyle: { color: p['cat-2'], width: 2 },
        data: ANNUAL_LOSSES.map((r) => r[3]),
        tooltip: { valueFormatter: (v) => `${fmt(Number(v), 0)} M USD` },
        markLine: avg(meanEstimated, p['cat-2'], `mean ${fmt(meanEstimated, 0)} M USD`),
      },
    ],
  }
}

export function Calibration({ palette }: { palette: Palette }) {
  const [inv, setInv] = useState<Inventory>()
  useEffect(() => { fetch(dataUrl('calibration_inventory.json')).then((r) => r.json()).then(setInv) }, [])
  const h = inv?.haruna, v = inv?.v7v, m = inv?.mahajanga, g = inv?.groundsource
  const n = (x: number | undefined, d = 0) => (x === undefined ? '…' : fmt(x, d))

  const usefulness: string[][] = [
    ['H1 Groundsource (news)', 'Reported flood locations, 2005–2026', 'Mixed; ~25% of locations in headwater catchments', 'Validation: hit rate at reported locations; event selection', 'Location check for event impact', 'High (many events, national)'],
    ['H2 Haruna 2013, Atsimo Andrefana', 'Mapped flooded zones, one event', 'Mostly fluvial and coastal', 'Validation of a Haruna run on headwater parts; negative test elsewhere', 'Context', 'Medium'],
    ['H3 Vatovavy Fitovinany flood-prone areas', 'Expert map, no event, no return period', 'Mostly coastal and deltaic', 'Qualitative check only', '–', 'Low'],
    ['H4 Cheneso 2023, Mahajanga (modelled)', '1 m depth from a detailed urban drainage model', 'Pluvial with tidal boundary', 'Calibration benchmark (extent and depth)', 'Event exposure check', 'High, but local and modelled'],
    ['R1 Cyclone impact catalogue 2000–2022', 'Deaths, affected, damage per cyclone and year', 'All cyclone causes', '–', 'Upper bound for average annual affected population and loss; event order of magnitude', 'Medium'],
    ['R2 Flood events 1985–2022', 'Deaths and affected per flood event', 'Flooding (21 cyclone events, 1 heavy rain)', '–', 'People affected per event (flood only)', 'Medium'],
  ]

  const nextEvents: (string | number)[][] = [
    ['Cheneso, Jan 2023', 'Cyclone', 'Mahajanga (Metzinger valley); north-west', 'H4 depth and extent; Groundsource locations', 'Calibration: roughness, infiltration (curve number), depth bias. Also run the study\'s 10-year 24 h storm against our 10-year design'],
    ['Ana, Jan 2022', 'Cyclone (weak) / heavy rain', 'Antananarivo and highlands', `Groundsource (${g?.top_storms.find((s) => s[0].startsWith('Ana'))?.[1] ?? '…'} reports, most of any storm); R1 960,000 affected`, 'Validation of hazard (hit rate) and event affected population'],
    ['Feb 2015 heavy rains', 'Non-cyclone', 'Antananarivo', `Groundsource (${g?.top_nontc_months.find((s) => s[0] === '2015-02')?.[1] ?? '…'} reports, largest non-cyclone month)`, 'Validation of the 12 h non-cyclone storm'],
    ['Haruna, Feb 2013', 'Cyclone', 'Atsimo Andrefana (south-west)', 'H2 headwater parts (CSI); fluvial and coastal parts as negative test', 'Validation of extent'],
    ['Enawo 2017, Batsirai 2022, Gamane 2024', 'Cyclone', 'North-east, east, north', 'Groundsource; R1 (Enawo 415 M USD, 430,000 affected)', 'Validation across regions and event impact'],
  ]

  return (
    <div className="space-y-4">
      <ChapterIndex title="Calibration & validation" chapters={CHAPTERS} />

      <Chapter entry={CHAPTERS[0]}
        builds={<>the design storms (Rainfall tab), the flood model setup and the risk computation (Risk tab).</>}
        outcome={<>
          One dataset can calibrate (Cheneso in Mahajanga, itself a model); Groundsource and the Haruna extent can validate once
          fluvial and coastal flooding are set aside; the impact catalogues bound the risk metrics from above. Next steps: simulate the
          five event groups in the last table, forced with half-hourly GPM IMERG, calibrate on Cheneso, then validate on the others
          and compare modelled event and average annual impacts with R1 and R2.
        </>}>

        <Card title="Where the datasets lie" subtitle="Regional extents in the south-west and south-east, one urban catchment in the north-west, news reports island-wide">
          <Figure src={fig('calinv_coverage.png')} maxHeight={720}
            alt="Map of Madagascar with Groundsource event locations, Haruna flooded zones, Vatovavy Fitovinany flood-prone areas and the Mahajanga model box" />
          <Info>
            None of these datasets is specific to pluvial flooding. The hazard data are therefore read through a separation of
            flood drivers, and the impact data are used as upper bounds rather than calibration targets.
          </Info>
        </Card>

        <h3 className="pt-2 text-lg font-semibold text-ink">Hazard datasets</h3>

        <Dataset id="H1" title="Groundsource: flood events from news" kind="Reported flood locations, global, 2000–2026 (Madagascar from 2005)" rows={[
          ['Content', <>2.6 million flood events worldwide extracted from news articles; each has a start and end date and the footprint of the place named in the article. Madagascar: <b>{n(g?.n_events)}</b> events on land from {g?.first ?? '…'} to {g?.last ?? '…'}; median footprint {n(g?.median_area_km2, 1)} km², {n(g?.pct_under_10km2)}% under 10 km²; median duration {n(g?.median_duration_days)} day.</>],
          ['Source', 'Google Research (2026), Groundsource: a dataset of flood events from news. Zenodo, record 18647054. CC BY 4.0.'],
          ['Flood drivers', <>Not labelled. {n(g?.n_tc)} events ({g ? fmt(100 * g.n_tc / g.n_events, 0) : '…'}%) fall during {n(g?.n_storms)} cyclones (start 3 days before to 7 days after the storm date, track within 500 km). By location, {n(g?.driver_pct.coastal)}% are within 10 km of the coast, {n(g?.driver_pct.fluvial_prone)}% in catchments with upstream inflow and {n(g?.driver_pct.headwater)}% in headwater catchments.</>],
          ['Limitations', <>Presence only (no record of where it did not flood); footprints are places, not water extents; {n(g?.since_2022_pct)}% of events date from 2022 onwards, so frequencies are not comparable over time.</>],
        ]}>
          <Figure src={fig('calinv_groundsource.png')} alt="Map of Groundsource events coloured by cyclone or other, and bar charts of events per year, per month and by footprint size" />
          <div className="mt-3">
            <DataTable name="the cyclones with the most reports" caption="Cyclones with the most Groundsource reports"
              head={['Cyclone', 'Reports']} rows={g?.top_storms ?? []} />
          </div>
        </Dataset>

        <Dataset id="H2" title="Flooded zones after Cyclone Haruna, Atsimo Andrefana (2013)" kind="Mapped flood extent, regional, single event" rows={[
          ['Content', <>{n(h?.n_polygons)} polygons, {n(h?.area_km2)} km², mapped after Haruna (landfall 22 February 2013) along the Mangoky, Manombo, Fiherenana, Onilahy, Linta and Menarandra; they touch {n(h?.n_catchments)} model catchments. No attributes (depth, date or type).</>],
          ['Source', 'CPGU – Cellule de Prévention et Gestion des Urgences (2013), Aléa inondations SAVA – Vatovavy Fitovinany – Sud-Ouest, actualisation 2013 (commune-by-commune account of the Haruna flooding).'],
          ['Flood drivers', <>{h ? pct(h.driver_pct, 'coastal') : '…'} of the area within 10 km of the coast, {h ? pct(h.driver_pct, 'fluvial') : '…'} in catchments with upstream inflow, only <b>{h ? pct(h.driver_pct, 'headwater') : '…'}</b> in headwater catchments (pluvial candidate).</>],
          ['Limitations', 'Mapping method and observation date unknown; regional-scale digitising.'],
        ]}>
          <Figure src={fig('calinv_haruna.png')} alt="Satellite map of the Haruna flooded zones coloured by likely driver with sub-area boxes and a zoom on the lower Fiherenana" />
        </Dataset>

        <Dataset id="H3" title="Flood-prone areas, Vatovavy Fitovinany" kind="Expert flood susceptibility map, regional, no return period" rows={[
          ['Content', <>{n(v?.n_polygons)} polygons, {n(v?.area_km2)} km², on the deltas and lower reaches of the Sakaleona, Mananjary, Faraony and Manakara; {n(v?.n_catchments)} catchments touched. No attributes.</>],
          ['Source', 'CPGU (2013), same report as H2. The Sava polygons named in it were not delivered.'],
          ['Flood drivers', <>{v ? pct(v.driver_pct, 'coastal') : '…'} within 10 km of the coast, {v ? pct(v.driver_pct, 'fluvial') : '…'} in catchments with upstream inflow, {v ? pct(v.driver_pct, 'headwater') : '…'} in headwater catchments. Only {n(v?.inside_fluvial_rp10_pct)}% lies inside the riverine 10-year map, which covers {n(v?.fluvial_rp10_inside_obs_pct)}% of it the other way round.</>],
          ['Limitations', 'Zones where flooding is known to occur, without frequency, depth or event.'],
        ]}>
          <Figure src={fig('calinv_v7v.png')} alt="Satellite map of the Vatovavy Fitovinany flood-prone areas coloured by likely driver, with a zoom on the lower Mananjary and the riverine 10-year extent" />
        </Dataset>

        <Dataset id="H4" title="Cyclone Cheneso, Mahajanga (January 2023, modelled)" kind="Detailed 2D urban drainage model, maximum water depth, 1 m" rows={[
          ['Content', <>Maximum depth over the Metzinger valley, a 500 ha urban catchment where 101 ha lie below 2 m. {n(m?.wet_km2, 1)} km² wet above 5 cm, {n(m?.area_gt_0p5m_km2, 1)} km² above 0.5 m; median {n(m?.median_m, 2)} m, 99th percentile {n(m?.p99_m, 1)} m (main canal and low basin).</>],
          ['Source', 'GESCOD (2023), Étude de drainage du vallon Metzinger et assistance communale à la gestion du réseau, Commune Urbaine de Mahajanga. Model forced by observed 30-minute rainfall during Cheneso and the observed tide. It also simulates a 10-year 24 h storm with a mean spring tide and gives local rainfall frequencies.'],
          ['Flood drivers', 'Rainfall runoff draining to a tide-controlled canal: the closest match to the pluvial model.'],
          ['Limitations', 'A model, not an observation; includes canals, culverts and blockages that SFINCS at catchment scale does not resolve; one small catchment.'],
        ]}>
          <Figure src={fig('calinv_mahajanga.png')} alt="Map of modelled maximum water depth in the Metzinger valley, Mahajanga, and bar chart of flooded area by depth class" />
        </Dataset>

        <h3 className="pt-2 text-lg font-semibold text-ink">Risk datasets</h3>

        <Dataset id="R1" title="Cyclone impact catalogue, 2000–2022" kind="Reported impacts per cyclone and per year" rows={[
          ['Content', '60 cyclones with deaths (47 events), people affected (39), reported damage (13) and a flag for documented flooding (29); yearly totals with damage in 2020 USD (US CPI).'],
          ['Source', 'Firinga (2025) for every event, completed with Peyrusaubes (2016), Rakotoarimanana et al. (2022), ReliefWeb (2002, 2022), The World Bank (2022), World Bank Group (2017), UNDP (2012), OCHA (2000), UNOCHA (2004), Météo Madagascar (2019), PreventionWeb (2008), Atlas Magazine (2012), Reuters (2015), Madagascar Tribune (2019) and AON (2020).'],
          ['Flood drivers', 'All causes of cyclone damage together; non-cyclone floods not included.'],
          ['Limitations', <>Estimated damage = people affected × 354 USD, so not independent of the affected counts. Reported damage exists for {yearsReported} of {nYears} years.</>],
        ]}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="People affected per year" value={fmt(Math.round(meanAffected / 100) * 100)} sub="all cyclone impacts" hero />
            <Stat label="Reported damage per year" value={`${fmt(meanReported, 0)} M USD`} sub={`nominal, missing years as zero (${yearsReported} of ${nYears} years)`} />
            <Stat label="Estimated damage per year" value={`${fmt(meanEstimated, 0)} M USD`} sub="2020 USD, derived from people affected" />
          </div>
          <div className="mt-3">
            <Chart option={lossChart(palette)} height={360} label="Bars of people affected per year and line of estimated damage per year, 2000 to 2022, with dashed means" />
          </div>
          <Info>
            Three years dominate: 2000 (Eline, Gloria, Hudah), 2004 (Gafilo) and 2022 (Ana, Batsirai and others). The pluvial model
            covers only part of these impacts, so its average annual affected population and loss must come out clearly below the means.
          </Info>
          <div className="mt-3">
            <DataTable name="the major cyclones (table)" caption="Cyclones with reported damage or at least 150,000 people affected"
              head={['Storm', 'Date', 'Deaths', 'Affected', 'Reported damage (M USD)', 'Flooding documented']} rows={MAJOR_EVENTS} />
          </div>
        </Dataset>

        <Dataset id="R2" title="Flood events, 1985–2022" kind="Reported flood impacts per event" rows={[
          ['Content', '22 flood events with deaths and people affected: 21 caused by cyclones (Domoina 1987 to Batsirai 2022) and one by heavy rain.'],
          ['Source', 'Dartmouth Flood Observatory (2018), UNDP et al. (2012), Red Cross appeals (2017, 2022).'],
          ['Flood drivers', 'Flooding only, unlike R1, but not split into pluvial, fluvial and coastal.'],
          ['Limitations', 'No economic damage; affected counts differ from R1 for the same storms (other sources and definitions).'],
        ]} />

        <Card title="Challenges" subtitle="Why none of the datasets can be used as it is">
          <dl className="grid gap-3 md:grid-cols-2">
            {CHALLENGES.map(([t, d]) => (
              <div key={t} className="rounded-lg border border-line p-3">
                <dt className="font-medium text-ink">{t}</dt>
                <dd className="mt-1 text-sm text-ink-2">{d}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Separating pluvial, fluvial and coastal flooding" subtitle="Each flooded pixel or reported location is labelled by four tests in order; what fails the first three is pluvial">
          <Steps items={DRIVER_STEPS} />
        </Card>

        <Card title="Which datasets are useful">
          <TextTable
            caption="Calibration = tuning model parameters against the data; validation = independent check of results"
            head={['Dataset', 'Content', 'Flood drivers', 'Pluvial hazard', 'Flood risk', 'Usefulness']} rows={usefulness} />
        </Card>

        <Card title="Next steps: events to simulate and ground truth" subtitle="Event runs with the production model, forced by half-hourly GPM IMERG over each catchment">
          <TextTable caption="Events proposed for calibration and validation"
            head={['Event', 'Type', 'Area', 'Ground truth', 'Purpose']} rows={nextEvents} />
          <div className="mt-4" />
          <Steps items={[
            { title: '1 · Calibrate on Cheneso (H4)', body: 'Run the Mahajanga catchment with the Cheneso rainfall and tide; tune Manning roughness and curve-number condition to match the H4 extent (critical success index) and depth distribution; check the 10-year design against the study\'s 10-year 24 h storm.' },
            { title: '2 · Validate hazard', body: 'Freeze parameters; run Ana, Feb 2015, Haruna, Enawo, Batsirai and Gamane. Score the hit rate at Groundsource locations in headwater catchments (flooded above 15 cm within the footprint) and the critical success index on the Haruna headwater polygons; fluvial and coastal parts of H2 and H3 should stay mostly dry in the pluvial model.' },
            { title: '3 · Validate risk', body: 'Overlay event depths with exposure: people affected and loss per event against R1 and R2 (pluvial share expected well below the totals). Then compare modelled average annual affected population and loss with the R1 means as an upper bound.' },
            { title: '4 · Data still to obtain', body: 'The Sava flood-prone polygons; the observation date and method of the Haruna map; event flood maps from Copernicus EMS / UNOSAT for Ana, Batsirai and Freddy where they exist.' },
          ]} />
        </Card>
      </Chapter>
    </div>
  )
}
