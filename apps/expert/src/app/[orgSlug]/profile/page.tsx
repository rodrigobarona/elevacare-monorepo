import { getLocale, getTranslations } from "next-intl/server"
import { isLocale, locales, type Locale } from "@eleva/config"
import { expertProfileUrl } from "@eleva/config/env"
import type { LocalizedRichTextFieldValue } from "@eleva/editor/localized-rich-text-field"
import {
  localizedRichTextSchema,
  plainTextToPlateValue,
} from "@eleva/editor/types"
import { ArrowSquareOutIcon } from "@eleva/icons"
import { LinkButton } from "@eleva/ui/components/button"
import { PageHeader } from "@eleva/ui/components/page-header"
import { loadExpertWorkspace } from "@/lib/expert-workspace"
import { BasicsSection } from "./basics-section"
import { BioSection } from "./bio-section"
import { CredentialsSection } from "./credentials-section"
import { PortraitSection } from "./portrait-section"
import { SocialLinksSection } from "./social-links-section"

export const dynamic = "force-dynamic"

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const [{ profile }, uiLocale, t] = await Promise.all([
    loadExpertWorkspace(orgSlug, "expert:onboard"),
    getLocale(),
    getTranslations("publicProfile"),
  ])
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"

  const sourceLocale: Locale =
    profile.bioSourceLocale && isLocale(profile.bioSourceLocale)
      ? profile.bioSourceLocale
      : isLocale(uiLocale)
        ? uiLocale
        : "en"

  const storedBio = localizedRichTextSchema.safeParse(profile.bioRich ?? {})
  const bioValue: LocalizedRichTextFieldValue = {}
  for (const locale of locales) {
    const entry = storedBio.success ? storedBio.data[locale] : undefined
    if (entry) bioValue[locale] = { json: entry.json, source: entry.source }
  }
  if (Object.keys(bioValue).length === 0 && profile.bio?.trim()) {
    bioValue[sourceLocale] = {
      json: plainTextToPlateValue(profile.bio),
      source: "human",
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <LinkButton
            variant="outline"
            href={expertProfileUrl(uiLocale, profile.username)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("viewPublic")}
            <ArrowSquareOutIcon aria-hidden className="ms-1.5 size-4" />
          </LinkButton>
        }
      />

      <PortraitSection
        initialUrl={profile.avatarUrl}
        displayName={profile.displayName}
        username={profile.username}
        apiBaseUrl={apiBaseUrl}
      />
      <BasicsSection
        initialDisplayName={profile.displayName}
        initialHeadline={profile.headline ?? ""}
      />
      <BioSection
        profileId={profile.id}
        initialSourceLocale={sourceLocale}
        initialValue={bioValue}
      />
      <SocialLinksSection initialLinks={profile.socialLinks} />
      <CredentialsSection initialCredentials={profile.credentials} />
    </div>
  )
}
