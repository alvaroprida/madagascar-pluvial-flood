// Data contract with scripts/export_site.py in the (private) modelling repository.

export type PopKey = 'total' | 'tc' | 'nontc'

export interface SplitNode {
  level: number
  pfaf_id: number
  hybas_id: number
  sub_area: number
  children: SplitNode[]
}

export interface DomainOption {
  option: string
  kind: 'level' | 'split'
  threshold_km2?: number
  n_basins: number
  median_km2: number
  max_km2: number
  above_1000_km2: number
}

export interface Domain {
  n_basins: number
  max_km2: number
  min_landmass_km2: number
  total_km2: number
  area_stats_km2: { min: number; p25: number; median: number; p75: number; max: number }
  n_below_50_km2: number
  histogram: { lo: number; hi: number; n: number }[]
  by_level: Record<string, { n: number; median_km2: number; km2: number }>
  options: DomainOption[]
  example: SplitNode[]
  islets: { landmasses: number; landmasses_kept: number; islet_parts_dropped: number; islet_km2_dropped: number; basins_dropped: number }
  above_max: { basin_id: string; area_km2: number; endo: number }[]
  endorheic_sinks: number
  with_upstream_inflow: number
  pilots: { basin_id: string; area_km2: number; level: number; upstream_inflow_km2: number }[]
}

export interface Storm {
  name: string
  date: string
  year: number
  vmax_kn: number
  vmax_kmh: number
  category: string
  cat: number
  coast_km: number
  in_damage_list: boolean
}

export interface Cyclones {
  storms: Storm[]
  max_coast_km: number
  farthest_pass_km: number
  damage_check: { n_list: number; n_matched: number; n_in_rule: number; unmatched: { name: string; note: string }[] }
  n_below_ts: number
  categories: string[]
}

export interface Rainfall {
  record: { start: string; end: string; years: number; grid_deg: number; land_cells: number }
  radius_km: number
  flagged_cell_days_pct: number
  land_mean_mm_per_year: Record<PopKey, number>
  tc_share_pct: { land_mean: number; max_cell: number }
  monthly_mm: { month: number; total: number; tc: number; nontc: number; flagged_pct: number }[]
  growth_curves_mm: Record<PopKey, { rp: number; median: number; p10: number; p90: number }[]>
  total_vs_direct_fit: { rp: number; median: number; p10: number; p90: number }[]
  design_population: PopKey
  season_start_month: number
  pilots: {
    basin_id: string
    gpm_cells: number
    depth_24h: Record<PopKey, { rp: number; mm: number }[]>
  }[]
  dd_law: { coefficient: number; exponent: number }
}

export interface DesignStorm {
  population: 'nontc' | 'tc'
  duration_h: number
  rp: number
  step_h: number
  depth_mm: number
  peak_mm_hr: number
  intensity_mm_hr: number[]
  wettest_day_over_24h?: number
}

type Spread = { min: number; median: number; max: number }

export interface DesignStorms {
  law: { coefficient: number; exponent: number; ratios: { t_h: number; p_over_pj: number }[] }
  config: {
    nontc: { duration_h: number; intense_h: number; centre_frac: number; step_min: number; gcn250_arc: string }
    tc: { duration_h: number; step_min: number; gcn250_arc: string }
    report_peak_mm_hr: number
  }
  tc_day_shares: {
    method: string
    shares: Record<'2d' | '3d' | '4d', { median: number[]; p25: number[]; p75: number[]; n_events: number }>
    event_length_days: { median: number; p75: number; p90: number; share_by_days: Record<string, number> }
  }
  radius_check: {
    radius_adopted_km: number
    radius_tested_km: number
    tc_share_of_rainfall_island_mean: Record<string, number>
    depth_ratio_tested_over_adopted: Record<string, { p05: number; median: number; p95: number; share_within_5pct: number }>
    outer_band_check: {
      catchments_nontc_rp100_up_more_than_10pct: number
      n_catchments: number
      top3_nontc_maxima_on_tc_days_at_adopted_radius: { those_catchments: number; other_catchments: number }
    }
  } | null
  validation_durations: Record<'nontc' | 'tc', number[]>
  catchments: { basin_id: string; slot: string; area_km2: number; daily_depth_mm: Record<'nontc' | 'tc', Record<string, number>>; storms: DesignStorm[] }[]
  nested_test: {
    rows: ({ duration_h: number; rp: number } & Record<'flooded_km2_vs_24h' | 'volume_m3_vs_24h' | 'building_loss_usd_vs_24h', Spread>)[]
    n_catchments: number
    max_share_deeper_than_24h_pct: number
  } | null
}

export interface LandcoverClass {
  code: number
  name: string
  color: string
}

// Data contract with scripts/export_exposure.py.
export type Scenario = 'hist_baseline' | 'ssp2_2050' | 'ssp5_2050' | 'ssp2_2085' | 'ssp5_2085'
type ByScenario<T> = Record<Scenario, T>

export interface Exposure {
  grid_deg: number
  scenarios: Scenario[]
  population: { total: ByScenario<number>; in_domain: ByScenario<number>; n_cells_100m: number }
  econ: {
    by_type: Record<'rural' | 'urban', { n_buildings: number; footprint_km2: number; usd: ByScenario<number> }>
    in_domain: ByScenario<number>
  }
  agriculture: { cropland_km2: number; grassland_km2: number; land_km2: number }
  share_in_domain: { population: number; econ: number }
  catchments: Units
  admin: {
    population: ByScenario<number>   // outside every fokontany polygon
    usd: ByScenario<number>
    n_buildings: number
    n_units: Record<AdminUnit, number>
    agri_usd_per_ha: { cropland: number; grassland: number }
  }
}

export type AdminUnit = 'region' | 'district' | 'commune' | 'fokontany'

/** Exposure summed per polygon: catchments, or one administrative level (admin/adm<N>.json). */
export interface Units {
  ids: string[]
  names?: string[]
  parents?: string[]
  level?: number
  unit?: AdminUnit
  area_km2: number[]
  pop: ByScenario<number[]>
  usd: ByScenario<number[]>
  urban_usd_share: number[]
  n_buildings: number[]
  cropland_km2: number[]
  grassland_km2: number[]
}

export interface VulnCurve {
  curve: number
  ymax: number
  points: [number, number][]
}

export interface ClimateIndexFactor {
  median: number; p10: number; p90: number; share_increase: number
  vs_1995_2014: { median: number; p10: number; p90: number }
  baseline_shift_median: number
  per_model: Record<string, number>
}
export type FutureScenario = Exclude<Scenario, 'hist_baseline'>
export interface ClimateFactors {
  method: string
  models: string[]; n_models: number
  baseline_period: [number, number]; ar6_reference_period: [number, number]
  windows: Record<'2050' | '2085', [number, number]>
  duration_index: Record<string, 'rx1day' | 'rx5day'>
  spatial_signal_l5: { index: string; scenario: string; period: string; unit_median_range: number
    typical_model_spread_p10_p90: number; agreement: number; agreement_chance_mean: number; agreement_chance_p95: number }[]
  scenarios: Record<FutureScenario, { rx1day: ClimateIndexFactor; rx5day: ClimateIndexFactor
    cc_reference: { additional_warming_c: number; factor: number } }>
}

export type FeatureCollection = import('geojson').FeatureCollection

export interface SiteData {
  benchmark: import('./compute').Benchmark
  prices: import('./compute').Prices
  domain: Domain
  cyclones: Cyclones
  rainfall: Rainfall
  landcover: LandcoverClass[]
  catchments: FeatureCollection
  tracks: FeatureCollection
  exposure: Exposure
  vulnerability: VulnCurve[]
}
