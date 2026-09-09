import {
  CONSENT_DOCUMENTS,
  CONSENT_KINDS,
  type ConsentKind,
} from "@eleva/compliance"
import type { Locale } from "@eleva/config/i18n"

export type FunnelConsentDoc = {
  kind: ConsentKind
  version: string
  href: string
}

export function funnelConsentDocs(locale: Locale): FunnelConsentDoc[] {
  return CONSENT_KINDS.map((kind) => ({
    kind,
    version: CONSENT_DOCUMENTS[kind].version,
    href: CONSENT_DOCUMENTS[kind].urls[locale],
  }))
}
