/** Collects `Server-Timing` entries (durations only, safe on public routes). */
export interface ServerTiming {
  time<T>(name: string, fn: () => Promise<T>): Promise<T>
  apply(response: Response): Response
}

export function createServerTiming(): ServerTiming {
  const entries: string[] = []
  return {
    async time(name, fn) {
      const start = performance.now()
      try {
        return await fn()
      } finally {
        entries.push(`${name};dur=${(performance.now() - start).toFixed(1)}`)
      }
    },
    apply(response) {
      if (entries.length > 0) {
        response.headers.set("Server-Timing", entries.join(", "))
      }
      return response
    },
  }
}
