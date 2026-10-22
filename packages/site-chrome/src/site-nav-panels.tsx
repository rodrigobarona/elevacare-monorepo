"use client"

import type { Locale } from "@eleva/config/i18n"
import {
  ArrowRightIcon,
  BookOpenIcon,
  BuildingsIcon,
  EnvelopeIcon,
  InfoIcon,
  MagnifyingGlassIcon,
  StethoscopeIcon,
  type Icon,
} from "@eleva/icons"
import { ElevaImage } from "@eleva/media/image"
import { cn } from "@eleva/ui/lib/utils"
import { usePublicNavigation } from "./navigation-context"
import { navString, type NavCopyRecords } from "./nav-copy"
import type { SiteNavIcon, SiteNavLink, SiteNavMenu } from "./public-site-nav"

const ICONS: Record<SiteNavIcon, Icon> = {
  search: MagnifyingGlassIcon,
  stethoscope: StethoscopeIcon,
  buildings: BuildingsIcon,
  info: InfoIcon,
  book: BookOpenIcon,
  envelope: EnvelopeIcon,
}

export type NavCopy = NavCopyRecords

function linkCopy(link: SiteNavLink, copy: NavCopy) {
  return {
    title: navString(copy, link, "titleKey"),
    description: navString(copy, link, "descriptionKey"),
  }
}

function NavRow({
  link,
  copy,
  locale,
  compact = false,
}: {
  link: SiteNavLink
  copy: NavCopy
  locale: Locale
  compact?: boolean
}) {
  const { Link } = usePublicNavigation()
  const { title, description } = linkCopy(link, copy)
  const LinkIcon = "icon" in link ? ICONS[link.icon] : null

  return (
    <Link
      href={link.href}
      className={cn(
        "group/row flex gap-4 rounded-2xl transition-colors hover:bg-muted focus-visible:bg-muted",
        compact ? "items-center p-2" : "items-start p-3"
      )}
    >
      {"imageSlug" in link ? (
        <span
          className={cn(
            "relative shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-border/60",
            compact ? "size-10" : "size-14"
          )}
        >
          <ElevaImage
            slug={link.imageSlug}
            locale={locale}
            fill
            sizes={compact ? "40px" : "56px"}
            className="object-cover transition-transform duration-300 group-hover/row:scale-105"
          />
        </span>
      ) : LinkIcon ? (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 ring-1 ring-teal-100 transition-colors group-hover/row:bg-teal-700 group-hover/row:text-white dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-900",
            compact ? "size-10" : "size-11"
          )}
        >
          <LinkIcon weight="duotone" className="size-5" />
        </span>
      ) : null}
      <span
        className={cn("flex min-w-0 flex-col gap-0.5", !compact && "pt-0.5")}
      >
        <span className="text-sm font-medium text-foreground">{title}</span>
        {compact ? null : (
          <span className="line-clamp-2 text-sm text-pretty text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </Link>
  )
}

function FeaturedCard({
  menu,
  copy,
  locale,
}: {
  menu: SiteNavMenu
  copy: NavCopy
  locale: Locale
}) {
  const { Link } = usePublicNavigation()

  return (
    <Link
      href={menu.featured.href}
      className="group/featured relative flex min-h-64 flex-col justify-end overflow-hidden rounded-3xl bg-teal-900 p-5 text-white shadow-1"
    >
      <ElevaImage
        slug={menu.featured.imageSlug}
        locale={locale}
        fill
        sizes="320px"
        className="object-cover transition-transform duration-500 group-hover/featured:scale-105"
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-teal-950/90 via-teal-950/40 to-transparent"
      />
      <span className="relative flex flex-col gap-1">
        <span className="font-heading text-lg leading-snug">
          {copy.nav[`menu.${menu.id}.featuredTitle`]}
        </span>
        <span className="text-sm text-pretty text-white/80">
          {copy.nav[`menu.${menu.id}.featuredDescription`]}
        </span>
      </span>
    </Link>
  )
}

/** Desktop mega-menu panel body for one header menu. */
export function SiteNavPanel({
  menu,
  copy,
  locale,
}: {
  menu: SiteNavMenu
  copy: NavCopy
  locale: Locale
}) {
  const wide = menu.links.length > 3

  return (
    <div
      className={cn(
        "mx-auto grid gap-6 px-4 py-6 sm:px-6 lg:py-8",
        wide
          ? "max-w-6xl grid-cols-[minmax(0,1fr)_20rem]"
          : "max-w-4xl grid-cols-[minmax(0,1fr)_18rem]"
      )}
    >
      <div className="flex flex-col gap-3">
        <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {copy.nav[`menu.${menu.id}.heading`]}
        </p>
        <ul className={cn("grid gap-1", wide && "grid-cols-2")}>
          {menu.links.map((link) => (
            <li key={link.href}>
              <NavRow link={link} copy={copy} locale={locale} />
            </li>
          ))}
        </ul>
        {menu.footerLink ? (
          <FooterLink link={menu.footerLink} copy={copy} />
        ) : null}
      </div>
      <FeaturedCard menu={menu} copy={copy} locale={locale} />
    </div>
  )
}

function FooterLink({ link, copy }: { link: SiteNavLink; copy: NavCopy }) {
  const { Link } = usePublicNavigation()
  const { title, description } = linkCopy(link, copy)

  return (
    <Link
      href={link.href}
      className="group/footer mt-auto flex items-center justify-between gap-4 rounded-2xl bg-muted/70 px-4 py-3 transition-colors hover:bg-muted"
    >
      <span className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
      <ArrowRightIcon className="size-4 shrink-0 text-primary transition-transform group-hover/footer:translate-x-0.5" />
    </Link>
  )
}

/** Grouped links for the mobile sheet; featured cards are desktop-only. */
export function SiteNavMobileGroups({
  menus,
  copy,
  locale,
}: {
  menus: readonly SiteNavMenu[]
  copy: NavCopy
  locale: Locale
}) {
  return (
    <div className="flex flex-col gap-6">
      {menus.map((menu) => (
        <section key={menu.id} className="flex flex-col gap-1">
          <h2 className="px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {copy.nav[`menu.${menu.id}.trigger`]}
          </h2>
          <ul className="flex flex-col">
            {[...(menu.footerLink ? [menu.footerLink] : []), ...menu.links].map(
              (link) => (
                <li key={link.href}>
                  <NavRow link={link} copy={copy} locale={locale} compact />
                </li>
              )
            )}
          </ul>
        </section>
      ))}
    </div>
  )
}
