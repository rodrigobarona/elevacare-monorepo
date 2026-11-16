import { Fragment } from "react"
import type { TemplatePhiFinding } from "@eleva/api-client"

/** Renders `text` with the template-scrubber findings marked. */
export function PhiHighlight({
  text,
  findings,
}: {
  text: string
  findings: readonly TemplatePhiFinding[]
}) {
  const parts: React.ReactNode[] = []
  let cursor = 0
  for (const finding of findings) {
    if (finding.start < cursor) continue
    parts.push(
      <Fragment key={`t${cursor}`}>
        {text.slice(cursor, finding.start)}
      </Fragment>
    )
    parts.push(
      <mark
        key={`m${finding.start}`}
        className="rounded bg-destructive/15 px-0.5 text-destructive"
      >
        {text.slice(finding.start, finding.end)}
      </mark>
    )
    cursor = finding.end
  }
  parts.push(<Fragment key="rest">{text.slice(cursor)}</Fragment>)
  return <p className="text-sm whitespace-pre-wrap">{parts}</p>
}
