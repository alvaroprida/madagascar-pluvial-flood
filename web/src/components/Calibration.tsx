/** Calibration & validation tab. Chapter 1: inventory of existing flood calibration and validation datasets
 *  (calibration_inventory.json and figures/calinv_*.png, from scripts/calibration_inventory.py). */
import type { EChartsOption } from 'echarts'
import { useEffect, useState, type ReactNode } from 'react'
import { dataUrl } from '../data'
import type { Palette } from '../theme'
import { CalibrationMap } from './CalibrationMap'
import { CalibrationSetup } from './CalibrationSetup'
import { SatelliteValidation } from './SatelliteValidation'
import { ANNUAL_LOSSES, MAJOR_EVENTS } from './calibrationLosses'
import { Card, Chapter, ChapterIndex, Chart, DataTable, Figure, Info, Stat, Steps, Toggle, type ChapterEntry } from './ui'

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
  rapid?: { event: string; source: string; sensors: string; dates: string; n_areas: number; analysed_km2: number | null; flooded_km2: number; driver_pct: Drivers }[]
}

const rapidRows = (r: Inventory['rapid'], source: string) => (r ?? []).filter((x) => x.source === source).map((x) => [
  x.event, x.dates || '–', x.sensors, x.n_areas, x.analysed_km2 === null ? '–' : fmt(x.analysed_km2), x.flooded_km2 ? fmt(x.flooded_km2, 1) : 'none mapped',
  Object.keys(x.driver_pct).length ? `${pct(x.driver_pct, 'coastal')} / ${pct(x.driver_pct, 'fluvial')} / ${pct(x.driver_pct, 'headwater')}` : '–',
])
const RAPID_HEAD = ['Event', 'Image dates', 'Sensors', 'Areas', 'Analysed (km²)', 'Flooded (km²)', 'Coastal / fluvial-prone / headwater']

const CHAPTERS_RAW: ChapterEntry[] = [
  { id: 'consolidated', number: 2, title: 'Consolidated validation dataset', summary: 'One table of events with reported impacts from every source side by side, impacts per district, and yearly totals: the reference against which modelled event impacts and average annual figures are compared.' },
  { id: 'plan', number: 3, title: 'Validation plan and results', summary: 'Four-step validation approach, then 3.1 hazard validation: benchmark against the Cheneso local model and comparison with satellite flood maps (Gezani, Batsirai, Emnati).' },
  { id: 'inventory', number: 1, title: 'Inventory of existing calibration and validation datasets', summary: 'What observed and modelled flood data exist for Madagascar, where they lie, what they can and cannot show about pluvial flooding, and which events to simulate next.' },
]

const CHAPTERS = [...CHAPTERS_RAW].sort((a, b) => a.number - b.number)

interface ValEvent {
  event: string; date: string; type: string; glide: string | null; r1_deaths: number | null; r1_affected: number | null
  r1_damage_usd: number | null; r2_affected: number | null; di_districts: number | null; di_affected: number | null
  di_victims: number | null; di_houses_destroyed: number | null; reliefweb: string | null; groundsource_reports: number | null
  satellite_flood_km2: number | null; satellite_source: string | null; other_hazard_truth: string | null; rainfall: string
  role: string | null; affected_max_reported: number | null; rw_affected?: number | null; rw_houses_flooded?: number | null
}
interface Run { event: string; purpose: string; window_start: string; window_end: string; rainfall: string; n_catchments: number; area_km2: number; n_headwater: number; priority: string; n_priority: number; priority_km2: number; ground_truth: string; metrics: string }
interface ValAnnual { year: number; r1_affected: number | null; r1_damage_est_usd2020: number | null; di_affected: number | null; di_victims: number | null; di_houses_destroyed: number | null; r1_covered: boolean; di_covered: boolean }
interface Validation { events: ValEvent[]; annual: ValAnnual[]; n_district_rows: number; n_districts: number; runs: Run[] }

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
    <details className="group rounded-xl border border-line bg-surface p-4 md:p-5">
      <summary className="flex cursor-pointer list-none items-start gap-2">
        <span className="mt-0.5 inline-block text-accent transition-transform group-open:rotate-90">▸</span>
        <span>
          <span className="block text-base font-semibold text-ink">{id} · {title}</span>
          <span className="mt-0.5 block text-sm text-ink-2">{kind}</span>
        </span>
      </summary>
      <div className="mt-3">
        <dl className="grid gap-x-4 gap-y-2 text-sm md:grid-cols-[11rem_1fr]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-medium text-ink">{k}</dt>
              <dd className="text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </details>
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

export function Calibration({ palette, dark }: { palette: Palette; dark: boolean }) {
  const [inv, setInv] = useState<Inventory>()
  useEffect(() => { fetch(dataUrl('calibration_inventory.json')).then((r) => r.json()).then(setInv) }, [])
  const [val, setVal] = useState<Validation>()
  useEffect(() => { fetch(dataUrl('validation_events.json')).then((r) => r.json()).then(setVal) }, [])
  const h = inv?.haruna, v = inv?.v7v, m = inv?.mahajanga, g = inv?.groundsource
  const n = (x: number | undefined, d = 0) => (x === undefined ? '…' : fmt(x, d))

  const summary: string[][] = [
    ['H1 Groundsource', 'Reported flood locations (news)', '2005–2026; 874 events, 48 cyclones', 'Island-wide, biased to towns and roads', 'Place footprint, start/end date', 'Mixed; ~25% headwater', 'Hit rate at reported places; event selection', 'Location check', 'High'],
    ['H2 Haruna flooded zones (CPGU)', 'Mapped flood extent', 'Feb 2013; 1 event', 'Atsimo Andrefana (south-west), 10 river reaches', 'Flooded / not (polygons)', 'Mostly fluvial and coastal; 12% headwater', 'CSI on headwater parts; negative test elsewhere', 'Context', 'Medium'],
    ['H3 Vatovavy Fitovinany flood-prone areas (CPGU)', 'Expert susceptibility map', 'No event, no return period', 'South-east coast, 4 deltas and lower reaches', 'Flood-prone / not', 'Mostly coastal; 10% headwater', 'Qualitative check', '–', 'Low'],
    ['H4 Cheneso Mahajanga model (GESCOD)', 'Detailed urban drainage model', 'Jan 2023; 1 event + 10-year storm', 'Metzinger valley, Mahajanga (500 ha)', 'Max water depth, 1 m grid', 'Pluvial with tidal boundary', 'Benchmark (extent, depth)', 'Exposure check', 'High, local, modelled'],
    ['H5 UNOSAT flood extents', 'Satellite flood maps (3–20 m)', '2017–2025; 9 cyclones', 'East and south-east coast; Haute Matsiatra; Sava; Menabe', 'Flooded area + analysed area', 'Mostly coastal/fluvial; 13–29% headwater', 'CSI, hit rate, false alarms inside analysed areas', 'Exposure check', 'High'],
    ['H6 Copernicus EMS', 'Very-high-resolution delineation', '2026; Fytia, Gezani', 'Antananarivo, Toamasina, Ambatondrazaka, Vatomandry, Ambato Boeny', 'Flooded area, flood traces + area of interest', 'Mixed; 45% headwater (Gezani)', 'Urban validation', 'Exposure check', 'High, small areas'],
    ['R1 Cyclone impact catalogue', 'Reported impacts per cyclone and year', '2000–2022; 60 cyclones', 'National', 'Deaths, affected, damage (13 events; rest derived)', 'All cyclone causes', '–', 'Upper bound for average annual figures; event order of magnitude', 'Medium'],
    ['R2 Flood events (DFO and others)', 'Reported flood impacts', '1985–2022; 22 events', 'National', 'Deaths, affected', 'Flooding (21 cyclone, 1 rain)', '–', 'Event affected (flood only)', 'Medium'],
    ['R3 DesInventar', 'Disaster loss database', '1982–2024 (mostly ≤ 2018); 1,017 cyclone + 25 flood records', '113 districts', 'Deaths, affected, victims, houses destroyed/damaged, crops', 'Cyclone records all causes; flood records separate', '–', 'Event impacts per district; yearly totals', 'High'],
    ['R4 ReliefWeb / BNGRC / IFRC', 'Humanitarian reports; IFRC DREF and appeal documents', '1997–2026; 53 cyclone/flood disasters; 10 IFRC operations transcribed', 'National, regions, some districts and communes', 'Deaths, affected, displaced, houses flooded/damaged/destroyed; response budget by sector and people targeted', 'Narrative; houses flooded is flood-specific; Jan 2020 and Jan 2022 (Antananarivo) are floods without cyclone', '–', 'Event impacts; emergency-response cost rate by flood depth', 'High for 2020–2026'],
  ]


  return (
    <div className="space-y-4">
      <ChapterIndex title="Calibration & validation" chapters={CHAPTERS} />

      <Chapter entry={CHAPTERS[0]}
        builds={<>the design storms (Rainfall tab), the flood model setup and the risk computation (Risk tab).</>}
        outcome={<>
          One dataset gives depths (Cheneso in Mahajanga, itself a model) for a benchmark against a local model; the UNOSAT and Copernicus EMS satellite maps, Groundsource and the Haruna extent can validate once
          fluvial and coastal flooding are set aside; the impact catalogues bound the risk metrics from above. The datasets are consolidated in Chapter 2 and the simulation plan is in Chapter 3.
        </>}>

        <Card title="Interactive map of the geospatial datasets" subtitle="Tick a layer to load it; H5 and H6 have one flood extent and one analysed area per event. Click a shape for its attributes; R3/R4 colours districts by the reported impact of the selected event.">
          <CalibrationMap dark={dark} />
          <Info>
            None of these datasets is specific to pluvial flooding. The hazard data are therefore read through a separation of
            flood drivers, and the impact data are used as upper bounds rather than calibration targets. The satellite extents are
            simplified for the web (patches under 0.5–5 ha dropped, edges smoothed by 10–90 m, shown per layer); scores in Chapter 3 use the original files.
            R1 and R2 have no locations and are not mapped.
          </Info>
          <Toggle title="Static overview map">
            <Figure src={fig('calinv_coverage.png')} maxHeight={720}
              alt="Map of Madagascar with Groundsource event locations, Haruna flooded zones, Vatovavy Fitovinany flood-prone areas, UNOSAT and Copernicus EMS analysed areas and the Mahajanga model box" />
          </Toggle>
        </Card>

        <p className="text-sm text-ink-2">Click a dataset to unfold its description, figures and tables.</p>

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
          ['Source', 'GESCOD (2023), Étude de drainage du vallon Metzinger et assistance communale à la gestion du réseau, Commune Urbaine de Mahajanga. HEC-RAS 2D model (Manning 0.04, curve number 84.3) forced by half-hourly GPM rainfall over 19–23 January 2023 and the predicted tide (Tide4Fishing). It also simulates a 10-year 24 h storm with a mean spring tide and gives local rainfall frequencies.'],
          ['Flood drivers', 'Rainfall runoff draining to a tide-controlled canal: the closest match to the pluvial model.'],
          ['Limitations', 'A model, not an observation; includes canals, culverts and blockages that SFINCS at catchment scale does not resolve; one small catchment.'],
        ]}>
          <Figure src={fig('calinv_mahajanga.png')} alt="Map of modelled maximum water depth in the Metzinger valley, Mahajanga, and bar chart of flooded area by depth class" />
        </Dataset>

        <Dataset id="H5" title="UNOSAT satellite-detected flood extents" kind="Event flood maps from satellite imagery, 2017–2025, nine cyclones" rows={[
          ['Content', 'Flood extent (water detected after the event minus normal water) and the analysed area for each image, mostly Sentinel-1/2, TerraSAR-X, RCM and KOMPSAT-5 at about 3–20 m; one national VIIRS map at 375 m for January 2020. Outside the analysed area nothing was observed.'],
          ['Source', 'UNITAR-UNOSAT rapid mapping, distributed on the Humanitarian Data Exchange (42 Madagascar entries, nine archives). Free for humanitarian and research use with attribution.'],
          ['Flood drivers', 'Not labelled. Most maps cover the east and south-east coastal plains and lower rivers; Haute Matsiatra (Fianarantsoa highlands, Batsirai and Emnati 2022) is the main exception.'],
          ['Limitations', 'Single snapshots a few days after landfall (pluvial ponding may already have drained); radar misses water in dense built-up areas and under vegetation; the Alvaro 2024 archive has analysed areas but no flood layer.'],
        ]}>
          <Figure src={fig('calinv_rapid_coverage.png')} maxHeight={720} alt="Map of Madagascar with UNOSAT and Copernicus EMS analysed areas and flooded areas coloured by event" />
          <div className="mt-3">
            <TextTable caption="UNOSAT maps per event; flooded area merged over all images of the event; flood-driver split of the flooded area (coastal within 10 km of the shore / catchment with upstream inflow / headwater)"
              head={RAPID_HEAD} rows={rapidRows(inv?.rapid, 'UNOSAT')} />
          </div>
        </Dataset>

        <Dataset id="H6" title="Copernicus EMS rapid mapping" kind="Very-high-resolution flood delineation, 2026, two cyclones" rows={[
          ['Content', 'Observed flooded areas and flood traces, delineated by photo-interpretation and semi-automatic extraction on very-high-resolution imagery, within each area of interest (grading products and their monitoring updates).'],
          ['Source', 'Copernicus Emergency Management Service, rapid mapping activations EMSR863 (Fytia, January 2026) and EMSR867 (Gezani, February 2026). The public catalogue lists no earlier Madagascar activation.'],
          ['Flood drivers', 'Not labelled. Gezani includes Antananarivo, the only very-high-resolution urban flood map available; most of it lies in the Ikopa plain (fluvial), the rest in town.'],
          ['Limitations', 'Small areas of interest (8–113 km²); 2026 events lie beyond the GPM IMERG Final record (to September 2025), so their runs need IMERG Late rainfall.'],
        ]}>
          <TextTable caption="Copernicus EMS maps per event" head={RAPID_HEAD} rows={rapidRows(inv?.rapid, 'Copernicus EMS')} />
          <div className="mt-3">
            <Figure src={fig('calinv_rapid_examples.png')} alt="Three satellite maps of flooded areas coloured by likely driver: Haute Matsiatra after Batsirai, Antananarivo after Gezani, Manakara after Freddy" />
          </div>
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

        <Dataset id="R3" title="DesInventar Madagascar" kind="National disaster loss database, impacts per event and district, 1982–2024" rows={[
          ['Content', '2,402 records, of which 1,017 cyclone and 25 flood records (2005–2016): deaths, people affected and victims, houses destroyed and damaged, hectares of crops. About 70% of cyclone records give the district (none the commune); economic damage only in yearly records per region.'],
          ['Source', 'DesInventar Sendai (UNDRR), Madagascar database fed by BNGRC and CERED; full export with district boundaries (NDMO/OCHA).'],
          ['Flood drivers', 'Cyclone records mix wind and flooding; flood records separate flooding, including the late February – March 2015 rains in Antananarivo (about 90,000 affected, no cyclone).'],
          ['Limitations', 'No storm names (131 records carry a GLIDE code; the rest are matched by month); sparse after 2018; a block of July 2018 records with no storm that month is left out; affected and victims are used inconsistently.'],
        ]} />

        <Dataset id="R4" title="ReliefWeb and IFRC reports" kind="Humanitarian reports per disaster, 1997–2026; IFRC operations with impacts and response budgets" rows={[
          ['Content', '62 disasters for Madagascar, 53 cyclones or floods, each with its GLIDE number and from 30 to 100 reports: OCHA flash updates, BNGRC situation reports, IFRC DREF reports, UNICEF situation reports, IOM displacement tracking, multi-sector assessments.'],
          ['Source', 'ReliefWeb (OCHA). The list and links are in the consolidated dataset; the API needs an approved application name.'],
          ['Flood drivers', 'Narrative; floods without cyclone appear as separate disasters (January 2003, March 2005, January 2020, January 2022).'],
          ['IFRC operations', 'IFRC GO lists 37 Madagascar appeals (DREF, Emergency Appeals, early action protocols); for the flood and cyclone operations the DREF documents give BNGRC impact figures (displaced, houses flooded, damaged and destroyed, by region) and the planned budget by sector with the people targeted, i.e. the direct cost of the emergency response.'],
          ['Limitations', 'Reports, not data: figures sit in PDFs and are extracted by hand; IFRC budgets cover the Red Cross share of the response only (5–20% of affected households), not the government or UN response.'],
        ]}>
          <IfrcCosts />
        </Dataset>

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

        <Card title="Summary of all datasets" subtitle="Area covered, metrics, flood drivers and use for the pluvial hazard and the flood risk">
          <TextTable
            caption="Calibration = tuning model parameters against the data; validation = independent check of results"
            head={['Dataset', 'Type', 'Period / events', 'Area covered', 'Metrics', 'Flood drivers', 'Pluvial hazard', 'Flood risk', 'Usefulness']} rows={summary} />
        </Card>

      </Chapter>

      <Chapter entry={CHAPTERS[1]}
        builds={<>the risk datasets R1–R4 and the hazard ground truth of Chapter 1.</>}
        outcome={<>
          The consolidated dataset is the reference for risk validation: per event, modelled people affected and losses are compared
          with the range of reported values (not one number); per district, with DesInventar; per year, modelled average annual figures
          must stay below the all-cause totals. It is rebuilt from the sources by scripts/build_validation_events.py.
        </>}>
        <ValidationDataset val={val} palette={palette} />
      </Chapter>

      <Chapter entry={CHAPTERS[2]}
        builds={<>the consolidated dataset (Chapter 2) and the per-catchment SFINCS pipeline; event runs are driven by scripts/run_events.py (forcing, models, run, score).</>}
        outcome={<>
          No parameter is tuned: the production set-up is benchmarked against the GESCOD local model for Cheneso (H4) and checked against the
          satellite maps of Gezani, Batsirai and Emnati (H5, H6); impacts per event and per district (R1, R3) are then compared using event footprints
          built from the return-period flood maps, and finally the average annual figures. The aim is to show results of the same order as local
          models and reported impacts, not to fit one site.
        </>}>
        <Plan />
        <Toggle title="3.1 · Hazard validation">
          <ValidationEvents />
          <CalibrationSetup palette={palette} dark={dark} />
          <SatelliteValidation palette={palette} dark={dark} />
        </Toggle>
      </Chapter>
    </div>
  )
}

function annualChart(p: Palette, an: ValAnnual[]): EChartsOption {
  const axis = {
    axisLabel: { color: p['text-secondary'] }, axisLine: { lineStyle: { color: p.axis } },
    axisTick: { show: false }, splitLine: { lineStyle: { color: p.grid } }, nameTextStyle: { color: p['text-secondary'] },
  }
  const ser = (name: string, key: keyof ValAnnual, color: string, cov: keyof ValAnnual) => ({
    name, type: 'bar' as const, itemStyle: { color, borderRadius: [3, 3, 0, 0] },
    data: an.map((r) => (r[cov] ? +(((r[key] as number) ?? 0) / 1e6).toFixed(3) : null)),
  })
  return {
    grid: { left: 64, right: 24, top: 40, bottom: 36 },
    legend: { top: 0, textStyle: { color: p['text-secondary'] } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => (v == null ? 'not covered' : `${fmt(Number(v), 2)} M`) },
    xAxis: { type: 'category', data: an.map((r) => String(r.year)), ...axis, splitLine: { show: false } },
    yAxis: { type: 'value', name: 'People (millions)', ...axis },
    series: [
      ser('R1 people affected (all cyclone causes)', 'r1_affected', p['cat-1'], 'r1_covered'),
      ser('R3 DesInventar affected', 'di_affected', p['cat-2'], 'di_covered'),
      ser('R3 DesInventar victims', 'di_victims', p['cat-3'], 'di_covered'),
    ],
  }
}

function ValidationDataset({ val, palette }: { val?: Validation; palette: Palette }) {
  if (!val) return <Card><Info>Loading…</Info></Card>
  const ev = val.events
  const nSrc = (e: ValEvent) => [e.r1_affected ?? e.r1_deaths, e.r2_affected, e.di_affected || e.di_victims].filter((x) => x != null && x !== 0).length
  const multi = ev.filter((e) => nSrc(e) >= 2).length
  const withHaz = ev.filter((e) => e.satellite_flood_km2 || e.other_hazard_truth || (e.groundsource_reports ?? 0) >= 10).length
  const cmp = val.annual.filter((r) => r.year >= 2000 && r.year <= 2018)
  const mean = (k: keyof ValAnnual) => cmp.reduce((s, r) => s + ((r[k] as number) ?? 0), 0) / cmp.length
  const v = (x: number | null | undefined, d = 0) => (x == null || x === 0 ? '–' : fmt(x, d))
  const key = ev.filter((e) => e.role || (e.affected_max_reported ?? 0) >= 100000)
  const row = (e: ValEvent) => [
    e.event, e.date.slice(0, 10), e.type === 'Cyclone' ? 'Cyclone' : 'Flood',
    v(e.r1_affected), v(e.r2_affected), v(e.di_affected || e.di_victims), v(e.rw_affected), v(e.di_districts), v(e.di_houses_destroyed), v(e.rw_houses_flooded),
    e.r1_damage_usd ? fmt(e.r1_damage_usd / 1e6, 0) : '–',
    [e.satellite_source && `${e.satellite_source} ${fmt(e.satellite_flood_km2 ?? 0, 0)} km²`, e.other_hazard_truth, e.groundsource_reports && `${e.groundsource_reports} news reports`].filter(Boolean).join('; ') || '–',
    e.rainfall.replace('GPM IMERG ', ''), e.role ?? '',
  ]
  const head = ['Event', 'Date', 'Type', 'R1 affected', 'R2 affected', 'R3 affected/victims', 'R4 affected', 'R3 districts', 'R3 houses destroyed', 'R4 houses flooded', 'R1 damage (M USD)', 'Hazard ground truth', 'Rainfall', 'Role']
  return (
    <>
      <Card title="Structure" subtitle="Three linked tables, one per validation scale">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Events" value={fmt(ev.length)} sub={`${ev.filter((e) => e.type !== 'Cyclone').length} floods without cyclone`} hero />
          <Stat label="Events with ≥ 2 impact sources" value={fmt(multi)} sub="R1, R2, R3 compared" />
          <Stat label="Events with hazard ground truth" value={fmt(withHaz)} sub="satellite map, model or ≥ 10 news reports" />
          <Stat label="Event × district rows" value={fmt(val.n_district_rows)} sub={`${val.n_districts} districts (DesInventar)`} />
        </div>
        <Steps items={[
          { title: 'events.csv · per event', body: 'One row per cyclone (IBTrACS name and date) or flood without cyclone: deaths, people affected and damage from R1, R2, R3 and R4 (BNGRC figures extracted from ReliefWeb reports, including houses flooded) side by side (not merged), GLIDE number and ReliefWeb link, hazard ground truth available, rainfall record (GPM IMERG Final to September 2025, Late afterwards) and proposed role.' },
          { title: 'event_district.csv · per event and district', body: 'DesInventar impacts per district with OCHA district codes, ready to join with modelled exposure in flooded areas per district. BNGRC figures extracted from ReliefWeb reports are added for the validation events.' },
          { title: 'annual.csv · per year', body: 'Totals per source and year 1998–2025 with coverage flags, for comparing modelled average annual affected population and loss over the years each source covers.' },
        ]} />
        <p className="mt-3 text-sm text-ink-2">
          Download:{' '}
          {['events.csv', 'event_district.csv', 'annual.csv'].map((f, i) => (
            <span key={f}>{i > 0 && ' · '}<a className="text-accent underline underline-offset-2" href={dataUrl(`validation/${f}`)} download>{f}</a></span>
          ))}
        </p>
      </Card>

      <Card title="Reference values for average annual impact" subtitle="Common period 2000–2018 (both R1 and DesInventar cover it)">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="R1 people affected / year" value={fmt(Math.round(mean('r1_affected') / 100) * 100)} sub="all cyclone causes" />
          <Stat label="R3 people affected / year" value={fmt(Math.round(mean('di_affected') / 100) * 100)} sub="DesInventar, cyclones and floods" />
          <Stat label="R3 victims / year" value={fmt(Math.round(mean('di_victims') / 100) * 100)} sub="DesInventar 'damnificados'" />
          <Stat label="R3 houses destroyed / year" value={fmt(Math.round(mean('di_houses_destroyed') / 100) * 100)} sub="DesInventar" />
        </div>
        <div className="mt-3">
          <Chart option={annualChart(palette, val.annual)} height={340} label="Bars per year of people affected from R1 and DesInventar affected and victims, 1998 to 2025" />
        </div>
        <Info>
          Sources disagree by a factor of two to three on the same years (definitions of affected, victims and missing districts), so modelled
          values are compared with the range. Pluvial flooding is one part of these impacts: the model must come out below the all-cause totals,
          and close to them only for rain-driven events such as Ana 2022 or February–March 2015.
        </Info>
      </Card>

      <Card title="Events for validation" subtitle="Events with a proposed role or at least 100,000 people affected in any source; the full list is in the download">
        <TextTable caption="Reported impacts per source side by side; hazard ground truth and rainfall record per event" head={head} rows={key.map(row)} />
        <DataTable name="all events (table)" caption="All events of the consolidated dataset" head={head} rows={ev.map(row)} />
      </Card>
    </>
  )
}

const VALIDATION_EVENTS: string[][] = [
  ['Cheneso 2023', 'Benchmark against a local model (3.1.1)', '19–23 Jan 2023 (GESCOD period)', 'GESCOD half-hourly GPM series over the basin (digitised) and GESCOD tide at the sea edge', 'GESCOD model area + 1 km, Mahajanga: 18.8 km², 1,706 cells', 'H4 GESCOD 1 m maximum depth', 'Flooded area ratio, median depth error, CSI, hit rate, false alarm ratio'],
  ['Gezani 2026', 'Satellite validation (3.1.2)', '9–18 Feb 2026 (to the image)', 'IMERG Late V07B, half-hourly, per catchment', '3 catchments, Antananarivo: 1,140 km², 116,083 cells', 'H6 Copernicus EMS, Pleiades 18 Feb 2026 07:10 UTC', 'Bias, CSI, hit rate, false alarm ratio; maximum and at the image time'],
  ['Batsirai 2022', 'Satellite validation (3.1.2)', '4–15 Feb 2022', 'IMERG Final V07B, half-hourly, per catchment', '10 catchments, Haute Matsiatra: 3,077 km², 313,139 cells', 'H5 UNOSAT, KOMPSAT-5 12 Feb 2022', 'Same'],
  ['Emnati 2022', 'Satellite validation (3.1.2)', '21 Feb – 1 Mar 2022', 'IMERG Final V07B, half-hourly, per catchment', '13 catchments, Haute Matsiatra: 4,636 km², 471,275 cells', 'H5 UNOSAT, RCM 28 Feb 2022', 'Same'],
]

function ValidationEvents() {
  return (
    <Card title="Validation events" subtitle="Four events in three areas, simulated with the production set-up and fixed parameters (100 m grid, 30 m depths)">
      <TextTable caption="Satellite events: whole pluvial catchments with at least 10% of their area analysed by the satellite; maps saved every 3 h so the one nearest the image time can be scored. Flooded = depth above 15 cm."
        head={['Event', 'Purpose', 'Window (UTC)', 'Forcing', 'Model domain', 'Ground truth', 'Metrics']} rows={VALIDATION_EVENTS} />
    </Card>
  )
}

function Plan() {
  return (
    <>
      <Card title="Approach in four steps" subtitle="Validation only: parameters are fixed in advance (production set-up). Hazard first, then impacts per event, then average annual figures">
        <TextTable caption="Flooded = water depth above 15 cm. Steps 1–2 use event simulations; steps 3–4 reuse the catalogue of return-period flood maps, so they need no new simulation."
          head={['Step', 'What is done', 'Data source', 'Metrics']} rows={[
            ['1 · Benchmark against a local model', 'Simulate Cyclone Cheneso (19–23 January 2023) around the Metzinger valley with the same rainfall and tide as GESCOD, production set-up (100 m grid, 30 m depths), no tuning (see 3.1.1). Sensitivity runs (roughness ×0.5 and ×2, average soil moisture, GESCOD roughness and curve number) show whether the conclusion depends on the parameters.',
              'H4 GESCOD maximum depth, 1 m, Metzinger valley', 'Flooded area ratio, median depth error, main flooded zones (order of magnitude); CSI, hit rate, false alarm ratio reported'],
            ['2 · Validate the hazard model', 'With the same fixed parameters, simulate Gezani 2026 (Antananarivo), Batsirai 2022 and Emnati 2022 (Haute Matsiatra) on the whole catchments the satellite analysed; compare the modelled flooding, at its maximum and at the image time, with the mapped extent inside the analysed area (see 3.1.2).',
              'H6 Copernicus EMS (Gezani); H5 UNOSAT (Batsirai, Emnati)', 'Bias, CSI, hit rate, false alarm ratio, per event'],
            ['3 · Validate impacts per event', 'For every cyclone with reported damage: (a) per pluvial catchment, return period of the event rainfall from the catchment rainfall record (GPM, 1998–2025) and the design rainfall curves; (b) event flood map per catchment by interpolating between the return-period flood maps of the catalogue; (c) merge all catchments into one national footprint per event; (d) overlay with exposure and vulnerability.',
              'R1 cyclone catalogue (national per event); R3 DesInventar (per district); R2/R4 as cross-checks (houses flooded, displaced)', 'People and buildings affected and losses per event vs R1; per district vs R3 (rank correlation, ratio modelled / reported, share of districts hit)'],
            ['4 · Validate average annual figures', 'Average annual affected population and building loss from the return-period risk curve; yearly sums of the step 3 event footprints over 2000–2018 as a second estimate.',
              'R1 and R3 yearly totals, 2000–2018', 'Modelled vs reported average per year (people affected, houses destroyed or damaged, loss); modelled must stay below the all-cause totals'],
          ]} />
        <Info>
          Steps 3 and 4 are an upper-bound check: reported figures include wind, river and coastal flooding, so the pluvial model should explain a
          share of them, close to the totals only for rain-driven events (January 2022 Antananarivo, February–March 2015). R1 has no locations and is
          used nationally; R3 gives the district split.
        </Info>
      </Card>

    </>
  )
}

interface IfrcOp {
  event: string; code: string; type: string; driver: string; areas: string; deaths?: number | null; affected?: number | null
  displaced?: number | null; flooded?: number | null; damaged?: number | null; destroyed?: number | null; budget: number; targeted: number
  chf_per_person_targeted: number; coverage_hh_share?: number | null; displaced_share?: number | null
  destroyed_share_of_flooded_or_destroyed?: number | null; budget_note?: string | null; unit_notes?: string | null; links: string
}
interface IfrcRate { depth_class: string; package: string; direct_chf_per_hh: number; chf_per_hh: number; usd_per_hh: number; usd_per_person: number }
interface IfrcCostsData {
  operations: IfrcOp[]; unit_costs: Record<string, number | string | null>[]; rates: IfrcRate[]
  meta: { unit_costs_chf_per_hh: Record<string, number>; support_share: number; markup: number; chf_usd: number; persons_per_hh: number }
}

function IfrcCosts() {
  const [d, setD] = useState<IfrcCostsData>()
  useEffect(() => { fetch(dataUrl('emergency_costs.json')).then((r) => r.json()).then(setD) }, [])
  if (!d) return <Info>Loading IFRC operations…</Info>
  const v = (x: number | null | undefined) => (x == null ? '–' : fmt(x))
  const p = (x: number | null | undefined) => (x == null ? '–' : `${fmt(100 * x, 0)}%`)
  const m = d.meta
  const SECT: [string, string][] = [['shelter', 'Shelter kits / emergency shelter'], ['cash', 'Basic-needs cash (multi-purpose)'], ['wash', 'Water, sanitation, hygiene'],
    ['health', 'Health'], ['protection_cea', 'Protection, gender, inclusion + community engagement'], ['shelter_cash', 'Cash for shelter repair']]
  const links = d.operations.flatMap((o) => o.links.split(' ').map((u) => [o.code, o.event, u]))
  return (
    <div className="space-y-4">
      <h4 className="text-base font-semibold text-ink">IFRC operations: flood impacts and response budgets</h4>
      <TextTable caption="Impacts as reported by BNGRC in the IFRC documents; budget = DREF allocation or appeal requirement (CHF, nominal); coverage = people targeted / affected"
        head={['Event', 'Operation', 'Driver', 'Areas', 'Affected', 'Displaced', 'Houses flooded', 'Damaged', 'Destroyed', 'Budget (CHF)', 'Targeted', 'CHF / person', 'Coverage']}
        rows={d.operations.map((o) => [o.event, `${o.code} · ${o.type}`, o.driver, o.areas, v(o.affected), v(o.displaced), v(o.flooded), v(o.damaged), v(o.destroyed),
          fmt(o.budget), fmt(o.targeted), fmt(o.chf_per_person_targeted, 0), p(o.coverage_hh_share)])} />
      <Info>
        Flood-dominated events show what depth does to households: in the Antananarivo floods of January 2022 (no cyclone) 57% of the affected
        were displaced but only 0.6% of the flooded-or-destroyed houses were destroyed; Gamane 2024 4%, Fytia 2026 14%, whereas wind-dominated
        cyclones reach about 50% (Batsirai, Freddy). Displacement is the main humanitarian consequence of pluvial flooding; destruction is limited to
        traditional huts under deep water. Unit values reported: {d.operations.filter((o) => o.unit_notes).map((o) => `${o.event}: ${o.unit_notes}`).join('; ')}.
      </Info>

      <h4 className="text-base font-semibold text-ink">Unit costs per household assisted</h4>
      <TextTable caption={`Median over the 2020–2026 DREFs with sector budgets and targets (Jan 2020 floods, Jan 2022 Antananarivo, Freddy, Gamane, Fytia); support (IFRC secretariat + National Society) = ${fmt(100 * m.support_share, 0)}% of budgets, i.e. ×${m.markup} on direct costs; ${m.persons_per_hh} persons per household`}
        head={['Sector', 'CHF per household (direct)']}
        rows={SECT.map(([k, lab]) => [lab, fmt(m.unit_costs_chf_per_hh[k] ?? 0)])} />

      <h4 className="text-base font-semibold text-ink">Emergency-response cost rate by flood depth</h4>
      <TextTable caption={`Cost of the response package per affected household by maximum water depth at the dwelling, support included; USD at ${m.chf_usd} USD/CHF, nominal 2020–2026 prices`}
        head={['Depth at the dwelling', 'Response package', 'Direct CHF / HH', 'CHF / HH', 'USD / HH', 'USD / person']}
        rows={d.rates.map((r) => [r.depth_class, r.package, fmt(r.direct_chf_per_hh), fmt(r.chf_per_hh), fmt(r.usd_per_hh), fmt(r.usd_per_person, 1)])} />
      <Info>
        Use: for each design event, sum over flooded residential pixels the population in each depth class divided by {m.persons_per_hh}, times the
        rate of the class. This gives the cost of a full Red Cross-type response to every affected household (an upper reference for the
        humanitarian response). IFRC alone reached 5–20% of affected households in these operations, so its share is that fraction; government
        (BNGRC), UN agencies and NGOs cover the rest at comparable unit costs. The depth thresholds follow the pattern above (displacement from
        about 0.5 m, destruction of traditional huts above about 1 m) and should be checked against modelled buildings once the event runs are done.
      </Info>

      <Toggle title={`Documents (${links.length})`}>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {links.map(([c, e, u]) => <li key={u}><span className="text-ink">{c}</span> · {e}: <a className="break-all text-accent underline underline-offset-2" href={u} target="_blank" rel="noreferrer">{u}</a></li>)}
          <li>IFRC GO, all Madagascar appeals: <a className="text-accent underline underline-offset-2" href="https://go.ifrc.org/countries/109" target="_blank" rel="noreferrer">go.ifrc.org</a></li>
        </ul>
      </Toggle>
      <p className="text-sm text-ink-2">
        Download:{' '}
        {['ifrc_operations.csv', 'emergency_unit_costs.csv', 'emergency_cost_rates.csv'].map((f, i) => (
          <span key={f}>{i > 0 && ' · '}<a className="text-accent underline underline-offset-2" href={dataUrl(`validation/${f}`)} download>{f}</a></span>
        ))}
      </p>
    </div>
  )
}
