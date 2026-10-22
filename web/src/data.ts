import type { SiteData } from './types'

/** Path of a file under public/data, relative so the site works from any Pages sub-path. */
export const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`

async function get<T>(file: string): Promise<T> {
  const res = await fetch(dataUrl(file))
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export async function loadData(): Promise<SiteData> {
  const [domain, cyclones, rainfall, landcover, catchments, tracks, benchmark, prices, exposure, vulnerability] = await Promise.all([
    get<SiteData['domain']>('domain.json'),
    get<SiteData['cyclones']>('cyclones.json'),
    get<SiteData['rainfall']>('rainfall.json'),
    get<SiteData['landcover']>('landcover_classes.json'),
    get<SiteData['catchments']>('catchments.geojson'),
    get<SiteData['tracks']>('tc_tracks.geojson'),
    get<SiteData['benchmark']>('compute_benchmark.json'),
    get<SiteData['prices']>('aws_prices.json'),
    get<SiteData['exposure']>('exposure.json'),
    get<SiteData['vulnerability']>('vulnerability.json'),
  ])
  return { domain, cyclones, rainfall, landcover, catchments, tracks, benchmark, prices, exposure, vulnerability }
}
