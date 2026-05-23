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
  // eslint-plugin-only-warn in @eleva/eslint-config downgrades errors to
  // warnings; the boundaries rules explicitly re-escalate the ones that
  // must block a commit. So we do not pass --max-warnings here.
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
