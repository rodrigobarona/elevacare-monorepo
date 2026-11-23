import { readFile } from "node:fs/promises"
import path from "node:path"
import { createTranslator } from "next-intl"
import { SignInAgainStates, type SignInAgainCopy } from "./states"

/**
 * The "sign in again" notices of a staff decision (slice 12.7) in each of
 * their states, for `e2e/sign-in-again.spec.ts`. Not a product surface:
 * the review around them is made up, and nothing here signs anyone in or
 * out. The words are the product's own: read from the staff console's
 * messages (`apps/admin/messages`, namespace `signInAgain`), so this page
 * cannot say something the console does not.
 */
const LOCALES = ["en", "pt", "es"] as const
// The rule's number, as the console reads it from the shared constant.
const HOURS = 12

export default async function SignInAgainFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>
}) {
  const asked = (await searchParams).locale
  const locale = LOCALES.find((known) => known === asked) ?? "en"
  // The playground runs from apps/poc; the console's messages are beside it.
  const messages = JSON.parse(
    await readFile(
      path.join(process.cwd(), "..", "admin", "messages", `${locale}.json`),
      "utf8"
    )
  ) as Record<string, unknown>
  // The messages are read as they are on disk, so their keys are not known
  // to the compiler: a translator by key, as text.
  type Translate = (key: string, values?: Record<string, number>) => string
  const translator = (namespace: string) =>
    createTranslator({
      locale,
      messages: messages as never,
      namespace: namespace as never,
    }) as unknown as Translate
  const t = translator("signInAgain")
  const form = translator("clinics.detail")
  const copy: SignInAgainCopy = {
    bannerTitle: t("banner.title"),
    bannerBody: t("banner.body", { hours: HOURS }),
    kept: t("kept"),
    notKept: t("notKept"),
    refusedTitle: t("refused.title"),
    refusedBody: t("refused.body", { hours: HOURS }),
    refusedKept: t("refused.kept"),
    action: t("action"),
    actionPending: t("actionPending"),
    unavailable: t("unavailable"),
    writeFailed: t("writeFailed"),
    restored: t("restored"),
    restoredSome: t("restoredSome"),
    changed: `${t("changed.clinic")} ${t("reasonKept")}`,
    lapsed: t("lapsed"),
    renewed: t("renewed"),
    snapshotTitle: form("snapshotTitle"),
    decisionTitle: form("decisionTitle"),
    checklistHelp: form("checklistHelp"),
    approve: form("approve"),
    reasonLabel: form("reasonLabel"),
    reasonHelp: form("reasonHelp"),
    needsChanges: form("needsChanges"),
    reject: form("reject"),
  }
  return <SignInAgainStates copy={copy} />
}
