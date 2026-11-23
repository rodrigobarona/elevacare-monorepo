import path from "node:path"

/** Skip `_context/` snapshots and the internal PoC playground. */
function repoFilesOnly(filenames) {
  return filenames.filter((f) => {
    const normalized = f.split(path.sep).join("/")
    return (
      !normalized.includes("/_context/") && !normalized.startsWith("apps/poc/")
    )
  })
}

export default {
  // eslint-plugin-only-warn in @eleva/eslint-config turns every finding
  // into a warning, the boundary rules too, so nothing here stops a commit.
  // What must not get in is refused in CI by `pnpm check:boundaries`.
  "*.{ts,tsx,js,mjs,cjs}": (filenames) => {
    const files = repoFilesOnly(filenames)
    if (files.length === 0) return []
    const quoted = files.map((f) => JSON.stringify(f))
    return [
      `prettier --write ${quoted.join(" ")}`,
      `eslint --fix ${quoted.join(" ")}`,
    ]
  },
  "*.{json,md,yml,yaml,css}": (filenames) => {
    const files = repoFilesOnly(filenames)
    if (files.length === 0) return []
    const quoted = files.map((f) => JSON.stringify(f))
    return `prettier --write ${quoted.join(" ")}`
  },
}
