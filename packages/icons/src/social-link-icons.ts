import type { Icon } from "@phosphor-icons/react/lib"
import {
  FacebookLogoIcon,
  GlobeIcon,
  InstagramLogoIcon,
  LinkedinLogoIcon,
  TiktokLogoIcon,
  YoutubeLogoIcon,
} from "@phosphor-icons/react/ssr"

/** Keyed by `SocialLinkKind` from `@eleva/config/expert-profile-content`. */
export const SOCIAL_LINK_ICONS = {
  website: GlobeIcon,
  instagram: InstagramLogoIcon,
  linkedin: LinkedinLogoIcon,
  youtube: YoutubeLogoIcon,
  tiktok: TiktokLogoIcon,
  facebook: FacebookLogoIcon,
} as const satisfies Record<string, Icon>
