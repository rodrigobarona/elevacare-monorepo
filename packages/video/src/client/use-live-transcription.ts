"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { DailyCall } from "@daily-co/daily-js"
import { callDisplayName } from "./call-display-name"
import type { ElevaCallLabels } from "./labels"
import type { TranscriptionLine } from "./transcription-message"
import {
  createLiveTranscriptController,
  initialTranscriptionSnapshot,
  withModeChange,
  type LiveTranscriptController,
  type TranscriptionPort,
  type TranscriptMarker,
} from "./transcription-controller"
import {
  detectsLanguage,
  dominantLanguage,
  legacyLanguageCode,
  primaryLanguage,
  suggestsEnglishOnly,
  type TranscriptLanguageMode,
  type TranscriptModelTier,
} from "./transcription-settings"

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

function dailyTranscriptionPort(
  daily: DailyCall,
  labels: () => ElevaCallLabels
): TranscriptionPort {
  return {
    start: (options) => daily.startTranscription(options),
    stop: () => daily.stopTranscription(),
    speakerName(participantId) {
      const all = daily.participants()
      if (all.local?.session_id === participantId) {
        return callDisplayName(all.local.user_name, labels().you)
      }
      const remote = all[participantId]
      return remote ? callDisplayName(remote.user_name, labels().remote) : null
    },
    subscribe(handlers) {
      daily.on("transcription-started", handlers.started)
      daily.on("transcription-error", handlers.error)
      daily.on("transcription-stopped", handlers.stopped)
      daily.on("transcription-message", handlers.message)
      return () => {
        daily.off("transcription-started", handlers.started)
        daily.off("transcription-error", handlers.error)
        daily.off("transcription-stopped", handlers.stopped)
        daily.off("transcription-message", handlers.message)
      }
    },
  }
}

function markerText(
  labels: ElevaCallLabels,
  marker: TranscriptMarker,
  sessionLanguage: string | null
): string {
  const { settings } = marker
  const setting =
    settings.mode === "english"
      ? labels.transcriptLanguageEnglish
      : settings.tier === "legacy"
        ? labels.languageName(legacyLanguageCode(sessionLanguage))
        : labels.transcriptMarkerAuto
  return labels.transcriptMarker(
    setting,
    marker.medical
      ? labels.transcriptVocabularyMedical
      : labels.transcriptVocabularyStandard
  )
}

/**
 * Expert-side live transcript over Daily (Deepgram, EU). The state machine
 * lives in `transcription-controller.ts`; this hook connects it to Daily
 * while the call is joined and the member allows AI processing.
 */
export function useLiveTranscription(input: {
  daily: DailyCall | null
  enabled: boolean
  sessionLanguage: string | null
  labels: ElevaCallLabels
  onLine: (line: TranscriptionLine) => void
  onMarker: (note: string) => void
}): LiveTranscription {
  const { daily, enabled, sessionLanguage, labels } = input
  const [snapshot, setSnapshot] = useState(() =>
    initialTranscriptionSnapshot(sessionLanguage)
  )
  const controllerRef = useRef<LiveTranscriptController | null>(null)
  const snapshotRef = useRef(snapshot)
  const labelsRef = useRef(labels)
  const onLineRef = useRef(input.onLine)
  const onMarkerRef = useRef(input.onMarker)

  // Daily handlers read the last committed values.
  useEffect(() => {
    snapshotRef.current = snapshot
    labelsRef.current = labels
    onLineRef.current = input.onLine
    onMarkerRef.current = input.onMarker
  })

  useEffect(() => {
    if (!enabled || !daily) return
    const controller = createLiveTranscriptController({
      port: dailyTranscriptionPort(daily, () => labelsRef.current),
      sessionLanguage,
      initial: snapshotRef.current,
      onLine: (line) => onLineRef.current(line),
      onMarker: (marker) =>
        onMarkerRef.current(
          markerText(labelsRef.current, marker, sessionLanguage)
        ),
      onChange: setSnapshot,
    })
    controllerRef.current = controller
    controller.connect()
    return () => {
      controller.dispose()
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [daily, enabled, sessionLanguage])

  const setMode = useCallback((mode: TranscriptLanguageMode) => {
    const controller = controllerRef.current
    if (controller) {
      controller.setMode(mode)
      return
    }
    setSnapshot((curr) =>
      curr.mode === mode ? curr : withModeChange(curr, mode)
    )
  }, [])

  const dismissSuggestion = useCallback(() => {
    const controller = controllerRef.current
    if (controller) {
      controller.dismissSuggestion()
      return
    }
    setSnapshot((curr) => ({ ...curr, suggestionDismissed: true }))
  }, [])

  const stop = useCallback(async () => {
    await controllerRef.current?.stop()
  }, [])

  const detecting = detectsLanguage(snapshot)
  return {
    mode: snapshot.mode,
    tier: snapshot.tier,
    expectedLanguage: primaryLanguage(sessionLanguage),
    detectedLanguage: detecting ? dominantLanguage(snapshot.recent) : null,
    detecting,
    failed: snapshot.failed,
    suggestEnglishOnly:
      !snapshot.suggestionDismissed &&
      suggestsEnglishOnly(snapshot, snapshot.recent),
    notice:
      snapshot.switchedTo === "english"
        ? labels.transcriptNowEnglish
        : snapshot.switchedTo === "auto"
          ? labels.transcriptNowAuto
          : "",
    setMode,
    dismissSuggestion,
    stop,
  }
}
