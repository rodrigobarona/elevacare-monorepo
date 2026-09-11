export function toCsv(rows: unknown): string {
  if (!Array.isArray(rows) || rows.length === 0) {
    return ""
  }
  const objects = rows.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === "object" && !Array.isArray(row)
  )
  if (objects.length === 0) return ""

  const headers: string[] = []
  const seen = new Set<string>()
  for (const row of objects) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        headers.push(key)
      }
    }
  }

  const lines = [headers.map(escapeCsv).join(",")]
  for (const row of objects) {
    lines.push(
      headers.map((header) => escapeCsv(stringifyCsv(row[header]))).join(",")
    )
  }
  return `${lines.join("\n")}\n`
}

function stringifyCsv(value: unknown): string {
  if (value == null) return ""
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }
  return value
}
