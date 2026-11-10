"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { DailyCall } from "@daily-co/daily-js"
import { callDisplayName } from "./call-display-name"
import type { ElevaCallLabels } from "./labels"
import {
  parseTranscriptionMessage,
  type TranscriptionLine,
} from "./transcription-message"
import {
  detectsLanguage,
  dominantLanguage,
  initialModelTier,
  isAlreadyRunningError,
  isMedicalModel,
  legacyLanguageCode,
  nextModelTier,
  primaryLanguage,
  rememberLanguage,
  runDailyMethod,
  suggestsEnglishOnly,
  transcriptionOptions,
  type TranscriptLanguageMode,
  type TranscriptModelTier,
  type TranscriptSettings,
} from "./transcription-settings"

/** Restart anyway if Daily never confirms the stop. */
const RESTART_FALLBACK_MS = 4000
/** Same-model restarts after a transcript that had started then failed. */
const MAX_SAME_TIER_RETRIES = 2

export type LiveTranscription = {
  mode: TranscriptLanguageMode
  tier: TranscriptModelTier
  /** Booked language (primary subtag), shown before anything is detected. */
  expectedLanguage: string | null
  detectedLanguage: string | null
  detecting: boolean
  failed: boolean
  suggestEnglishOnly: boolean
  /** Polite live-region text after the expert changes the language. */
  notice: string
  setMode: (mode: TranscriptLanguageMode) => void
  dismissSuggestion: () => void
  stop: () => Promise<void>
}

/**
 * Expert-side live transcript. Starts Deepgram's medical model through
 * Daily, steps down a model tier when Daily reports an error, restarts
 * when the expert changes the language, and writes a marker line each
 * time a transcript starts so the record shows what produced it.
 */
export function useLiveTranscription(input: {
  daily: DailyCall | null
  enabled: boolean
  sessionLanguage: string | null
  labels: ElevaCallLabels
  onLine: (line: TranscriptionLine) => void
  onMarker: (note: string) => void
}): LiveTranscription {
  const { daily, enabled, sessionLanguage } = input
  const [mode, setModeState] = useState<TranscriptLanguageMode>("auto")
  const [tier, setTier] = useState<TranscriptModelTier>(() =>
    initialModelTier(sessionLanguage)
  )
  const [recent, setRecent] = useState<string[]>([])
  const [failed, setFailed] = useState(false)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const [notice, setNotice] = useState("")

  const settingsRef = useRef<TranscriptSettings>({ mode, tier })
  const activeRef = useRef<TranscriptSettings | null>(null)
  /** Daily confirmed the active settings with `transcription-started`. */
  const confirmedRef = useRef(false)
  const retriesRef = useRef(0)
  const pendingRestartRef = useRef<TranscriptSettings | null>(null)
  const restartTimerRef = useRef<number | undefined>(undefined)
  const startRef = useRef<(settings: TranscriptSettings) => void>(() => {})
  const labelsRef = useRef(input.labels)
  const onLineRef = useRef(input.onLine)
  const onMarkerRef = useRef(input.onMarker)
  labelsRef.current = input.labels
  onLineRef.current = input.onLine
  onMarkerRef.current = input.onMarker

  useEffect(() => {
    if (!enabled || !daily) return
    let disposed = false

    const start = (settings: TranscriptSettings) => {
      if (disposed) return
      settingsRef.current = settings
      activeRef.current = settings
      confirmedRef.current = false
      setTier(settings.tier)
      void runDailyMethod(() =>
        daily.startTranscription(
          transcriptionOptions({ ...settings, sessionLanguage })
        )
      ).catch(() => {
        if (!disposed) setFailed(true)
      })
    }
    startRef.current = start

    const resolveSpeaker = (participantId: string): string | null => {
      const labels = labelsRef.current
      const all = daily.participants()
      if (all.local?.session_id === participantId) {
        return callDisplayName(all.local.user_name, labels.you)
      }
      const remote = all[participantId]
      return remote ? callDisplayName(remote.user_name, labels.remote) : null
    }

    const onStarted = (ev: unknown) => {
      const labels = labelsRef.current
      const settings = activeRef.current ?? settingsRef.current
      const model = (ev as { model?: unknown } | null)?.model
      const medical =
        typeof model === "string"
          ? isMedicalModel(model)
          : settings.tier === "medical"
      confirmedRef.current = true
      const setting =
        settings.mode === "english"
          ? labels.transcriptLanguageEnglish
          : settings.tier === "legacy"
            ? labels.languageName(legacyLanguageCode(sessionLanguage))
            : labels.transcriptMarkerAuto
      setFailed(false)
      onMarkerRef.current(
        labels.transcriptMarker(
          setting,
          medical
            ? labels.transcriptVocabularyMedical
            : labels.transcriptVocabularyStandard
        )
      )
    }

    const onError = (ev: unknown) => {
      if (isAlreadyRunningError((ev as { errorMsg?: unknown })?.errorMsg)) {
        return
      }
      const active = activeRef.current
      activeRef.current = null
      if (!active) {
        setFailed(true)
        return
      }
      // A transcript that had started and then dropped keeps its model;
      // one Daily never started (e.g. model refused) steps down a tier.
      if (confirmedRef.current && retriesRef.current < MAX_SAME_TIER_RETRIES) {
        retriesRef.current += 1
        start(active)
        return
      }
      const next = nextModelTier(active.tier)
      if (next) {
        start({ mode: active.mode, tier: next })
        return
      }
      setFailed(true)
    }

    const onStopped = () => {
      const pending = pendingRestartRef.current
      if (!pending) return
      pendingRestartRef.current = null
      window.clearTimeout(restartTimerRef.current)
      start(pending)
    }

    const onMessage = (ev: unknown) => {
      const line = parseTranscriptionMessage(ev, resolveSpeaker)
      if (!line?.isFinal) return
      setFailed(false)
      if (line.language) {
        const language = primaryLanguage(line.language)
        if (language) setRecent((curr) => rememberLanguage(curr, language))
      }
      onLineRef.current(line)
    }

    daily.on("transcription-started", onStarted)
    daily.on("transcription-error", onError)
    daily.on("transcription-stopped", onStopped)
    daily.on("transcription-message", onMessage)
    start(settingsRef.current)

    return () => {
      disposed = true
      startRef.current = () => {}
      window.clearTimeout(restartTimerRef.current)
      daily.off("transcription-started", onStarted)
      daily.off("transcription-error", onError)
      daily.off("transcription-stopped", onStopped)
      daily.off("transcription-message", onMessage)
    }
  }, [daily, enabled, sessionLanguage])

  const setMode = useCallback(
    (next: TranscriptLanguageMode) => {
      const current = settingsRef.current
      if (next === current.mode) return
      const settings = { mode: next, tier: current.tier }
      settingsRef.current = settings
      setModeState(next)
      setRecent([])
      setSuggestionDismissed(true)
      setNotice(
        next === "english"
          ? labelsRef.current.transcriptNowEnglish
          : labelsRef.current.transcriptNowAuto
      )
      if (!enabled || !daily) return
      if (pendingRestartRef.current) {
        // A stop is still in flight: restart with the latest choice only.
        pendingRestartRef.current = settings
        return
      }
      if (!activeRef.current) {
        startRef.current(settings)
        return
      }
      // Daily cannot change the language of a running transcript: stop it,
      // then start again once Daily confirms (or after a short wait).
      pendingRestartRef.current = settings
      activeRef.current = null
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = window.setTimeout(() => {
        const pending = pendingRestartRef.current
        if (!pending) return
        pendingRestartRef.current = null
        startRef.current(pending)
      }, RESTART_FALLBACK_MS)
      void runDailyMethod(() => daily.stopTranscription()).catch(() => {
        /* the restart timer still starts the new setting */
      })
    },
    [daily, enabled]
  )

  const stop = useCallback(async () => {
    pendingRestartRef.current = null
    window.clearTimeout(restartTimerRef.current)
    if (!daily || !activeRef.current) return
    activeRef.current = null
    await runDailyMethod(() => daily.stopTranscription()).catch(() => {
      /* room teardown */
    })
  }, [daily])

  const dismissSuggestion = useCallback(() => {
    setSuggestionDismissed(true)
  }, [])

  const settings = { mode, tier }
  const detecting = detectsLanguage(settings)
  return {
    mode,
    tier,
    expectedLanguage: primaryLanguage(sessionLanguage),
    detectedLanguage: detecting ? dominantLanguage(recent) : null,
    detecting,
    failed,
    suggestEnglishOnly:
      !suggestionDismissed && suggestsEnglishOnly(settings, recent),
    notice,
    setMode,
    dismissSuggestion,
    stop,
  }
}
