import type { ReactNode } from 'react'
import { Card, Info } from './ui'

// Literature review of flood depth-damage curves for pluvial flooding in Madagascar (November 2026).

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-3">
            {head.map((h) => <th key={h} className="py-1.5 pr-4 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line align-top">
              {r.map((c, j) => <td key={j} className={`py-2 pr-4 ${j === 0 ? 'font-medium text-ink' : 'text-ink-2'}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Group({ title, items }: { title: string; items: ReactNode[] }) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-ink">{title}</h4>
      <ul className="mt-1.5 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  )
}

const B = ({ children }: { children: ReactNode }) => <b className="text-ink">{children}</b>

const COMPARISON: ReactNode[][] = [
  ['Huizinga et al. 2017 (JRC, Africa)', 'Africa (South Africa, Mozambique)', 'Mostly fluvial', 'Transfer and normalisation of existing models', 'One residential curve', 'Coarse (0.5 m steps), no threshold', 'Medium: standard, but generic'],
  ['Englhardt et al. 2019', 'Ethiopia', 'Fluvial', 'Synthetic (literature, field data, experts)', '4 material classes, 1 and 2 floors', 'Defined, no threshold', <B>High: closest building types</B>],
  ['Lilongwe, Malawi 2025', 'Malawi', 'Urban, rain-driven', 'Empirical survey (80 buildings)', '5 brick and mud-brick types', 'Depth bands only', 'High as a check; not a curve'],
  ['Besarra et al. 2025', 'Philippines', 'Cyclone flood', 'Empirical survey (394 households)', 'Light, raised light, masonry', 'Defined', 'Medium–high for light-material houses'],
  ['Komolafe et al. 2025', 'Nigeria', 'Fluvial', 'Empirical survey (149 households)', '3 building types', 'Defined', 'Medium (values behind paywall, not checked)'],
  ['Chinh et al. 2016, 2017; Wijayanti et al. 2017', 'Vietnam, Indonesia', 'Mixed river, tide, rain', 'Empirical surveys', 'Households', '—', 'Low as curves; shows how uncertain curves are'],
  ['European and New Zealand pluvial studies', 'Europe, New Zealand', <B>Pluvial</B>, 'Empirical (insurance claims, surveys)', 'Various', 'Well described', 'Low for values; high for shape and thresholds'],
  ['World Bank / GFDRR 2016 (SWIO-RAFI)', <B>Madagascar</B>, 'Inland flood', 'Proprietary catastrophe model', 'By construction type (not published)', '—', 'Loss benchmark only'],
  ['Rice damage functions, NHESS 2026', 'Southeast Asia', 'Fluvial and pluvial', 'Review of 20 models + surveys', 'Rice, by growth stage', 'Depth × duration', <B>High for paddy rice</B>],
]

const REFERENCES = [
  'Besarra et al. (2025). Flood fragility and vulnerability functions for residential buildings in the Province of Leyte, Philippines. Journal of Flood Risk Management. https://doi.org/10.1111/jfr3.13043',
  'Chinh, D.T. et al. (2016). Multi-variate analyses of flood loss in Can Tho City, Mekong Delta. Water, 8(1), 6. https://doi.org/10.3390/w8010006',
  'Chinh, D.T. et al. (2017). Flood loss models and risk analysis for private households in Can Tho City, Vietnam. Water, 9(5), 313. https://doi.org/10.3390/w9050313',
  'Englhardt, J. et al. (2019). Enhancement of large-scale flood risk assessments using building-material-based vulnerability curves for an object-based approach in urban and rural areas. Natural Hazards and Earth System Sciences, 19, 1703–1722. https://doi.org/10.5194/nhess-19-1703-2019',
  'Flood damage functions for rice: synthesizing evidence and building data-driven models (2026). Natural Hazards and Earth System Sciences, 26, 925–942. https://doi.org/10.5194/nhess-26-925-2026',
  'Gerl, T. et al. (2016). A review of flood loss models as basis for harmonization and benchmarking. PLOS ONE, 11(7), e0159791. https://doi.org/10.1371/journal.pone.0159791',
  'Huizinga, J., de Moel, H., Szewczyk, W. (2017). Global flood depth-damage functions: methodology and the database with guidelines. JRC Technical Report EUR 28552 EN. https://publications.jrc.ec.europa.eu/repository/handle/JRC105688',
  'Komolafe, A.A. et al. (2025). Flood damage models and flood damage factors in a data-scarce river basin, Nigeria. Environmental Hazards, 24(4), 311–338. https://doi.org/10.1080/17477891.2024.2394206',
  'Malgwi, M.B. et al. (2020). A generic physical vulnerability model for floods: review and concept for data-scarce regions. Natural Hazards and Earth System Sciences, 20, 2067–2090. https://doi.org/10.5194/nhess-20-2067-2020',
  'Martínez-Gomariz, E. et al. (2020). Flood depth–damage curves for Spanish urban areas. Sustainability, 12(7), 2666. https://doi.org/10.3390/su12072666',
  'Paulik, R. et al. (2023). Evaluating the spatial application of multivariable flood damage models. Journal of Flood Risk Management. https://doi.org/10.1111/jfr3.12934',
  'Physical vulnerability of buildings to flooding in Lilongwe City, Malawi (2025). UCL Open: Environment, 7, e3216. https://doi.org/10.14324/111.444/ucloe.3216',
  'Rözer, V. et al. (2016). Coping with pluvial floods by private households. Water, 8(7), 304. https://doi.org/10.3390/w8070304',
  'Spekkers, M.H. et al. (2014). Decision-tree analysis of factors influencing rainfall-related building structure and content damage. Natural Hazards and Earth System Sciences, 14, 2531–2547. https://doi.org/10.5194/nhess-14-2531-2014',
  'Van Ootegem, L. et al. (2015). Multivariate pluvial flood damage models. Environmental Impact Assessment Review, 54, 91–100. https://doi.org/10.1016/j.eiar.2015.05.005',
  'Wijayanti, P. et al. (2017). Estimation of river flood damages in Jakarta, Indonesia. Natural Hazards, 86, 1059–1079. https://doi.org/10.1007/s11069-016-2730-1',
  'Wing, O.E.J. et al. (2020). New insights into US flood vulnerability revealed from flood insurance big data. Nature Communications, 11, 1444. https://doi.org/10.1038/s41467-020-15264-2',
  'World Bank / GFDRR (2016). Profil de risque de catastrophe – Madagascar (SWIO-RAFI). https://documents1.worldbank.org/curated/en/262521494235299571/pdf/114366-FRENCH-WP-PUBLIC-drp-madagascar-fr.pdf',
  'World Bank (2018). The Road to Recovery: The Role of Poverty in the Exposure, Vulnerability and Resilience to Floods in Accra. https://documents1.worldbank.org/curated/en/301991534935351432/pdf/',
  'World Bank (2019). Wading Out the Storm: The Role of Poverty in Exposure, Vulnerability and Resilience to Floods in Dar es Salaam. https://documents1.worldbank.org/curated/en/788241565625141093/pdf/',
]

function linkify(s: string): ReactNode {
  const m = s.match(/https?:\/\/\S+$/)
  if (!m) return s
  return <>{s.slice(0, m.index)}<a className="text-accent underline underline-offset-2 break-all" href={m[0]} target="_blank" rel="noreferrer">{m[0]}</a></>
}

export function LiteratureReview() {
  return (
    <div className="space-y-4">
      <Card title="Literature review: depth-damage curves for pluvial flooding" subtitle="Which published curves fit pluvial flooding in Madagascar, or in places with similar building stock and climate, and which ones the assessment uses.">
        <Info>
          Pluvial flooding differs from river flooding in ways that matter for vulnerability: water is mostly shallow (below
          0.5 m), slow-moving, and lasts hours to a few days. Most pluvial losses therefore depend on the <B>shallow end of the
          curve (0–0.5 m) and the depth at which damage starts</B>, which is where curves built for river floods are least
          reliable. Exposure in Madagascar is dominated by single-storey residential buildings, many of them non-engineered
          (earth, sun-dried brick, timber, corrugated metal sheet), plus rice paddies in the lowlands.
        </Info>
        <Info>
          Sources were searched in five groups: Madagascar-specific studies, global databases, sub-Saharan Africa, other
          tropical low-income settings, and pluvial-specific studies from any country. <B>No published depth-damage curve exists
          for Madagascar</B>, for buildings or for crops.
        </Info>
      </Card>

      <Card title="Sources by group">
        <Group title="1. Madagascar" items={[
          <><B>World Bank / GFDRR (2016), SWIO-RAFI risk profile.</B> A proprietary catastrophe model with vulnerability functions by construction type, occupancy and region; the functions are not published. Inland flood losses: about USD 13 M per year on average and USD 120 M for a 100-year event. Useful as a national loss benchmark, not as a source of curves.</>,
          <><B>World Bank project documents on Antananarivo flooding.</B> The 2015 flood is reported at about 1.1% of GDP and about 93,000 people affected. Event losses only, no curves.</>,
        ]} />
        <Group title="2. Global databases" items={[
          <><B>Huizinga et al. (2017), JRC global depth-damage functions.</B> The standard for large-scale studies (CLIMADA, Delft-FIAT). Relative curves by continent and sector from 0 to 6 m, with a method to set maximum damage per country from GDP per capita. The Africa residential curve gives 0.22 at 0.5 m, 0.38 at 1 m, 0.64 at 2 m and 1.0 at 6 m, but rests on only five house types from South Africa and Mozambique. The Africa agriculture curve reaches 1.0 at 3 m. No Africa curves for commercial buildings or infrastructure.</>,
        ]} />
        <Group title="3. Sub-Saharan Africa" items={[
          <><B>Englhardt et al. (2019), Ethiopia.</B> Synthetic curves for four building-material classes (I earth and informal, II timber, III unreinforced masonry, IV reinforced concrete), one and two floors. Using a single generic curve instead raised expected annual damage by 41%. The closest match to Malagasy building types and the only African source that separates them.</>,
          <><B>Lilongwe, Malawi (2025).</B> Survey of 80 brick and mud-brick houses with corrugated iron roofs; damage by depth band (below 30, 30–60, above 60 cm). Very similar building types and pluvial-relevant depths. Cites Karonga (Malawi): at 1.5 m, 100% loss for traditional, 60% for semi-permanent and 35% for permanent houses.</>,
          <><B>Komolafe et al. (2025), Nigeria.</B> Empirical building and contents curves from 149 households, by building type, for river flooding.</>,
          <><B>Malgwi et al. (2020), Nigeria.</B> A method for building vulnerability models from post-event surveys where data are scarce; no ready-made curves.</>,
          <><B>World Bank household surveys, Accra (2015) and Dar es Salaam (2018).</B> Urban floods driven mostly by rainfall; losses and share of dwellings damaged, no curves. Useful for checking results.</>,
        ]} />
        <Group title="4. Other tropical and low-income settings" items={[
          <><B>Besarra et al. (2025), Philippines.</B> Empirical fragility and vulnerability functions from 394 households for light-material, raised light-material and masonry houses in a cyclone setting. The strongest empirical source for timber and metal-sheet housing.</>,
          <><B>Chinh et al. (2016, 2017), Vietnam; Wijayanti et al. (2017), Jakarta.</B> Surveys after mixed river, tide and rain floods. Depth alone explains little of the damage (R² about 0.26 in Jakarta), and a curve transferred from elsewhere overestimated Jakarta's survey-based loss about 2.6 times.</>,
        ]} />
        <Group title="5. Pluvial-specific studies" items={[
          <><B>Spekkers et al. (2014), Netherlands; Van Ootegem et al. (2015), Belgium; Rözer et al. (2016), Germany; Martínez-Gomariz et al. (2020), Spain; Paulik et al. (2023), New Zealand.</B> They agree that damage occurs at shallow depths, contents carry much of the loss, many flooded properties report no damage (so a threshold is needed), and losses vary widely (depth explains only about 20–30% of the variance). The values do not transfer to Madagascar (basements, high-value contents), but the lessons on curve shape and thresholds do.</>,
        ]} />
        <Group title="6. Agriculture" items={[
          <><B>Rice damage functions, NHESS (2026).</B> Reviews 20 rice models from 12 countries and fits new ones to surveys in Thailand and Myanmar. Yield loss depends on depth, flood duration and growth stage; lookup tables are open. No African data, but the most complete basis for rice.</>,
        ]} />
      </Card>

      <Card title="Comparison">
        <Table head={['Source', 'Region', 'Flood type', 'Method', 'Classes', 'Shallow range (0–0.5 m)', 'Fit for Madagascar pluvial']} rows={COMPARISON} />
      </Card>

      <Card title="Strengths and weaknesses of the four options">
        <Table head={['Option', 'Strengths', 'Weaknesses']} rows={[
          ['A. JRC Africa curves only (Huizinga et al., 2017)',
            'Transparent global standard; consistent with CLIMADA, Delft-FIAT and earlier assessments; comes with country maximum damage values.',
            'One curve for all buildings, based on two countries; no threshold and only 0.5 m steps, so values in the 0–0.5 m range are interpolated; likely overstates damage to concrete and understates it for earth houses.'],
          ['B. Material-class curves (Englhardt et al., 2019)',
            'Separates the building types that dominate Madagascar; large, documented effect on losses (41%); peer-reviewed and applied in a low-income African setting.',
            'Synthetic, not observed; built for river floods; no threshold or duration term; needs a building-material class per building, which the exposure data do not give directly.'],
          ['C. Empirical curves from Malawi, the Philippines or Nigeria',
            'Based on observed damage to similar building types.',
            'Small samples and local conditions; some give only depth bands or are behind a paywall. Better for checking option B than as the main source.'],
          ['D. Pluvial curves from Europe or New Zealand',
            'The only curves calibrated on pluvial floods.',
            'Very different building stock and contents values. Their lessons on thresholds and shallow depths transfer; their values do not.'],
        ]} />
      </Card>

      <Card title="Recommendation">
        <Info>No source offers curves that are both pluvial-specific and calibrated for Madagascar. The assessment therefore combines the best available evidence for each asset type:</Info>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
          <li><B>Buildings: Englhardt et al. (2019) material-class curves</B> (option B), already used in this assessment: Class I for rural and Class IIIa for urban buildings (see above).</li>
          <li><B>Damage threshold of 0.10 m:</B> shallower water counts as dry, representing floor or plinth height and the many no-damage cases reported in the pluvial literature. The value will be checked against the Malawi depth bands and the Philippine light-material functions.</li>
          <li><B>JRC Africa residential curve as a sensitivity test</B> (option A), to show how much the curve choice moves the results and to stay comparable with earlier assessments.</li>
          <li><B>Agriculture:</B> the JRC Africa agriculture curve for now; the rice depth–duration functions (NHESS, 2026) are proposed for paddy areas, since cyclone floods on rice can last several days.</li>
          <li><B>Population:</B> people living in flooded areas above the threshold, with the damage-weighted count as an option (see Population).</li>
          <li><B>Validation:</B> modelled average annual losses against the SWIO-RAFI inland-flood estimate (USD 13 M per year, an upper bound because it also includes river flooding), and event losses against recorded impacts (see the Calibration tab).</li>
        </ol>
        <Info>
          Depth-damage curves are among the largest sources of uncertainty in flood risk, and depth alone explains only part
          of the observed damage. Results will be presented with the sensitivity range, not as single values.
        </Info>
      </Card>

      <Card title="References">
        <ul className="space-y-1.5 text-sm leading-relaxed text-ink-2">
          {REFERENCES.map((r) => <li key={r}>{linkify(r)}</li>)}
        </ul>
      </Card>
    </div>
  )
}
