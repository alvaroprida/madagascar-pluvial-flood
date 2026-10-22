import { useState } from 'react'
import { fmt } from '../format'
import type { Exposure } from '../types'
import { Card, Info, Segmented, Steps } from './ui'

// Candidate values (USD per hectare per year) and where they come from.
const FAO_YEAR = 2023
const CROPLAND_OPTIONS = {
  crops: { label: 'All crops', usd_ha: 672, source: `FAOSTAT ${FAO_YEAR}: gross production value of all crops (USD 2,445 M, current) / cropland (3.64 Mha)` },
  rice: { label: 'Rice', usd_ha: 819, source: `FAOSTAT ${FAO_YEAR}: rice production value (USD 1,666 M) / harvested area (2.04 Mha); 2.5 t/ha at USD 326/t` },
  jrc: { label: 'JRC (all farmland)', usd_ha: 57, source: 'Huizinga et al. (2017), Table A-1: agricultural value added per hectare of all agricultural land, Madagascar 2008–2012' },
} as const
type CropOpt = keyof typeof CROPLAND_OPTIONS
const GRASSLAND_USD_HA = 57

const bn = (v: number) => `${fmt(v / 1e9, 2)} bn USD`

export function AgriValuation({ exposure }: { exposure: Exposure }) {
  const [crop, setCrop] = useState<CropOpt>('crops')
  const a = exposure.agriculture
  const cropUsd = a.cropland_km2 * 100 * CROPLAND_OPTIONS[crop].usd_ha
  const grassUsd = a.grassland_km2 * 100 * GRASSLAND_USD_HA

  return (
    <>
      <Card title="How the agricultural layer is built" subtitle="ESA WorldCover land cover, valued per m² with national production statistics. Proposal: the unit values are still to be agreed.">
        <Steps items={[
          { title: 'Where', body: <>ESA WorldCover 2021 (v200), 10 m. Only two classes count as agricultural exposure: <b>Cropland</b> (class 40, annual crops harvested within 12 months of planting) and <b>Grassland</b> (class 30, herbaceous cover such as savannah and pasture, which grazing livestock depend on). Perennial tree crops (coffee, vanilla, cloves, lychee) are mapped as tree cover and are left out.</> },
          { title: 'How much', body: <>WorldCover gives {fmt(a.cropland_km2)} km² of cropland and {fmt(a.grassland_km2)} km² of grassland ({fmt((100 * a.grassland_km2) / a.land_km2)}% of the island). The cropland area is within 3% of FAOSTAT's {FAO_YEAR} figure (36,396 km²), which supports using national statistics divided by the mapped area.</> },
          { title: 'Value per m²', body: <>Annual production value per hectare, from FAOSTAT for cropland and from JRC for grassland (below). The exposed value of a 10 m pixel is its area times that rate, so it represents one year's harvest.</> },
          { title: 'Damage', body: <>The JRC depth-damage curve for agriculture in Africa (Vulnerability tab), applied to the pixel's value with the flood depth from the model.</> },
        ]} />
      </Card>

      <Card
        title="Value per m²: options"
        subtitle="National exposed value for each choice. All crops over all cropland is the recommended default."
        actions={<Segmented label="Cropland value" value={crop} onChange={setCrop}
          options={(Object.keys(CROPLAND_OPTIONS) as CropOpt[]).map((k) => ({ value: k, label: CROPLAND_OPTIONS[k].label }))} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                {['Class', 'Basis', 'USD/ha', 'USD/m²', 'Exposed value'].map((h, i) => (
                  <th key={h} className={`py-1.5 pr-4 font-medium ${i > 1 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular">
              {(Object.keys(CROPLAND_OPTIONS) as CropOpt[]).map((k) => {
                const o = CROPLAND_OPTIONS[k]
                return (
                  <tr key={k} className={`border-b border-line align-top ${k === crop ? 'bg-banner' : ''}`}>
                    <td className="py-2 pr-4 font-medium text-ink">Cropland · {o.label}</td>
                    <td className="py-2 pr-4 text-ink-2">{o.source}</td>
                    <td className="py-2 pr-4 text-right text-ink">{fmt(o.usd_ha)}</td>
                    <td className="py-2 pr-4 text-right text-ink">{fmt(o.usd_ha / 1e4, 4)}</td>
                    <td className="py-2 pr-4 text-right text-ink">{bn(a.cropland_km2 * 100 * o.usd_ha)}</td>
                  </tr>
                )
              })}
              <tr className="align-top">
                <td className="py-2 pr-4 font-medium text-ink">Grassland</td>
                <td className="py-2 pr-4 text-ink-2">Huizinga et al. (2017): agricultural value added per hectare of agricultural land in Madagascar. Pasture is 91% of that land (FAOSTAT), so the figure is close to the value of grazing land.</td>
                <td className="py-2 pr-4 text-right text-ink">{fmt(GRASSLAND_USD_HA)}</td>
                <td className="py-2 pr-4 text-right text-ink">{fmt(GRASSLAND_USD_HA / 1e4, 4)}</td>
                <td className="py-2 pr-4 text-right text-ink">{bn(grassUsd)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Info>
          With the selected cropland value, agricultural exposure totals <b className="text-ink">{bn(cropUsd + grassUsd)}</b> per
          year ({fmt((100 * cropUsd) / (cropUsd + grassUsd))}% from cropland). The all-crops rate reproduces FAOSTAT's
          national crop production value (USD 2.44 bn) over the WorldCover cropland, so it adds no value that is not
          in the statistics. Rice, the main lowland crop and the one most exposed to flooding, is worth about 20% more
          per hectare. The JRC rate spreads value added over all farmland, most of it extensive pasture, and is far too
          low for cropland, but it fits grassland.
        </Info>
      </Card>

      <Card title="Assumptions and possible refinements">
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
          <li><b className="text-ink">Season.</b> Exposure is a full year's harvest, as if every flood struck a crop at maturity. The cyclone season (December–March) overlaps the main rice season, so this is close for lowland rice and conservative for other crops. A crop-calendar factor could scale it down.</li>
          <li><b className="text-ink">One rate per class.</b> Cropland value is a national average. A refinement is SPAM 2020 (IFPRI, about 10 km, 46 crops): production per crop in each SPAM cell times the FAOSTAT producer price, divided by the WorldCover cropland in that cell. SPAM 2020 gives production but not value, so the prices have to be added.</li>
          <li><b className="text-ink">Grassland.</b> Floods rarely destroy pasture; the main losses are livestock, which no gridded layer places reliably. Grassland is kept at a low rate so it does not dominate the losses, and can be reported separately or left out.</li>
          <li><b className="text-ink">Map accuracy.</b> In Africa WorldCover cropland has 71% user's and 59% producer's accuracy (cropland is under-mapped), and grassland is confused with shrubland and cropland. Rice paddies may also be mapped as herbaceous wetland (class 90), which is not counted here.</li>
          <li><b className="text-ink">Future.</b> Land cover and unit values stay at the baseline in the future scenarios unless a projection of agricultural output is chosen.</li>
          <li><b className="text-ink">Currency.</b> Current USD of {FAO_YEAR} (FAOSTAT) and of 2008–2012 (JRC), while the building values are in 2020 USD. The difference is small next to the other uncertainties.</li>
        </ul>
      </Card>
    </>
  )
}
