import { useState } from 'react'
import { dataUrl } from '../data'
import type { Domain, LandcoverClass } from '../types'
import { Card, Figure, Info, Segmented } from './ui'

const DATASETS = [
  { name: 'FABDEM V1-2', role: 'Topography', res: '30 m', access: '1° tiles read with HTTP range requests from the 10° ZIP archives (University of Bristol); only the tiles a basin touches are fetched, then cached', licence: 'CC BY-NC-SA 4.0' },
  { name: 'Copernicus Global Land Cover LC100 v3.0.1 (2019)', role: "Manning's roughness", res: '100 m', access: 'Windowed read of the global cloud-optimised GeoTIFF on Zenodo, basin window only', licence: 'Free and open' },
  { name: 'GCN250 (ARC II)', role: 'SCS curve number', res: '250 m', access: 'Global grid downloaded once from figshare (links expire in seconds, so no streaming), then windowed per basin', licence: 'CC BY 4.0' },
  { name: 'SoilGrids 2.0 sand & clay, 0–100 cm', role: 'Hydrologic soil group (audit)', res: '250 m', access: 'WCS request per basin, subset and reprojected server-side', licence: 'CC BY 4.0' },
]

const BASIN_FIGS = [
  ['01_topography.png', 'Topography', 'FABDEM elevation with hillshade, and the elevation distribution inside the basin.'],
  ['02_landcover.png', 'Land cover', 'Copernicus classes in the official colours; small classes are grouped as Other.'],
  ['03_curve_number_arcii.png', 'Curve number', 'GCN250 curve number (average antecedent moisture) and its distribution; S is the matching maximum retention.'],
  ['04_soil_hsg.png', 'Soil groups', 'Hydrologic soil groups A–D from SoilGrids texture. SoilGrids has no data on built-up land and water, which shows as gaps.'],
] as const

export function StaticInputs({ domain, landcover }: { domain: Domain; landcover: LandcoverClass[] }) {
  const [pilot, setPilot] = useState(domain.pilots[0].basin_id)
  const [fig, setFig] = useState<(typeof BASIN_FIGS)[number][0]>(BASIN_FIGS[0][0])
  const current = BASIN_FIGS.find((f) => f[0] === fig)!

  return (
    <div className="space-y-4">
      <Card title="Datasets and how they are fetched" subtitle="Everything is downloaded on the fly for each basin's bounding box (plus a 0.02° halo) and kept on its native grid in EPSG:4326. Reprojection to the basin's UTM zone happens at model setup.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                {['Dataset', 'Used for', 'Resolution', 'Access', 'Licence'].map((h) => <th key={h} className="py-1.5 pr-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {DATASETS.map((d) => (
                <tr key={d.name} className="border-b border-line align-top last:border-0">
                  <td className="py-2 pr-4 font-medium text-ink">{d.name}</td>
                  <td className="py-2 pr-4 text-ink-2">{d.role}</td>
                  <td className="py-2 pr-4 text-ink-2">{d.res}</td>
                  <td className="py-2 pr-4 text-ink-2">{d.access}</td>
                  <td className="py-2 pr-4 text-ink-2">{d.licence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Info>
          Downloads shared by several basins (FABDEM tiles, the GCN250 grid) are cached under a file lock, so basins
          can be processed in parallel without fetching or corrupting the same file twice. Every step skips outputs
          that already exist, and each basin gets a provenance manifest with the source and SHA-256 checksum of every file.
        </Info>
      </Card>

      <Card title="National overview" subtitle="Context maps of the three main grids. The models read the same sources per basin.">
        <div className="grid gap-4 md:grid-cols-3">
          <Figure src={dataUrl('figures/national_topography.png')} alt="Elevation map of Madagascar" caption="FABDEM elevation (≈250 m overview)." />
          <figure className="space-y-2">
            <Figure src={dataUrl('figures/national_landcover.png')} alt="Land cover map of Madagascar" />
            <ul className="space-y-0.5 text-sm text-ink-2">
              {landcover.map((c) => (
                <li key={c.code} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 shrink-0 rounded-sm border border-line" style={{ background: c.color }} aria-hidden />{c.name}
                </li>
              ))}
            </ul>
          </figure>
          <Figure src={dataUrl('figures/national_curve_number.png')} alt="Curve number map of Madagascar" caption="GCN250 curve number: higher means more runoff." />
        </div>
      </Card>

      <Card
        title="Quality control for the pilot basins"
        subtitle="The pipeline draws one figure per input for every basin, with the basin outline and the values inside it."
        actions={<Segmented label="Pilot basin" value={pilot} onChange={setPilot}
          options={domain.pilots.map((p) => ({ value: p.basin_id, label: `${p.basin_id} · ${Math.round(p.area_km2)} km²` }))} />}
      >
        <div className="mb-3">
          <Segmented label="Input" value={fig} onChange={setFig} options={BASIN_FIGS.map(([f, label]) => ({ value: f, label }))} />
        </div>
        <Figure src={dataUrl(`figures/basins/${pilot}/${current[0]}`)} alt={`${current[1]} for basin ${pilot}`} caption={current[2]} />
      </Card>
    </div>
  )
}
