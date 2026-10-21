import { useState } from 'react'
import { dataUrl } from '../data'
import type { Domain } from '../types'
import { Card, Figure, Info, Segmented, Steps } from './ui'

export function ModelSetup({ domain }: { domain: Domain }) {
  const [pilot, setPilot] = useState(domain.pilots[0].basin_id)
  return (
    <div className="space-y-4">
      <Card title="From inputs to a SFINCS model" subtitle="Built per basin with HydroMT-SFINCS from the basin's data catalogue.">
        <Steps items={[
          { title: 'Grid', body: <>50 m regular grid in the basin's UTM zone (38S or 39S, chosen automatically). Active cells are those inside the basin polygon and above 0.01 m, so a polygon that reaches the coast does not model the sea (FABDEM sets it to exactly 0 m).</> },
          { title: 'Subgrid', body: <>Subgrid tables at 25 m (2 pixels per cell) from FABDEM, so storage and conveyance follow the 30 m terrain inside each 50 m cell. Manning's n from Copernicus land cover through the Deltares look-up table.</> },
          { title: 'Boundaries', body: <>The basin edge is an outflow boundary. Inland it is mostly a drainage divide, so water leaves in practice through the outlet; on the coast it drains to the sea.</> },
          { title: 'Infiltration', body: <>SCS curve number from GCN250 for average antecedent moisture (ARC II), converted to maximum soil retention. Wet conditions (ARC III), relevant for cyclones on saturated soils, are a planned sensitivity run.</> },
          { title: 'Forcing', body: <>The basin's design hyetograph applied uniformly, followed by 12 hours without rain to let the water drain. The series carries explicit zeros to the end of the run, because SFINCS leaves the forcing undefined past the end of the file.</> },
          { title: 'Run and post-processing', body: <>SFINCS v2.4.1 in the official Deltares container. Maximum water levels are projected onto the 25 m terrain to map flood depth (depths under 0.10 m not counted), with flooded area per depth class and a water balance per basin.</> },
        ]} />
      </Card>

      <Card
        title="Model setup check"
        subtitle="Active mask and outflow boundary, subgrid elevation, infiltration capacity and the rainfall forcing, as drawn by the pipeline after setup."
        actions={<Segmented label="Pilot basin" value={pilot} onChange={setPilot}
          options={domain.pilots.map((p) => ({ value: p.basin_id, label: p.basin_id }))} />}
      >
        <Figure src={dataUrl(`figures/basins/${pilot}/06_model_setup.png`)} alt={`SFINCS model setup for basin ${pilot}`} />
      </Card>

      <Card title="Simulations">
        <div role="note" className="rounded-lg bg-banner px-4 py-3 text-sm text-ink">
          <strong>Pending.</strong> The chain (setup, run, post-processing) has been tested end to end on the pilot
          basins. The design runs will follow once the design rainfall is settled: the choice of rainfall population
          and the calibration of the sub-daily rainfall profile. Flood depth maps will be published here.
        </div>
        <Info>
          Each basin is a separate model, so basins run in series or in parallel, locally or in the cloud, with the
          same container. Interrupted batches resume where they stopped.
        </Info>
      </Card>
    </div>
  )
}
