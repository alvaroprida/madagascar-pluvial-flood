import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useState } from 'react'
import Map, { Layer, Popup, Source, type MapLayerMouseEvent } from 'react-map-gl/maplibre'
import { dataUrl } from '../data'
import { fmt } from '../format'
import type { Palette } from '../theme'
import type { FeatureCollection } from '../types'
import { Segmented } from './ui'

setWorkerUrl(workerUrl)

const BASEMAP = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
const MDG: [[number, number], [number, number]] = [[43.1, -25.7], [50.6, -11.9]]

type Legend =
  | { type: 'continuous'; min: number; max: number; unit: string; colors: string[] }
  | { type: 'categorical'; items: { label: string; color: string }[] }
interface StaticLayer { key: string; name: string; source: string; file: string; legend: Legend }
interface StaticLayers {
  coordinates: [[number, number], [number, number], [number, number], [number, number]]
  layers: StaticLayer[]
}

/** National static inputs on one map: one raster at a time, catchment outlines on top. */
export function StaticLayersMap({ catchments, palette, dark }: { catchments: FeatureCollection; palette: Palette; dark: boolean }) {
  const [meta, setMeta] = useState<StaticLayers>()
  const [layer, setLayer] = useState('topography')
  const [showCatchments, setShowCatchments] = useState(true)
  const [opacity, setOpacity] = useState(0.85)
  const [hover, setHover] = useState<{ id: string; area: number; pilot: boolean; lng: number; lat: number } | null>(null)

  useEffect(() => {
    fetch(dataUrl('static_layers.json')).then((r) => r.json()).then(setMeta).catch(() => setMeta(undefined))
  }, [])

  const current = meta?.layers.find((l) => l.key === layer)

  const onMove = (e: MapLayerMouseEvent) => {
    const p = e.features?.[0]?.properties
    setHover(p ? { id: p.basin_id, area: p.area_km2, pilot: p.pilot, lng: e.lngLat.lng, lat: e.lngLat.lat } : null)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {meta && <Segmented label="Layer" value={layer} onChange={setLayer}
          options={meta.layers.map((l) => ({ value: l.key, label: l.name }))} />}
        <label className="flex items-center gap-1.5 text-sm text-ink-2">
          <input type="checkbox" checked={showCatchments} onChange={(e) => setShowCatchments(e.target.checked)} className="accent-accent" />
          Pluvial catchments
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink-2">
          Opacity
          <input type="range" min={0.2} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-24" />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="relative h-[640px] overflow-hidden rounded-lg border border-line">
          <Map
            initialViewState={{ bounds: MDG, fitBoundsOptions: { padding: 16 } }}
            mapStyle={dark ? BASEMAP.dark : BASEMAP.light}
            interactiveLayerIds={showCatchments ? ['static-catchment-fill'] : []}
            cursor={hover ? 'pointer' : 'grab'}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            onLoad={(e) => e.target.resize()}
            attributionControl={{ compact: true, customAttribution: 'FABDEM (Univ. Bristol) · Copernicus LC100 · GCN250 · HydroBASINS' }}
          >
            {meta && current && (
              // keyed by layer so MapLibre swaps the image instead of loading all of them
              <Source key={current.key} id={`static-${current.key}`} type="image"
                url={dataUrl(`static_layers/${current.file}`)} coordinates={meta.coordinates}>
                <Layer id={`static-${current.key}-raster`} type="raster"
                  paint={{ 'raster-opacity': opacity, 'raster-resampling': current.legend.type === 'categorical' ? 'nearest' : 'linear', 'raster-fade-duration': 0 }} />
              </Source>
            )}
            <Source id="static-catchments" type="geojson" data={catchments}>
              <Layer id="static-catchment-fill" type="fill" layout={{ visibility: showCatchments ? 'visible' : 'none' }}
                paint={{ 'fill-color': '#000', 'fill-opacity': 0 }} />
              <Layer id="static-catchment-line" type="line" layout={{ visibility: showCatchments ? 'visible' : 'none' }}
                paint={{ 'line-color': dark ? '#ffffff' : '#333333', 'line-width': 0.4, 'line-opacity': 0.55 }} />
              <Layer id="static-catchment-hover" type="line" filter={['==', ['get', 'basin_id'], hover?.id ?? '']}
                layout={{ visibility: showCatchments ? 'visible' : 'none' }}
                paint={{ 'line-color': palette['text-primary'], 'line-width': 2 }} />
              <Layer id="static-pilot-line" type="line" filter={['==', ['get', 'pilot'], true]}
                layout={{ visibility: showCatchments ? 'visible' : 'none' }}
                paint={{ 'line-color': palette['cat-2'], 'line-width': 2.5 }} />
            </Source>
            {hover && (
              <Popup longitude={hover.lng} latitude={hover.lat} closeButton={false} offset={12}>
                <div className="font-medium">{hover.id}{hover.pilot ? ' · pilot' : ''}</div>
                <div className="tabular text-ink-2">{fmt(hover.area)} km²</div>
              </Popup>
            )}
          </Map>
        </div>

        <div className="space-y-3 text-sm">
          {current && (
            <div>
              <div className="font-medium text-ink">{current.name}</div>
              <div className="mb-2 text-ink-3">{current.source}</div>
              {current.legend.type === 'continuous' ? (
                <div>
                  <div className="h-3 rounded-sm" style={{ background: `linear-gradient(to right, ${current.legend.colors.join(', ')})` }} />
                  <div className="tabular mt-1 flex justify-between text-ink-2">
                    <span>≤ {fmt(current.legend.min)}{current.legend.unit && ` ${current.legend.unit}`}</span>
                    <span>≥ {fmt(current.legend.max)}{current.legend.unit && ` ${current.legend.unit}`}</span>
                  </div>
                  {current.key.startsWith('cn_') && <p className="mt-1 text-ink-3">Higher curve number means more runoff. ARC II and ARC III share the scale.</p>}
                </div>
              ) : (
                <ul className="space-y-0.5 text-ink-2">
                  {current.legend.items.map((i) => (
                    <li key={i.label} className="flex items-center gap-1.5">
                      <span className="h-3 w-3 shrink-0 rounded-sm border border-line" style={{ background: i.color }} aria-hidden />{i.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {showCatchments && (
            <div className="space-y-1 text-ink-2">
              <div className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: dark ? '#fff' : '#333' }} /> Pluvial catchment (hover for id)</div>
              <div className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: palette['cat-2'] }} /> Pilot basin</div>
            </div>
          )}
          <p className="text-ink-3">Display grid ≈ 500 m in Web Mercator. The models read each source at its native resolution per basin.</p>
        </div>
      </div>
    </div>
  )
}
