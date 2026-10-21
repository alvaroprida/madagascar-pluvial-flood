import { useMemo, useState } from 'react'
import Map, { Layer, Popup, Source, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { EChartsOption } from 'echarts'
import { dataUrl } from '../data'
import { fmt, MONTHS } from '../format'
import { CATEGORY_RAMP, POP_LABEL, POP_SLOT, type Palette } from '../theme'
import type { Cyclones, FeatureCollection, PopKey, Rainfall as RainfallData } from '../types'
import { CatchmentRainfall } from './CatchmentRainfall'
import { Card, Chart, DataTable, Figure, Info, Legend, Segmented, Stat, Steps } from './ui'

const BASEMAP = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
const POPS: PopKey[] = ['total', 'tc', 'nontc']

interface Props {
  rainfall: RainfallData
  cyclones: Cyclones
  tracks: FeatureCollection
  catchments: FeatureCollection
  palette: Palette
  dark: boolean
}

const axisStyle = (p: Palette) => ({
  axisLabel: { color: p['text-secondary'] },
  axisLine: { lineStyle: { color: p.axis } },
  axisTick: { show: false },
  splitLine: { lineStyle: { color: p.grid } },
  nameTextStyle: { color: p['text-secondary'] },
})

export function Rainfall({ rainfall: r, cyclones, tracks, catchments, palette, dark }: Props) {
  const [hover, setHover] = useState<{ name: string; year: number; category: string; vmax: number; lng: number; lat: number } | null>(null)
  const [pilot, setPilot] = useState(r.pilots[0].basin_id)
  const pilotData = r.pilots.find((p) => p.basin_id === pilot)!

  // ---- catalogue: storms per year, stacked by peak category (ordinal ramp)
  const catalogue: EChartsOption = useMemo(() => {
    const years = Array.from({ length: 2022 - 2000 + 1 }, (_, i) => 2000 + i)
    return {
      grid: { left: 40, right: 12, top: 12, bottom: 32 },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (ps) => {
          const year = (ps as unknown as { axisValue: string }[])[0].axisValue
          const list = cyclones.storms.filter((s) => s.year === Number(year))
          return `<b>${year}</b>: ${list.length} storm${list.length === 1 ? '' : 's'}<br/>` +
            list.map((s) => `${s.name} · ${s.category} · ${s.vmax_kmh} km/h`).join('<br/>')
        },
      },
      xAxis: { type: 'category', data: years.map(String), ...axisStyle(palette),
               axisLabel: { color: palette['text-secondary'], interval: 3 } },
      yAxis: { type: 'value', minInterval: 1, name: 'Storms', ...axisStyle(palette) },
      series: cyclones.categories.map((cat, c) => ({
        name: cat, type: 'bar', stack: 'n', barCategoryGap: '25%',
        itemStyle: { color: CATEGORY_RAMP[c], borderColor: palette.surface, borderWidth: 1 },
        data: years.map((y) => cyclones.storms.filter((s) => s.year === y && s.cat === c).length || null),
      })),
    }
  }, [cyclones, palette])

  // ---- monthly regime: TC and non-TC stack to the total
  const monthly: EChartsOption = {
    grid: { left: 48, right: 12, top: 12, bottom: 32 },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps) => {
        const m = r.monthly_mm[(ps as { dataIndex: number }[])[0].dataIndex]
        return `<b>${MONTHS[m.month - 1]}</b><br/>Total ${fmt(m.total)} mm<br/>Tropical cyclone ${fmt(m.tc)} mm ` +
          `(${fmt((100 * m.tc) / Math.max(m.total, 1e-9), 1)}%)<br/>Non-TC ${fmt(m.nontc)} mm<br/>` +
          `Cyclone-flagged cell-days ${fmt(m.flagged_pct, 1)}%`
      },
    },
    xAxis: { type: 'category', data: MONTHS, ...axisStyle(palette) },
    yAxis: { type: 'value', name: 'mm per month', ...axisStyle(palette) },
    series: (['nontc', 'tc'] as PopKey[]).map((k) => ({
      name: POP_LABEL[k], type: 'bar', stack: 'm', barCategoryGap: '30%',
      itemStyle: { color: palette[POP_SLOT[k]], borderColor: palette.surface, borderWidth: 2,
                   borderRadius: k === 'tc' ? [4, 4, 0, 0] : 0 },
      data: r.monthly_mm.map((m) => m[k]),
    })),
  }

  // ---- growth curves: land median per return period and population
  const growth: EChartsOption = {
    grid: { left: 52, right: 16, top: 12, bottom: 44 },
    tooltip: { trigger: 'axis', valueFormatter: (v) => `${fmt(Number(v))} mm` },
    xAxis: { type: 'category', data: r.growth_curves_mm.total.map((g) => String(g.rp)), name: 'Return period (years)',
             nameLocation: 'middle', nameGap: 28, ...axisStyle(palette), boundaryGap: false },
    yAxis: { type: 'value', name: '24 h depth (mm)', ...axisStyle(palette) },
    series: POPS.map((k) => ({
      name: POP_LABEL[k], type: 'line', symbolSize: 8, lineStyle: { width: 2 },
      itemStyle: { color: palette[POP_SLOT[k]], borderColor: palette.surface, borderWidth: 2 },
      data: r.growth_curves_mm[k].map((g) => g.median),
    })),
  }

  // ---- pilot basin: depths per population and the model forcing
  const pilotDepth: EChartsOption = {
    grid: { left: 52, right: 16, top: 12, bottom: 44 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => `${fmt(Number(v))} mm` },
    xAxis: { type: 'category', data: pilotData.depth_24h.total.map((d) => String(d.rp)), name: 'Return period (years)',
             nameLocation: 'middle', nameGap: 28, ...axisStyle(palette) },
    yAxis: { type: 'value', name: '24 h depth (mm)', ...axisStyle(palette) },
    series: POPS.map((k) => ({
      name: POP_LABEL[k], type: 'bar', barGap: '10%', barCategoryGap: '30%',
      itemStyle: { color: palette[POP_SLOT[k]], borderRadius: [4, 4, 0, 0] },
      data: pilotData.depth_24h[k].map((d) => d.mm),
    })),
  }
  const step = pilotData.hyetograph_rp100.step_h
  const hyeto: EChartsOption = {
    grid: { left: 52, right: 16, top: 12, bottom: 44 },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (ps) => {
        const i = (ps as { dataIndex: number }[])[0].dataIndex
        return `${fmt(i * step, 1)}–${fmt((i + 1) * step, 1)} h<br/><b>${fmt(pilotData.hyetograph_rp100.intensity_mm_hr[i], 1)} mm/h</b>`
      },
    },
    xAxis: { type: 'category', data: pilotData.hyetograph_rp100.intensity_mm_hr.map((_, i) => fmt(i * step, 1)),
             name: 'Time (h)', nameLocation: 'middle', nameGap: 28, ...axisStyle(palette),
             axisLabel: { color: palette['text-secondary'], interval: 7 } },
    yAxis: { type: 'value', name: 'Intensity (mm/h)', ...axisStyle(palette) },
    series: [{ type: 'bar', barCategoryGap: '12%', data: pilotData.hyetograph_rp100.intensity_mm_hr,
               itemStyle: { color: palette[POP_SLOT.total], borderRadius: [3, 3, 0, 0] } }],
  }
  const total100 = pilotData.depth_24h[r.design_population].find((d) => d.rp === 100)!.mm
  const peak = Math.max(...pilotData.hyetograph_rp100.intensity_mm_hr)

  const onMove = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    setHover(f ? { name: f.properties.name, year: f.properties.year, category: f.properties.category,
                   vmax: f.properties.vmax_kn, lng: e.lngLat.lng, lat: e.lngLat.lat } : null)
  }
  const catColor = ['match', ['get', 'cat'], ...CATEGORY_RAMP.flatMap((c, i) => [i, c]), CATEGORY_RAMP[3]] as unknown as string

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Rainfall record" value={`${r.record.years} years`} sub={`GPM IMERG daily, ${r.record.start.slice(0, 4)}–${r.record.end.slice(0, 4)}, ${r.record.grid_deg}°`} />
        <Stat label="Cyclones in the catalogue" value={`${cyclones.n_matched} / ${cyclones.n_catalogue}`} sub="matched to IBTrACS best tracks" />
        <Stat label="Cyclone share of rainfall" value={`${fmt(r.tc_share_pct.land_mean, 1)}%`} sub={`up to ${fmt(r.tc_share_pct.max_cell, 1)}% locally`} />
        <Stat label="Cyclone-flagged cell-days" value={`${fmt(r.flagged_cell_days_pct, 2)}%`} sub={`within ${r.radius_km} km of a storm centre`} />
      </div>

      <Card title="Splitting the rainfall record into cyclone and non-cyclone rainfall">
        <Steps items={[
          { title: 'Catalogue', body: <>{cyclones.n_catalogue} storms that made landfall on, or passed close to, Madagascar between 2000 and 2022, with their date of passage.</> },
          { title: 'Best tracks', body: <>Each storm is matched to <b>IBTrACS v04r00</b> (South Indian basin, NOAA NCEI): a geographic screen (a fix within 8° of the island), the name (tested against each part of combined names such as <i>Eline:Leone</i>) and the date of passage to pick between storms that share a name. {cyclones.unmatched.length > 0 && <>One entry has no name and no storm within ±5 days ({cyclones.unmatched.map((u) => u.name).join(', ')}); it is reported, not substituted.</>}</> },
          { title: 'Attribution', body: <>A GPM cell-day is <b>cyclone rainfall</b> when any 6-hourly fix of a matched storm on that day lies within <b>{r.radius_km} km</b> of the cell centre. The radius is generous next to a typical radius of maximum wind (~50 km), to catch the outer rainbands. It is the main tunable assumption: a wider radius raises the cyclone share.</> },
          { title: 'Three populations', body: <><b>Tropical-cyclone</b> rainfall (flagged cell-days), <b>non-TC</b> rainfall (all other cell-days) and <b>total</b> rainfall (the unmodified record). TC and non-TC are complementary: together they reproduce the record exactly.</> },
        ]} />
      </Card>

      <Card title="Cyclone catalogue" subtitle="Storms per year by peak intensity (1-minute sustained wind, Saffir-Simpson), and their best tracks. Hover for details.">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Chart option={catalogue} height={380} label="Number of cyclones per year by peak category" />
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-2">
              {cyclones.categories.map((c, i) => (
                <li key={c} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm" style={{ background: CATEGORY_RAMP[i] }} aria-hidden />{c}
                </li>
              ))}
            </ul>
            <DataTable caption="Cyclone catalogue" head={['Storm', 'Date of passage', 'Peak wind (km/h)', 'Category']}
              rows={cyclones.storms.map((s) => [s.name, s.date, s.vmax_kmh, s.category])} />
          </div>
          <div className="relative h-[440px] overflow-hidden rounded-lg border border-line">
            <Map
              initialViewState={{ bounds: [[33, -32], [62, -8]] }}
              mapStyle={dark ? BASEMAP.dark : BASEMAP.light}
              interactiveLayerIds={['track-hit']}
              cursor={hover ? 'pointer' : 'grab'}
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
              // the container settles after the grid lays out; re-measure so WebGL fills it
              onLoad={(e) => e.target.resize()}
              attributionControl={{ compact: true, customAttribution: 'Tracks: IBTrACS v04r00 (NOAA NCEI)' }}
            >
              <Source id="tracks" type="geojson" data={tracks}>
                <Layer id="track" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                  paint={{ 'line-color': catColor, 'line-width': 1.6, 'line-opacity': hover ? 0.25 : 0.85 }} />
                <Layer id="track-hover" type="line" filter={['==', ['get', 'name'], hover?.name ?? '']}
                  layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                  paint={{ 'line-color': palette['text-primary'], 'line-width': 3 }} />
                <Layer id="track-hit" type="line" paint={{ 'line-color': '#000', 'line-opacity': 0, 'line-width': 12 }} />
              </Source>
              {hover && (
                <Popup longitude={hover.lng} latitude={hover.lat} closeButton={false} offset={12}>
                  <div className="font-medium">{hover.name} ({hover.year})</div>
                  <div className="text-ink-2">{hover.category} · peak {fmt(hover.vmax * 1.852)} km/h</div>
                </Popup>
              )}
            </Map>
          </div>
        </div>
      </Card>

      <Card title="Total, cyclone and non-cyclone rainfall" subtitle={`Mean annual rainfall over land, ${r.record.start.slice(0, 4)}–${r.record.end.slice(0, 4)}.`}>
        <Figure
          src={dataUrl('figures/rain_annual_by_population.png')}
          alt="Maps of mean annual total, non-TC and cyclone rainfall, and the cyclone share"
          caption={<>Land mean: total <b>{fmt(r.land_mean_mm_per_year.total)} mm/yr</b>, of which <b>{fmt(r.land_mean_mm_per_year.tc)} mm</b> from cyclones and {fmt(r.land_mean_mm_per_year.nontc)} mm from other systems. Cyclone rainfall peaks on the east coast; its <i>share</i> peaks in the dry southwest, where little else falls.</>}
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <h3 className="text-sm font-semibold text-ink">Seasonal cycle (land mean)</h3>
            <Chart option={monthly} height={300} label="Monthly rainfall split into cyclone and non-cyclone rainfall" />
            <Legend palette={palette} items={[{ label: 'Non-TC', role: POP_SLOT.nontc }, { label: 'Tropical cyclone', role: POP_SLOT.tc }]} />
            <DataTable caption="Monthly rainfall by population" head={['Month', 'Total (mm)', 'TC (mm)', 'Non-TC (mm)', 'Flagged cell-days (%)']}
              rows={r.monthly_mm.map((m) => [MONTHS[m.month - 1], m.total, m.tc, m.nontc, m.flagged_pct])} />
          </div>
          <Info>
            Cyclone rainfall falls mostly in January–March, when it makes up 12–18% of the monthly total (4% in
            December), and there is none from June to October. Cyclones are a modest share of the totals; the
            split matters most for the extremes, which the next section shows.
          </Info>
        </div>
      </Card>

      <Card title="Design rainfall depth per population" subtitle="24-hour depth by return period: median over land cells (lines), and the 100-year depth (maps, shared colour scale).">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div>
            <Chart option={growth} height={320} label="24-hour design depth by return period for each rainfall population" />
            <Legend palette={palette} items={POPS.map((k) => ({ label: POP_LABEL[k], role: POP_SLOT[k], line: true }))} />
            <DataTable caption="Design depths, land median and 10–90% range" head={['Return period', 'Total (mm)', 'TC (mm)', 'Non-TC (mm)']}
              rows={r.growth_curves_mm.total.map((g, i) => [
                `${g.rp} yr`,
                ...POPS.map((k) => `${fmt(r.growth_curves_mm[k][i].median)} (${fmt(r.growth_curves_mm[k][i].p10)}–${fmt(r.growth_curves_mm[k][i].p90)})`),
              ])} />
            <Info>
              Seasonal maxima of daily rainfall (seasons start on {MONTHS[r.season_start_month - 1]} 1, so a cyclone
              season is never split) are fitted with a <b>Gumbel</b> distribution by the method of moments, separately
              for cyclone and non-cyclone rainfall. Many seasons bring no cyclone rain to a given cell, so the TC fit
              is <b>mixed</b>: a probability mass at zero for those seasons and a Gumbel for the rest.
            </Info>
            <Info>
              The <b>total</b> is derived from the two: a season's maximum is the larger of its cyclone and
              non-cyclone maxima, so with independent populations P(total ≤ x) = P(TC ≤ x) · P(non-TC ≤ x). This keeps
              the total at or above both components everywhere; fitting the three records independently put TC
              depths above total depths in a third of the island at 100 years. As a check, the derived total is
              within {fmt(Math.abs(1 - r.total_vs_direct_fit[0].median) * 100, 0)}% of a direct fit of the whole record at
              2 years and {fmt((r.total_vs_direct_fit[r.total_vs_direct_fit.length - 1].median - 1) * 100, 0)}% above it at
              100 years (median over land). Ordinary rain controls the frequent events; cyclone depths rise steeply and
              match non-cyclone depths at around 50 years.
            </Info>
          </div>
          <Figure src={dataUrl('figures/design_depth_rp100_by_population.png')}
            alt="Maps of the 100-year 24-hour rainfall depth for total, cyclone and non-cyclone rainfall" />
        </div>
      </Card>

      <Card
        title="Design storm for a pilot basin"
        subtitle="The basin depth is the median of the GPM cells it touches. The 24-hour depth is spread into 30-minute blocks with the alternating-block method."
        actions={<Segmented label="Pilot basin" value={pilot} onChange={setPilot}
          options={r.pilots.map((p) => ({ value: p.basin_id, label: p.basin_id }))} />}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">24-hour depth by population ({pilotData.gpm_cells} GPM cells)</h3>
            <Chart option={pilotDepth} height={300} label="Basin design depth by return period and population" />
            <Legend palette={palette} items={POPS.map((k) => ({ label: POP_LABEL[k], role: POP_SLOT[k] }))} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">100-year hyetograph, {POP_LABEL[r.design_population].toLowerCase()} rainfall ({fmt(total100)} mm, peak {fmt(peak)} mm/h)</h3>
            <Chart option={hyeto} height={300} label="100-year design hyetograph in 30-minute blocks" />
          </div>
        </div>
        <Info>
          Depth-duration law P(t) = P<sub>24h</sub>·(t/24)<sup>n</sup> with n = {fmt(r.dd_exponent, 2)}. With only daily
          data, <b>n is uncalibrated</b>: it sets the peak intensity, and so the peak flood depth. It will be calibrated
          on IMERG half-hourly data before the design events are run. The models are currently set up with the
          {POP_LABEL[r.design_population].toLowerCase()} rainfall; which population drives the hazard maps is still
          open, and switching is one setting.
        </Info>
      </Card>
      <CatchmentRainfall catchments={catchments} palette={palette} dark={dark} initial={r.pilots[0].basin_id} />
    </div>
  )
}
