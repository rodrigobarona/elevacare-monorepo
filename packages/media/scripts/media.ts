/**
 * Curate marketing media into the public Blob store + `src/library.json`.
 *
 *   pnpm --filter @eleva/media media:search "pregnant woman natural light home" [--orientation landscape] [--per 12]
 *   pnpm --filter @eleva/media media:import <slug> <pexelsId> --alt-en "…" --alt-pt "…" --alt-es "…" [--tags a,b]
 *   pnpm --filter @eleva/media media:import-local <slug> <path> --alt-en "…" --alt-pt "…" --alt-es "…" [--tags a,b]
 *   pnpm --filter @eleva/media media:import-video <slug> <mp4> --poster <image> --alt-en "…" --alt-pt "…" --alt-es "…" [--tags a,b] [--width N] [--height N] [--blur path]
 *
 * Reads PEXELS_API_KEY and BLOB_READ_WRITE_TOKEN from the repo `.env.local`.
 * Public store only: never import member, health or session imagery.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"

import { uploadPublicBlob } from "@eleva/storage"

import type { MediaAsset, MediaImage, MediaVideo } from "../src/types"

const LIBRARY_PATH = fileURLToPath(
  new URL("../src/library.json", import.meta.url)
)
const PEXELS_API = "https://api.pexels.com/v1"
const TARGET_WIDTH = 2400
const THUMBS_DIR = "/tmp/eleva-media-candidates"

interface PexelsPhoto {
  id: number
  width: number
  height: number
  url: string
  photographer: string
  photographer_url: string
  avg_color: string
  alt: string
  src: { original: string; medium: string }
}

function pexelsKey(): string {
  const key = process.env.PEXELS_API_KEY
  if (!key) throw new Error("PEXELS_API_KEY is not set (.env.local)")
  return key
}

async function pexels<T>(pathname: string): Promise<T> {
  const res = await fetch(`${PEXELS_API}${pathname}`, {
    headers: { Authorization: pexelsKey() },
  })
  if (!res.ok) throw new Error(`Pexels ${res.status} for ${pathname}`)
  return (await res.json()) as T
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download ${res.status} ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

async function readLibrary(): Promise<MediaAsset[]> {
  return JSON.parse(await readFile(LIBRARY_PATH, "utf8")) as MediaAsset[]
}

async function writeLibrary(assets: MediaAsset[]): Promise<void> {
  const sorted = [...assets].sort((a, b) => a.slug.localeCompare(b.slug))
  await writeFile(LIBRARY_PATH, `${JSON.stringify(sorted, null, 2)}\n`)
}

async function upsert(asset: MediaAsset): Promise<void> {
  const library = await readLibrary()
  await writeLibrary([...library.filter((a) => a.slug !== asset.slug), asset])
}

function assertSlug(slug: string | undefined): string {
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`invalid slug "${slug ?? ""}" (kebab-case)`)
  }
  return slug
}

function altFrom(values: Record<string, string | boolean | undefined>) {
  const en = values["alt-en"]
  const pt = values["alt-pt"]
  const es = values["alt-es"]
  if (
    typeof en !== "string" ||
    typeof pt !== "string" ||
    typeof es !== "string"
  ) {
    throw new Error("--alt-en, --alt-pt and --alt-es are required")
  }
  return { en, pt, es }
}

function tagsFrom(value: string | boolean | undefined): string[] {
  return typeof value === "string"
    ? value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : []
}

function sized(url: string, width: number): string {
  const u = new URL(url)
  u.searchParams.set("auto", "compress")
  u.searchParams.set("cs", "tinysrgb")
  u.searchParams.set("w", String(width))
  return u.toString()
}

async function search(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      orientation: { type: "string", default: "landscape" },
      per: { type: "string", default: "12" },
    },
  })
  const query = positionals.join(" ").trim()
  if (!query) throw new Error("search needs a query")
  const params = new URLSearchParams({
    query,
    per_page: values.per,
    orientation: values.orientation,
  })
  const { photos } = await pexels<{ photos: PexelsPhoto[] }>(
    `/search?${params.toString()}`
  )
  const dir = path.join(THUMBS_DIR, query.replace(/[^a-z0-9]+/gi, "-"))
  await mkdir(dir, { recursive: true })
  for (const photo of photos) {
    const file = path.join(dir, `${photo.id}.jpg`)
    await writeFile(file, await download(photo.src.medium))
    console.log(
      [
        photo.id,
        `${photo.width}x${photo.height}`,
        photo.photographer,
        photo.alt,
        file,
      ].join(" | ")
    )
  }
}

async function importPexels(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "alt-en": { type: "string" },
      "alt-pt": { type: "string" },
      "alt-es": { type: "string" },
      tags: { type: "string" },
    },
  })
  const slug = assertSlug(positionals[0])
  const id = positionals[1]
  if (!id || !/^\d+$/.test(id)) throw new Error("import needs a Pexels id")
  const photo = await pexels<PexelsPhoto>(`/photos/${id}`)
  const width = Math.min(TARGET_WIDTH, photo.width)
  const height = Math.round((photo.height * width) / photo.width)
  const [body, blur] = await Promise.all([
    download(sized(photo.src.original, width)),
    download(sized(photo.src.original, 24)),
  ])
  const { url } = await uploadPublicBlob({
    pathname: `media/pexels/${slug}.jpg`,
    body,
    contentType: "image/jpeg",
  })
  const asset: MediaImage = {
    kind: "image",
    slug,
    url,
    width,
    height,
    blurDataURL: `data:image/jpeg;base64,${blur.toString("base64")}`,
    avgColor: photo.avg_color,
    alt: altFrom(values),
    tags: tagsFrom(values.tags),
    license: "pexels",
    credit: { name: photo.photographer, url: photo.photographer_url },
    source: { provider: "pexels", id: String(photo.id), pageUrl: photo.url },
  }
  await upsert(asset)
  console.log(`imported ${slug} → ${url}`)
}

async function importLocal(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      "alt-en": { type: "string" },
      "alt-pt": { type: "string" },
      "alt-es": { type: "string" },
      tags: { type: "string" },
      width: { type: "string" },
      height: { type: "string" },
      blur: { type: "string" },
    },
  })
  const slug = assertSlug(positionals[0])
  const file = positionals[1]
  if (!file) throw new Error("import-local needs a file path")
  const width = Number(values.width)
  const height = Number(values.height)
  if (!width || !height || typeof values.blur !== "string") {
    throw new Error(
      "import-local needs --width, --height and --blur (24px jpeg path)"
    )
  }
  const ext = path.extname(file).toLowerCase()
  const contentType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg"
  const [body, blur] = await Promise.all([
    readFile(file),
    readFile(values.blur),
  ])
  const { url } = await uploadPublicBlob({
    pathname: `media/eleva/${slug}${ext}`,
    body,
    contentType,
  })
  const asset: MediaImage = {
    kind: "image",
    slug,
    url,
    width,
    height,
    blurDataURL: `data:image/jpeg;base64,${blur.toString("base64")}`,
    alt: altFrom(values),
    tags: tagsFrom(values.tags),
    license: "eleva-owned",
    credit: { name: "Eleva Care" },
    source: { provider: "eleva" },
  }
  await upsert(asset)
  console.log(`imported ${slug} → ${url}`)
}

async function importVideo(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      poster: { type: "string" },
      "alt-en": { type: "string" },
      "alt-pt": { type: "string" },
      "alt-es": { type: "string" },
      tags: { type: "string" },
      width: { type: "string" },
      height: { type: "string" },
      blur: { type: "string" },
    },
  })
  const slug = assertSlug(positionals[0])
  const mp4Path = positionals[1]
  if (!mp4Path) throw new Error("import-video needs an mp4 path")
  if (typeof values.poster !== "string") {
    throw new Error("import-video needs --poster <image>")
  }
  if (typeof values.blur !== "string") {
    throw new Error(
      "import-video needs --blur <small image> (blur placeholder)"
    )
  }
  const width = Number(values.width)
  const height = Number(values.height)
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("import-video needs the video's --width and --height")
  }
  const alt = altFrom(values)

  const posterExt = path.extname(values.poster).toLowerCase()
  const posterType =
    posterExt === ".png"
      ? "image/png"
      : posterExt === ".webp"
        ? "image/webp"
        : "image/jpeg"

  const [videoBody, posterBody] = await Promise.all([
    readFile(mp4Path),
    readFile(values.poster),
  ])

  const blur = await readFile(values.blur)
  const blurDataURL = `data:image/jpeg;base64,${blur.toString("base64")}`

  const [{ url }, { url: posterUrl }] = await Promise.all([
    uploadPublicBlob({
      pathname: `media/eleva/${slug}.mp4`,
      body: videoBody,
      contentType: "video/mp4",
    }),
    uploadPublicBlob({
      pathname: `media/eleva/${slug}-poster${posterExt || ".jpg"}`,
      body: posterBody,
      contentType: posterType,
    }),
  ])

  const asset: MediaVideo = {
    kind: "video",
    slug,
    url,
    poster: posterUrl,
    blurDataURL,
    width,
    height,
    alt,
    tags: tagsFrom(values.tags),
    license: "eleva-owned",
    credit: { name: "Eleva Care" },
    source: { provider: "eleva" },
  }
  await upsert(asset)
  console.log(`imported video ${slug} → ${url}`)
  console.log(`poster → ${posterUrl}`)
}

const [command, ...rest] = process.argv.slice(2)
const commands: Record<string, (argv: string[]) => Promise<void>> = {
  search,
  import: importPexels,
  "import-local": importLocal,
  "import-video": importVideo,
}
const run = command ? commands[command] : undefined
if (!run) {
  console.error("usage: media.ts <search|import|import-local|import-video> …")
  process.exit(1)
}
await run(rest)
