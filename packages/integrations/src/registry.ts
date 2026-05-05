import type { IntegrationCategory, IntegrationManifest } from "./types"

const manifests = new Map<string, IntegrationManifest>()

export function registerManifest(manifest: IntegrationManifest): void {
  if (manifests.has(manifest.slug)) {
    throw new Error(`Duplicate integration slug: ${manifest.slug}`)
  }
  manifests.set(manifest.slug, manifest)
}

export function getManifest(slug: string): IntegrationManifest | undefined {
  return manifests.get(slug)
}

export function listManifests(): IntegrationManifest[] {
  return Array.from(manifests.values())
}

export function listByCategory(
  category: IntegrationCategory
): IntegrationManifest[] {
  return listManifests().filter((m) => m.category === category)
}

export function listCategories(): IntegrationCategory[] {
  const cats = new Set<IntegrationCategory>()
  for (const m of manifests.values()) {
    cats.add(m.category)
  }
  return Array.from(cats)
}
