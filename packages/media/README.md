# @eleva/media

Curated marketing photos and videos for every Eleva app. `src/library.json` is the
manifest: Blob URL, intrinsic size, blur placeholder, localized alt (en/pt/es),
tags, licence and credit.

```tsx
import { ElevaImage } from "@eleva/media/image"
import { ElevaVideo } from "@eleva/media/video"

<ElevaImage slug="pregnancy-home" locale={locale} fill className="object-cover" />
<ElevaVideo slug="hero-intro" locale={locale} priority className="aspect-video" />
```

Apps need `images.remotePatterns: ELEVA_IMAGE_REMOTE_PATTERNS` from
`@eleva/config/next-dev`.

## Curating

Public Blob store only. Never import member, health or session imagery.
Follow `docs/eleva-v3/brand-book/art-direction.md`: real women, natural light,
warm homes and clinics.

```bash
pnpm --filter @eleva/media media:search "pregnant woman natural light home" --per 12
# thumbnails land in /tmp/eleva-media-candidates/<query>/<id>.jpg
pnpm --filter @eleva/media media:import pregnancy-home 5425038 \
  --alt-en "…" --alt-pt "…" --alt-es "…" --tags pregnancy,home
pnpm --filter @eleva/media media:import-local service-pregnancy ./photo.jpg \
  --width 1600 --height 1067 --blur ./photo-24px.jpg --alt-en "…" --alt-pt "…" --alt-es "…"
```

## Licences

- `eleva-owned`: MVP photography and the Mux intro video.
- `pexels`: [Pexels licence](https://www.pexels.com/license/). Free to use;
  credit is appreciated, not required. `creditedMedia()` feeds the photo
  credits on the public site's legal page.
