/** Thousands separators; fewer decimals as numbers grow. */
export function fmt(v: number, digits?: number): string {
  const d = digits ?? (Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2)
  return v.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: d })
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
