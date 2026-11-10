import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  MAX_SAME_TIER_RETRIES,
  RESTART_FALLBACK_MS,
  createLiveTranscriptController,
  initialTranscriptionSnapshot,
  type TranscriptionEventHandlers,
  type TranscriptionPort,
  type TranscriptionSnapshot,
  type TranscriptMarker,
} from "./client/transcription-controller"
import type { TranscriptionLine } from "./client/transcription-message"
import type { DailyTranscriptionStartOptions } from "./client/transcription-settings"

function fakeDaily() {
  const starts: DailyTranscriptionStartOptions[] = []
  let stops = 0
  let handlers: TranscriptionEventHandlers | null = null
  const port: TranscriptionPort = {
    start: (options) => {
      starts.push(options)
    },
    stop: () => {
      stops += 1
    },
    speakerName: (id) => (id === "expert" ? "Dr. Ana" : "Maria"),
    subscribe: (next) => {
      handlers = next
      return () => {
        handlers = null
      }
    },
  }
  const emit = handlersProxy(() => handlers)
  return {
    port,
    starts,
    stopCount: () => stops,
    emit,
    subscribed: () => handlers !== null,
  }
}

function handlersProxy(get: () => TranscriptionEventHandlers | null) {
  return {
    started: (model?: string) => get()?.started({ model }),
    error: (errorMsg = "deepgram connection failed") =>
      get()?.error({ errorMsg }),
    stopped: () => get()?.stopped({}),
    line: (text: string, language = "pt") =>
      get()?.message({
        participantId: "expert",
        text,
        rawResponse: {
          is_final: true,
          channel: { alternatives: [{ languages: [language] }] },
        },
      }),
  }
}

function setup(sessionLanguage: string | null = "pt") {
  const daily = fakeDaily()
  const lines: TranscriptionLine[] = []
  const markers: TranscriptMarker[] = []
  let snapshot: TranscriptionSnapshot =
    initialTranscriptionSnapshot(sessionLanguage)
  const controller = createLiveTranscriptController({
    port: daily.port,
    sessionLanguage,
    initial: snapshot,
    onLine: (line) => lines.push(line),
    onMarker: (marker) => markers.push(marker),
    onChange: (next) => {
      snapshot = next
    },
  })
  return {
    ...daily,
    controller,
    lines,
    markers,
    snapshot: () => snapshot,
    models: () => daily.starts.map((s) => `${s.model}/${s.language}`),
  }
}

/** Lets `runDailyMethod` promises settle. */
async function flush() {
  await Promise.resolve()
  await Promise.resolve()
}

describe("createLiveTranscriptController", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts the medical model detecting the language", () => {
    const t = setup("pt")
    t.controller.connect()
    expect(t.subscribed()).toBe(true)
    expect(t.models()).toEqual(["nova-3-medical/multi"])
    expect(t.starts[0]).toMatchObject({ transcription_geo: "eu" })
  })

  it("starts the general model with a hint for other languages", () => {
    const t = setup("pl")
    t.controller.connect()
    expect(t.starts[0]).toMatchObject({
      model: "nova-3",
      language: "multi",
      extra: { language_hint: "pl" },
    })
  })

  it("steps down a tier when a start never produced a line", () => {
    const t = setup()
    t.controller.connect()
    t.emit.started("nova-3-medical")
    t.emit.error("model not available")
    t.emit.error("model not available")
    expect(t.models()).toEqual([
      "nova-3-medical/multi",
      "nova-3/multi",
      "nova-2/pt-PT",
    ])
    expect(t.snapshot().tier).toBe("legacy")
    t.emit.error()
    expect(t.snapshot().failed).toBe(true)
  })

  it("retries the same model after a transcript that was producing lines", () => {
    const t = setup()
    t.controller.connect()
    t.emit.started("nova-3-medical")
    t.emit.line("bom dia")
    t.emit.error()
    expect(t.models()).toEqual(["nova-3-medical/multi", "nova-3-medical/multi"])
    expect(t.snapshot().tier).toBe("medical")
  })

  it("resets the retry budget each time lines arrive again", () => {
    const t = setup()
    t.controller.connect()
    for (let drop = 0; drop < MAX_SAME_TIER_RETRIES + 3; drop += 1) {
      t.emit.started("nova-3-medical")
      t.emit.line(`linha ${drop}`)
      t.emit.error()
    }
    expect(new Set(t.models())).toEqual(new Set(["nova-3-medical/multi"]))
  })

  it("steps down once same-model retries run out without new lines", () => {
    const t = setup()
    t.controller.connect()
    t.emit.line("bom dia")
    for (let i = 0; i <= MAX_SAME_TIER_RETRIES; i += 1) t.emit.error()
    expect(t.models().at(-1)).toBe("nova-3/multi")
  })

  it("ignores Daily's already-running error", () => {
    const t = setup()
    t.controller.connect()
    t.emit.error("Transcription already started")
    expect(t.models()).toEqual(["nova-3-medical/multi"])
    expect(t.snapshot().failed).toBe(false)
  })

  it("writes the setting marker before the first line of each start", () => {
    const t = setup()
    t.controller.connect()
    t.emit.started("nova-3-medical")
    expect(t.markers).toHaveLength(0)
    t.emit.line("bom dia")
    t.emit.line("tudo bem")
    expect(t.markers).toEqual([
      { settings: { mode: "auto", tier: "medical" }, medical: true },
    ])
    expect(t.lines.map((l) => l.speaker)).toEqual(["Dr. Ana", "Dr. Ana"])
  })

  it("restarts with the new language once Daily confirms the stop", () => {
    const t = setup()
    t.controller.connect()
    t.emit.started("nova-3-medical")
    t.controller.setMode("english")
    expect(t.stopCount()).toBe(1)
    expect(t.starts).toHaveLength(1)
    t.emit.stopped()
    expect(t.models().at(-1)).toBe("nova-3-medical/en")
    expect(t.snapshot()).toMatchObject({
      mode: "english",
      switchedTo: "english",
    })
  })

  it("starts only the latest choice when the expert switches twice", () => {
    const t = setup()
    t.controller.connect()
    t.emit.started("nova-3-medical")
    t.controller.setMode("english")
    t.controller.setMode("auto")
    expect(t.starts).toHaveLength(1)
    t.emit.stopped()
    expect(t.models()).toEqual(["nova-3-medical/multi", "nova-3-medical/multi"])
    expect(t.snapshot().mode).toBe("auto")
  })

  it("restarts after a short wait if Daily never confirms the stop", () => {
    const t = setup()
    t.controller.connect()
    t.controller.setMode("english")
    vi.advanceTimersByTime(RESTART_FALLBACK_MS - 1)
    expect(t.starts).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(t.models().at(-1)).toBe("nova-3-medical/en")
  })

  it("does not restart after stop(), even when Daily confirms later", async () => {
    const t = setup()
    t.controller.connect()
    t.controller.setMode("english")
    await t.controller.stop()
    t.emit.stopped()
    vi.advanceTimersByTime(RESTART_FALLBACK_MS)
    expect(t.starts).toHaveLength(1)
  })

  it("stops Daily on leave", async () => {
    const t = setup()
    t.controller.connect()
    await t.controller.stop()
    expect(t.stopCount()).toBe(1)
    await t.controller.stop()
    expect(t.stopCount()).toBe(1)
  })

  it("tracks detected languages for the in-call label", () => {
    const t = setup()
    t.controller.connect()
    t.emit.line("bom dia", "pt")
    t.emit.line("good morning", "en-GB")
    expect(t.snapshot().recent).toEqual(["pt", "en"])
  })

  it("marks the transcript failed when Daily throws on start", async () => {
    const t = setup()
    t.port.start = () => {
      throw new Error("only supported after join")
    }
    t.controller.connect()
    await flush()
    expect(t.snapshot().failed).toBe(true)
  })

  it("unsubscribes and ignores events after dispose", () => {
    const t = setup()
    t.controller.connect()
    t.controller.dispose()
    expect(t.subscribed()).toBe(false)
    t.controller.setMode("english")
    expect(t.starts).toHaveLength(1)
  })
})
