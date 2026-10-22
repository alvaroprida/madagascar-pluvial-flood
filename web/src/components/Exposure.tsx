import { useEffect, useMemo, useState } from 'react'
import Map, { Layer, Popup, Source, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { EChartsOption } from 'echarts'
import { dataUrl } from '../data'
import { fmt } from '../format'
import type { Palette } from '../theme'
import type { Exposure as ExposureData, FeatureCollection, Scenario, Units } from '../types'
import { Card, Chart, DataTable, Figure, Info, Legend, Segmented, Stat, Steps } from './ui'
import { AgriValuation } from './AgriValuation'

const BASEMAP = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
const MDG: [[number, number], [number, number]] = [[43.1, -25.7], [50.6, -11.9]]

export const SCENARIO_LABEL: Record<Scenario, string> = {
  hist_baseline: 'Baseline',
  ssp2_2050: 'SSP2-4.5 · 2050',
  ssp5_2050: 'SSP5-8.5 · 2050',
  ssp2_2085: 'SSP2-4.5 · 2085',
  ssp5_2085: 'SSP5-8.5 · 2085',
}

type LayerKey = 'population' | 'econ' | 'agriculture'
type Measure = 'density' | 'growth'
type AgriClass = 'cropland' | 'grassland' | 'value'
type UnitKey = 'catchment' | 'adm1' | 'adm2' | 'adm3' | 'adm4'
const UNIT_LABEL: Record<UnitKey, [string, string]> = {
  catchment: ['Catchment', 'catchments'], adm1: ['Region', 'regions'], adm2: ['District', 'districts'],
  adm3: ['Commune', 'communes'], adm4: ['Fokontany', 'fokontany'],
}
const UNIT_FILE: Record<Exclude<UnitKey, 'catchment'>, string> = {
  adm1: 'adm1_region', adm2: 'adm2_district', adm3: 'adm3_commune', adm4: 'adm4_fokontany',
}

const usd = (v: number) => (v >= 1e9 ? `${fmt(v / 1e9, 1)} bn` : v >= 1e6 ? `${fmt(v / 1e6, 1)} M` : fmt(v))
const people = (v: number) => (v >= 1e6 ? `${fmt(v / 1e6, 2)} M` : fmt(v))

/** Sextile breaks of the positive values, so each map class holds about the same number of polygons. */
function breaks(values: number[]): number[] {
  const v = values.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b)
  if (!v.length) return [0]
  const q = [1, 2, 3, 4, 5].map((k) => v[Math.floor((k / 6) * (v.length - 1))])
  return [...new Set(q.map((x) => Number(x.toPrecision(2))))]
}
const OPACITY = [0.1, 0.25, 0.4, 0.55, 0.7, 0.88]

interface Props {
  exposure: ExposureData
  catchments: FeatureCollection
  palette: Palette
  dark: boolean
}

export function Exposure({ exposure, catchments, palette, dark }: Props) {
  const [layer, setLayer] = useState<LayerKey>('population')
  const [scenario, setScenario] = useState<Scenario>('hist_baseline')
  const [measure, setMeasure] = useState<Measure>('density')
  const [agri, setAgri] = useState<AgriClass>('cropland')
  const [hover, setHover] = useState<{ i: number; lng: number; lat: number } | null>(null)
  const [unit, setUnit] = useState<UnitKey>('catchment')
  const [admin, setAdmin] = useState<Partial<Record<UnitKey, { fc: FeatureCollection; units: Units }>>>({})
  const pop = exposure.population
  const econ = exposure.econ.by_type
  const rates = exposure.admin.agri_usd_per_ha
  const econTotal = (s: Scenario) => econ.rural.usd[s] + econ.urban.usd[s]
  const growthOn = layer !== 'agriculture' && measure === 'growth' && scenario !== 'hist_baseline'

  // administrative levels are fetched the first time they are shown
  useEffect(() => {
    if (unit === 'catchment' || admin[unit]) return
    const n = unit.slice(3)
    Promise.all([fetch(dataUrl(`admin/adm${n}.geojson`)).then((r) => r.json()), fetch(dataUrl(`admin/adm${n}.json`)).then((r) => r.json())])
      .then(([fc, units]) => setAdmin((a) => ({ ...a, [unit]: { fc, units } })))
  }, [unit, admin])
  const loaded = unit === 'catchment' ? { fc: catchments, units: exposure.catchments } : admin[unit]
  const c = loaded?.units ?? exposure.catchments
  const fc = loaded?.fc ?? catchments
  const idKey = unit === 'catchment' || !loaded ? 'basin_id' : 'id'
  const unitName = (i: number) => (c.names ? `${c.names[i]}${c.parents?.[i] ? ` (${c.parents[i]})` : ''}` : c.ids[i])

  // value per polygon for the current view, and how to print it
  const { values, label, show } = useMemo(() => {
    const per = c.ids.map((_, i) => {
      if (layer === 'agriculture') return agri === 'value'
        ? (100 * (c.cropland_km2[i] * rates.cropland + c.grassland_km2[i] * rates.grassland)) / c.area_km2[i]
        : (100 * c[`${agri}_km2`][i]) / c.area_km2[i]
      const src = layer === 'population' ? c.pop : c.usd
      if (growthOn) return src.hist_baseline[i] > 0 ? src[scenario][i] / src.hist_baseline[i] : NaN
      return src[scenario][i] / c.area_km2[i]
    })
    if (layer === 'agriculture') return agri === 'value'
      ? { values: per, label: 'Agricultural value per km² (USD per year)', show: (v: number) => usd(v) }
      : { values: per, label: `${agri === 'cropland' ? 'Cropland' : 'Grassland'} share of the area (%)`, show: (v: number) => `${fmt(v, 1)}%` }
    if (growthOn) return { values: per, label: `Growth factor, ${SCENARIO_LABEL[scenario]} / baseline`, show: (v: number) => `× ${fmt(v, 2)}` }
    return layer === 'population'
      ? { values: per, label: `People per km², ${SCENARIO_LABEL[scenario]}`, show: (v: number) => fmt(v) }
      : { values: per, label: `Building value per km² (USD), ${SCENARIO_LABEL[scenario]}`, show: (v: number) => usd(v) }
  }, [c, layer, scenario, agri, growthOn, rates])

  const br = useMemo(() => breaks(values), [values])
  const colored = useMemo(() => {
    const idx = Object.fromEntries(c.ids.map((id, i) => [id, i]))
    return {
      ...fc,
      features: fc.features.map((f) => {
        const i = idx[f.properties![idKey]]
        return { ...f, properties: { ...f.properties, i, v: i == null || !Number.isFinite(values[i]) ? -1 : values[i] } }
      }),
    }
  }, [fc, c.ids, values, idKey])
  // the polygons in the table: all of them for few units, otherwise the 50 highest
  const ranked = useMemo(() => c.ids.map((_, i) => i).filter((i) => Number.isFinite(values[i]))
    .sort((a, b) => values[b] - values[a]).slice(0, 50), [c.ids, values])
  const fillOpacity = ['step', ['get', 'v'], 0, 0, OPACITY[0], ...br.flatMap((b, k) => [b, OPACITY[k + 1]])] as unknown as number

  const onMove = (e: MapLayerMouseEvent) => {
    const p = e.features?.[0]?.properties
    setHover(p && p.i != null ? { i: p.i, lng: e.lngLat.lng, lat: e.lngLat.lat } : null)
  }

  const axis = {
    axisLabel: { color: palette['text-secondary'] }, axisLine: { lineStyle: { color: palette.axis } },
    axisTick: { show: false }, splitLine: { lineStyle: { color: palette.grid } }, nameTextStyle: { color: palette['text-secondary'] },
  }
  const scen = exposure.scenarios
  const totalsChart: EChartsOption = layer === 'population' ? {
    grid: { left: 56, right: 16, top: 24, bottom: 32 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => `${fmt(Number(v), 1)} M people` },
    xAxis: { type: 'category', data: scen.map((s) => SCENARIO_LABEL[s]), ...axis },
    yAxis: { type: 'value', name: 'Million people', ...axis },
    series: [{
      type: 'bar', barCategoryGap: '40%', data: scen.map((s) => pop.total[s] / 1e6),
      itemStyle: { color: palette['cat-1'], borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: 'top', color: palette['text-secondary'], formatter: (p) => fmt(Number(p.value), 1) },
    }],
  } : {
    legend: { show: false },
    grid: { left: 56, right: 16, top: 24, bottom: 32 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => `${fmt(Number(v), 1)} bn USD` },
    xAxis: { type: 'category', data: scen.map((s) => SCENARIO_LABEL[s]), ...axis },
    yAxis: { type: 'log', name: 'bn USD (log scale)', min: 1, ...axis },
    series: (['rural', 'urban'] as const).map((t, k) => ({
      name: t === 'rural' ? 'Rural buildings' : 'Urban buildings', type: 'bar' as const, barGap: '10%', barCategoryGap: '35%',
      data: scen.map((s) => econ[t].usd[s] / 1e9),
      itemStyle: { color: palette[k ? 'cat-2' : 'cat-4'], borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: 'top' as const, color: palette['text-secondary'], formatter: (p: { value: unknown }) => fmt(Number(p.value), 1) },
    })),
  }

  const h = hover ? hover.i : null
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Population, baseline" value={`${fmt(pop.total.hist_baseline / 1e6, 1)} M`} sub={`${fmt(pop.n_cells_100m / 1e6, 2)} M inhabited 100 m cells`} />
        <Stat label="Building value, baseline" value={`${fmt(econTotal('hist_baseline') / 1e9, 1)} bn USD`} sub={`${fmt((econ.rural.n_buildings + econ.urban.n_buildings) / 1e6, 1)} M building footprints`} />
        <Stat label="Cropland" value={`${fmt(exposure.agriculture.cropland_km2)} km²`} sub={`${fmt((100 * exposure.agriculture.cropland_km2) / exposure.agriculture.land_km2, 1)}% of the land`} />
        <Stat label="Grassland" value={`${fmt(exposure.agriculture.grassland_km2)} km²`} sub={`${fmt((100 * exposure.agriculture.grassland_km2) / exposure.agriculture.land_km2, 1)}% of the land`} />
      </div>

      <Card
        title="Three exposure layers"
        subtitle="What the flood depths will be overlaid with to compute losses. The map sums each layer per catchment or per administrative unit; the national map beside it shows the 1 km detail."
        actions={<Segmented label="Exposure layer" value={layer} onChange={(v) => { setLayer(v); setHover(null) }}
          options={[{ value: 'population', label: 'Population' }, { value: 'econ', label: 'Economic value' }, { value: 'agriculture', label: 'Agriculture' }]} />}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Segmented label="Aggregate by" value={unit} onChange={(v) => { setUnit(v); setHover(null) }}
            options={(Object.keys(UNIT_LABEL) as UnitKey[]).map((k) => ({ value: k, label: UNIT_LABEL[k][0] }))} />
          {layer === 'agriculture'
            ? <Segmented label="Land cover class" value={agri} onChange={setAgri}
                options={[{ value: 'cropland', label: 'Cropland share' }, { value: 'grassland', label: 'Grassland share' }, { value: 'value', label: 'Value per km²' }]} />
            : <>
                <Segmented label="Scenario" value={scenario} onChange={setScenario}
                  options={scen.map((s) => ({ value: s, label: SCENARIO_LABEL[s] }))} />
                <Segmented label="Measure" value={measure} onChange={setMeasure}
                  options={[{ value: 'density', label: 'Per km²' }, { value: 'growth', label: 'Growth vs baseline' }]} />
              </>}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="relative h-[600px] overflow-hidden rounded-lg border border-line">
            <Map
              initialViewState={{ bounds: MDG, fitBoundsOptions: { padding: 16 } }}
              mapStyle={dark ? BASEMAP.dark : BASEMAP.light}
              interactiveLayerIds={['exp-fill']}
              cursor={hover ? 'pointer' : 'grab'}
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
              onLoad={(e) => e.target.resize()}
              attributionControl={{ compact: true, customAttribution: 'WorldPop · LitPop · Google Open Buildings · ESA WorldCover · Wang et al. (2022)' }}
            >
              <Source id="exp" type="geojson" data={colored}>
                <Layer id="exp-fill" type="fill" paint={{ 'fill-color': palette.accent, 'fill-opacity': fillOpacity }} />
                <Layer id="exp-line" type="line" paint={{ 'line-color': palette.surface, 'line-width': 0.4 }} />
                <Layer id="exp-hover" type="line" filter={['==', ['get', 'i'], h ?? -1]}
                  paint={{ 'line-color': palette['text-primary'], 'line-width': 2 }} />
              </Source>
              {hover && h != null && (
                <Popup longitude={hover.lng} latitude={hover.lat} closeButton={false} offset={12}>
                  <div className="font-medium">{unitName(h)} · {fmt(c.area_km2[h])} km²</div>
                  {layer === 'population' && <div className="tabular text-ink-2">{people(c.pop[scenario][h])} people · {fmt(c.pop[scenario][h] / c.area_km2[h])} /km²</div>}
                  {layer === 'econ' && <>
                    <div className="tabular text-ink-2">{usd(c.usd[scenario][h])} USD · {fmt(c.n_buildings[h])} buildings</div>
                    <div className="tabular text-ink-2">{fmt(100 * c.urban_usd_share[h])}% of the baseline value in urban buildings</div>
                  </>}
                  {layer === 'agriculture' && <>
                    <div className="tabular text-ink-2">{fmt(c.cropland_km2[h])} km² cropland · {fmt(c.grassland_km2[h])} km² grassland</div>
                    <div className="tabular text-ink-2">{usd(100 * (c.cropland_km2[h] * rates.cropland + c.grassland_km2[h] * rates.grassland))} USD per year</div>
                  </>}
                  {Number.isFinite(values[h]) && <div className="tabular text-ink">{label.split(',')[0]}: {show(values[h])}</div>}
                </Popup>
              )}
            </Map>
            <div className="absolute left-2 top-2 max-w-[230px] rounded-md bg-surface/90 px-2.5 py-2 text-xs text-ink-2 shadow-sm">
              <div className="mb-1 font-medium text-ink">{label}</div>
              {[...br, Infinity].map((b, k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm" style={{ background: palette.accent, opacity: OPACITY[k] }} />
                  {k === 0 ? `< ${show(b)}` : k === br.length ? `≥ ${show(br[k - 1])}` : `${show(br[k - 1])} – ${show(b)}`}
                </div>
              ))}
              <div className="mt-1 text-ink-3">Classes hold about equal numbers of {UNIT_LABEL[unit][1]}.</div>
              {unit !== 'catchment' && !loaded && <div className="mt-1 text-ink">Loading {UNIT_LABEL[unit][1]}…</div>}
            </div>
          </div>
          <div>
            {layer === 'population' && <Figure src={dataUrl('figures/exposure_population.png')} alt="Population density map of Madagascar" maxHeight={600}
              caption="Baseline population per km², summed from the 100 m cells on a 0.01° (≈1 km) grid." />}
            {layer === 'econ' && <Figure src={dataUrl('figures/exposure_econ_value.png')} alt="Building value density map of Madagascar" maxHeight={600}
              caption="Baseline building value per km², summed from the building footprints on a 0.01° grid." />}
            {layer === 'agriculture' && <Figure src={dataUrl(`figures/exposure_${agri === 'grassland' ? 'grassland' : 'cropland'}.png`)}
              alt={`${agri === 'grassland' ? 'Grassland' : 'Cropland'} share map of Madagascar`} maxHeight={600}
              caption={`${agri === 'grassland' ? 'Grassland' : 'Cropland'} share of the land in each 0.01° cell, from WorldCover read at 80 m.${agri === 'value' ? ' Cropland carries most of the value per km².' : ''}`} />}
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-ink">
            {ranked.length < c.ids.length ? `The 50 ${UNIT_LABEL[unit][1]} with the highest value` : `All ${UNIT_LABEL[unit][1]}`}, by {label.split(',')[0].toLowerCase()}
          </h3>
          {unit !== 'catchment' && (
            <p className="mt-1 text-sm text-ink-2">
              Every {UNIT_LABEL[unit][0].toLowerCase()} with all scenarios:{' '}
              <a className="text-accent underline underline-offset-2" href={dataUrl(`admin/exposure_${UNIT_FILE[unit]}.csv`)} download>
                exposure_{UNIT_FILE[unit]}.csv
              </a>{' '}(agricultural value at USD {rates.cropland}/ha of cropland and {rates.grassland}/ha of grassland).
            </p>
          )}
          <DataTable
            caption={`Exposure per ${UNIT_LABEL[unit][0].toLowerCase()}`}
            head={[UNIT_LABEL[unit][0], label.split(',')[0], `People, ${SCENARIO_LABEL[scenario]}`, `Building value (USD), ${SCENARIO_LABEL[scenario]}`, 'Agricultural value (USD/yr)']}
            rows={ranked.map((i) => [unitName(i), show(values[i]), fmt(c.pop[scenario][i]), usd(c.usd[scenario][i]),
              usd(100 * (c.cropland_km2[i] * rates.cropland + c.grassland_km2[i] * rates.grassland))])}
          />
        </div>
        {layer !== 'agriculture' && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-ink">National total by scenario</h3>
            {layer === 'econ' && <div className="mt-1"><Legend palette={palette} items={[{ label: 'Rural buildings', role: 'cat-4' }, { label: 'Urban buildings', role: 'cat-2' }]} /></div>}
            <Chart option={totalsChart} height={280} label={`National ${layer === 'population' ? 'population' : 'building value'} for each scenario`} />
            <DataTable
              caption="National exposure by scenario"
              head={layer === 'population'
                ? ['Scenario', 'People', 'Growth factor']
                : ['Scenario', 'Rural (USD)', 'Urban (USD)', 'Total (USD)', 'Growth factor']}
              rows={scen.map((s) => layer === 'population'
                ? [SCENARIO_LABEL[s], fmt(pop.total[s]), `× ${fmt(pop.total[s] / pop.total.hist_baseline, 2)}`]
                : [SCENARIO_LABEL[s], usd(econ.rural.usd[s]), usd(econ.urban.usd[s]), usd(econTotal(s)), `× ${fmt(econTotal(s) / econTotal('hist_baseline'), 1)}`])}
            />
          </div>
        )}
      </Card>

      {layer === 'population' && <PopulationDoc exposure={exposure} />}
      {layer === 'econ' && <EconDoc exposure={exposure} />}
      {layer === 'agriculture' && <AgriValuation exposure={exposure} />}
      {layer !== 'agriculture' && <FutureDoc />}
      <AdminDoc exposure={exposure} />
    </div>
  )
}

function AdminDoc({ exposure }: { exposure: ExposureData }) {
  const a = exposure.admin
  return (
    <Card title="Aggregation by catchment and administrative unit" subtitle="The same exposure, summed over two kinds of polygons.">
      <Steps items={[
        { title: 'Catchments', body: <>The {fmt(exposure.catchments.ids.length)} pluvial model domains. Values are summed on a 0.01° grid first and each grid cell goes to the catchment holding its centre, which is enough for maps of the national pattern.</> },
        { title: 'Fokontany', body: <>The {fmt(a.n_units.fokontany)} fokontany polygons (adm4; BNGRC boundaries cleaned and merged by OCHA in 2018) are the finest administrative unit. Each 100 m population cell and each building footprint is assigned to the fokontany containing its centre, directly from the full-resolution layers. Cropland and grassland come from rasterising the fokontany onto the WorldCover grid read at 80 m.</> },
        { title: 'Communes, districts, regions', body: <>Their polygons are the fokontany dissolved by the parent codes (adm3, adm2 and adm1 pcodes): {fmt(a.n_units.commune)} communes, {fmt(a.n_units.district)} districts and {a.n_units.region} regions. Their exposure is the sum of their fokontany, so every level adds up to the same national total.</> },
        { title: 'Agricultural value', body: <>Cropland area × USD {a.agri_usd_per_ha.cropland}/ha plus grassland area × USD {a.agri_usd_per_ha.grassland}/ha per year: the proposed default rates, still to be agreed (Agriculture view).</> },
      ]} />
      <Info>
        Every inhabited population cell falls inside a fokontany. {fmt(a.n_buildings)} buildings worth{' '}
        {usd(a.usd.hist_baseline)} USD ({fmt((100 * a.usd.hist_baseline) / (exposure.econ.by_type.rural.usd.hist_baseline + exposure.econ.by_type.urban.usd.hist_baseline), 2)}% of the
        baseline value) lie just outside the boundaries, on the coast or on small islands, and are not counted in any unit.
        The map polygons are simplified for display; areas and totals use the original boundaries.
      </Info>
    </Card>
  )
}

function PopulationDoc({ exposure }: { exposure: ExposureData }) {
  const p = exposure.population
  return (
    <Card title="How the population layer was built" subtitle="A 100 m grid of residents for 2024, and the same grid scaled to each future scenario.">
      <Steps items={[
        { title: 'Spatial pattern', body: <>WorldPop 2020 UN-adjusted <i>constrained</i> population, 3 arc-seconds (≈100 m). The constrained product places people only in cells where settlements were mapped, so empty land carries no population.</> },
        { title: 'Official totals', body: <>INSTAT (national statistics) regional population projections for 2024. Each region's total was distributed over its WorldPop cells in proportion to their 2020 counts, giving the 2024 baseline: {fmt(p.total.hist_baseline / 1e6, 2)} million people, the INSTAT national figure of about 30.8 million.</> },
        { title: 'Future scenarios', body: <>Each 100 m cell is multiplied by the growth factor of the 1 km cell it falls in, taken from Wang et al. (2022): projected population divided by the 2025 projection, for SSP2 and SSP5 in 2050 and 2085 (see below).</> },
        { title: 'Storage', body: <>{fmt(p.n_cells_100m)} inhabited cells, each a 100 m polygon carrying the baseline and the four future counts. {fmt(100 * exposure.share_in_domain.population, 1)}% of the people live inside the pluvial modelling domain; the rest are on islets left out of it.</> },
      ]} />
      <Info>
        <b className="text-ink">Assumptions.</b> People are counted where they live (night-time population): no daily
        movement and no evacuation. Growth factors only rescale cells that are already inhabited, so new settlements
        on land empty today do not appear in the future scenarios, and the pattern inside each 1 km cell stays that of 2020.
        SSP5 grows less than SSP2 in population (fast development, lower fertility) but much more in GDP.
      </Info>
    </Card>
  )
}

function EconDoc({ exposure }: { exposure: ExposureData }) {
  const t = exposure.econ.by_type
  return (
    <Card title="How the economic value layer was built" subtitle="LitPop GDP, carried down to individual building footprints.">
      <Steps items={[
        { title: 'Gridded GDP', body: <>LitPop (Eberenz et al., 2020) at about 450 m: national nominal GDP (World Bank, 2020 USD) shared between cells in proportion to night-time light intensity times population. Electrification is low in Madagascar, so population drives most of the allocation.</> },
        { title: 'Building footprints', body: <>Google Open Buildings polygons for Madagascar: {fmt((t.rural.n_buildings + t.urban.n_buildings) / 1e6, 1)} million buildings, {fmt(t.rural.footprint_km2 + t.urban.footprint_km2)} km² of footprint. The dataset gives no occupancy type, so residential, commercial and other uses cannot be separated.</> },
        { title: 'Value per building', body: <>Each building is attached to the nearest LitPop cell centre. The cell's value divided by the total footprint area of its buildings gives a value per m², and each building gets that value times its own footprint area.</> },
        { title: 'Urban or rural', body: <>The GHSL settlement model (GHSL-SMOD) classes each building as urban or rural: {fmt(t.urban.n_buildings / 1e6, 1)} M urban buildings ({fmt((100 * t.urban.usd.hist_baseline) / (t.urban.usd.hist_baseline + t.rural.usd.hist_baseline))}% of the value) and {fmt(t.rural.n_buildings / 1e6, 1)} M rural. The class stands for construction quality and selects the vulnerability curve.</> },
        { title: 'Future scenarios', body: <>Each building value is multiplied by the growth factor of its 1 km cell from Wang et al. (2022) GDP (PPP) projections, relative to 2020.</> },
      ]} />
      <Info>
        <b className="text-ink">Assumptions.</b> GDP, an annual flow, stands in for the value of assets, as in the earlier
        riverine assessment, so losses are in GDP-equivalent USD rather than replacement cost. Value only reaches cells
        that hold a mapped building; LitPop value elsewhere is not counted. The baseline is nominal USD while the growth
        factors come from PPP projections: applying them assumes the ratio between the two stays constant.
      </Info>
    </Card>
  )
}

function FutureDoc() {
  return (
    <Card title="Future exposure" subtitle="Scenarios SSP2-4.5 and SSP5-8.5, horizons 2050 and 2085.">
      <Info>
        Future population and GDP follow Wang et al. (2022), who give 1 km grids of population and GDP (PPP) for every
        SSP from 2020 to 2100 in 5-year steps. Their GDP grids disaggregate the national SSP Database (IIASA) projections
        with the LitPop method (night-time lights from NOAA's National Geophysical Data Center combined with LandScan
        population). Their population grids come from a machine-learning model that distributes the national SSP
        projections using WorldPop unconstrained estimates, the Global Urban Land Use Change Product (GULCP) and other
        predictors.
      </Info>
      <Info>
        Growth factors are the ratio of projected to base-year values in each 1 km cell (2020 for GDP, 2025 for
        population) and are applied to the baseline layers. Only the socio-economic pathway (SSP2 or SSP5) changes
        the exposure; the emission level paired with it (4.5 or 8.5 W/m²) acts on the hazard side, through the
        design rainfall.
      </Info>
    </Card>
  )
}
