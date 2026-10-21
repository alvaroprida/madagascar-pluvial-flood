// Data contract with scripts/export_site.py in the (private) modelling repository.

export type PopKey = 'total' | 'tc' | 'nontc'

export interface Domain {
  n_features: number
  n_parts: number
  n_basins: number
  threshold_km2: number
  dropped_parts: number
  dropped_km2: number
  total_km2: number
  area_stats_km2: { min: number; p25: number; median: number; p75: number; max: number }
  histogram: { lo: number; hi: number; n: number }[]
  pilots: { basin_id: string; area_km2: number }[]
}

export interface Storm {
  name: string
  date: string
  year: number
  vmax_kn: number
  vmax_kmh: number
  category: string
  cat: number
}

export interface Cyclones {
  storms: Storm[]
  unmatched: { name: string; note: string }[]
  n_catalogue: number
  n_matched: number
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
    hyetograph_rp100: { step_h: number; intensity_mm_hr: number[] }
  }[]
  dd_exponent: number
}

export interface LandcoverClass {
  code: number
  name: string
  color: string
}

export type FeatureCollection = import('geojson').FeatureCollection

export interface SiteData {
  domain: Domain
  cyclones: Cyclones
  rainfall: Rainfall
  landcover: LandcoverClass[]
  catchments: FeatureCollection
  tracks: FeatureCollection
}
