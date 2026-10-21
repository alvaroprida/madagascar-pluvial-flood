// Indicative compute model for the scenario matrix. Everything scales from the two benchmark
// runs: cost = cells x time steps, with cells ~ 1/res^2 and the stable time step ~ res (CFL).

export interface Benchmark {
  date: string
  machine: string
  sfincs: string
  grid_m: number
  design_storm: string
  runs: { basin_km2: number; active_cells: number; simulated_h: number; avg_dt_s: number; wall_s: number; cell_steps_per_s: number }[]
  domain: { n_basins: number; area_km2: number }
}

export interface Prices {
  on_demand_published: string
  spot_retrieved: string
  sources: { on_demand: string; spot: string }
  unit: string
  regions: Record<string, { name: string; families: Record<string, { on_demand: number; spot: number | null }> }>
}

export const DURATIONS = [1, 3, 6, 12, 24, 48] as const
export const POPULATIONS = [
  { key: 'total', label: 'Total' },
  { key: 'tc', label: 'Tropical cyclone' },
  { key: 'nontc', label: 'Non-TC' },
] as const
export const CLIMATES = ['Baseline', 'SSP2 2050', 'SSP5 2050', 'SSP2 2085', 'SSP5 2085'] as const
export const RESOLUTIONS = [30, 50, 100, 200] as const

export interface Scenario {
  rps: number
  populations: string[]
  durations: number[]
  climates: string[]
  res_m: number
  share: number          // share of the island's catchments modelled, 0-1 (by area)
  drain_h: number
}

export interface Assumptions {
  dt50_s: number         // average time step at 50 m
  native_per_vcpu: number // cell-steps per second per vCPU, native x86 (to be benchmarked)
  emulated_per_core: number // measured, per local core under emulation
  local_cores: number
  local_native: boolean
  vcpus: number          // concurrent vCPUs on AWS
  spot: number           // USD per vCPU-hour
  on_demand: number
}

export interface Estimate {
  runs: number
  cellSteps: number
  vcpuHours: number
  awsDays: number
  spotUsd: number
  onDemandUsd: number
  localDays: number
  storageGb: number
  byDuration: { duration: number; vcpuHours: number }[]
}

export function estimate(s: Scenario, a: Assumptions, domain: Benchmark['domain']): Estimate {
  const cells = (domain.area_km2 * s.share) / (s.res_m / 1000) ** 2
  const dt = a.dt50_s * (s.res_m / 50)
  const combos = s.rps * s.populations.length * s.climates.length
  const byDuration = s.durations.map((d) => {
    const cs = cells * (((d + s.drain_h) * 3600) / dt) * combos
    return { duration: d, cellSteps: cs, vcpuHours: cs / a.native_per_vcpu / 3600 }
  })
  const cellSteps = byDuration.reduce((t, x) => t + x.cellSteps, 0)
  const vcpuHours = cellSteps / a.native_per_vcpu / 3600
  const runs = Math.round(domain.n_basins * s.share) * combos * s.durations.length
  const localRate = a.local_cores * (a.local_native ? a.native_per_vcpu : a.emulated_per_core)
  // max-depth maps at the subgrid resolution (half the grid cell), int16, ~10x compression
  const px = (domain.area_km2 * s.share) / (s.res_m / 2 / 1000) ** 2
  const storageGb = (px * 2 * combos * s.durations.length) / 10 / 1e9
  return {
    runs, cellSteps, vcpuHours,
    awsDays: vcpuHours / a.vcpus / 24,
    spotUsd: vcpuHours * a.spot,
    onDemandUsd: vcpuHours * a.on_demand,
    localDays: cellSteps / localRate / 86400,
    storageGb,
    byDuration: byDuration.map(({ duration, vcpuHours }) => ({ duration, vcpuHours })),
  }
}

const ALL_POPS = POPULATIONS.map((p) => p.key as string)
export const PRESETS: { key: string; label: string; scenario: Omit<Scenario, 'share' | 'drain_h'> }[] = [
  { key: 'A', label: 'A · Full matrix, 50 m', scenario: { rps: 8, populations: ALL_POPS, durations: [...DURATIONS], climates: [...CLIMATES], res_m: 50 } },
  { key: 'B', label: 'B · Full matrix, 100 m', scenario: { rps: 8, populations: ALL_POPS, durations: [...DURATIONS], climates: [...CLIMATES], res_m: 100 } },
  { key: 'C', label: 'C · Total + TC, 24 h + 48 h, 50 m', scenario: { rps: 8, populations: ['total', 'tc'], durations: [24, 48], climates: [...CLIMATES], res_m: 50 } },
  { key: 'D', label: 'D · Total + TC, 24 h + 48 h, 100 m', scenario: { rps: 8, populations: ['total', 'tc'], durations: [24, 48], climates: [...CLIMATES], res_m: 100 } },
  { key: 'E', label: 'E · Total, 24 h, 100 m', scenario: { rps: 8, populations: ['total'], durations: [24], climates: [...CLIMATES], res_m: 100 } },
]
