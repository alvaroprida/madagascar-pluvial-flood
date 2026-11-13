import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useMemo } from 'react'
import Map, { Layer, Marker, Source } from 'react-map-gl/maplibre'
import type { Palette } from '../theme'
import type { FeatureCollection } from '../types'

setWorkerUrl(workerUrl)

const BASEMAP = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
// south edge padded: the island must fit a tall, narrow column above the attribution strip
const MDG: [[number, number], [number, number]] = [[43.1, -27.4], [50.6, -11.9]]

/** Centre of a polygon's bounding box: enough to place a numbered marker on a small catchment. */
function centre(geometry: { type: string; coordinates: unknown }): [number, number] {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const [x, y] = c as number[]
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    } else if (Array.isArray(c)) c.forEach(walk)
  }
  walk(geometry.coordinates)
  return [(x0 + x1) / 2, (y0 + y1) / 2]
}

/** Test catchments of the design storms: numbered markers, the selected one filled. Click to select. */
export function TestCatchmentsMap({ catchments, tests, selected, onSelect, palette, dark }: {
  catchments: FeatureCollection
  tests: { basin_id: string; slot: string }[]
  selected: string
  onSelect: (id: string) => void
  palette: Palette
  dark: boolean
}) {
  const ids = useMemo(() => tests.map((t) => t.basin_id), [tests])
  const subset = useMemo(() => ({
    ...catchments,
    features: catchments.features.filter((f) => ids.includes(String(f.properties?.basin_id))),
  }) as FeatureCollection, [catchments, ids])
  const markers = useMemo(() => subset.features.map((f) => {
    const id = String(f.properties?.basin_id)
    return { id, n: ids.indexOf(id) + 1, slot: tests[ids.indexOf(id)].slot, at: centre(f.geometry as never) }
  }), [subset, ids, tests])

  return (
    <div className="relative h-[580px] overflow-hidden rounded-lg border border-line">
      <Map
        initialViewState={{ bounds: MDG, fitBoundsOptions: { padding: 16 } }}
        mapStyle={dark ? BASEMAP.dark : BASEMAP.light}
        onLoad={(e) => e.target.resize()}
        attributionControl={{ compact: true, customAttribution: 'Catchments: HydroSHEDS / HydroBASINS' }}
      >
        <Source id="test-catchments" type="geojson" data={subset}>
          <Layer id="test-fill" type="fill" paint={{
            'fill-color': ['case', ['==', ['get', 'basin_id'], selected], palette.accent, palette['text-muted']],
            'fill-opacity': ['case', ['==', ['get', 'basin_id'], selected], 0.55, 0.25] }} />
          <Layer id="test-line" type="line" paint={{
            'line-color': ['case', ['==', ['get', 'basin_id'], selected], palette.accent, palette['text-secondary']],
            'line-width': ['case', ['==', ['get', 'basin_id'], selected], 2, 0.8] }} />
        </Source>
        {markers.map((m) => (
          <Marker key={m.id} longitude={m.at[0]} latitude={m.at[1]} anchor="center">
            <button onClick={() => onSelect(m.id)} title={`${m.slot} · ${m.id}`} aria-label={`Select catchment ${m.n}, ${m.slot}`}
              className={`tabular flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium shadow-sm ${
                m.id === selected ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-ink'}`}>
              {m.n}
            </button>
          </Marker>
        ))}
      </Map>
    </div>
  )
}
