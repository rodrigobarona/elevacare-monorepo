import { createNavigation } from "next-intl/navigation"
import { routing } from "./routing"

/**
 * Locale-aware navigation helpers. Re-export `Link`, `redirect`,
 * `usePathname`, `useRouter`, and `getPathname` so app code can stay
 * agnostic of next-intl's internals.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)
