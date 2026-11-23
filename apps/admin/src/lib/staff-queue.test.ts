import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`redirect:${to}`)
  }),
  api: vi.fn(),
}))

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))
// Each message as its key and what it was given, so a test reads which
// sentence was chosen and with which numbers.
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values
        ? `${namespace}.${key}:${JSON.stringify(values)}`
        : `${namespace}.${key}`
    return t
  },
  getFormatter: async () => ({ dateTime: () => "a date" }),
}))
// A read of a queue is recorded. Anything here that reaches the API fails.
vi.mock("@/lib/server-api", () => ({
  getAuthedApiClient: () => {
    mocks.api()
    throw new Error("the queue was read")
  },
}))
vi.mock("@eleva/ui/components/pager", () => ({ Pager: () => null }))
vi.mock("@eleva/ui/components/focus-heading-on-change", () => ({
  FocusHeadingOnChange: () => null,
}))

import { generateMetadata as clinicsMetadata } from "../app/clinics/(queue)/page"
import { generateMetadata as partnersMetadata } from "../app/partners/(queue)/page"
import {
  followQueuePage,
  QueuePager,
  queueTitle,
  requestedQueuePage,
} from "./staff-queue"

const at = (page?: string | string[]) => Promise.resolve({ page })

interface PagerProps {
  range: string
  end?: string
  links?: { previous: string | null; next: string | null }
}

async function pagerProps(queue: {
  total: number
  page: number
  pages: number
}): Promise<PagerProps> {
  const fragment = (await QueuePager({
    path: "/clinics",
    queue: { ...queue, pageSize: 25 },
  })) as { props: { children: { props: PagerProps }[] } }
  return fragment.props.children[0]!.props
}

describe("a queue's address", () => {
  beforeEach(() => vi.clearAllMocks())

  it("is page 1 with no page in it", async () => {
    await expect(requestedQueuePage(at(), "/clinics")).resolves.toBe(1)
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it("names a page from 2 up", async () => {
    await expect(requestedQueuePage(at("2"), "/clinics")).resolves.toBe(2)
    await expect(requestedQueuePage(at("10000"), "/clinics")).resolves.toBe(
      10_000
    )
  })

  it.each(["1", "0", "-2", "abc", "1.5", "02", "", " 2", ["2", "3"]])(
    "goes to the clean address for %j",
    async (value) => {
      await expect(requestedQueuePage(at(value), "/clinics")).rejects.toThrow(
        "redirect:/clinics"
      )
    }
  )

  it("treats a number too large to be a page as past the end", async () => {
    // The API answers the last page for it, and the address follows.
    await expect(requestedQueuePage(at("10001"), "/clinics")).resolves.toBe(
      10_000
    )
    await expect(requestedQueuePage(at("99999999"), "/clinics")).resolves.toBe(
      10_000
    )
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it("follows the page the API returned, and only when it moved", () => {
    const queue = { total: 100, page: 4, pages: 4, pageSize: 25 }
    expect(() => followQueuePage("/clinics", 4, queue)).not.toThrow()
    expect(() => followQueuePage("/clinics", 9, queue)).toThrow(
      "redirect:/clinics?page=4"
    )
    // Back to the first page is the clean address.
    expect(() =>
      followQueuePage("/clinics", 3, { ...queue, total: 4, page: 1, pages: 1 })
    ).toThrow("redirect:/clinics")
  })
})

describe("a queue's tab title", () => {
  beforeEach(() => vi.clearAllMocks())

  it("names the page from the address", async () => {
    await expect(queueTitle("Clinics", at())).resolves.toBe("Clinics")
    await expect(queueTitle("Clinics", at("1"))).resolves.toBe("Clinics")
    await expect(queueTitle("Clinics", at("abc"))).resolves.toBe("Clinics")
    await expect(queueTitle("Clinics", at("3"))).resolves.toBe(
      'queue.titleWithPage:{"title":"Clinics","page":3}'
    )
  })

  it("never reads a queue: a title can be asked for ahead of a visit", async () => {
    await expect(
      clinicsMetadata({ searchParams: at("2") })
    ).resolves.toMatchObject({
      title: 'queue.titleWithPage:{"title":"clinics.title","page":2}',
    })
    await expect(
      partnersMetadata({ searchParams: at("2") })
    ).resolves.toMatchObject({
      title: 'queue.titleWithPage:{"title":"partners.title","page":2}',
    })
    expect(mocks.api).not.toHaveBeenCalled()
  })
})

describe("a queue's footer", () => {
  it("says the range, with both ways on, in the middle", async () => {
    await expect(
      pagerProps({ total: 112, page: 2, pages: 5 })
    ).resolves.toMatchObject({
      range: 'queue.range:{"from":26,"to":50,"total":112}',
      end: undefined,
      links: { previous: "/clinics", next: "/clinics?page=3" },
    })
  })

  it("has no way back on the first page, and none on after the last", async () => {
    expect((await pagerProps({ total: 112, page: 1, pages: 5 })).links).toEqual(
      { previous: null, next: "/clinics?page=2" }
    )
    await expect(
      pagerProps({ total: 112, page: 5, pages: 5 })
    ).resolves.toMatchObject({
      range: 'queue.range:{"from":101,"to":112,"total":112}',
      end: "queue.end",
      links: { previous: "/clinics?page=4", next: null },
    })
  })

  it("shows no controls and no end for a queue that fits on one page", async () => {
    const one = await pagerProps({ total: 12, page: 1, pages: 1 })
    expect(one.links).toBeUndefined()
    expect(one.end).toBeUndefined()
  })

  it("words one row as one row", async () => {
    expect((await pagerProps({ total: 1, page: 1, pages: 1 })).range).toBe(
      'queue.rangeSingle:{"to":1,"total":1}'
    )
    // A last page with one row is a position, not a count of rows shown.
    expect((await pagerProps({ total: 26, page: 2, pages: 2 })).range).toBe(
      'queue.rangeLastRow:{"to":26,"total":26}'
    )
  })
})
