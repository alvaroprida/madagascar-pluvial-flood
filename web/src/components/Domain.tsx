import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useState } from 'react'
import Map, { Layer, Popup, Source, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import type { EChartsOption } from 'echarts'
import { fmt } from '../format'
import type { Palette } from '../theme'
import type { Domain as DomainData, FeatureCollection } from '../types'
import { Card, Chart, DataTable, Info, Stat } from './ui'

// MapLibre 6 ships its worker as a separate module that Vite won't find on its own.
setWorkerUrl(workerUrl)

const BASEMAP = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
const MDG: [[number, number], [number, number]] = [[43.1, -25.7], [50.6, -11.9]]

// Area classes (km²) for the map; the same breaks label the legend.
const BREAKS = [250, 500, 1000, 2500, 5000]

interface Props {
  domain: DomainData
  catchments: FeatureCollection
  palette: Palette
  dark: boolean
}

export function Domain({ domain, catchments, palette, dark }: Props) {
  const [hover, setHover] = useState<{ id: string; area: number; pilot: boolean; lng: number; lat: number } | null>(null)
  const s = domain.area_stats_km2

  // One hue, light to dark with area: opacity steps of the accent colour.
  const opacity = ['step', ['get', 'area_km2'], 0.12, ...BREAKS.flatMap((b, i) => [b, 0.22 + i * 0.13])] as unknown as number

  const onMove = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    setHover(f ? { id: f.properties.basin_id, area: f.properties.area_km2, pilot: f.properties.pilot,
                   lng: e.lngLat.lng, lat: e.lngLat.lat } : null)
  }

  const histogram: EChartsOption = {
    grid: { left: 48, right: 16, top: 16, bottom: 48 },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (p) => {
        const i = (p as { dataIndex: number }[])[0].dataIndex
        const b = domain.histogram[i]
        return `${fmt(b.lo)}–${fmt(b.hi)} km²<br/><b>${b.n}</b> catchments`
      },
    },
    xAxis: {
      type: 'category',
      data: domain.histogram.map((b) => b.lo),
      name: 'Catchment area (km², log scale)', nameLocation: 'middle', nameGap: 30,
      axisLabel: {
        color: palette['text-secondary'],
        interval: (i: number) => i % 4 === 0,
        formatter: (v: string) => fmt(Number(v)),
      },
      axisLine: { lineStyle: { color: palette.axis } }, axisTick: { show: false },
    },
    yAxis: {
      type: 'value', name: 'Catchments', nameTextStyle: { color: palette['text-secondary'] },
      axisLabel: { color: palette['text-secondary'] }, splitLine: { lineStyle: { color: palette.grid } },
    },
    series: [{
      type: 'bar', barCategoryGap: '8%',
      data: domain.histogram.map((b) => b.n),
      itemStyle: { color: palette.accent, borderRadius: [4, 4, 0, 0] },
      markLine: {
        symbol: 'none', silent: true,
        lineStyle: { color: palette['text-secondary'], type: 'solid', width: 1 },
        label: { color: palette['text-secondary'], formatter: `median ${fmt(s.median)} km²` },
        data: [{ xAxis: domain.histogram.findIndex((b) => s.median >= b.lo && s.median < b.hi) }],
      },
    }],
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Model domains" value={domain.n_basins} sub="independent SFINCS models" />
        <Stat label="Median catchment" value={`${fmt(s.median)} km²`} sub={`${fmt(s.min)} – ${fmt(s.max)} km²`} />
        <Stat label="Area covered" value={`${fmt(domain.total_km2)} km²`} sub="whole island, offshore islets aside" />
        <Stat label="Polygons dropped" value={domain.dropped_parts} sub={`< ${domain.threshold_km2} km², ${fmt(domain.dropped_km2)} km² in total`} />
      </div>

      <Card
        title="Pluvial catchments"
        subtitle="HydroBASINS level 7, split into single parts and filtered on area. Hover a catchment for its id; the two pilot basins are outlined."
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="relative h-[560px] overflow-hidden rounded-lg border border-line">
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
                <Layer id="catchment-line" type="line" paint={{ 'line-color': palette.surface, 'line-width': 0.8 }} />
                <Layer
                  id="catchment-hover" type="line" filter={['==', ['get', 'basin_id'], hover?.id ?? '']}
                  paint={{ 'line-color': palette['text-primary'], 'line-width': 2 }}
                />
                <Layer
                  id="pilot-line" type="line" filter={['==', ['get', 'pilot'], true]}
                  paint={{ 'line-color': palette['cat-2'], 'line-width': 2.5 }}
                />
              </Source>
              {hover && (
                <Popup longitude={hover.lng} latitude={hover.lat} closeButton={false} offset={12}>
                  <div className="font-medium">{hover.id}</div>
                  <div className="tabular text-ink-2">{fmt(hover.area)} km²{hover.pilot ? ' · pilot basin' : ''}</div>
                </Popup>
              )}
            </Map>
            <div className="absolute left-2 top-2 rounded-md bg-surface/90 px-2.5 py-2 text-xs text-ink-2 shadow-sm">
              <div className="mb-1 font-medium text-ink">Area (km²)</div>
              {[0, ...BREAKS].map((b, i) => (
                <div key={b} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-sm" style={{ background: palette.accent, opacity: i === 0 ? 0.12 : 0.22 + (i - 1) * 0.13 }} />
                  {i === BREAKS.length ? `≥ ${fmt(b)}` : `${fmt(b)} – ${fmt(BREAKS[i])}`}
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
          </div>
        </div>
      </Card>

      <Card title="How the domain is built">
        <Info>
          A single 30 m grid over Madagascar would hold about 2 billion cells, so the country is split into
          hydrologically independent catchments, each its own SFINCS model. HydroBASINS level 7 (Pfafstetter
          sub-basins, about 1,000 km² median in Africa) is the level where basins are small enough for a tractable
          rain-on-grid model and large enough to keep the number of models manageable.
        </Info>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-2">
          <li>The {domain.n_features} HydroBASINS features are split into {domain.n_parts} single polygons: a feature can bundle a mainland basin with offshore islets.</li>
          <li>Areas are computed in UTM 38S and polygons under {domain.threshold_km2} km² are dropped. This removes offshore islets but keeps Nosy Be (~320 km²) and Île Sainte-Marie (~150 km²).</li>
          <li>Each surviving polygon gets a stable id, <code>&lt;hybas_id&gt;_&lt;part&gt;</code>, which names every input, model and result folder.</li>
          <li>Any other polygons (for example agricultural or urban areas of interest) can be modelled the same way.</li>
        </ol>
      </Card>
    </div>
  )
}
