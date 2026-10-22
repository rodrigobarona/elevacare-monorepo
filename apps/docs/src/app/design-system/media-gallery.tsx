import { listMedia } from "@eleva/media"
import { ElevaImage } from "@eleva/media/image"

/** Every curated asset with its slug, licence and credit, for picking slugs. */
export function MediaGallery() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {listMedia().map((asset) => (
        <li
          key={asset.slug}
          className="overflow-hidden rounded-xl border bg-card"
        >
          <div className="relative aspect-4/3 bg-muted">
            {asset.kind === "image" ? (
              <ElevaImage
                slug={asset.slug}
                locale="en"
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- video poster is Blob-hosted, not ElevaImage
              <img
                src={asset.poster}
                alt={asset.alt.en}
                className="size-full object-cover"
                loading="lazy"
              />
            )}
          </div>
          <div className="flex flex-col gap-1 p-3">
            <p className="font-mono text-xs text-foreground">{asset.slug}</p>
            <p className="text-xs text-muted-foreground">
              {asset.kind} · {asset.license} · {asset.credit.name}
            </p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {asset.tags.join(", ")}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
