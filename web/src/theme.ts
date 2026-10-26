import { useEffect, useState } from 'react'
import type { PopKey, Scenario } from './types'

const ROLES = [
  'surface', 'text-primary', 'text-secondary', 'text-muted', 'grid', 'axis', 'accent', 'neutral',
  'cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5',
] as const

export type Palette = Record<(typeof ROLES)[number], string>

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement)
  return Object.fromEntries(ROLES.map((r) => [r, css.getPropertyValue(`--${r}`).trim()])) as Palette
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

/** Resolved colour roles, re-read when the OS switches light/dark. */
export function usePalette(): { palette: Palette; dark: boolean } {
  const [state, setState] = useState(() => ({ palette: readPalette(), dark: darkQuery().matches }))
  useEffect(() => {
    const mq = darkQuery()
    const update = () => setState({ palette: readPalette(), dark: mq.matches })
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return state
}

// Fixed slot per rainfall population, so a colour means the same thing in every chart.
export const POP_SLOT: Record<PopKey, `cat-${1 | 2 | 3}`> = {
  total: 'cat-1',
  tc: 'cat-2',
  nontc: 'cat-3',
}

export const POP_LABEL: Record<PopKey, string> = {
  total: 'Total',
  tc: 'Tropical cyclone',
  nontc: 'Non-TC',
}

/** Ordinal ramp for the Saffir-Simpson categories, TD (light) to Cat 5 (dark), one hue. */
export const CATEGORY_RAMP = ['#d9d1ef', '#b9a9e2', '#9a82d4', '#7a5cc4', '#5f43a3', '#452e7c', '#2d1c55']

// Fixed slot per climate scenario (baseline neutral), shared by the rainfall and exposure tabs.
export const SCENARIO_SLOT: Record<Scenario, 'neutral' | `cat-${1 | 2 | 3 | 4}`> = {
  hist_baseline: 'neutral',
  ssp2_2050: 'cat-1',
  ssp5_2050: 'cat-2',
  ssp2_2085: 'cat-3',
  ssp5_2085: 'cat-4',
}
