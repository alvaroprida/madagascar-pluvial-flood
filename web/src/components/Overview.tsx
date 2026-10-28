import { dataUrl } from '../data'
import { fmt } from '../format'
import type { SiteData } from '../types'
import type { TabKey } from '../App'
import { Card, Figure, Info, Stat } from './ui'

const STAGES: { key: TabKey; step: string; title: string; body: string; status: string }[] = [
  { key: 'domain', step: '0', title: 'Domain', body: 'Catchments as independent model domains, or any polygons of interest.', status: 'Done' },
  { key: 'inputs', step: '1', title: 'Inputs', body: 'Topography, land cover, curve number and soils, fetched on the fly per basin.', status: 'Done' },
  { key: 'rainfall', step: '1', title: 'Design rainfall', body: 'Cyclone, non-cyclone and total rainfall; design depths and hyetographs.', status: 'Done' },
  { key: 'setup', step: '2', title: 'Model setup', body: 'SFINCS rain-on-grid model per basin with HydroMT.', status: 'Done' },
  { key: 'setup', step: '3–4', title: 'Run & post-process', body: 'SFINCS in a container; flood depth maps and summaries.', status: 'Tested, runs pending' },
]

export function Overview({ data, go }: { data: SiteData; go: (k: TabKey) => void }) {
  const { domain, rainfall, cyclones } = data
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat hero label="Catchments" value={domain.n_basins} sub="independent SFINCS models" />
        <Stat hero label="Cyclones" value={cyclones.n_matched} sub={`matched best tracks, 1998–2025`} />
        <Stat hero label="Cyclone share" value={`${fmt(rainfall.tc_share_pct.land_mean, 1)}%`} sub="of annual rainfall over land" />
        <Stat hero label="Pilot basins" value={domain.pilots.length} sub={domain.pilots.map((p) => `${Math.round(p.area_km2)} km²`).join(' and ')} />
      </div>

      <Card title="What this is">
        <Info>
          A national-scale <b>pluvial flood model</b> for Madagascar: rain falling directly on the ground (rain-on-grid),
          routed over the terrain with the hydrodynamic model <b>SFINCS</b>. The country is split into catchments, each
          an independent model, so the work can be restricted to areas of interest (agricultural or urban) and run in
          parallel. Every input comes from public global datasets, downloaded on the fly for each basin by a reproducible
          Python pipeline.
        </Info>
        <Info>
          This site documents the inputs and processing steps, with the figures the pipeline produces along the way.
          The design flood runs and their results will be added once the design rainfall is settled.
        </Info>
      </Card>

      <Card title="Workflow">
        <ol className="grid gap-3 md:grid-cols-5">
          {STAGES.map((s) => (
            <li key={s.title}>
              <button onClick={() => go(s.key)} className="h-full w-full rounded-lg border border-line p-3 text-left hover:border-ink-3">
                <div className="text-xs font-medium text-accent">Step {s.step}</div>
                <div className="mt-0.5 font-semibold text-ink">{s.title}</div>
                <p className="mt-1 text-sm text-ink-2">{s.body}</p>
                <p className="mt-2 text-xs text-ink-3">{s.status}</p>
              </button>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Rainfall is split by origin" subtitle="Mean annual rainfall and the share brought by tropical cyclones.">
          <Figure src={dataUrl('figures/rain_annual_by_population.png')} alt="Maps of total, non-TC and cyclone rainfall" maxHeight={300} />
          <button className="mt-3 text-sm text-accent underline underline-offset-2" onClick={() => go('rainfall')}>Rainfall segmentation →</button>
        </Card>
        <Card title="One model per catchment" subtitle={`${domain.n_basins} HydroBASINS catchments, median ${fmt(domain.area_stats_km2.median)} km².`}>
          <Figure src={dataUrl('figures/national_topography.png')} alt="Elevation of Madagascar" maxHeight={300} />
          <button className="mt-3 text-sm text-accent underline underline-offset-2" onClick={() => go('domain')}>Modelling domain →</button>
        </Card>
      </div>
    </div>
  )
}
