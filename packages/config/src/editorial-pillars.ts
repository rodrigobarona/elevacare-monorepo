function trimEnv(value: string | undefined): string {
  return value?.trim() ?? ""
}

export type EditorialPillars = {
  /** Femme Focus newsletter publication on Beehiiv */
  newsletterUrl: string
  /** Hosted subscribe embed (CSP frame-src must allow this origin when set) */
  newsletterEmbedUrl: string
  /** Beehiiv community space */
  communityUrl: string
  podcast: {
    spotify: string
    apple: string
    youtube: string
  }
}

const DEFAULTS: EditorialPillars = {
  newsletterUrl: "https://www.beehiiv.com/",
  newsletterEmbedUrl: "",
  communityUrl: "https://www.beehiiv.com/",
  podcast: {
    spotify: "",
    apple: "",
    youtube: "",
  },
}

/** SSOT for Learn & community external URLs; override via env when founder shares links. */
export function getEditorialPillars(): EditorialPillars {
  return {
    newsletterUrl:
      trimEnv(process.env.ELEVA_NEWSLETTER_URL) || DEFAULTS.newsletterUrl,
    newsletterEmbedUrl:
      trimEnv(process.env.ELEVA_NEWSLETTER_EMBED_URL) ||
      DEFAULTS.newsletterEmbedUrl,
    communityUrl:
      trimEnv(process.env.ELEVA_COMMUNITY_URL) || DEFAULTS.communityUrl,
    podcast: {
      spotify:
        trimEnv(process.env.ELEVA_PODCAST_SPOTIFY_URL) ||
        DEFAULTS.podcast.spotify,
      apple:
        trimEnv(process.env.ELEVA_PODCAST_APPLE_URL) || DEFAULTS.podcast.apple,
      youtube:
        trimEnv(process.env.ELEVA_PODCAST_YOUTUBE_URL) ||
        DEFAULTS.podcast.youtube,
    },
  }
}

/** @deprecated Use `getEditorialPillars()` — static object ignores env. */
export const EDITORIAL_PILLARS = DEFAULTS
