import { permanentRedirect } from "next/navigation"
import { resolveGatewayUrl } from "@eleva/config/env"

/**
 * Settings belongs to the person, not the Space, so it lives in /account
 * (ADR-026). Old links and bookmarks land there.
 */
export default function SpaceSettingsRedirect() {
  permanentRedirect(`${resolveGatewayUrl()}/account/settings`)
}
