import type { Palette } from '../theme'
import type { FeatureCollection } from '../types'
import { StaticLayersMap } from './StaticLayersMap'
import { Card, Info } from './ui'

const DATASETS = [
  { name: 'FABDEM V1-2', role: 'Topography', res: '30 m', access: '1° tiles read with HTTP range requests from the 10° ZIP archives (University of Bristol); only the tiles a basin touches are fetched, then cached', licence: 'CC BY-NC-SA 4.0' },
  { name: 'Copernicus Global Land Cover LC100 v3.0.1 (2019)', role: "Manning's roughness", res: '100 m', access: 'Windowed read of the global cloud-optimised GeoTIFF on Zenodo, basin window only', licence: 'Free and open' },
  { name: 'GCN250 (ARC II and ARC III)', role: 'SCS curve number: ARC II (average soil moisture) for thunderstorms, ARC III (wet soils) for cyclones', res: '250 m', access: 'Global grids downloaded once from figshare (links expire in seconds, so no streaming), then windowed per basin', licence: 'CC BY 4.0' },
]

export function StaticInputs({ catchments, palette, dark }: { catchments: FeatureCollection; palette: Palette; dark: boolean }) {
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

      <Card title="Antecedent soil moisture" subtitle="Hypothesis on soil wetness at the start of each design storm, and the curve-number grid it selects.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                {['Storm type', 'Hypothesis', 'Basis', 'GCN250 grid'].map((h) => <th key={h} className="py-1.5 pr-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line align-top">
                <td className="py-2 pr-4 font-medium text-ink">Cyclone</td>
                <td className="py-2 pr-4 text-ink-2">Rain falls on wet soils</td>
                <td className="py-2 pr-4 text-ink-2">Cyclones rain for several days (50–68 h without a break in 1959) and bring soils near saturation: runoff reached at least 70% of rain over the upper Ikopa in the March 1959 cyclone (IRD/ORSTOM 1993, Fleuves et rivières de Madagascar)</td>
                <td className="py-2 pr-4 text-ink-2">ARC III (wet)</td>
              </tr>
              <tr className="align-top">
                <td className="py-2 pr-4 font-medium text-ink">Non-cyclone (thunderstorm)</td>
                <td className="py-2 pr-4 text-ink-2">Average soil moisture</td>
                <td className="py-2 pr-4 text-ink-2">Local, short storms, frequent from late October at the end of the dry season; the report gives no soil moisture evidence for them</td>
                <td className="py-2 pr-4 text-ink-2">ARC II (average)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Info>
          The design storms of each type and their soil moisture are combined in Chapter 5 of the <a href="#rainfall" className="text-accent underline underline-offset-2">Rainfall</a> tab.
          The national map below shows both grids: ARC III has higher curve numbers everywhere (less retention).
        </Info>
      </Card>

      <Card title="National overview" subtitle="The grids the models read, at national scale. Pick a layer, and overlay the pluvial catchments (one SFINCS model each).">
        <StaticLayersMap catchments={catchments} palette={palette} dark={dark} />
      </Card>
    </div>
  )
}
