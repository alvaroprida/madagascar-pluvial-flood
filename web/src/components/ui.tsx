import type { EChartsOption } from 'echarts'
import ReactEChartsCore from 'echarts-for-react/esm/core'
import { useState, type ReactNode } from 'react'
import { echarts } from '../echarts'
import type { Palette } from '../theme'

export function Card({ title, subtitle, children, actions, className = '' }: {
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-4 md:p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, sub, hero = false }: { label: string; value: ReactNode; sub?: ReactNode; hero?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-sm text-ink-2">{label}</div>
      <div className={`mt-1 font-semibold text-ink ${hero ? 'text-3xl' : 'text-2xl'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-sm text-ink-3">{sub}</div>}
    </div>
  )
}

export function Chart({ option, height = 360, label }: { option: EChartsOption; height?: number; label: string }) {
  return (
    <div role="img" aria-label={label}>
      <ReactEChartsCore echarts={echarts} option={option} style={{ height }} notMerge lazyUpdate opts={{ renderer: 'svg' }} />
    </div>
  )
}

/** Legend row: coloured swatch beside ink-coloured text (identity never by colour alone). */
export function Legend({ items, palette }: { items: { label: string; role: keyof Palette; line?: boolean }[]; palette: Palette }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span
            className={it.line ? 'h-0.5 w-4 rounded' : 'h-3 w-3 rounded-sm'}
            style={{ background: palette[it.role] }}
            aria-hidden
          />
          {it.label}
        </li>
      ))}
    </ul>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 ${value === o.value ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Collapsible data table: every chart has its numbers available as text. */
export function DataTable({ head, rows, caption }: { head: string[]; rows: (string | number)[][]; caption: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3">
      <button className="text-sm text-accent underline underline-offset-2" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'Hide' : 'Show'} table
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm tabular">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-line text-left text-ink-3">
                {head.map((h, i) => (
                  <th key={h} className={`py-1.5 pr-4 font-medium ${i > 0 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className={`py-1.5 pr-4 ${j > 0 ? 'text-right text-ink' : 'text-ink-2'}`}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function Info({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-ink-2">{children}</p>
}

/** Static figure (PNG from the modelling pipeline) with caption; opens full size in a new tab. */
export function Figure({ src, alt, caption, maxHeight }: { src: string; alt: string; caption?: ReactNode; maxHeight?: number }) {
  return (
    <figure className="space-y-2">
      <a href={src} target="_blank" rel="noreferrer" className="figure-frame block overflow-hidden rounded-lg border border-line">
        <img src={src} alt={alt} loading="lazy" className="mx-auto h-auto w-full object-contain"
          style={maxHeight ? { maxHeight, width: 'auto', maxWidth: '100%' } : undefined} />
      </a>
      {caption && <figcaption className="text-sm text-ink-2">{caption}</figcaption>}
    </figure>
  )
}

export function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={it.title} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-banner text-sm font-semibold text-accent">
            {i + 1}
          </span>
          <div className="text-sm leading-relaxed text-ink-2">
            <span className="font-medium text-ink">{it.title}.</span> {it.body}
          </div>
        </li>
      ))}
    </ol>
  )
}
