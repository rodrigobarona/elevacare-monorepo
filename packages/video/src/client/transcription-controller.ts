import {
  parseTranscriptionMessage,
  type TranscriptionLine,
} from "./transcription-message"
import {
  initialModelTier,
  isAlreadyRunningError,
  isMedicalModel,
  nextModelTier,
  primaryLanguage,
  rememberLanguage,
  runDailyMethod,
  transcriptionOptions,
  type DailyTranscriptionStartOptions,
  type TranscriptLanguageMode,
  type TranscriptSettings,
} from "./transcription-settings"

/** Restart anyway if Daily never confirms the stop. */
export const RESTART_FALLBACK_MS = 4000
/** Same-model restarts after a transcript that was producing lines. */
export const MAX_SAME_TIER_RETRIES = 2

export type TranscriptionEventHandlers = {
  started: (ev: unknown) => void
  error: (ev: unknown) => void
  stopped: (ev: unknown) => void
  message: (ev: unknown) => void
}

/** The slice of Daily the controller needs; tests pass a fake. */
export type TranscriptionPort = {
  start: (options: DailyTranscriptionStartOptions) => unknown
  stop: () => unknown
  speakerName: (participantId: string) => string | null
  subscribe: (handlers: TranscriptionEventHandlers) => () => void
}

export type TranscriptionSnapshot = TranscriptSettings & {
  /** Recent detected languages, newest last. */
  recent: readonly string[]
  failed: boolean
  suggestionDismissed: boolean
  /** Mode the expert last switched to, for a polite live-region notice. */
  switchedTo: TranscriptLanguageMode | null
}

/** What produced the transcript lines that follow it. */
export type TranscriptMarker = {
  settings: TranscriptSettings
  medical: boolean
}

export type LiveTranscriptController = {
  connect: () => void
  dispose: () => void
  setMode: (mode: TranscriptLanguageMode) => void
  dismissSuggestion: () => void
  stop: () => Promise<void>
}

export function initialTranscriptionSnapshot(
  sessionLanguage: string | null
): TranscriptionSnapshot {
  return {
    mode: "auto",
    tier: initialModelTier(sessionLanguage),
    recent: [],
    failed: false,
    suggestionDismissed: false,
    switchedTo: null,
  }
}

/** Snapshot after the expert picks a language setting. */
export function withModeChange(
  snapshot: TranscriptionSnapshot,
  mode: TranscriptLanguageMode
): TranscriptionSnapshot {
  return {
    ...snapshot,
    mode,
    recent: [],
    suggestionDismissed: true,
    switchedTo: mode,
  }
}

function readField(ev: unknown, key: string): unknown {
  return ev && typeof ev === "object"
    ? (ev as Record<string, unknown>)[key]
    : undefined
}

/**
 * Expert-side live transcript state machine:
 * - starts the best model for the booked language;
 * - a model that never produced a line steps down a tier when Daily
 *   reports an error (e.g. the model is refused);
 * - a model that has produced lines retries itself, up to
 *   {@link MAX_SAME_TIER_RETRIES} times between lines, then steps down;
 * - a language change stops the transcript and starts the latest choice
 *   once Daily confirms the stop, or after {@link RESTART_FALLBACK_MS};
 * - before the first line of each start, `onMarker` reports the setting.
 */
export function createLiveTranscriptController(input: {
  port: TranscriptionPort
  sessionLanguage: string | null
  initial: TranscriptionSnapshot
  onLine: (line: TranscriptionLine) => void
  onMarker: (marker: TranscriptMarker) => void
  onChange: (snapshot: TranscriptionSnapshot) => void
}): LiveTranscriptController {
  let snapshot = input.initial
  let active: TranscriptSettings | null = null
  /** Tier that has produced lines this session; it keeps its retries. */
  let producedTier: TranscriptSettings["tier"] | null = null
  let retries = 0
  let pendingMarker: TranscriptMarker | null = null
  let pendingRestart: TranscriptSettings | null = null
  let restartTimer: ReturnType<typeof setTimeout> | undefined
  let unsubscribe: (() => void) | null = null
  let disposed = false

  const update = (next: TranscriptionSnapshot) => {
    snapshot = next
    input.onChange(snapshot)
  }

  const clearRestartTimer = () => {
    if (restartTimer === undefined) return
    clearTimeout(restartTimer)
    restartTimer = undefined
  }

  const start = (settings: TranscriptSettings) => {
    if (disposed) return
    active = settings
    pendingMarker = null
    if (snapshot.tier !== settings.tier) {
      update({ ...snapshot, tier: settings.tier })
    }
    void runDailyMethod(() =>
      input.port.start(
        transcriptionOptions({
          ...settings,
          sessionLanguage: input.sessionLanguage,
        })
      )
    ).catch(() => {
      if (!disposed) update({ ...snapshot, failed: true })
    })
  }

  const stopDaily = () =>
    runDailyMethod(() => input.port.stop()).catch(() => {
      /* room teardown, or the restart timer starts the next setting */
    })

  const handlers: TranscriptionEventHandlers = {
    started(ev) {
      const settings = active ?? { mode: snapshot.mode, tier: snapshot.tier }
      const model = readField(ev, "model")
      pendingMarker = {
        settings,
        medical:
          typeof model === "string"
            ? isMedicalModel(model)
            : settings.tier === "medical",
      }
    },
    error(ev) {
      if (isAlreadyRunningError(readField(ev, "errorMsg"))) return
      const failed = active
      active = null
      if (!failed) {
        update({ ...snapshot, failed: true })
        return
      }
      if (producedTier === failed.tier && retries < MAX_SAME_TIER_RETRIES) {
        retries += 1
        start(failed)
        return
      }
      const next = nextModelTier(failed.tier)
      if (next) {
        start({ mode: failed.mode, tier: next })
        return
      }
      update({ ...snapshot, failed: true })
    },
    stopped() {
      const settings = pendingRestart
      if (!settings) return
      pendingRestart = null
      clearRestartTimer()
      start(settings)
    },
    message(ev) {
      const line = parseTranscriptionMessage(ev, input.port.speakerName)
      if (!line?.isFinal) return
      producedTier = active?.tier ?? snapshot.tier
      retries = 0
      if (pendingMarker) {
        input.onMarker(pendingMarker)
        pendingMarker = null
      }
      const language = primaryLanguage(line.language)
      if (language || snapshot.failed) {
        update({
          ...snapshot,
          failed: false,
          recent: language
            ? rememberLanguage(snapshot.recent, language)
            : snapshot.recent,
        })
      }
      input.onLine(line)
    },
  }

  return {
    connect() {
      if (disposed || unsubscribe) return
      unsubscribe = input.port.subscribe(handlers)
      start({ mode: snapshot.mode, tier: snapshot.tier })
    },
    dispose() {
      disposed = true
      clearRestartTimer()
      unsubscribe?.()
      unsubscribe = null
    },
    setMode(mode) {
      if (mode === snapshot.mode) return
      retries = 0
      update(withModeChange(snapshot, mode))
      if (disposed || !unsubscribe) return
      const settings: TranscriptSettings = { mode, tier: snapshot.tier }
      if (pendingRestart) {
        // A stop is still in flight: restart with the latest choice only.
        pendingRestart = settings
        return
      }
      if (!active) {
        start(settings)
        return
      }
      // Daily cannot change the language of a running transcript.
      pendingRestart = settings
      active = null
      clearRestartTimer()
      restartTimer = setTimeout(() => {
        restartTimer = undefined
        const next = pendingRestart
        if (!next) return
        pendingRestart = null
        start(next)
      }, RESTART_FALLBACK_MS)
      void stopDaily()
    },
    dismissSuggestion() {
      if (!snapshot.suggestionDismissed) {
        update({ ...snapshot, suggestionDismissed: true })
      }
    },
    async stop() {
      pendingRestart = null
      clearRestartTimer()
      if (!active) return
      active = null
      await stopDaily()
    },
  }
}
