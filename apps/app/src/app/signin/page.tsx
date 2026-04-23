import Link from "next/link"
import { getSignInUrl } from "@workos-inc/authkit-nextjs"
import { useTranslations } from "next-intl"

export default async function SignInPage() {
  const href = await getSignInUrl()
  return <SignInView href={href} />
}

function SignInView({ href }: { href: string }) {
  const t = useTranslations()
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-lg border p-6">
        <h1 className="text-xl font-medium">{t("auth.signin.title")}</h1>
        <Link
          href={href}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          {t("auth.signin.cta")}
        </Link>
      </div>
    </main>
  )
}
