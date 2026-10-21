import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useState } from 'react'
import Map, { Layer, Popup, Source, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { EChartsOption } from 'echarts'
import { fmt } from '../format'
import type { Palette } from '../theme'
import type { Domain as DomainData, FeatureCollection, SplitNode } from '../types'
import { Card, Chart, DataTable, Info, Segmented, Stat, Steps } from './ui'

// MapLibre 6 ships its worker as a separate module that Vite won't find on its own.
setWorkerUrl(workerUrl)

const BASEMAP = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
const MDG: [[number, number], [number, number]] = [[43.1, -25.7], [50.6, -11.9]]

// Area classes (km²); the same breaks label the legend.
const BREAKS = [50, 100, 250, 500, 1000]
// HydroBASINS level a basin was kept at: ordinal, light (coarse) to dark (fine).
const LEVEL_SHADES: Record<number, number> = { 7: 0.18, 8: 0.4, 9: 0.65, 10: 0.92 }

interface Props {
  domain: DomainData
  catchments: FeatureCollection
  palette: Palette
  dark: boolean
}

type ColourBy = 'area' | 'level'

function Tree({ node, max }: { node: SplitNode; max: number }) {
  const split = node.children.length > 1
  const passThrough = node.children.length === 1
  const big = node.sub_area > max
  return (
    <li className="mt-1">
      <span className="tabular text-ink">
        <span className="mr-1.5 rounded bg-banner px-1.5 py-0.5 text-xs font-medium text-accent">L{node.level}</span>
        {node.pfaf_id} · {fmt(node.sub_area)} km²
      </span>
      <span className="ml-2 text-ink-3">
        {big && passThrough && '> threshold, but this level does not divide it → go one level down'}
        {big && split && `> threshold → replaced by its ${node.children.length} children`}
        {!big && '✓ kept'}
      </span>
      {big && node.children.length > 0 && (
        <ul className="ml-5 border-l border-line pl-3">
          {[...node.children].sort((a, b) => a.pfaf_id - b.pfaf_id).map((c) => <Tree key={c.pfaf_id} node={c} max={max} />)}
        </ul>
      )}
    </li>
  )
}

export function Domain({ domain, catchments, palette, dark }: Props) {
  const [hover, setHover] = useState<{ id: string; area: number; level: number; inflow: number; endo: number; pilot: boolean; lng: number; lat: number } | null>(null)
  const [colourBy, setColourBy] = useState<ColourBy>('area')
  const s = domain.area_stats_km2
  const levels = Object.entries(domain.by_level).map(([k, v]) => ({ level: Number(k), ...v }))

  const opacity = (colourBy === 'area'
    ? ['step', ['get', 'area_km2'], 0.1, ...BREAKS.flatMap((b, i) => [b, 0.22 + i * 0.15])]
    : ['match', ['get', 'level'], ...Object.entries(LEVEL_SHADES).flatMap(([l, o]) => [Number(l), o]), 0.3]
  ) as unknown as number

  const onMove = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    const p = f?.properties
    setHover(p ? { id: p.basin_id, area: p.area_km2, level: p.level, inflow: p.upstream_inflow_km2, endo: p.endo,
                   pilot: p.pilot, lng: e.lngLat.lng, lat: e.lngLat.lat } : null)
  }

  const axis = {
    axisLabel: { color: palette['text-secondary'] }, axisLine: { lineStyle: { color: palette.axis } },
    axisTick: { show: false }, splitLine: { lineStyle: { color: palette.grid } },
    nameTextStyle: { color: palette['text-secondary'] },
  }

  const histogram: EChartsOption = {
    grid: { left: 48, right: 16, top: 16, bottom: 48 },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (p) => {
        const b = domain.histogram[(p as { dataIndex: number }[])[0].dataIndex]
        return `${fmt(b.lo)}–${fmt(b.hi)} km²<br/><b>${b.n}</b> catchments`
      },
    },
    xAxis: {
      type: 'category', data: domain.histogram.map((b) => b.lo), ...axis,
      name: 'Catchment area (km², log scale)', nameLocation: 'middle', nameGap: 30,
      axisLabel: { color: palette['text-secondary'], interval: (i: number) => i % 5 === 0, formatter: (v: string) => fmt(Number(v)) },
    },
    yAxis: { type: 'value', name: 'Catchments', ...axis },
    series: [{
      type: 'bar', barCategoryGap: '8%', data: domain.histogram.map((b) => b.n),
      itemStyle: { color: palette.accent, borderRadius: [4, 4, 0, 0] },
      markLine: {
        symbol: 'none', silent: true, lineStyle: { color: palette['text-secondary'], type: 'solid', width: 1 },
        label: { color: palette['text-secondary'], formatter: `median ${fmt(s.median)} km²` },
        data: [{ xAxis: domain.histogram.findIndex((b) => s.median >= b.lo && s.median < b.hi) }],
      },
    }],
  }

  // Domain options: two charts, one axis each (count of models, largest basin).
  const opts = domain.options
  const optionBars = (key: 'n_basins' | 'max_km2', name: string): EChartsOption => ({
    grid: { left: 190, right: 56, top: 8, bottom: 40 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => fmt(Number(v)) },
    xAxis: { type: 'value', name, nameLocation: 'middle', nameGap: 26, splitNumber: 4, ...axis },
    yAxis: { type: 'category', inverse: true, data: opts.map((o) => o.option), ...axis },
    series: [{
      type: 'bar', barCategoryGap: '30%',
      data: opts.map((o) => ({
        value: o[key],
        itemStyle: {
          color: o.kind === 'split' && o.threshold_km2 === domain.max_km2 ? palette.accent
            : o.kind === 'split' ? palette['cat-1'] : palette.neutral,
          opacity: o.kind === 'split' && o.threshold_km2 === domain.max_km2 ? 1 : 0.55,
          borderRadius: [0, 4, 4, 0],
        },
      })),
      label: { show: true, position: 'right', color: palette['text-secondary'], formatter: (p) => fmt(Number(p.value)) },
      ...(key === 'max_km2' ? { markLine: { symbol: 'none', silent: true, data: [{ xAxis: domain.max_km2 }],
        lineStyle: { color: palette['text-primary'], type: 'solid', width: 1 },
        label: { show: false } } } : {}),
    }],
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Model domains" value={fmt(domain.n_basins)} sub="independent SFINCS models" />
        <Stat label="Median catchment" value={`${fmt(s.median)} km²`} sub={`${fmt(s.min)} – ${fmt(s.max)} km²`} />
        <Stat label="Size threshold" value={`${fmt(domain.max_km2)} km²`} sub={`${domain.above_max.length} basins cannot be split further`} />
        <Stat label="From HydroBASINS levels" value={levels.map((l) => l.level).join(' · ')} sub={levels.map((l) => `L${l.level}: ${fmt(l.n)}`).join(' · ')} />
      </div>

      <Card
        title="Pluvial catchments"
        subtitle="HydroBASINS level 7, split into finer levels wherever a basin exceeds the threshold. Hover a catchment for its id; the pilot basins are outlined."
        actions={<Segmented label="Colour by" value={colourBy} onChange={setColourBy}
          options={[{ value: 'area', label: 'Area' }, { value: 'level', label: 'HydroBASINS level' }]} />}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="relative h-[600px] overflow-hidden rounded-lg border border-line">
            <Map
              initialViewState={{ bounds: MDG, fitBoundsOptions: { padding: 16 } }}
              mapStyle={dark ? BASEMAP.dark : BASEMAP.light}
              interactiveLayerIds={['catchment-fill']}
              cursor={hover ? 'pointer' : 'grab'}
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
              // the container settles after the grid lays out; re-measure so WebGL fills it
              onLoad={(e) => e.target.resize()}
              attributionControl={{ compact: true, customAttribution: 'Catchments: HydroSHEDS / HydroBASINS' }}
            >
              <Source id="catchments" type="geojson" data={catchments}>
                <Layer id="catchment-fill" type="fill" paint={{ 'fill-color': palette.accent, 'fill-opacity': opacity }} />
                <Layer id="catchment-line" type="line" paint={{ 'line-color': palette.surface, 'line-width': 0.5 }} />
                <Layer id="catchment-hover" type="line" filter={['==', ['get', 'basin_id'], hover?.id ?? '']}
                  paint={{ 'line-color': palette['text-primary'], 'line-width': 2 }} />
                <Layer id="pilot-line" type="line" filter={['==', ['get', 'pilot'], true]}
                  paint={{ 'line-color': palette['cat-2'], 'line-width': 2.5 }} />
              </Source>
              {hover && (
                <Popup longitude={hover.lng} latitude={hover.lat} closeButton={false} offset={12}>
                  <div className="font-medium">{hover.id}{hover.pilot ? ' · pilot' : ''}</div>
                  <div className="tabular text-ink-2">{fmt(hover.area)} km² · level {hover.level}</div>
                  {hover.inflow > 0 && <div className="tabular text-ink-2">receives {fmt(hover.inflow)} km² from upstream</div>}
                  {hover.endo === 2 && <div className="text-ink-2">endorheic sink (closed boundaries)</div>}
                </Popup>
              )}
            </Map>
            <div className="absolute left-2 top-2 rounded-md bg-surface/90 px-2.5 py-2 text-xs text-ink-2 shadow-sm">
              <div className="mb-1 font-medium text-ink">{colourBy === 'area' ? 'Area (km²)' : 'HydroBASINS level'}</div>
              {colourBy === 'area'
                ? [0, ...BREAKS].map((b, i) => (
                    <div key={b} className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm" style={{ background: palette.accent, opacity: i === 0 ? 0.1 : 0.22 + (i - 1) * 0.15 }} />
                      {i === BREAKS.length ? `≥ ${fmt(b)}` : `${fmt(b)} – ${fmt(BREAKS[i])}`}
                    </div>
                  ))
                : Object.entries(LEVEL_SHADES).map(([l, o]) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-sm" style={{ background: palette.accent, opacity: o }} />
                      Level {l} ({fmt(domain.by_level[l]?.n ?? 0)})
                    </div>
                  ))}
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-0.5 w-3" style={{ background: palette['cat-2'] }} /> Pilot basin
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Distribution of catchment areas</h3>
            <Chart option={histogram} height={420} label="Histogram of catchment areas on a log scale" />
            <DataTable
              caption="Catchment area histogram"
              head={['Area class (km²)', 'Catchments']}
              rows={domain.histogram.filter((b) => b.n > 0).map((b) => [`${fmt(b.lo)} – ${fmt(b.hi)}`, b.n])}
            />
            <Info>
              {fmt(domain.n_below_50_km2)} catchments are smaller than 50 km²: coastal strips and small sub-basins
              left over where a larger basin was split. They are real land and are kept as models of their own.
            </Info>
          </div>
        </div>
      </Card>

      <Card title="Why split the catchments" subtitle="Level 7 (282 basins, median about 1,500 km², up to 15,500 km²) is too coarse for pluvial modelling.">
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-2">
          <li><b className="text-ink">Rainfall.</b> One design storm cannot represent a basin of several thousand km²: no storm brings 100-year rain to all of it at once.</li>
          <li><b className="text-ink">Physics.</b> Large basins contain real rivers, which rain-on-grid on a terrain model without river beds represents poorly; that is fluvial flooding.</li>
          <li><b className="text-ink">Run time.</b> A 15,500 km² basin is about 6 million cells at 50 m; at most {fmt(domain.max_km2)} km² (about 400,000 cells) a run takes minutes.</li>
        </ul>
        <Info>
          Splitting does not change the total amount of work (the island is about 240 million cells at 50 m whichever
          way it is cut). It bounds the size of the largest model and spreads the work evenly over parallel runs.
        </Info>
      </Card>

      <Card title="Choosing the split" subtitle={`Single HydroBASINS levels (grey) against level 7 split above a threshold (blue); the adopted option is highlighted. The vertical line marks ${fmt(domain.max_km2)} km².`}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Chart option={optionBars('n_basins', 'Number of models')} height={300} label="Number of models for each domain option" />
          <Chart option={optionBars('max_km2', 'Largest basin (km²)')} height={300} label="Largest basin for each domain option" />
        </div>
        <DataTable caption="Domain options" head={['Option', 'Models', 'Median (km²)', 'Largest (km²)', 'Above 1,000 km²']}
          rows={opts.map((o) => [o.option, fmt(o.n_basins), fmt(o.median_km2), fmt(o.max_km2), o.above_1000_km2])} />
        <Info>
          Level 8 still leaves over half of the island in basins above 1,000 km²; level 10 fragments it into 4,153
          models. Splitting level 7 only where needed gives fewer models than level 9 and no basin above the threshold
          except two that HydroBASINS never subdivides, while basins that are already small stay whole.
        </Info>
      </Card>

      <Card title="How the split works" subtitle="HydroBASINS levels are nested: a basin's Pfafstetter code is its parent's code plus one digit, and its children tile it exactly.">
        <Steps items={[
          { title: 'Start', body: <>Take the 282 level-7 basins of Madagascar (Pfafstetter region 181).</> },
          { title: 'Split', body: <>Replace every basin larger than {fmt(domain.max_km2)} km² by its children at the next level, and keep the others. Because the children tile their parent exactly, no gaps or overlaps appear.</> },
          { title: 'Repeat', body: <>Go down level by level to level 10. A level does not always divide a basin (its only child is the same polygon); the descent then simply continues. Basins still too large at level 10 are kept whole: {domain.above_max.map((b) => `${b.basin_id} (${fmt(b.area_km2)} km²${b.endo === 2 ? ', endorheic' : ', coastal, no main river'})`).join(' and ')}.</> },
          { title: 'Remove islets', body: <>Drop polygon parts on landmasses smaller than {domain.min_landmass_km2} km² ({domain.islets.islet_parts_dropped} parts, {fmt(domain.islets.islet_km2_dropped)} km²). The mainland, Nosy Be and Sainte-Marie are kept, and so are small basins on them.</> },
          { title: 'Identify', body: <>Each model keeps its HydroBASINS <code>hybas_id</code> as its id, at whichever level it was kept, with its attributes: the area draining into it from upstream, and whether it is an endorheic sink.</> },
        ]} />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 className="text-sm font-semibold text-ink">Worked example</h3>
            <ul className="text-sm">{domain.example.map((n) => <Tree key={n.pfaf_id} node={n} max={domain.max_km2} />)}</ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Result</h3>
            <table className="mt-2 w-full text-sm tabular">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  {['Kept at level', 'Basins', 'Median (km²)', 'Area (km²)'].map((h, i) => (
                    <th key={h} className={`py-1.5 pr-4 font-medium ${i > 0 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {levels.map((l) => (
                  <tr key={l.level} className="border-b border-line last:border-0">
                    <td className="py-1.5 pr-4 text-ink-2">Level {l.level}</td>
                    <td className="py-1.5 pr-4 text-right text-ink">{fmt(l.n)}</td>
                    <td className="py-1.5 pr-4 text-right text-ink">{fmt(l.median_km2)}</td>
                    <td className="py-1.5 pr-4 text-right text-ink">{fmt(l.km2)}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="py-1.5 pr-4 text-ink">Total</td>
                  <td className="py-1.5 pr-4 text-right text-ink">{fmt(domain.n_basins)}</td>
                  <td className="py-1.5 pr-4 text-right text-ink">{fmt(domain.area_stats_km2.median)}</td>
                  <td className="py-1.5 pr-4 text-right text-ink">{fmt(domain.total_km2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card title="Consequences for the modelling">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
          <li>
            <b className="text-ink">Water from upstream is not included.</b> {fmt(domain.with_upstream_inflow)} of the {fmt(domain.n_basins)} catchments
            receive water from catchments upstream (both pilots do: {domain.pilots.map((p) => `${fmt(p.upstream_inflow_km2)} km²`).join(' and ')}).
            Each model only receives the rain falling on it, so flooding along the main rivers is underestimated. Those
            river reaches will be masked from the pluvial maps as fluvial, leaving pluvial flooding away from the rivers,
            where missing inflow does not matter.
          </li>
          <li>
            <b className="text-ink">Endorheic sinks.</b> {domain.endorheic_sinks} catchments drain to an inland depression rather than
            to the sea. They are modelled with closed boundaries, so their water stays in the basin.
          </li>
        </ul>
      </Card>
    </div>
  )
}
