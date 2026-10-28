import { Card } from './ui'

const SOURCES = [
  ['FABDEM V1-2', 'Hawker, L. et al. (2022). A 30 m global map of elevation with forests and buildings removed. Environ. Res. Lett. 17, 024016.', 'CC BY-NC-SA 4.0 (non-commercial)'],
  ['Copernicus Global Land Cover LC100', 'Buchhorn, M. et al. (2020). Copernicus Global Land Service: Land Cover 100 m, epoch 2019. Zenodo, doi:10.5281/zenodo.3939050.', 'Free and open'],
  ['GCN250', 'Jaafar, H., Ahmad, F. & El Beyrouthy, N. (2019). GCN250, new global gridded curve numbers for hydrologic modeling and design. Sci. Data 6, 145.', 'CC BY 4.0'],
  ['SoilGrids 2.0', 'Poggio, L. et al. (2021). SoilGrids 2.0: producing soil information for the globe with quantified spatial uncertainty. SOIL 7, 217–240.', 'CC BY 4.0'],
  ['HydroBASINS v1c', 'Lehner, B. & Grill, G. (2013). Global river hydrography and network routing. Hydrol. Process. 27, 2171–2186.', 'HydroSHEDS licence'],
  ['GPM IMERG Final, daily', 'Huffman, G. J. et al. (2019). GPM IMERG Final Precipitation L3 1 day 0.1°. NASA GES DISC.', 'Free and open (NASA)'],
  ['IBTrACS v04r01', 'Knapp, K. R. et al. (2010). The International Best Track Archive for Climate Stewardship (IBTrACS). Bull. Am. Meteorol. Soc. 91, 363–376.', 'Free and open (NOAA)'],
  ['WorldPop 2020, constrained, UN-adjusted', 'Bondarenko, M. et al. (2020). Census/projection-disaggregated gridded population datasets for 183 countries in 2020 using Built-Settlement Growth Model outputs. WorldPop, University of Southampton, doi:10.5258/SOTON/WP00685.', 'CC BY 4.0'],
  ['INSTAT', 'Institut National de la Statistique de Madagascar: regional population projections for 2024.', 'Official statistics'],
  ['LitPop', 'Eberenz, S., Stocker, D., Röösli, T. & Bresch, D. N. (2020). Asset exposure data for global physical risk assessment. Earth Syst. Sci. Data 12, 817–833.', 'CC BY 4.0'],
  ['Google Open Buildings', 'Sirko, W. et al. (2021). Continental-scale building detection from high resolution satellite imagery. arXiv:2107.12283.', 'CC BY 4.0 / ODbL'],
  ['GHS-SMOD', 'European Commission, Joint Research Centre: Global Human Settlement Layer, Settlement Model grid (degree of urbanisation).', 'CC BY 4.0'],
  ['SSP gridded GDP', 'Wang, T. & Sun, F. (2022). Global gridded GDP data set consistent with the shared socioeconomic pathways. Sci. Data 9, 221.', 'CC BY 4.0'],
  ['SSP gridded population', 'Wang, X., Meng, X. & Long, Y. (2022). Projecting 1 km-grid population distributions from 2020 to 2100 globally under shared socioeconomic pathways. Sci. Data 9, 563.', 'CC BY 4.0'],
  ['ESA WorldCover 2021 v200', 'Zanaga, D. et al. (2022). ESA WorldCover 10 m 2021 v200. Zenodo, doi:10.5281/zenodo.7254221.', 'CC BY 4.0'],
  ['FAOSTAT', 'FAO: Crops and livestock products, Value of agricultural production, Land use (Madagascar, 2023).', 'CC BY 4.0'],
  ['SPAM 2020', 'IFPRI (2024). Global spatially-disaggregated crop production statistics data for 2020. Harvard Dataverse, doi:10.7910/DVN/SWPENT.', 'CC BY 4.0'],
  ['Administrative boundaries', 'BNGRC fokontany (adm4) polygons, cleaned and merged by OCHA (2018), Madagascar subnational administrative boundaries (COD-AB), Humanitarian Data Exchange. Communes, districts and regions dissolved from them by pcode.', 'CC BY-IGO'],
  ['Building vulnerability', 'Englhardt, J., de Ruiter, M. C., de Moel, H. & Aerts, J. C. J. H. (2019). Enhancement of large-scale flood risk assessments using building-material-based vulnerability curves for an object-based approach in urban and rural areas. Nat. Hazards Earth Syst. Sci. 19, 1703–1722.', 'CC BY 4.0'],
  ['Agricultural vulnerability', 'Huizinga, J., de Moel, H. & Szewczyk, W. (2017). Global flood depth-damage functions: methodology and the database with guidelines. JRC Technical Report EUR 28552 EN.', 'European Commission'],
  ['CMIP6 extreme indices (C3S)', 'Copernicus Climate Change Service: Climate extreme indices and heat stress indicators derived from CMIP6 global climate projections (ETCCDI indices computed with climdex.pcic). Climate Data Store.', 'CMIP6 indicators licence (CICERO)'],
  ['CMIP6', 'Eyring, V. et al. (2016). Overview of the Coupled Model Intercomparison Project Phase 6 (CMIP6). Geosci. Model Dev. 9, 1937–1958.', 'Per modelling centre'],
  ['IPCC AR6 WGI', 'IPCC (2021). Summary for Policymakers. In: Climate Change 2021: The Physical Science Basis. Cambridge University Press. (Warming levels, Table SPM.1.)', 'IPCC'],
  ['SFINCS', 'Leijnse, T. et al. (2021). Modeling compound flooding in coastal systems using a computationally efficient reduced-physics solver. Coast. Eng. 163, 103796.', 'Open source (Deltares)'],
  ['HydroMT-SFINCS', 'Eilander, D. et al. (2023). HydroMT: automated and reproducible model building and analysis. J. Open Source Softw. 8(83), 4897.', 'MIT'],
]

const LIMITS = [
  ['Sub-daily rainfall', 'The rainfall record is daily. The 30-minute design profile relies on a depth-duration exponent (1/3) that is not calibrated yet; it sets the peak intensity and so the peak flood depth.'],
  ['Stationarity', 'The Gumbel fits assume a stationary climate over the 27 cyclone seasons 1998/99–2024/25 (GPM to September 2025). 100-year depths are indicative.'],
  ['Independent populations', 'The total design depth combines the cyclone and non-cyclone fits assuming their seasonal maxima are independent. It agrees with a direct fit of the whole record within a few per cent.'],
  ['Single-peak storm', 'The alternating-block hyetograph has one central peak. Slow cyclones with several rainbands are better represented by observed events.'],
  ['Cyclone attribution', 'A cell-day counts as cyclone rainfall within 500 km of a catalogued storm centre, at daily resolution. A wider radius raises the cyclone share. The 2000–2022 catalogue holds the storms that caused damage in Madagascar, so weaker or offshore storms without reported damage are not in it and their rain counts as non-cyclone. Storms of 1998–1999 and 2022–2025 were added by distance (landfall or within 300 km of the coast).'],
  ['Upstream inflow', 'Each catchment is modelled on its own, so about 900 of the 2,129 catchments miss the water arriving from catchments upstream. Main river reaches will be masked as fluvial; the model covers local pluvial flooding, not river floods.'],
  ['Domain', 'Catchments are HydroBASINS level 7, split into finer levels where above 1,000 km². Two basins cannot be split further (about 1,400 and 1,950 km²).'],
  ['Uniform rainfall', 'The design storm is applied uniformly over each basin.'],
  ['Data gaps', 'SoilGrids has no data on built-up land and water; GCN250 has gaps on some coastal cells, which become full runoff (conservative).'],
  ['Exposure as GDP', 'Building values are disaggregated GDP (a flow), not replacement costs; losses are in GDP-equivalent USD. Buildings have no occupancy type.'],
  ['Building classes', 'Material is unknown, so rural buildings take the Englhardt Class I curve and urban buildings Class IIIa, all as single-storey.'],
  ['Agricultural values', 'National average production value per hectare (FAOSTAT, JRC) on WorldCover cropland and grassland: one year of harvest, no crop calendar. Unit values still to be agreed.'],
  ['Climate projections', 'Future rainfall applies one national CMIP6 change factor per scenario (multi-model median of the change in mean annual Rx1day / Rx5day, against each model\'s own 1998–2024 baseline) to the observed curves, equally to every return period and to cyclone and non-cyclone rainfall. Models disagree widely (some project decreases) and resolve tropical cyclones poorly.'],
  ['Risk results (placeholder)', 'The Risk tab runs on riverine flood depth maps until the pluvial maps are merged, to demonstrate the loss computation. In those maps about 30% of the buildings wet at 100 years are under more than 10 m of water (channels, reservoirs), which the curves treat as total loss.'],
  ['Average annual loss', 'Trapezoids over 1/T between the 5- and 1,000-year events: nothing is counted for more frequent events and the 1,000-year loss is held to probability zero. Losses use GDP-equivalent building values, so future economic losses grow with the GDP projections.'],
  ['Validation','Results have not been validated against observed flooding yet.'],
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
