import {
  AI_PROCESSING_CONSENT_DOCUMENT,
  CONSENT_DOCUMENTS,
  FUNNEL_CONSENT_KINDS,
  type FunnelConsentKind,
} from "@eleva/compliance"
import type { Locale } from "@eleva/config/i18n"

export type FunnelConsentDoc = {
  kind: FunnelConsentKind
  version: string
  href: string
}

export function funnelConsentDocs(locale: Locale): FunnelConsentDoc[] {
  return FUNNEL_CONSENT_KINDS.map((kind) => ({
    kind,
    version: CONSENT_DOCUMENTS[kind].version,
    href: CONSENT_DOCUMENTS[kind].urls[locale],
  }))
}

export function aiProcessingConsentDoc(locale: Locale): {
  version: string
  href: string
} {
  return {
    version: AI_PROCESSING_CONSENT_DOCUMENT.version,
    href: AI_PROCESSING_CONSENT_DOCUMENT.urls[locale],
  }
}
