/** Design storm shapes, ported from the modelling code (mdg_pluvial.design_storms): same inputs, same blocks.
 *  Depth-duration law P(t) = a · t^n · PJ (t in hours, PJ = daily depth of the return period). */

export interface Law { coefficient: number; exponent: number }

export const lawDepth = (t: number, pj: number, law: Law) => law.coefficient * t ** law.exponent * pj

/** Alternating blocks: the first increment in the middle, the next ones alternately right and left. */
function alternatingBlocks(inc: number[]): number[] {
  const n = inc.length, out = new Array(n).fill(0)
  let right = Math.floor(n / 2), left = right - 1
  inc.forEach((v, i) => { if (i % 2 === 0) out[right++] = v; else out[left--] = v })
  return out
}

/** Non-TC double triangle: intensities (mm/h) of blocks of stepMin minutes. */
export function nontcStorm(pj: number, law: Law, D = 3, th = 0.5, centreFrac = 0.2, stepMin = 10): number[] {
  const total = lawDepth(D, pj, law), intense = lawDepth(th, pj, law)
  const step = stepMin / 60
  let tc = Math.min(Math.max(centreFrac * D, th / 2), D - th / 2)
  const t1 = Math.min(Math.max(Math.round((tc - th / 2) / step) * step, 0), D - th)
  tc = t1 + th / 2
  const t2 = t1 + th
  const g = (tc ** 2 - t1 ** 2) / (2 * tc) + ((D - tc) ** 2 - (D - t2) ** 2) / (2 * (D - tc))
  const h = (total - intense) / (D / 2 - g)
  const k = (2 * (intense - h * g)) / th
  const intensity = (t: number) => h * (t <= tc ? t / tc : (D - t) / (D - tc)) + k * Math.max(0, 1 - Math.abs(t - tc) / (th / 2))
  const n = Math.round(D / step), sub = 600
  const blocks: number[] = []
  for (let b = 0; b < n; b++) {
    let s = 0
    for (let j = 0; j < sub; j++) {
      const a = (b + j / sub) * step, c = (b + (j + 1) / sub) * step
      s += ((intensity(a) + intensity(c)) / 2) * (c - a)
    }
    blocks.push(s)
  }
  const sum = blocks.reduce((x, y) => x + y, 0)
  return blocks.map((v) => (v * total) / sum / step)
}

/** Position of each ranked day (0 = wettest): the wettest in the middle, the others alternately before and after. */
export function dayOrder(n: number): number[] {
  const mid = Math.floor(n / 2), pos = [mid]
  for (let r = 1; r < n; r++) pos.push(r % 2 ? mid - Math.floor((r + 1) / 2) : mid + Math.floor(r / 2))
  return pos
}

/** TC storm: total split by the daily shares (wettest first); wettest day shaped by alternating blocks of the law,
 *  the other days at a constant rate. Returns intensities (mm/h) of blocks of stepMin minutes. */
export function tcStorm(total: number, shares: number[], law: Law, stepMin = 30): number[] {
  const sum = shares.reduce((a, b) => a + b, 0)
  const step = stepMin / 60, perDay = Math.round(24 / step)
  const days: number[][] = new Array(shares.length)
  dayOrder(shares.length).forEach((pos, rank) => {
    const depth = (total * shares[rank]) / sum
    if (rank === 0) {
      const pj = depth / (law.coefficient * 24 ** law.exponent)
      const cum = Array.from({ length: perDay }, (_, i) => lawDepth((i + 1) * step, pj, law))
      days[pos] = alternatingBlocks(cum.map((c, i) => c - (i ? cum[i - 1] : 0)))
    } else {
      days[pos] = new Array(perDay).fill(depth / perDay)
    }
  })
  return days.flat().map((v) => v / step)
}
