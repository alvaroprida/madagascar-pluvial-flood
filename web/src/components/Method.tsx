import { Card } from './ui'

const SOURCES = [
  ['FABDEM V1-2', 'Hawker, L. et al. (2022). A 30 m global map of elevation with forests and buildings removed. Environ. Res. Lett. 17, 024016.', 'CC BY-NC-SA 4.0 (non-commercial)'],
  ['Copernicus Global Land Cover LC100', 'Buchhorn, M. et al. (2020). Copernicus Global Land Service: Land Cover 100 m, epoch 2019. Zenodo, doi:10.5281/zenodo.3939050.', 'Free and open'],
  ['GCN250', 'Jaafar, H., Ahmad, F. & El Beyrouthy, N. (2019). GCN250, new global gridded curve numbers for hydrologic modeling and design. Sci. Data 6, 145.', 'CC BY 4.0'],
  ['SoilGrids 2.0', 'Poggio, L. et al. (2021). SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty. SOIL 7, 217–240.', 'CC BY 4.0'],
  ['HydroBASINS v1c', 'Lehner, B. & Grill, G. (2013). Global river hydrography and network routing. Hydrol. Process. 27, 2171–2186.', 'HydroSHEDS licence'],
  ['GPM IMERG Final, daily', 'Huffman, G. J. et al. (2019). GPM IMERG Final Precipitation L3 1 day 0.1°. NASA GES DISC.', 'Free and open (NASA)'],
  ['IBTrACS v04r00', 'Knapp, K. R. et al. (2010). The International Best Track Archive for Climate Stewardship (IBTrACS). Bull. Am. Meteorol. Soc. 91, 363–376.', 'Free and open (NOAA)'],
  ['SFINCS', 'Leijnse, T. et al. (2021). Modeling compound flooding in coastal systems using a computationally efficient reduced-physics solver. Coast. Eng. 163, 103796.', 'Open source (Deltares)'],
  ['HydroMT-SFINCS', 'Eilander, D. et al. (2023). HydroMT: automated and reproducible model building and analysis. J. Open Source Softw. 8(83), 4897.', 'MIT'],
]

const LIMITS = [
  ['Sub-daily rainfall', 'The rainfall record is daily. The 30-minute design profile relies on a depth-duration exponent (1/3) that is not calibrated yet; it sets the peak intensity and so the peak flood depth.'],
  ['Stationarity', 'The Gumbel fits assume a stationary climate over 1998–2024. With 26 seasons, 100-year depths are indicative.'],
  ['Independent populations', 'The total design depth combines the cyclone and non-cyclone fits assuming their seasonal maxima are independent. It agrees with a direct fit of the whole record within a few per cent.'],
  ['Single-peak storm', 'The alternating-block hyetograph has one central peak. Slow cyclones with several rainbands are better represented by observed events.'],
  ['Cyclone attribution', 'A cell-day counts as cyclone rainfall within 500 km of a storm centre, at daily resolution. A wider radius raises the cyclone share.'],
  ['Upstream inflow', 'Each catchment is modelled on its own, so main rivers receive no inflow from upstream catchments. The model covers local pluvial flooding, not river floods.'],
  ['Uniform rainfall', 'The design storm is applied uniformly over each basin.'],
  ['Data gaps', 'SoilGrids has no data on built-up land and water; GCN250 has gaps on some coastal cells, which become full runoff (conservative).'],
  ['Validation', 'Results have not been validated against observed flooding yet.'],
]

export function Method() {
  return (
    <div className="space-y-4">
      <Card title="Assumptions and limitations">
        <dl className="grid gap-3 md:grid-cols-2">
          {LIMITS.map(([t, d]) => (
            <div key={t} className="rounded-lg border border-line p-3">
              <dt className="font-medium text-ink">{t}</dt>
              <dd className="mt-1 text-sm text-ink-2">{d}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Data, tools and references">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                {['Source', 'Reference', 'Licence'].map((h) => <th key={h} className="py-1.5 pr-4 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {SOURCES.map(([n, ref, lic]) => (
                <tr key={n} className="border-b border-line align-top last:border-0">
                  <td className="py-2 pr-4 font-medium text-ink">{n}</td>
                  <td className="py-2 pr-4 text-ink-2">{ref}</td>
                  <td className="py-2 pr-4 text-ink-2">{lic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-ink-2">
          Basemaps © OpenStreetMap contributors, OpenFreeMap. The modelling code is a Python package
          (rasterio, xarray, geopandas, HydroMT-SFINCS) kept in a private repository; this site holds only the
          figures and summary data it exports.
        </p>
      </Card>
    </div>
  )
}
