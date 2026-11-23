import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// `next/link` needs the app router around it; an anchor says the same here.
vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    children,
    ...rest
  }: {
    href: string
    prefetch?: boolean
    children: unknown
  }) =>
    createElement(
      "a",
      { href, "data-prefetch": String(prefetch), ...rest },
      children as string
    ),
}))

import { Pager } from "./pager"

const labels = {
  landmark: "Pages",
  previous: "Previous",
  next: "Next",
  previousPage: "Previous page",
  nextPage: "Next page",
}

const render = (props: Partial<Parameters<typeof Pager>[0]>) =>
  renderToStaticMarkup(
    createElement(Pager, { range: "Showing 26 to 50 of 112", labels, ...props })
  )

describe("Pager", () => {
  it("links to both sides from a page in the middle", () => {
    const html = render({
      links: { previous: "/clinics", next: "/clinics?page=3" },
    })
    expect(html).toContain('<nav aria-label="Pages"')
    expect(html).toMatch(
      /<a href="\/clinics"[^>]*aria-label="Previous page"[^>]*>Previous<\/a>/
    )
    expect(html).toMatch(
      /<a href="\/clinics\?page=3"[^>]*aria-label="Next page"[^>]*>Next<\/a>/
    )
    // Previous comes before Next, in reading and in tab order.
    expect(html.indexOf("Previous<")).toBeLessThan(html.indexOf("Next<"))
  })

  it("never fetches a page ahead of the reader", () => {
    const html = render({ links: { previous: "/a", next: "/b" } })
    expect(html.match(/data-prefetch="false"/g)).toHaveLength(2)
  })

  it("keeps an unavailable control in place, and says it is unavailable", () => {
    const first = render({ links: { previous: null, next: "/clinics?page=2" } })
    expect(first).toMatch(
      /<span role="link" aria-disabled="true" aria-label="Previous page"[^>]*>Previous<\/span>/
    )
    expect(first).not.toMatch(/<a [^>]*>Previous/)
    const last = render({
      links: { previous: "/clinics?page=4", next: null },
      end: "You’ve reached the end of the queue.",
    })
    expect(last).toMatch(/<span role="link" aria-disabled="true"[^>]*>Next/)
    // In words, straight after the range, not only a greyed button.
    expect(last).toMatch(
      /Showing 26 to 50 of 112\.<span[^>]*> You’ve reached the end of the queue\.<\/span>/
    )
    // The available control is the stronger of the two.
    expect(last).toMatch(
      /<a [^>]*class="[^"]*text-foreground[^"]*"[^>]*>Previous/
    )
    expect(last).toMatch(
      /<span role="link"[^>]*class="[^"]*text-muted-foreground[^"]*"[^>]*>Next/
    )
  })

  it("shows the range alone for a list that fits on one page", () => {
    const html = render({ range: "Showing 1 to 12 of 12", rangeId: "range" })
    expect(html).toContain('<p id="range"')
    expect(html).toContain("Showing 1 to 12 of 12")
    expect(html).not.toContain("<nav")
    expect(html).not.toContain("Previous")
  })
})
