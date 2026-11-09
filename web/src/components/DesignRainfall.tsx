/** Sections of the Rainfall chapters built from design_storms.json: storm types, attribution radius check,
 *  event durations, depth-duration law, design hyetographs and intensity checks. */
import { useEffect, useState, type ReactNode } from 'react'
import type { EChartsOption } from 'echarts'
import { dataUrl } from '../data'
import { fmt } from '../format'
import { POP_LABEL, POP_SLOT, type Palette } from '../theme'
import type { DesignStorms } from '../types'
import { Card, Chart, DataTable, Figure, Info, Ref, Segmented, Stat, Steps } from './ui'

export const REPORT = 'IRD/ORSTOM (1993), Fleuves et rivières de Madagascar, §7.4'

const axisStyle = (p: Palette) => ({
  axisLabel: { color: p['text-secondary'] },
  axisLine: { lineStyle: { color: p.axis } },
  axisTick: { show: false },
  splitLine: { lineStyle: { color: p.grid } },
  nameTextStyle: { color: p['text-secondary'] },
})

const pct = (v: number) => `${fmt(v * 100, 0)}%`

/** Small static table (always visible): the numbers are the point of these cards. */
function Table({ head, rows, caption }: { head: string[]; rows: ReactNode[][]; caption: string }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-sm tabular">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-ink-3">
            {head.map((h) => <th key={h} className="py-1.5 pr-4 align-bottom font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line align-top last:border-0">
              {r.map((c, j) => <td key={j} className={`py-1.5 pr-4 ${j === 0 ? 'font-medium text-ink' : 'text-ink-2'}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Section wrapper: a card that cross-references can scroll to. */
export function Section({ id, ...card }: { id: string } & Parameters<typeof Card>[0]) {
  return <div id={id} className="scroll-mt-4"><Card {...card} /></div>
}

export function useDesignStorms() {
  const [d, setD] = useState<DesignStorms>()
  useEffect(() => {
    fetch(dataUrl('design_storms.json')).then((r) => r.json()).then(setD)
  }, [])
  return d
}

const ratioOf = (d: DesignStorms) => (t: number) => d.nontc_duration_check!.ratios.find((r) => r.t_h === t)!

// ------------------------------------------------------------------ Chapter 1
export function StormTypes() {
  return (
    <Section id="s1-1" title="1.1 Convective storms and tropical cyclones" subtitle={`Characteristics of extreme rainfall in Madagascar from the ORSTOM rainfall study (${REPORT}).`}>
      <Table caption="Characteristics of thunderstorm and cyclone rainfall in Madagascar"
        head={['', 'Thunderstorms (convective)', 'Cyclones and tropical depressions']}
        rows={[
          ['Structure', 'Very short or no preliminary phase (< 10 mm/h); a core of 10–20 min at 80–100 mm/h, with 5-min bursts of 200 mm/h and more; a tail of several hours falling from 30 to 5 mm/h', 'Regular, long-lasting rain with moderate intensities'],
          ['Duration', 'Core under an hour, tail of a few hours (e.g. 29 Nov 1962, Antananarivo: 78 mm, core of 50 min, 90 min of tail)', 'Tens of hours: 68 h almost without a break over the upper Ikopa (25–28 Mar 1959); 50 h at Morombe (12–14 Jan 1959)'],
          ['Intensity', '519 mm/h over 6 min (15 Nov 1962, Antananarivo); 312 mm/h over a few minutes (Tafaina basin, 2 Dec 1965)', 'At most 36 mm/h (Antananarivo, 1959) and 88 mm/h over 15 min (Morombe, 1959)'],
          ['Totals', '30–150 mm in the recorded storms', '300–800 mm in 3–6 days: Toamasina 603 mm in 4 days, Mananara-Nord 515 mm in 3 days, Isalo 807 mm in 4 days'],
          ['Extent', 'Local', 'Whole river basins along the track'],
          ['Season', 'Most frequent from late October, at the end of the dry season, then all through the rainy season', 'Mostly January–March'],
          ['Soils', 'Not documented', 'Bring soils near saturation: runoff of at least 70% of rain over the upper Ikopa in 1959'],
        ]} />
      <Info>
        Other non-cyclone rain comes from non-cyclonic depressions, southern winter rain from polar-front lows and multi-day
        series of thunderstorms on the highlands (5–15 days, sometimes 20). The report describes these series only
        qualitatively and only for the highlands: they are not given a design storm of their own. Highest daily records by
        region: east coast 543 mm (Vatomandry), north 533 mm (Antsiranana), west 398 mm (Tsaratanana), south 225 mm (Toliara),
        highlands 166–188 mm.
      </Info>
    </Section>
  )
}

export function Hypotheses() {
  return (
    <Section id="s1-2" title="1.2 Working hypotheses" subtitle="What the storm types imply for the design rainfall, and where each hypothesis is tested.">
      <Table caption="Working hypotheses from the storm types"
        head={['', 'Hypothesis', 'Basis (section 1.1)', 'Tested or applied in']}
        rows={[
          ['H1', 'Cyclone and non-cyclone rainfall are two populations, to be separated in the record and treated separately', 'Different mechanism, duration, intensity, extent and season',
            <>Separation: <Ref to="ch2">Chapter 2</Ref>; statistics: <Ref to="ch4">Chapter 4</Ref>; storm shapes: <Ref to="ch5">Chapter 5</Ref></>],
          ['H2', 'A cyclone rainfall event lasts about 3 days, with moderate intensities', '50–68 h of continuous rain; 300–800 mm in 3–6 days',
            <><Ref to="s3-1">Section 3.1</Ref>: confirmed (72 h)</>],
          ['H3', 'A non-cyclone event is a thunderstorm: an intense core under an hour and a tail of a few hours (3 h assumed)', 'Core of 10–50 min, tail of 1.5 h to several hours',
            <><Ref to="s3-2">Section 3.2</Ref>: 3 h core confirmed; the event lasts 12 h</>],
        ]} />
    </Section>
  )
}

// ------------------------------------------------------------------ Chapter 2
/** One step of a figure-led argument: the figure, then how it is computed, what it shows and what follows. */
function FigureStep({ n, title, src, alt, wide, children }: { n: number; title: string; src: string; alt: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`mt-6 grid gap-4 border-t border-line pt-4 ${wide ? '' : 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]'}`}>
      <div><Figure src={dataUrl(`figures/${src}`)} alt={alt} /></div>
      <div className="space-y-2 text-sm leading-relaxed text-ink-2">
        <h3 className="text-sm font-semibold text-ink">Step {n}. {title}</h3>
        {children}
      </div>
    </div>
  )
}

const Part = ({ label, children }: { label: string; children: ReactNode }) => (
  <p><b className="text-ink">{label}.</b> {children}</p>
)
const Limit = ({ children }: { children: ReactNode }) => <p className="text-xs text-ink-3"><b>Limitation.</b> {children}</p>

export function RadiusCheck({ d }: { d: DesignStorms }) {
  const rc = d.radius_check
  if (!rc) return null
  const R0 = rc.radius_adopted_km, R1 = rc.radius_tested_km
  const ratio = (k: string) => rc.depth_ratio_tested_over_adopted[k]
  const f = rc.figures
  const n = rc.outer_band_check.catchments_nontc_rp100_up_more_than_10pct, N = rc.outer_band_check.n_catchments
  const POP = { total: 'Total', tc: 'Cyclone', nontc: 'Non-cyclone' } as const
  if (!f) return null
  const s2 = f.step2, sm = f.step3_seasonal_maxima, reg2 = (r: string) => s2.regions.find((x) => x.region === r)!
  const reg4 = (r: string) => f.step4.regions.find((x) => x.region === r)!
  const x = (v: number) => `×${v.toFixed(2)}`
  return (
    <Section id="s2-4" title="2.4 Choice of the attribution radius" subtitle={`Why rain within ${R0} km of a storm centre is counted as cyclone rain: five steps, each building on the previous one.`}>
      <div className="space-y-2 text-sm leading-relaxed text-ink-2">
        <p>
          <b className="text-ink">What the radius decides.</b> GPM measures how much it rained, not why. A day of rain on a
          GPM cell is labelled cyclone rain when the centre of a storm passes within a set distance of the cell that day
          (<Ref to="s2-1">section 2.1</Ref>); all other rain is non-cyclone rain. That distance, the attribution radius, is
          the only free parameter of the split. It matters because the two populations get different design storms
          (<Ref to="ch5">Chapter 5</Ref>): a 72 h storm on wet soils for cyclones, a 12 h storm with an intense core for
          thunderstorms. Too small a radius labels the outer rain of cyclones as thunderstorm rain; too large a radius labels
          ordinary thunderstorms as cyclone rain.
        </p>
        <p>
          <b className="text-ink">How the choice is tested.</b> {R0} km is the radius most used to attribute rain to tropical
          cyclones in satellite and gauge studies (e.g. Jiang &amp; Zipser 2010; Prat &amp; Nelson 2013; Khouakhi et al. 2017).
          To check it on Madagascar, the whole chain was run a second time with {R1} km: the split, the catchment series and
          the extreme value fits of <Ref to="ch4">Chapter 4</Ref>. Comparing the two runs answers two questions:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b className="text-ink">Does the radius change the design rainfall, and where?</b> Measured by the{' '}
            <b className="text-ink">depth ratio</b> (steps 3 and 4): for each catchment, population and return period, the
            daily design depth with {R1} km divided by the depth with {R0} km. A ratio of 1 means the radius makes no
            difference; &ldquo;within 5%&rdquo; means a ratio between 0.95 and 1.05.
          </li>
          <li>
            <b className="text-ink">Is the rain that changes label cyclone rain?</b> Measured by the{' '}
            <b className="text-ink">outer-band share</b> (step 5): among the largest non-cyclone days of the catchments whose
            design depth rises, the share that had a storm between {R1} and {R0} km away. The same share in the other
            catchments gives the rate expected by coincidence. A clear excess over that rate means the rain is cyclone rain.
          </li>
        </ul>
        <p>Each step gives how the figure is computed, what it shows, and what follows for the next step. The conclusion gathers the five findings.</p>
      </div>

      <FigureStep n={1} title="Cyclone rain reaches beyond 300 km: one storm day" src="radius_1_example.png"
        alt={`Daily GPM rainfall on ${f.example.date} with the track of ${f.example.storm} and the areas labelled cyclone rain with ${R1} and ${R0} km`}>
        <Part label="How it is computed">Daily GPM rainfall on one day. Inside the solid line, cells within {R1} km of a
          position of the storm that day: cyclone rain with either radius. Inside the dashed line, cells within {R0} km.
          Between the two lines, the rain changes label: cyclone rain with {R0} km, thunderstorm rain with {R1} km.</Part>
        <Part label="Finding">{f.example.storm} ({f.example.date}) never made landfall: its centre stayed at least{' '}
          {fmt(f.example.nearest_coast_km)} km off the east coast. Its rain still covered the east coast and reached the
          north: {fmt(f.example.land_cells_50mm_between_radii)} land cells between the two lines received 50 mm or more that day.</Part>
        <Part label="What follows">A cyclone rains far beyond its core: its outer rainbands and moist inflow reach several
          hundred kilometres from the centre, while its strongest winds lie within about 50 km. With {R1} km, this rain would
          count as thunderstorm rain. One day is an illustration; step 2 measures the same effect over the whole record.</Part>
        <Limit>The day was chosen, not drawn at random: among storms that stayed offshore east of the island, the day with a
          single storm and the most heavy rain between the two lines. The GPM grid stops at 50.75°E, so rain under the storm
          itself is cut at the right edge.</Limit>
      </FigureStep>

      <FigureStep n={2} title="How much rain the radius moves, and where" src="radius_2_tc_share.png"
        alt={`Six maps: cyclone share of annual rainfall with ${R0} and ${R1} km and the change; annual rainfall; rain relabelled; days with a storm ${R1}–${R0} km away`}>
        <Part label="How it is computed">Every map uses the yearly mean over the record (1998–2025) for each GPM cell on land.
          (a) and (b): cyclone rain divided by all rain in the cell, with each radius. The land figures above the maps
          ({pct(s2.share_land[`${R0}km`])} and {pct(s2.share_land[`${R1}km`])}) are the cyclone rain summed over all land
          cells divided by all rain summed over them: the share of the island's rainfall that comes from cyclones, as in{' '}
          <Ref to="s2-1">section 2.1</Ref>. (c): share (b) minus share (a), in percentage points: a cell going from 20% to
          12% shows −8 points. (d): annual rainfall, the same with either radius. (e): cyclone rain with {R0} km minus cyclone
          rain with {R1} km, in mm per year: the rain that becomes non-cyclone rain. Since total rain does not change, (c) is
          (e) divided by (d). (f): days per year with a storm {R1}–{R0} km away, i.e. labelled cyclone with {R0} km but not
          with {R1} km.</Part>
        <Part label="Finding">Over land, {fmt(s2.land.moved_mm, 0)} mm of the {fmt(s2.land.total_mm, 0)} mm that fall each year
          change label, {fmt(-s2.land.change_pp, 1)} percentage points of the rainfall. The change is everywhere because storms pass
          {' '}{R1}–{R0} km away from every part of the island almost equally often: {fmt(Math.min(...s2.regions.map((r) => r.band_days)), 1)} to{' '}
          {fmt(Math.max(...s2.regions.map((r) => r.band_days)), 1)} days a year in every region (f). The island is about 570 km
          wide, so a ring of {R1}–{R0} km around a storm off either coast covers much of it.</Part>
        <Part label="Spatial pattern">The rain that moves (e) is largest where those days are wettest: the east coast
          ({fmt(reg2('East coast').moved_mm)} mm a year) and the north-west ({fmt(reg2('North-west').moved_mm)} mm), the
          least in the south-west ({fmt(reg2('South-west').moved_mm)} mm). The change in share (c) is nevertheless largest in
          the west ({fmt(reg2('West').change_pp, 1)} points) and south-west ({fmt(reg2('South-west').change_pp, 1)} points):
          they receive little rain ({fmt(reg2('West').total_mm)} and {fmt(reg2('South-west').total_mm)} mm a year, against
          {' '}{fmt(reg2('East coast').total_mm)} mm on the east coast), so the same rain is a larger share of it. The dark
          west and south in (c) is an effect of dry climates, not of more cyclone rain moving there.</Part>
        <Table caption="Annual rainfall moved by the radius, by region"
          head={['Region', 'Annual rainfall (mm)', `Relabelled with ${R1} km (mm)`, 'Change in cyclone share (points)', `Days with a storm ${R1}–${R0} km away, per year`]}
          rows={[...s2.regions.map((r) => [r.region, fmt(r.total_mm), fmt(r.moved_mm), r.change_pp.toFixed(1), r.band_days.toFixed(1)]),
            ['All land', fmt(s2.land.total_mm, 0), fmt(s2.land.moved_mm, 0), fmt(s2.land.change_pp, 1), fmt(s2.land.band_days, 1)]]} />
        <Part label="What follows">The radius decides the label of about 5% of all rain, on every part of the island. Design
          depths, however, come from the largest days, not from annual totals: step 3 checks how they change.</Part>
        <Limit>Regions are approximate boxes used only for these summaries. Annual means mix all days, ordinary and extreme.</Limit>
      </FigureStep>

      <FigureStep n={3} title="Effect on the design depths" src="radius_3_depth_ratio.png"
        alt={`Distribution over catchments of the design depth with ${R1} km divided by the depth with ${R0} km, per population and return period`}>
        <Part label="How it is computed">For every catchment, each population is reduced to its seasonal maxima: the largest
          daily rainfall of each season (July to June), 27 values for the 27 complete seasons. The extreme value fits of{' '}
          <Ref to="s4-1">section 4.1</Ref> turn them into the 10- and 100-year daily depths. This is done with both radii, and
          each row of the figure shows how the depth ratio ({R1} ÷ {R0} km) is spread over the {fmt(N)} catchments. The table
          below shows how the seasonal maxima themselves change.</Part>
        <Table caption="Seasonal maxima with the tested radius against the adopted radius, over all catchments and seasons"
          head={['', 'Cyclone', 'Non-cyclone']}
          rows={[
            ['Seasons without any rain of the population', `${pct(sm.tc.seasons_without_rain[0])} → ${pct(sm.tc.seasons_without_rain[1])}`, `${pct(sm.nontc.seasons_without_rain[0])} → ${pct(sm.nontc.seasons_without_rain[1])}`],
            ['Seasonal maxima lower / higher', `${pct(sm.tc.maxima_lower)} / ${pct(sm.tc.maxima_higher)}`, `${pct(sm.nontc.maxima_lower)} / ${pct(sm.nontc.maxima_higher)}`],
            ['Typical (median) seasonal maximum, median over catchments', x(sm.tc.median_maximum_ratio), x(sm.nontc.median_maximum_ratio)],
            ['Mean of the 3 largest maxima: median (5–95% of catchments)', `${x(sm.tc.top_maxima_ratio.median)} (${x(sm.tc.top_maxima_ratio.p05)}–${x(sm.tc.top_maxima_ratio.p95)})`, `${x(sm.nontc.top_maxima_ratio.median)} (${x(sm.nontc.top_maxima_ratio.p05)}–${x(sm.nontc.top_maxima_ratio.p95)})`],
          ]} />
        <Part label="Why cyclone ratios are below 1 and non-cyclone ratios above">The direction is set by the construction.
          With {R1} km fewer days are cyclone days, so the cyclone series of a catchment loses days and the non-cyclone series
          gains the same days. The largest value of a season taken over fewer days can only fall or stay the same; over more
          days it can only rise or stay. The data follow this exactly: {pct(sm.tc.maxima_lower)} of cyclone maxima fall and
          none rise; {pct(sm.nontc.maxima_higher)} of non-cyclone maxima rise and none fall. The small departures in the
          figure (a few non-cyclone ratios just under 1) come from the fitting, not from the data.</Part>
        <Part label="Cyclone: the frequent depths fall, the rare ones hardly">Seasons with no cyclone rain at all rise from{' '}
          {pct(sm.tc.seasons_without_rain[0])} to {pct(sm.tc.seasons_without_rain[1])}, and the typical seasonal maximum
          falls by a quarter. The three largest maxima of each catchment barely move (median {x(sm.tc.top_maxima_ratio.median)}):
          the heaviest cyclone rain falls near the centre, within {R1} km, and stays cyclone rain. The 10-year depth depends
          more on ordinary seasons and falls more (median {x(ratio('tc_rp10').median)}); the 100-year depth depends on the
          largest seasons and hardly changes ({x(ratio('tc_rp100').median)}).</Part>
        <Part label="Non-cyclone: unchanged in most catchments, much higher in some">The days added to the non-cyclone series
          are usually smaller than the catchment's own largest thunderstorm days, so most maxima do not change and the median
          ratio stays close to 1 ({x(ratio('nontc_rp10').median)} at 10 years, {x(ratio('nontc_rp100').median)} at 100). Where
          the added days are among the largest of the record, the depth rises sharply: the three largest maxima rise by up
          to {pct(sm.nontc.top_maxima_ratio.p95 - 1)} in the 5% most affected catchments, and the 100-year depth by up to{' '}
          {x(ratio('nontc_rp100').p95)}.</Part>
        <Part label="Total: stable">The rain itself does not depend on the radius. The design total can still move a little,
          because it is rebuilt from the two fitted populations rather than fitted on all rain (<Ref to="s4-1">section 4.1</Ref>).
          It stays within 5% in {pct(ratio('total_rp10').share_within_5pct)} of catchments at 10 years and{' '}
          {pct(ratio('total_rp100').share_within_5pct)} at 100 years: moving days between populations does not distort the fits.</Part>
        <Part label="What follows">The radius barely changes the cyclone and total design depths. It matters for the
          non-cyclone depths of a minority of catchments: step 4 locates them.</Part>
        <Limit>Daily (24 h) design depths only; the 2–4 day depths behind the cyclone storm were not compared.</Limit>
        <DataTable caption={`Design depth with ${R1} km divided by the depth with ${R0} km`}
          head={['Population', 'Return period', 'Median', '5%', '95%', 'Within ±5%']}
          rows={(['total', 'tc', 'nontc'] as const).flatMap((p) => [10, 100].map((T) => {
            const r = ratio(`${p}_rp${T}`)
            return [POP[p], `${T}-year`, r.median.toFixed(2), r.p05.toFixed(2), r.p95.toFixed(2), pct(r.share_within_5pct)]
          }))} />
      </FigureStep>

      <FigureStep n={4} wide title="Where the non-cyclone design depths rise" src="radius_4_nontc_map.png"
        alt={`(a) 100-year non-cyclone depth with ${R1} km divided by ${R0} km per catchment, catchments above 1.10 outlined; (b) days per decade with 50 mm or more and a storm ${R1}–${R0} km away`}>
        <Part label="How it is computed">(a) The 100-year non-cyclone depth ratio of step 3, per catchment; outlined where it
          exceeds 1.10 (a rise of more than 10%). (b) For each GPM cell, the number of days per decade with 50 mm or more
          of rain and a storm {R1}–{R0} km away: heavy rain that changes label with the radius.</Part>
        <Part label="Finding">The non-cyclone 100-year depth rises by more than 10% in <b className="text-ink">{fmt(n)} of {fmt(N)}
          {' '}catchments</b>, mostly on the east coast ({pct(reg4('East coast').share_above_10pct)} of its catchments) and in
          the north-east ({pct(reg4('North-east').share_above_10pct)}), then on the eastern edge of the highlands and in the west
          ({pct(reg4('Highlands').share_above_10pct)} each). These are the areas where heavy rain with a storm {R1}–{R0} km away
          is frequent (b): {fmt(reg4('East coast').heavy_band_days_per_decade, 1)} days per decade on the east coast, against{' '}
          {fmt(reg4('South-west').heavy_band_days_per_decade, 1)} in the south-west, where few catchments rise
          ({pct(reg4('South-west').share_above_10pct)}). The north-west is the exception: such days are as frequent
          ({fmt(reg4('North-west').heavy_band_days_per_decade, 1)} per decade), yet only {pct(reg4('North-west').share_above_10pct)} of
          its catchments rise. This was not investigated further.</Part>
        <Table caption="Catchments whose 100-year non-cyclone depth rises by more than 10%, by region"
          head={['Region', 'Catchments', 'Rise above 10%', `Heavy rain days with a storm ${R1}–${R0} km away, per decade`]}
          rows={f.step4.regions.map((r) => [r.region, fmt(r.catchments), pct(r.share_above_10pct), r.heavy_band_days_per_decade.toFixed(1)])} />
        <Part label="What follows">The rise follows where heavy outer-band rain falls, which points to cyclone rain. Location
          alone does not prove it: step 5 tests it day by day.</Part>
        <Limit>Catchments are assigned to regions by their centre; regions are approximate boxes.</Limit>
      </FigureStep>

      <FigureStep n={5} wide title="The rain that moves is cyclone rain, and none is left beyond 500 km" src="radius_5_outer_band.png"
        alt={`Distance to the nearest storm on the largest non-cyclone days, for the ${n} catchments of step 4 and for the others`}>
        <Part label="How it is computed">A catchment's seasonal maxima are the largest daily non-cyclone rainfall of each
          season (July to June), one per season, 27 in all (step 3). From the {R1} km run, the three largest of them are kept:
          the three heaviest non-cyclone days of the record, which control the 100-year depth. For each of these days, the
          distance is measured from the catchment centre to the nearest position, that day, of any storm of the catalogue (<Ref to="s2-2">section 2.2</Ref>), and counted in
          100 km classes. &ldquo;{R1}–{R0} km away&rdquo; means at least {R1} km and less than {R0} km. The count is made
          separately for the {fmt(n)} catchments of step 4 (orange) and the other {fmt(N - n)} catchments (grey). In the grey
          group the depth barely changes, so its share of days near a storm is the rate expected by coincidence: a heavy
          thunderstorm that happens to fall while a cyclone is somewhere in the region.</Part>
        <Part label="Finding">Almost no day (under 0.2%) has a storm within {R1} km: with the {R1} km radius such days are cyclone days. In
          the orange group, <b className="text-ink">{pct(f.distance_outlined.between)}</b> of the days had a storm {R1}–{R0} km
          away, against <b className="text-ink">{pct(f.distance_others.between)}</b> in the grey group: about three times the
          coincidence rate. Beyond {R0} km the excess disappears: {pct(f.distance_outlined.adopted_to_1000)} of the orange days
          had their nearest storm {R0}–1,000 km away, against {pct(f.distance_others.adopted_to_1000)} of the grey ones. The
          rest had no storm within 1,500 km.</Part>
        <Part label="What follows">The non-cyclone rise of steps 3 and 4 comes from cyclone outer bands between {R1} and{' '}
          {R0} km: a {R1} km radius is too small. Storms farther than {R0} km leave no mark on the largest non-cyclone days, so
          a larger radius would have little more cyclone rain to catch.</Part>
        <Limit>Distances are measured from the catchment centre and from storm positions at any time of the day, while the
          split itself works cell by cell (it gives {pct(rc.outer_band_check.top3_nontc_maxima_on_tc_days_at_adopted_radius.those_catchments)} and{' '}
          {pct(rc.outer_band_check.top3_nontc_maxima_on_tc_days_at_adopted_radius.other_catchments)} for the same comparison).</Limit>
      </FigureStep>

      <div className="mt-6 space-y-3 border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-ink">Conclusion: {R0} km is kept</h3>
        <Steps items={[
          { title: 'Cyclone rain reaches beyond 300 km', body: <>A storm that stays offshore rains heavily {R1}–{R0} km away (step 1).</> },
          { title: 'That rain is about 5% of all rainfall, everywhere', body: <>Storms pass {R1}–{R0} km away 4–5 days a year in every region; the radius decides the label of {fmt(s2.land.moved_mm, 0)} mm a year (step 2).</> },
          { title: 'It changes the split, not the total', body: <>Cyclone and total design depths barely move; non-cyclone depths rise in a minority of catchments (step 3).</> },
          { title: 'The rise is where heavy outer-band rain falls', body: <>{fmt(n)} catchments, mostly on the east coast and in the north-east (step 4).</> },
          { title: 'And it is cyclone rain, with nothing left beyond 500 km', body: <>Their largest &ldquo;thunderstorm&rdquo; days have a storm {R1}–{R0} km away three times more often than chance, and no excess beyond {R0} km (step 5).</> },
        ]} />
        <Info>
          A {R1} km radius would leave cyclone rain in the thunderstorm population, which <Ref to="ch5">Chapter 5</Ref>{' '}
          concentrates into a 12 h storm with an intense core, and would raise thunderstorm design depths in {fmt(n)}{' '}
          catchments for the wrong reason. {R0} km catches that rain, and step 5 finds no cyclone rain left to catch beyond
          it. The cost of a large radius is small: the cyclone and total design depths hardly depend on it.
        </Info>
        <p className="text-xs leading-relaxed text-ink-3">
          <b>Limitations of the test.</b> Only one other radius ({R1} km) was run: the depth comparison bounds the choice from
          below, and the upper bound rests on the distances of step 5 alone. The radius is a circle of the same size for
          every storm, whereas real cyclone rain is uneven around the centre, enhanced by the relief on the windward side, and
          wider for large storms. Labels are daily: a storm position at any hour labels the whole day. GPM cells are about
          10 km, and the record covers 27 seasons.
        </p>
      </div>
    </Section>
  )
}

// ------------------------------------------------------------------ Chapter 3
export function CycloneEvents({ d, palette }: { d: DesignStorms; palette: Palette }) {
  const shares3 = d.tc_day_shares.shares['3d']
  const ev = d.tc_day_shares.event_length_days
  const lengthDays = Object.keys(ev.share_by_days)
  const lengthChart: EChartsOption = {
    grid: { left: 48, right: 12, top: 12, bottom: 44 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => `${fmt(Number(v) * 100, 0)}% of events` },
    xAxis: { type: 'category', data: lengthDays.map((k) => `${k} d`), name: 'Consecutive days with ≥ 10 mm of cyclone rain',
             nameLocation: 'middle', nameGap: 28, ...axisStyle(palette) },
    yAxis: { type: 'value', name: 'Share of events', ...axisStyle(palette),
             axisLabel: { color: palette['text-secondary'], formatter: (v: number) => `${Math.round(v * 100)}%` } },
    series: [{ type: 'bar', barCategoryGap: '30%', data: lengthDays.map((k) => ev.share_by_days[k]),
               itemStyle: { color: palette[POP_SLOT.tc], borderRadius: [4, 4, 0, 0] } }],
  }
  return (
    <Section id="s3-1" title="3.1 Tropical cyclone events" subtitle="How long the largest cyclone rainfall events last in the daily GPM record (1998–2025), and how their rain splits by day.">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Chart option={lengthChart} height={260} label="Share of the largest cyclone events by number of consecutive days with at least 10 mm of cyclone rain" />
          <DataTable caption="Event length distribution" head={['Days', 'Share of events']}
            rows={lengthDays.map((k) => [k, pct(ev.share_by_days[k])])} />
        </div>
        <div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Median event length" value={`${fmt(ev.median, 0)} days`} sub={`75th percentile ${fmt(ev.p75, 0)} d, 90th ${fmt(ev.p90, 0)} d`} />
            <Stat label="Events analysed" value={fmt(shares3.n_events)} sub="5 largest seasonal events per catchment" />
          </div>
          <Info>
            For every catchment, the five largest seasonal cyclone events (the 3-day windows behind the seasonal maxima) are
            pooled over the island. {pct(ev.share_by_days['3'])} last exactly 3 days, {pct(ev.share_by_days['2'])} two
            and {pct(ev.share_by_days['4'])} four. Split by day, the wettest day holds {pct(shares3.median[0])} of the
            3-day total, the second {pct(shares3.median[1])} and the third {pct(shares3.median[2])}. A fourth day adds
            about {pct(d.tc_day_shares.shares['4d'].median[3])} of a 4-day total (median). This confirms H2: the cyclone event
            lasts 3 days, as in the recorded cyclones (50–68 h of continuous rain). The daily shares shape the cyclone
            hyetograph in <Ref to="s5-1">section 5.1</Ref>.
          </Info>
        </div>
      </div>
    </Section>
  )
}

export function NontcEvents({ d }: { d: DesignStorms }) {
  const dc = d.nontc_duration_check
  if (!dc) return null
  const ratio = ratioOf(d)
  return (
    <Section id="s3-2" title="3.2 Non-cyclone events: half-hourly analysis"
      subtitle={`The ${dc.per_season} wettest non-cyclone days of each season (at least ${dc.min_day_mm} mm) on the ${dc.n_catchments} test catchments, ${dc.n_seasons} seasons (1998–2025): ${fmt(dc.n_days)} catchment-days, ${fmt(dc.n_dates)} days of half-hourly GPM IMERG (V07, final run).`}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Figure src={dataUrl('figures/nontc_duration_check.png')}
          alt="Four panels: share of the day's rain in the wettest t hours; time needed to deliver 80% of the day's rain by region; composite hyetograph around the peak; local time of the peak" />
        <div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Wettest 3 h" value={pct(ratio(3).median)} sub="of the day's rain (median)" />
            <Stat label="Wettest 12 h" value={pct(ratio(12).median)} sub="of the day's rain (median)" />
            <Stat label="80% of the day in" value={`${fmt(dc.d80_median_h, 1)} h`} sub={`median; within 3 h on only ${pct(dc.d80_within_h['3'])} of days`} />
            <Stat label="Peak between 15:00 and 23:00" value={pct(dc.peak_local_15_23_share)} sub="local time: afternoon and evening storms" />
          </div>
          <Info>
            Method: catchment-average half-hourly rain for each selected day (the UTC day of the daily record, 03:00–03:00 local
            time, with 6 h either side to catch storms cut at midnight). The half-hourly totals match the daily record
            exactly (median ratio {dc.hhr_over_daily.toFixed(3)}). Cyclone days are excluded with the attribution of{' '}
            <Ref to="ch2">Chapter 2</Ref>.
          </Info>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Table caption="Event structure by region"
          head={['Region', 'Days', 'Wettest 3 h', 'Wettest 6 h', 'Wettest 12 h', '80% of the day in']}
          rows={dc.by_group.map((g) => [g.group, g.n, pct(g.r_3h), pct(g.r_6h), pct(g.r_12h), `${fmt(g.d80_h, 1)} h`])} />
        <Steps items={[
          { title: 'A 3 h storm is only the core', body: <>The wettest 3 h hold {pct(ratio(3).median)} of the day's rain. 80% of the day takes a median of {fmt(dc.d80_median_h, 1)} h (90%: {fmt(dc.d90_median_h, 1)} h); only {pct(dc.d80_within_h['3'])} of days deliver it within 3 h, {pct(dc.d80_within_h['6'])} within 6 h and {pct(dc.d80_within_h['12'])} within 12 h. The wettest 12 h hold the whole day ({pct(ratio(12).median)}); 24 h adds almost nothing ({pct(ratio(24).median)}). The same holds in every region.</> },
          { title: 'A core and a tail', body: <>Around the wettest half-hour (panel c, {fmt(dc.composite.n)} days), rain builds over 3–4 h and decays over 6–9 h: {pct(dc.composite.before_peak)} of the rain falls before the peak half-hour, {pct(dc.composite.peak_half_hour)} in it and {pct(dc.composite.after_peak)} after: the short core and tail of several hours of section 1.1.</> },
          { title: 'Thunderstorms, as assumed', body: <>Peaks fall in the afternoon and evening in every region (panel d), the signature of convection: the non-cyclone population is thunderstorm rain (H1).</> },
          { title: 'Resolution', body: <>GPM cells (about 10 km) and satellite sampling smooth short peaks and spread rain in time, so real events are, if anything, a little shorter than measured here. Short intensities are left to the depth-duration law (<Ref to="s4-3">section 4.3</Ref>).</> },
        ]} />
      </div>
    </Section>
  )
}

export function DesignDurations({ d }: { d: DesignStorms }) {
  const cfg = d.config, dc = d.nontc_duration_check, ev = d.tc_day_shares.event_length_days
  return (
    <Section id="s3-3" title="3.3 Adopted design durations" subtitle="Durations of the design events per storm type, from sections 3.1 and 3.2.">
      <Table caption="Design durations per storm type"
        head={['Storm type', 'Hypothesis (Ch. 1)', 'Design duration', 'Basis']}
        rows={[
          ['Cyclone', '≈ 3 days', `${cfg.tc.duration_h} h`,
            `The median cyclone event in GPM lasts ${fmt(ev.median, 0)} days; recorded cyclone rain lasts 50–68 h without a break. 24, 48 and 96 h storms are kept for comparison in Chapter 6.`],
          ['Non-cyclone (thunderstorm)', '3 h', `${cfg.nontc.duration_h} h`,
            dc ? `The 3 h core holds ${pct(ratioOf(d)(3).median)} of the day; 80% of the day falls in a median ${fmt(dc.d80_median_h, 1)} h and the whole day within 12 h. The design event holds the whole daily depth.` : ''],
          ['Non-cyclone multi-day series', '–', 'not modelled', 'Only described qualitatively, and only for the highlands; the 72 h cyclone storm covers the high-volume case.'],
        ]} />
    </Section>
  )
}

/** Earlier flood-model duration tests, kept as supporting analysis. */
export function DurationTests({ d }: { d: DesignStorms }) {
  const nested = d.nested_test
  const nestedRow = (D: number, T: number) => nested?.rows.find((r) => r.duration_h === D && r.rp === T)
  const pilot = d.nontc_pilot ?? []
  const area = d.catchments.find((x) => x.basin_id === pilot[0]?.basin_id)?.area_km2
  return (
    <>
      <p className="text-sm leading-relaxed text-ink-2">
        Before settling the durations from the rainfall record, two sets of flood runs looked for a <i>critical duration</i>:
        the storm duration that gives the deepest flood. Both show that, at a given return period, flood depth keeps growing
        with the volume of rain, so the flood model cannot bound the duration. This is why sections 3.1–3.3 set the durations
        from how long real storms last.
      </p>
      {nested && (
        <div>
          <h3 className="text-sm font-semibold text-ink">A. Nested storms of 1–48 h ({nested.n_catchments} test catchments, 10- and 100-year, total rainfall, average soil moisture)</h3>
          <div className="mt-2 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Figure src={dataUrl('figures/duration_test_nested.png')} alt="Flood area, volume, buildings flooded and building loss against storm duration, as a ratio to the 24 h storm, one line per catchment" />
            <div>
              <Table caption="Building loss as a ratio to the 24 h storm (median, range over catchments)"
                head={['Duration', '10-year', '100-year']}
                rows={[1, 3, 6, 12, 48].map((D) => [`${D} h`, ...[10, 100].map((T) => {
                  const r = nestedRow(D, T)?.building_loss_usd_vs_24h
                  return r ? `${fmt(r.median, 2)} (${fmt(r.min, 2)}–${fmt(r.max, 2)})` : '–'
                })])} />
              <Info>
                Each storm was built with the alternating-block method from one depth-duration curve, so each storm is the
                central part of the next longer one. Flood area, volume and losses rise with duration in every catchment
                (shorter storms leave at most {fmt(nested.max_share_deeper_than_24h_pct, 1)}% of the flooded area more than 5 cm
                deeper than 24 h; 48 h exceeds 24 h everywhere). The result follows from the construction: it cannot show a
                critical duration, and it stacks thunderstorm peaks inside cyclone volumes.
              </Info>
            </div>
          </div>
        </div>
      )}
      {pilot.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink">B. Non-cyclone storms of 1, 3 and 6 h, two shapes (urban Antananarivo catchment{area ? `, ${fmt(area)} km²` : ''}, 100-year)</h3>
          <div className="mt-2 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Table caption="Pilot runs: share of the flood envelope reproduced by each duration"
              head={['Storm', 'Flooded area', 'Deepest here (share of area)', 'Within 5 cm of the envelope', 'Building loss ÷ envelope']}
              rows={pilot.map((r) => [`${r.duration_h} h, ${r.shape}`, `${fmt(r.flooded_km2, 1)} km²`, `${fmt(r.critical_share_pct, 0)}%`,
                `${r.within_5cm_pct.toFixed(1)}%`, r.loss_vs_envelope.toFixed(2)])} />
            <Info>
              Flood maps are compared cell by cell with the deepest of the three runs (the envelope). The double triangle keeps the
              same 30-min core at every duration; the single triangle spreads the rain, so its peak falls with duration (64, 34
              and 23 mm/h). With either shape the 6 h storm gives the deepest water on 90–97% of the flooded area, both shapes flood
              almost the same volume, and the flood volume peaks when the rain stops. Short storms win only on about 10% of the area
              (steep slopes and channels).
            </Info>
          </div>
        </div>
      )}
    </>
  )
}

// ------------------------------------------------------------------ Chapter 4
export function DepthDurationLaw({ d }: { d: DesignStorms }) {
  const law = d.law
  return (
    <Section id="s4-2" title="4.2 Sub-daily depths: the depth-duration law" subtitle="With a daily record, depths for shorter durations come from a law fitted on sub-daily gauges.">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="text-sm text-ink-2">
            <b className="text-ink">P(T, t) = {fmt(law.coefficient, 3)} · t<sup>{fmt(law.exponent, 1)}</sup> · PJ(T)</b>, with t the duration in
            hours, PJ(T) the daily depth of return period T (<Ref to="s4-1">section 4.1</Ref>) and P(T, t) the depth of the same return
            period over t hours. The law comes from a local urban drainage study in Antananarivo.
          </p>
          <Table caption="Depth over t hours as a share of the daily depth"
            head={['Duration', ...law.ratios.map((r) => r.t_h < 1 ? `${Math.round(r.t_h * 60)} min` : `${r.t_h} h`)]}
            rows={[['P(t) / PJ', ...law.ratios.map((r) => fmt(r.p_over_pj, 2))]]} />
        </div>
        <div>
          <Info>
            At 24 h the law gives <b>1.19 PJ</b>. Daily totals are counted over fixed calendar days and miss part of storms that
            straddle two days; the usual correction (about 1.13) is therefore already included, and no separate factor is
            applied. Beyond 24 h, depths are fitted on 2–4 day running sums.
          </Info>
          <Info>
            As a check against the gauge statistics quoted by ORSTOM (BCEOM 1967, Antananarivo, 10-year): 67 mm in 1 h and 93 mm
            in 3 h, an exponent of about 0.30 between 1 and 3 hours, against 0.4 here. Both are fitted on highland gauges;{' '}
            <Ref to="s4-3">section 4.3</Ref> checks the law over the whole island.
          </Info>
        </div>
      </div>
    </Section>
  )
}

export function LawValidation({ d }: { d: DesignStorms }) {
  const dc = d.nontc_duration_check
  if (!dc) return null
  const ratio = ratioOf(d)
  return (
    <Section id="s4-3" title="4.3 Validation of the depth-duration law" subtitle={`The wettest t hours of the ${fmt(dc.n_days)} heavy non-cyclone catchment-days of section 3.2, as a share of the daily depth, against the law.`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Table caption="Wettest t hours as a share of the daily depth: observed and law"
          head={['Duration', 'Observed median (25–75%)', 'Largest third of days', 'Law 1/3·t^0.4']}
          rows={dc.ratios.filter((r) => [0.5, 1, 2, 3, 4, 6, 9, 12, 24].includes(r.t_h)).map((r) => [
            r.t_h < 1 ? `${r.t_h * 60} min` : `${r.t_h} h`, `${r.median.toFixed(2)} (${r.p25.toFixed(2)}–${r.p75.toFixed(2)})`,
            r.median_top_third.toFixed(2), r.law.toFixed(2)])} />
        <Steps items={[
          { title: 'The law holds at 3 h', body: <>The wettest 3 h hold {pct(ratio(3).median)} of the day's rain, against {pct(ratio(3).law)} from the law, in every region ({dc.by_group.map((g) => pct(g.r_3h)).join(', ')}) and on the largest days ({pct(ratio(3).median_top_third)}). The law, fitted in Antananarivo, applies to the coasts and the west too.</> },
          { title: 'Below 2 h, GPM cannot check it', body: <>GPM falls under the law (30 min: {pct(ratio(0.5).median)} against {pct(ratio(0.5).law)}): its 10 km cells and satellite sampling smooth short peaks. The law and the gauge statistics of the report remain the reference for short intensities.</> },
          { title: 'Above 3 h, real storms are more concentrated', body: <>Observed depths exceed the law from 4 to 12 h (6 h: {ratio(6).median.toFixed(2)} against {ratio(6).law.toFixed(2)}) and reach the whole day by 12 h; at 24 h the observed {ratio(24).median.toFixed(2)} stays below the law's 1.19. The non-cyclone design storm therefore follows the law up to 3 h and the observations beyond (<Ref to="s5-1">section 5.1</Ref>).</> },
        ]} />
      </div>
    </Section>
  )
}

// ------------------------------------------------------------------ Chapter 5
export function StormMethod({ d, palette }: { d: DesignStorms; palette: Palette }) {
  const cfg = d.config, shares3 = d.tc_day_shares.shares['3d'], dc = d.nontc_duration_check
  const ratio = dc ? ratioOf(d) : undefined
  const D = cfg.nontc.duration_h, law12 = d.law.coefficient * D ** d.law.exponent
  const pos = shares3.wettest_day_position
  const comp = dc?.composite
  const hours = comp ? comp.mean_share.map((_, i) => (i - 24) / 2) : []
  const designSpan = comp ? hours.filter((_, i) => comp.design_share[i] > 0) : []
  const compositeChart: EChartsOption | undefined = comp && {
    grid: { left: 64, right: 16, top: 36, bottom: 44 },
    legend: { top: 0, textStyle: { color: palette['text-secondary'] } },
    tooltip: { trigger: 'axis', valueFormatter: (v) => `${fmt(Number(v) * 100, 1)}% of the day` },
    xAxis: { type: 'value', min: -12, max: 12, interval: 3, name: 'Hours from the wettest half-hour', nameLocation: 'middle', nameGap: 28, ...axisStyle(palette) },
    yAxis: { type: 'value', name: 'Share of the day per half-hour', nameLocation: 'middle', nameGap: 44, ...axisStyle(palette),
             axisLabel: { color: palette['text-secondary'], formatter: (v: number) => `${Math.round(v * 100)}%` } },
    series: [
      { name: `Observed, mean of ${fmt(comp.n)} days (GPM)`, type: 'line', step: 'middle', symbol: 'none', lineStyle: { width: 2 },
        itemStyle: { color: palette.neutral }, data: comp.mean_share.map((v, i) => [hours[i], v]) },
      { name: `${D} h design storm`, type: 'line', step: 'middle', symbol: 'none', lineStyle: { width: 2 },
        itemStyle: { color: palette[POP_SLOT.nontc] }, data: comp.design_share.map((v, i) => [hours[i], v]) },
    ],
  }
  return (
    <Section id="s5-1" title="5.1 Construction and justification of the design hyetographs" subtitle="One shape per storm type: the depth from Chapter 4, spread over the duration and event structure of Chapter 3. Each shape is chosen to reproduce what the record shows, and checked against it.">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Non-cyclone: {D} h double triangle, {cfg.nontc.step_min}-min blocks</h3>
          <Steps items={[
            { title: 'Shape', body: <>The double-triangle design storm of Desbordes (1978), standard in French urban drainage practice with Montana-type depth-duration laws like the one used here. An outer triangle over the whole storm carries the tail; an inner triangle over the intense period tops it up, so both depths below are met exactly.</> },
            { title: 'Depths', body: <>The {D} h storm holds the daily depth PJ (the wettest 12 h of heavy non-cyclone days hold the whole day, <Ref to="s3-2">section 3.2</Ref>). The {fmt(cfg.nontc.intense_h * 60)}-min intense period holds P({fmt(cfg.nontc.intense_h, 1)} h) from the law.</> },
            { title: 'Timing', body: <>The intense period is centred at {fmt(cfg.nontc.centre_frac * 100)}% of the storm, snapped to the blocks, so that {dc ? pct(dc.design_before_peak_offpeak) : ''} of the rain outside it falls before the peak (observed {dc ? pct(dc.composite.before_peak / (dc.composite.before_peak + dc.composite.after_peak)) : ''}).</> },
            { title: 'Soil moisture', body: <>Average antecedent conditions (GCN250 {cfg.nontc.gcn250_arc}), from the soil moisture hypothesis of the <a href="#inputs" className="font-medium text-accent underline underline-offset-2">Static inputs</a> tab.</> },
          ]} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Cyclone: {cfg.tc.duration_h} h, {cfg.tc.step_min}-min blocks</h3>
          <Steps items={[
            { title: 'Daily split', body: <>The fitted 3-day cyclone depth (<Ref to="s4-1">section 4.1</Ref>) is split by day with the median shares of the largest observed events ({pct(shares3.median[0])} / {pct(shares3.median[1])} / {pct(shares3.median[2])}, <Ref to="s3-1">section 3.1</Ref>). The wettest day sits in the middle, the second wettest before it.</> },
            { title: 'Within the days', body: <>The wettest day is shaped with alternating blocks of the law (rainbands embed bursts in the main rain); the other days rain at a constant rate.</> },
            { title: 'Soil moisture', body: <>Wet antecedent conditions (GCN250 {cfg.tc.gcn250_arc}), from the soil moisture hypothesis of the <a href="#inputs" className="font-medium text-accent underline underline-offset-2">Static inputs</a> tab: long cyclone rain brings soils near saturation.</> },
          ]} />
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold text-ink">Why a double triangle for thunderstorms</h3>
      <p className="mt-1 text-sm text-ink-2">
        The storm must reproduce three things at once: the short intense core of the thunderstorms recorded by ORSTOM
        (<Ref to="s1-1">section 1.1</Ref>), the depth-duration law up to 3 h where it holds (<Ref to="s4-3">section 4.3</Ref>), and
        the observed depths from 3 to 12 h with the whole day within 12 h (<Ref to="s3-2">section 3.2</Ref>). The usual shapes
        each fail one of them:
      </p>
      <Table caption="Candidate shapes for the non-cyclone design storm"
        head={['Candidate shape', 'Result with the depths of Chapter 4']}
        rows={[
          ['Uniform rain over 12 h', <>No core: the wettest 30 min would hold {pct(cfg.nontc.intense_h / D)} of PJ, against {ratio ? pct(ratio(0.5).law) : ''} from the law.</>],
          ['Single triangle', <>One slope sets both core and tail: holding PJ over 12 h, the wettest 30 min hold about {pct(1 / D)} of PJ. Its peak falls as the duration grows (64, 34 and 23 mm/h for 1, 3 and 6 h in the pilot runs, <Ref to="s3-4">section 3.4</Ref>).</>],
          ['Alternating blocks (Chicago storm)', <>Imposes the law at every duration in one event. Above 3 h real storms are more concentrated than the law (<Ref to="s4-3">section 4.3</Ref>), and the 12 h total would be P(12 h) = {law12.toFixed(2)} PJ instead of the whole day.</>],
          [<b>Double triangle (adopted)</b>, <>Two triangles, two depths: the core holds P(30 min), the storm holds PJ, and the tail between them is linear. It follows the law up to 3 h and the observations from 3 to 12 h (table below).</>],
        ]} />
      {comp && compositeChart && ratio && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div>
            <Chart option={compositeChart} height={280} label="Share of the day's rain per half-hour around the wettest half-hour: observed composite of heavy non-cyclone days against the design storm" />
            <DataTable caption="Share of the day per half-hour around the peak" head={['Hours from peak', 'Observed', 'Design']}
              rows={hours.map((h, i) => [fmt(h, 1), `${fmt(comp.mean_share[i] * 100, 1)}%`, `${fmt(comp.design_share[i] * 100, 1)}%`])} />
          </div>
          <div>
            <Table caption="Wettest t hours of the non-cyclone design storm against the law and the observations, as a share of PJ"
              head={['Duration', '12 h design storm', 'Law (section 4.2)', 'Observed median (section 4.3)']}
              rows={[0.5, 1, 3, 6, 9, 12].map((t) => [t < 1 ? `${t * 60} min` : `${t} h`, ratio(t).design.toFixed(2), ratio(t).law.toFixed(2), ratio(t).median.toFixed(2)])} />
            <Info>
              The chart lays the design storm over the mean half-hourly hyetograph of the {fmt(comp.n)} heavy non-cyclone days of
              section 3.2, both aligned on their wettest half-hour. The design storm rains from {fmt(-designSpan[0], 1)} h before the
              peak to {fmt(designSpan[designSpan.length - 1], 1)} h after it, like the observed build-up and decay; the same share of
              the rain falls before the peak. Its peak half-hour ({pct(comp.design_share[24])} of the day) is higher than the GPM
              mean ({pct(comp.mean_share[24])}) by design: GPM smooths short peaks (<Ref to="s4-3">section 4.3</Ref>), and the core
              follows the law.
            </Info>
          </div>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold text-ink">Why this shape for cyclones</h3>
      <Table caption="Evidence behind each part of the cyclone design storm"
        head={['Part of the storm', 'Evidence', 'Choice']}
        rows={[
          ['Three days', <>Median cyclone event of {fmt(d.tc_day_shares.event_length_days.median, 0)} days in GPM; 50–68 h of continuous rain in the recorded cyclones (<Ref to="s3-1">section 3.1</Ref>).</>, `${cfg.tc.duration_h} h`],
          ['Daily split', <>Median daily shares of the {fmt(shares3.n_events)} largest observed events (<Ref to="s3-1">section 3.1</Ref>).</>, `${pct(shares3.median[0])} / ${pct(shares3.median[1])} / ${pct(shares3.median[2])}`],
          ['Wettest day in the middle', <>In the observed 3-day events the wettest day is the middle one in {pct(pos[1])} of cases, the first in {pct(pos[0])} and the last in {pct(pos[2])} (a third each if it were random): rain builds as the storm approaches and eases as it leaves.</>, 'Middle day'],
          ['Second wettest day before it', <>Before the wettest day in {pct(shares3.second_before_wettest)} of events: close to even, so this choice weighs little.</>, 'First day'],
          ['Bursts within the wettest day', <>Cyclone rain is steady with embedded rainbands (<Ref to="s1-1">section 1.1</Ref>). The daily record cannot resolve the hours, so the wettest day takes the sub-daily depths of the law, arranged with alternating blocks. This is on the safe side: <Ref to="s5-3">section 5.3</Ref> shows peaks that can exceed the highest cyclone intensity recorded by ORSTOM.</>, 'Alternating blocks'],
          ['Steady flanking days', <>Regular, long-lasting rain with moderate intensities (ORSTOM: 68 h almost without a break over the upper Ikopa in 1959).</>, 'Constant rate'],
        ]} />
      <p className="mt-1 text-xs text-ink-3">
        A double triangle is not used for cyclones: their rain has no single short core, and the flood is driven by the multi-day
        volume (<Ref to="s3-4">section 3.4</Ref>). The half-hourly analysis of section 3.2 covers non-cyclone days only.
      </p>
    </Section>
  )
}

export function StormShapes({ d, palette }: { d: DesignStorms; palette: Palette }) {
  const [basin, setBasin] = useState(d.catchments.find((c) => c.slot.startsWith('urban'))?.basin_id ?? d.catchments[0].basin_id)
  const [rp, setRp] = useState('100')
  const cfg = d.config, cap = cfg.report_peak_mm_hr
  const c = d.catchments.find((x) => x.basin_id === basin)!
  const storm = (pop: 'nontc' | 'tc') => c.storms.find((s) => s.population === pop && s.duration_h === cfg[pop].duration_h && s.rp === Number(rp))!
  const stormChart = (pop: 'nontc' | 'tc'): EChartsOption => {
    const s = storm(pop), D = cfg[pop].duration_h
    return {
      grid: { left: 56, right: 16, top: 16, bottom: 44 },
      tooltip: { trigger: 'axis', valueFormatter: (v) => `${fmt(Number(v), 1)} mm/h` },
      xAxis: { type: 'value', min: 0, max: D, interval: D > 24 ? 12 : D > 6 ? 2 : 0.5, name: 'Time (h)', nameLocation: 'middle',
               nameGap: 28, ...axisStyle(palette) },
      yAxis: { type: 'value', name: 'Intensity (mm/h)', ...axisStyle(palette) },
      series: [
        { name: POP_LABEL[pop], type: 'line', symbol: 'none', lineStyle: { width: 2 }, itemStyle: { color: palette[POP_SLOT[pop]] },
          areaStyle: { opacity: 0.1 },
          data: s.intensity_mm_hr.flatMap((v, i) => [[i * s.step_h, v], [(i + 1) * s.step_h, v]]),
          ...(pop === 'tc' ? { markLine: { symbol: 'none', silent: true, lineStyle: { color: palette['text-muted'], type: 'dashed' },
            label: { color: palette['text-muted'], formatter: `${cap} mm/h, highest cyclone intensity recorded by ORSTOM`, position: 'insideEndTop' },
            data: [{ yAxis: cap }] } } : {}) },
      ],
    }
  }
  return (
    <Section id="s5-2" title="5.2 Design hyetographs of the test catchments"
      subtitle="The two design storms for the test catchments. Pick a catchment and a return period; every catchment is in Chapter 6."
      actions={<Segmented label="Return period" value={rp} onChange={setRp} options={[{ value: '10', label: '10-year' }, { value: '100', label: '100-year' }]} />}>
      <div className="mb-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Test catchment">
        {d.catchments.map((x) => (
          <button key={x.basin_id} role="radio" aria-checked={x.basin_id === basin} onClick={() => setBasin(x.basin_id)}
            className={`rounded-md border px-2 py-1 text-xs ${x.basin_id === basin ? 'border-accent bg-accent text-white' : 'border-line text-ink-2 hover:text-ink'}`}>
            {x.slot}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {(['nontc', 'tc'] as const).map((pop) => {
          const s = storm(pop)
          return (
            <div key={pop}>
              <h3 className="text-sm font-semibold text-ink">
                {pop === 'nontc' ? `Non-cyclone thunderstorm, ${cfg.nontc.duration_h} h` : `Cyclone storm, ${cfg.tc.duration_h} h`}:{' '}
                {fmt(s.depth_mm)} mm, peak {fmt(s.peak_mm_hr)} mm/h
              </h3>
              <Chart option={stormChart(pop)} height={260} label={`${rp}-year ${POP_LABEL[pop]} design storm for catchment ${basin}`} />
            </div>
          )
        })}
      </div>
      <p className="mt-1 text-xs text-ink-3">Catchment {c.basin_id} ({fmt(c.area_km2)} km²). Daily depth PJ, {rp}-year: non-cyclone {fmt(c.daily_depth_mm.nontc[rp])} mm, cyclone {fmt(c.daily_depth_mm.tc[rp])} mm.</p>
    </Section>
  )
}

export function IntensityChecks({ d }: { d: DesignStorms }) {
  const cfg = d.config, cap = cfg.report_peak_mm_hr
  const find = (x: DesignStorms['catchments'][number], pop: 'nontc' | 'tc', T: number) =>
    x.storms.find((s) => s.population === pop && s.duration_h === cfg[pop].duration_h && s.rp === T)!
  return (
    <Section id="s5-3" title="5.3 Validation of design intensities" subtitle={`Design peak intensities of the ${d.catchments.length} test catchments against the intensities recorded in Madagascar (section 1.1).`}>
      <Table caption="Peak intensities of the design storms per test catchment"
        head={['Catchment', `Non-cyclone ${cfg.nontc.duration_h} h, 10-min peak (10 / 100-yr, mm/h)`, `Cyclone ${cfg.tc.duration_h} h, 30-min peak (10 / 100-yr, mm/h)`, 'Cyclone wettest day ÷ 24 h design depth (100-yr)']}
        rows={d.catchments.map((x) => {
          const flag = (v: number) => `${fmt(v)}${v > cap ? ' ▲' : ''}`
          return [x.slot, `${fmt(find(x, 'nontc', 10).peak_mm_hr)} / ${fmt(find(x, 'nontc', 100).peak_mm_hr)}`,
            `${flag(find(x, 'tc', 10).peak_mm_hr)} / ${flag(find(x, 'tc', 100).peak_mm_hr)}`, fmt(find(x, 'tc', 100).wettest_day_over_24h ?? 0, 2)]
        })} />
      <p className="mt-1 text-xs text-ink-3">▲ above {cap} mm/h, the highest cyclone intensity recorded by ORSTOM.</p>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <Info>
          <b>Thunderstorms.</b> The 10-min peaks are of the order of the recorded thunderstorm cores (80–100 mm/h, 5-min bursts of
          200 mm/h and more) and below the 100-year intensities at a single gauge in Antananarivo (Tsimbazaza: 260 mm/h over 15
          min, 124 mm/h over 1 h). Lower values are expected: the design depths are catchment averages, not point rainfall.
        </Info>
        <Info>
          <b>Cyclones.</b> The wettest day always stays below the 24 h design depth of the same return period (ratio below 1),
          so the 72 h storm never contains a day rarer than the storm itself. Its 30-min peak follows the Antananarivo law,
          fitted on storms that are mostly thunderstorms, and exceeds the {cap} mm/h recorded in cyclones at 100 years in some
          catchments. This is kept on purpose: it errs on the safe side, the recorded ceiling rests on two events, and cyclone
          floods depend mostly on volume (section 3.4).
        </Info>
      </div>
    </Section>
  )
}
