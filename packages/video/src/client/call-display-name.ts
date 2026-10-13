export function callDisplayName(userName: unknown, fallback: string): string {
  return typeof userName === "string" && userName.trim()
    ? userName.trim()
    : fallback
}

export function localCallDisplayName(
  userName: unknown,
  you: string,
  youNamed: (name: string) => string
): string {
  const name = callDisplayName(userName, "")
  return name ? youNamed(name) : you
}
