// How many times each run has been rendered. `?fail=2` fails the first two
// renders of a `?run=`, so a retry can be seen failing once, then working.
// `?delay=` (ms) holds each render after the first back, so what shows while
// the page loads again can be seen.
const renders = new Map<string, number>()

export async function FailingPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; fail?: string; delay?: string }>
}) {
  const { run = "default", fail = "1", delay = "0" } = await searchParams
  const seen = renders.get(run) ?? 0
  renders.set(run, seen + 1)
  if (seen > 0) {
    await new Promise((resolve) => setTimeout(resolve, Number(delay)))
  }
  if (seen < Number(fail)) {
    throw new Error("Fixture: this page fails on purpose")
  }
  return <h1 className="font-heading text-2xl">The page loaded</h1>
}
