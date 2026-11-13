import { useMemo, useState } from 'react'
import Map, { Layer, Popup, Source, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { EChartsOption } from 'echarts'
import { dataUrl } from '../data'
import { fmt, MONTHS } from '../format'
import { CATEGORY_RAMP, POP_LABEL, POP_SLOT, type Palette } from '../theme'
import type { Cyclones, FeatureCollection, PopKey, Rainfall as RainfallData } from '../types'
import { CatchmentRainfall } from './CatchmentRainfall'
import { CycloneEvents, DepthDurationLaw, DesignDurations, DurationTests, Hypotheses, IntensityChecks, LawValidation,
  NontcEvents, RadiusCheck, Section, StormMethod, StormShapes, StormTypes, useDesignStorms } from './DesignRainfall'
import { FutureRainfall } from './FutureRainfall'
import { GpmValidation } from './GpmValidation'
import { Chapter, ChapterIndex, Chart, DataTable, Figure, Info, Legend, Ref, Stat, Steps, Toggle, type ChapterEntry } from './ui'

/** Display name: unnamed systems carry their date in the catalogue key (Unnamed_19980123). */
const stormLabel = (name: string) => (name.startsWith('Unnamed_') ? 'Unnamed' : name)

const BASEMAP = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
const POPS: PopKey[] = ['total', 'tc', 'nontc']

const CHAPTERS: ChapterEntry[] = [
  { id: 'ch1', number: 1, title: 'Extreme rainfall mechanisms in Madagascar',
    summary: 'The two storm types behind extreme rainfall, from the ORSTOM rainfall study, and the working hypotheses they set.' },
  { id: 'ch2', number: 2, title: 'Historical rainfall record and population segmentation',
    summary: 'The GPM IMERG daily record (1998–2025) split into cyclone, non-cyclone and total rainfall.' },
  { id: 'ch3', number: 3, title: 'Characteristic duration of rainfall events',
    summary: 'How long cyclone and non-cyclone rainfall events last, and the design duration of each.' },
  { id: 'ch4', number: 4, title: 'Design rainfall depths',
    summary: 'Return-period depths per population from an extreme value analysis, extended to sub-daily durations.' },
  { id: 'ch5', number: 5, title: 'Design hyetographs',
    summary: 'The design depths spread in time over each storm type, and their intensities checked against records.' },
  { id: 'ch6', number: 6, title: 'Catchment design rainfall explorer',
    summary: 'Every result of Chapters 2–5 for any catchment of the domain.' },
  { id: 'ch7', number: 7, title: 'Validation of GPM against rain gauges',
    summary: 'The GPM record compared with station and basin observations: totals, seasons, variability, extremes and intensities.' },
]

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
  const [view, setView] = useState<'baseline' | 'future'>('baseline')
  const d = useDesignStorms()

  // ---- catalogue: storms per year, stacked by peak category (ordinal ramp)
  const catalogue: EChartsOption = useMemo(() => {
    const y0 = Math.min(...cyclones.storms.map((s) => s.year)), y1 = Math.max(...cyclones.storms.map((s) => s.year))
    const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i)
    return {
      grid: { left: 40, right: 12, top: 12, bottom: 32 },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (ps) => {
          const year = (ps as unknown as { axisValue: string }[])[0].axisValue
          const list = cyclones.storms.filter((s) => s.year === Number(year))
          return `<b>${year}</b>: ${list.length} storm${list.length === 1 ? '' : 's'}<br/>` +
            list.map((s) => `${stormLabel(s.name)} · ${s.category} · ${s.vmax_kmh} km/h`).join('<br/>')
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
    yAxis: { type: 'value', name: 'Daily depth (mm)', ...axisStyle(palette) },
    series: POPS.map((k) => ({
      name: POP_LABEL[k], type: 'line', symbolSize: 8, lineStyle: { width: 2 },
      itemStyle: { color: palette[POP_SLOT[k]], borderColor: palette.surface, borderWidth: 2 },
      data: r.growth_curves_mm[k].map((g) => g.median),
    })),
  }

  const onMove = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    setHover(f ? { name: f.properties.name, year: f.properties.year, category: f.properties.category,
                   vmax: f.properties.vmax_kn, lng: e.lngLat.lng, lat: e.lngLat.lat } : null)
  }
  const catColor = ['match', ['get', 'cat'], ...CATEGORY_RAMP.flatMap((c, i) => [i, c]), CATEGORY_RAMP[3]] as unknown as string

  const baseline = (
    <div className="space-y-4">
      <ChapterIndex title="Baseline rainfall: contents" chapters={CHAPTERS} />

      <Chapter entry={CHAPTERS[0]}
        outcome={<>Three working hypotheses (H1–H3). The two populations are separated in the record in <Ref to="ch2">Chapter 2</Ref>; the event durations (H2, H3) are tested in <Ref to="ch3">Chapter 3</Ref>.</>}>
        <StormTypes />
        <Hypotheses />
      </Chapter>

      <Chapter entry={CHAPTERS[1]} builds={<>hypothesis H1 (<Ref to="s1-2">section 1.2</Ref>): cyclone and non-cyclone rainfall are separate populations.</>}
        outcome={<>Daily cyclone, non-cyclone and total rainfall for every GPM cell and, as area-weighted averages, for every catchment. These series give the event durations of <Ref to="ch3">Chapter 3</Ref> and the extreme value analysis of <Ref to="ch4">Chapter 4</Ref>.</>}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Rainfall record" value={`${r.record.years} years`} sub={`GPM IMERG daily, ${r.record.start.slice(0, 4)}–${r.record.end.slice(0, 4)}, ${r.record.grid_deg}°`} />
          <Stat label="Cyclones in the catalogue" value={cyclones.storms.length} sub={`landfall or within ${cyclones.max_coast_km} km of the coast`} />
          <Stat label="Cyclone share of rainfall" value={`${fmt(r.tc_share_pct.land_mean, 1)}%`} sub={`up to ${fmt(r.tc_share_pct.max_cell, 1)}% locally`} />
          <Stat label="Cyclone-flagged cell-days" value={`${fmt(r.flagged_cell_days_pct, 2)}%`} sub={`within ${r.radius_km} km of a storm centre`} />
        </div>

        <Section id="s2-1" title="2.1 Data and segmentation method">
          <Steps items={[
            { title: 'Catalogue', body: <>One rule over the whole record: every <b>IBTrACS v04r01</b> storm (South Indian basin, NOAA NCEI) that made landfall on Madagascar or passed within <b>{cyclones.max_coast_km} km</b> of its coast, whatever its intensity: {cyclones.storms.length} storms, of which {cyclones.n_below_ts} never reached tropical-storm strength (34 kn). Weak systems are kept because rain does not scale with wind: ORSTOM notes heavy rain from tropical depressions too.</> },
            { title: 'Check against the damage list', body: <>The {cyclones.damage_check.n_list} storms that caused damage in Madagascar in 2000–2022 are matched to IBTrACS by name and date of passage: {cyclones.damage_check.n_matched} are found, and all {cyclones.damage_check.n_in_rule} are in the rule set (the farthest passed 288 km from the coast). {cyclones.damage_check.unmatched.length > 0 && <>{cyclones.damage_check.unmatched.map((u) => u.name).join(', ')} has no name and no storm within ±5 days; it is reported, not substituted. </>}The rule adds the weaker or offshore storms without reported damage, whose rain would otherwise count as non-cyclone rain.</> },
            { title: 'Attribution', body: <>A GPM cell-day is <b>cyclone rainfall</b> when any 6-hourly fix of a matched storm on that day lies within <b>{r.radius_km} km</b> of the cell centre. The radius is generous next to a typical radius of maximum wind (~50 km), to catch the outer rainbands. It is the main tunable assumption; <Ref to="s2-4">section 2.4</Ref> tests it.</> },
            { title: 'Three populations', body: <><b>Tropical-cyclone</b> rainfall (flagged cell-days), <b>non-TC</b> rainfall (all other cell-days) and <b>total</b> rainfall (the unmodified record). TC and non-TC are complementary: together they reproduce the record exactly.</> },
          ]} />
        </Section>

        <Section id="s2-2" title="2.2 Tropical cyclone catalogue" subtitle="Storms per year by peak intensity (1-minute sustained wind, Saffir-Simpson), and their best tracks. Hover for details.">
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
                rows={cyclones.storms.map((s) => [stormLabel(s.name), s.date, s.vmax_kmh, s.category])} />
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
                attributionControl={{ compact: true, customAttribution: 'Tracks: IBTrACS v04r01 (NOAA NCEI)' }}
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
                    <div className="font-medium">{stormLabel(hover.name)} ({hover.year})</div>
                    <div className="text-ink-2">{hover.category} · peak {fmt(hover.vmax * 1.852)} km/h</div>
                  </Popup>
                )}
              </Map>
            </div>
          </div>
        </Section>

        <Section id="s2-3" title="2.3 Rainfall climatology per population" subtitle={`Mean annual rainfall over land, ${r.record.start.slice(0, 4)}–${r.record.end.slice(0, 4)}.`}>
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
              split matters most for the extremes (<Ref to="ch4">Chapter 4</Ref>).
            </Info>
          </div>
        </Section>

        {d && <RadiusCheck d={d} />}
      </Chapter>

      <Chapter entry={CHAPTERS[2]}
        builds={<>hypotheses H2 and H3 (<Ref to="s1-2">section 1.2</Ref>) and the population series of <Ref to="ch2">Chapter 2</Ref>. At a given return period, flood depth keeps growing with the volume of rain, so the duration of a design event is set by how long real storms last, not by flood runs (<Ref to="s3-4">section 3.4</Ref>).</>}
        outcome={d && <>Cyclone events: {d.config.tc.duration_h} h, with the daily split of section 3.1. Non-cyclone events: {d.config.nontc.duration_h} h holding the whole daily depth, around a short intense core, with 40% of the rain outside the core before the peak. These set the storm lengths and structure in <Ref to="ch5">Chapter 5</Ref>; the half-hourly sample also validates the depth-duration law in <Ref to="s4-3">section 4.3</Ref>.</>}>
        {d ? <>
          <CycloneEvents d={d} palette={palette} />
          <NontcEvents d={d} />
          <DesignDurations d={d} />
          <div id="s3-4" className="scroll-mt-4">
            <Toggle title="3.4 Supporting analysis: flood-model duration tests">
              <DurationTests d={d} />
            </Toggle>
          </div>
        </> : <p className="text-sm text-ink-3">Loading…</p>}
      </Chapter>

      <Chapter entry={CHAPTERS[3]}
        builds={<>the daily population series of <Ref to="ch2">Chapter 2</Ref> and the cyclone event length of <Ref to="s3-1">section 3.1</Ref> (2–4 day depths).</>}
        outcome={<>The daily depth PJ(T) per population, return period and catchment, the 2–4 day depths, and sub-daily depths P(t) from the law, validated at 3 h. They scale the design hyetographs of <Ref to="ch5">Chapter 5</Ref>.</>}>
        <Section id="s4-1" title="4.1 Extreme value analysis of daily rainfall" subtitle="Daily (calendar-day) depth by return period: median over land cells (lines), and the 100-year depth (maps, shared colour scale).">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div>
              <Chart option={growth} height={320} label="Daily design depth by return period for each rainfall population" />
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
                {r.total_vs_direct_fit[0].rp} years and {fmt(((r.total_vs_direct_fit.find((c) => c.rp === 100)?.median ?? 1) - 1) * 100, 0)}% above it at
                100 years (median over land). Ordinary rain controls the frequent events; cyclone depths rise steeply and
                match non-cyclone depths at around 50 years.
              </Info>
            </div>
            <Figure src={dataUrl('figures/design_depth_rp100_by_population.png')}
              alt="Maps of the 100-year daily rainfall depth for total, cyclone and non-cyclone rainfall" />
          </div>
        </Section>

        {d && <><DepthDurationLaw d={d} /><LawValidation d={d} /></>}
      </Chapter>

      <Chapter entry={CHAPTERS[4]}
        builds={<>the depths of <Ref to="ch4">Chapter 4</Ref>, the durations and event structure of <Ref to="ch3">Chapter 3</Ref>, and the antecedent soil moisture hypothesis of the <a href="#inputs" className="font-medium text-accent underline underline-offset-2">Static inputs</a> tab.</>}
        outcome={<>One design hyetograph per population, return period and catchment, with its antecedent soil moisture: the rainfall input to the flood simulations. <Ref to="ch6">Chapter 6</Ref> gives them for every catchment.</>}>
        {d ? <>
          <StormMethod d={d} palette={palette} />
          <StormShapes d={d} palette={palette} catchments={catchments} dark={dark} />
          <IntensityChecks d={d} />
        </> : <p className="text-sm text-ink-3">Loading…</p>}
      </Chapter>

      <Chapter entry={CHAPTERS[5]} builds={<>Chapters 2–5, for the {catchments.features.length} catchments of the domain.</>}>
        <CatchmentRainfall catchments={catchments} palette={palette} dark={dark} initial={r.pilots[0].basin_id} />
      </Chapter>

      <Chapter entry={CHAPTERS[6]} builds={<>the GPM record of <Ref to="ch2">Chapter 2</Ref>, and the ORSTOM study of <Ref to="ch1">Chapter 1</Ref> for the gauge data.</>}
        outcome={<>GPM is a sound basis for the daily design rainfall over the highlands, west and north; it underestimates the wet east coast (totals 20–45%, daily extremes ~20%) and the longest multi-day cyclone sequences, and cannot resolve sub-daily intensities, which come from the gauge-based law.</>}>
        <GpmValidation />
      </Chapter>
    </div>
  )

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 rounded-lg border border-line bg-surface p-1 text-sm" aria-label="Rainfall views">
        {([['baseline', 'Baseline rainfall'], ['future', 'Future projected rainfall']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} aria-current={view === k ? 'page' : undefined}
            className={`rounded-md px-3 py-1.5 ${view === k ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </nav>
      {view === 'baseline' ? baseline : <FutureRainfall palette={palette} initial={r.pilots[0].basin_id} />}
    </div>
  )
}
