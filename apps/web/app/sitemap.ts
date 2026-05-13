import type { MetadataRoute } from "next"
import { listCategories, listExperts } from "@eleva/db"

const BASE_URL = "https://eleva.care"
const LOCALES = ["en", "pt", "es"] as const

function localizedUrls(path: string): MetadataRoute.Sitemap[number] {
  const url = path === "/" ? BASE_URL : `${BASE_URL}${path}`
  return {
    url,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [
          l,
          l === "en" ? `${BASE_URL}${path}` : `${BASE_URL}/${l}${path}`,
        ])
      ),
    },
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.8,
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ["/", "/about", "/experts", "/become-partner"]
  const entries: MetadataRoute.Sitemap = staticPaths.map(localizedUrls)

  try {
    const categories = await listCategories()
    for (const cat of categories) {
      entries.push(localizedUrls(`/experts/${cat.slug}`))
    }
  } catch {}

  try {
    const result = await listExperts({ pageSize: 500 })
    for (const expert of result.experts) {
      entries.push({
        ...localizedUrls(`/${expert.username}`),
        priority: 0.6,
      })
    }
  } catch {}

  return entries
}
