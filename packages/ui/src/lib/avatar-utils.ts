import type { CSSProperties } from "react"

const AVATAR_GRADIENTS = [
  ["rgb(var(--eleva-primary))", "rgb(var(--eleva-primary-light))"],
  ["rgb(var(--eleva-secondary))", "rgb(var(--eleva-secondary-light))"],
  ["rgb(var(--eleva-highlight-purple))", "rgb(var(--eleva-primary-light))"],
  ["rgb(var(--eleva-primary))", "rgb(var(--eleva-accent))"],
] as const

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function getAvatarSeed(email: string, displayName?: string): string {
  const trimmedEmail = email.trim().toLowerCase()
  if (trimmedEmail) return trimmedEmail

  const trimmedName = displayName?.trim()
  if (trimmedName) return trimmedName.toLowerCase()

  return "unknown"
}

export function getAvatarInitials(name: string, email?: string): string {
  const trimmed = name.trim()
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
    }
    return trimmed.slice(0, 2).toUpperCase()
  }

  const trimmedEmail = email?.trim()
  if (trimmedEmail) {
    return trimmedEmail.slice(0, 2).toUpperCase()
  }

  return "?"
}

export function getAvatarFallbackStyle(seed: string): CSSProperties {
  const index = hashString(seed) % AVATAR_GRADIENTS.length
  const [from, to] = AVATAR_GRADIENTS[index]!
  return {
    background: `linear-gradient(135deg, ${from}, ${to})`,
  }
}
