"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import {
  DailyAudio,
  DailyProvider,
  DailyVideo,
  useAppMessage,
  useDaily,
  useLocalSessionId,
  useMeetingState,
  useParticipantIds,
  useScreenShare,
  useVideoTrack,
  useAudioTrack,
} from "@daily-co/daily-react"
import {
  ChatCircleIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  MonitorIcon,
  PhoneDisconnectIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
} from "@eleva/icons"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Textarea } from "@eleva/ui/components/textarea"
import type { ElevaCallLabels } from "./labels"
import {
  EMPTY_INTERNAL_REPORT,
  serializeInternalReport,
  type InternalReportDraft,
} from "./internal-report"
import {
  appendTranscriptLine,
  parseTranscriptionMessage,
} from "./transcription-message"

export type { ElevaCallLabels, ElevaCallErrorCode } from "./labels"

export type SessionRecordBundle = {
  intake: string
  note: string
  transcript: string
  internalReport: InternalReportDraft
}

export type ElevaCallRecords = {
  load: () => Promise<SessionRecordBundle>
  save: (
    kind: "note" | "transcript" | "internal_report",
    body: string
  ) => Promise<void>
}

export type ElevaCallProps = {
  roomUrl: string
  token: string
  labels: ElevaCallLabels
  onLeft?: () => void
  showNotesSlot?: boolean
  records?: ElevaCallRecords
  backHref: string
}

type ChatMessage = {
  id: string
  fromLocal: boolean
  text: string
}

export function ElevaCall({
  roomUrl,
  token,
  labels,
  onLeft,
  showNotesSlot = false,
  records,
  backHref,
}: ElevaCallProps) {
  return (
    <DailyProvider url={roomUrl} token={token}>
      <CallShell
        labels={labels}
        onLeft={onLeft}
        showNotesSlot={showNotesSlot}
        records={records}
        backHref={backHref}
      />
    </DailyProvider>
  )
}

function CallShell({
  labels,
  onLeft,
  showNotesSlot,
  records,
  backHref,
}: Omit<ElevaCallProps, "roomUrl" | "token">) {
  const daily = useDaily()
  const meetingState = useMeetingState()
  const localId = useLocalSessionId()
  const remoteIds = useParticipantIds({ filter: "remote" })
  const { isSharingScreen, startScreenShare, stopScreenShare, screens } =
    useScreenShare()
  const cam = useVideoTrack(localId)
  const mic = useAudioTrack(localId)

  const [chatOpen, setChatOpen] = useState(false)
  const [chatDraft, setChatDraft] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [joinFailed, setJoinFailed] = useState(false)
  const [intake, setIntake] = useState("")
  const [note, setNote] = useState("")
  const [transcript, setTranscript] = useState("")
  const [internalReport, setInternalReport] = useState<InternalReportDraft>(
    EMPTY_INTERNAL_REPORT
  )
  const [notesDirty, setNotesDirty] = useState(false)
  const [reportDirty, setReportDirty] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const noteRef = useRef(note)
  const transcriptRef = useRef(transcript)
  const reportRef = useRef(internalReport)
  const notesDirtyRef = useRef(false)
  const reportDirtyRef = useRef(false)
  const recordsLoadedRef = useRef(false)
  const lastSavedTranscriptRef = useRef("")
  const [recordsReady, setRecordsReady] = useState(false)
  noteRef.current = note
  transcriptRef.current = transcript
  reportRef.current = internalReport
  notesDirtyRef.current = notesDirty
  reportDirtyRef.current = reportDirty

  const sendAppMessage = useAppMessage({
    onAppMessage: useCallback((ev: { data?: unknown }) => {
      const text =
        ev.data &&
        typeof ev.data === "object" &&
        "text" in ev.data &&
        typeof (ev.data as { text: unknown }).text === "string"
          ? (ev.data as { text: string }).text
          : null
      if (!text) return
      setMessages((curr) => [
        ...curr,
        { id: crypto.randomUUID(), fromLocal: false, text },
      ])
    }, []),
  })

  useEffect(() => {
    if (!showNotesSlot || !records) return
    const recordsApi = records
    let cancelled = false
    let attempt = 0
    let retryTimer: number | undefined
    function load() {
      void recordsApi
        .load()
        .then((bundle) => {
          if (cancelled) return
          recordsLoadedRef.current = true
          lastSavedTranscriptRef.current = bundle.transcript
          setIntake(bundle.intake)
          setTranscript((curr) => {
            const live = curr.trim()
            const stored = bundle.transcript.trim()
            if (!live) return bundle.transcript
            if (!stored) return curr
            if (live.startsWith(stored)) return curr
            return `${stored}\n${live}`
          })
          if (!notesDirtyRef.current) setNote(bundle.note)
          if (!reportDirtyRef.current) {
            setInternalReport(bundle.internalReport)
          }
          setRecordsReady(true)
          setSaveFailed(false)
        })
        .catch(() => {
          if (cancelled) return
          setSaveFailed(true)
          if (attempt >= 8) return
          attempt += 1
          retryTimer = window.setTimeout(load, 1500)
        })
    }
    load()
    return () => {
      cancelled = true
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
    }
  }, [showNotesSlot, records])

  useEffect(() => {
    if (!showNotesSlot || !records || !notesDirty || !recordsReady) return
    const timer = window.setTimeout(() => {
      const body = noteRef.current
      void records
        .save("note", body)
        .then(() => {
          if (noteRef.current === body) setNotesDirty(false)
          setSaveFailed(false)
        })
        .catch(() => setSaveFailed(true))
    }, 800)
    return () => window.clearTimeout(timer)
  }, [note, notesDirty, records, recordsReady, showNotesSlot])

  useEffect(() => {
    if (!showNotesSlot || !records || !reportDirty || !recordsReady) return
    const timer = window.setTimeout(() => {
      const body = serializeInternalReport(reportRef.current)
      void records
        .save("internal_report", body)
        .then(() => {
          if (serializeInternalReport(reportRef.current) === body) {
            setReportDirty(false)
          }
          setSaveFailed(false)
        })
        .catch(() => setSaveFailed(true))
    }, 800)
    return () => window.clearTimeout(timer)
  }, [internalReport, reportDirty, records, recordsReady, showNotesSlot])

  useEffect(() => {
    if (!showNotesSlot || !records || !transcript || !recordsReady) return
    if (transcript === lastSavedTranscriptRef.current) return
    const timer = window.setTimeout(() => {
      const body = transcriptRef.current
      void records
        .save("transcript", body)
        .then(() => {
          lastSavedTranscriptRef.current = body
          setSaveFailed(false)
        })
        .catch(() => setSaveFailed(true))
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [transcript, records, recordsReady, showNotesSlot])

  useEffect(() => {
    if (!daily) return
    // Prejoin preview needs local tracks before Join. The permission prompt
    // on mount is the intended Daily prejoin UX, not a silent capture.
    void daily.startCamera().catch(() => {
      /* device errors surface in the prejoin UI */
    })
    return () => {
      void daily.leave()
    }
  }, [daily])

  const joined = meetingState === "joined-meeting"
  const joining = meetingState === "joining-meeting"
  const left = meetingState === "left-meeting"

  useEffect(() => {
    if (!showNotesSlot || !joined || !daily) return
    const call = daily as unknown as {
      startTranscription?: () => Promise<unknown>
      stopTranscription?: () => Promise<unknown>
      on: (event: string, handler: (ev: unknown) => void) => void
      off: (event: string, handler: (ev: unknown) => void) => void
    }
    if (typeof call.startTranscription === "function") {
      void call.startTranscription().catch(() => {
        /* live transcript is best-effort; notes still persist */
      })
    }
    const onMessage = (event: unknown) => {
      const line = parseTranscriptionMessage(event)
      if (!line?.isFinal) return
      setTranscript((curr) => appendTranscriptLine(curr, line))
    }
    call.on("transcription-message", onMessage)
    return () => {
      call.off("transcription-message", onMessage)
      if (typeof call.stopTranscription === "function") {
        void call.stopTranscription().catch(() => {
          /* room teardown */
        })
      }
    }
  }, [daily, joined, showNotesSlot])

  const handleLeft = useCallback(() => {
    onLeft?.()
  }, [onLeft])

  useEffect(() => {
    if (left) handleLeft()
  }, [left, handleLeft])

  async function handleJoin() {
    if (!daily) return
    setJoinFailed(false)
    try {
      await daily.join()
    } catch {
      setJoinFailed(true)
    }
  }

  async function handleLeave() {
    if (records && showNotesSlot && recordsLoadedRef.current) {
      const saves: Promise<void>[] = []
      if (notesDirtyRef.current) {
        saves.push(records.save("note", noteRef.current))
      }
      if (reportDirtyRef.current) {
        saves.push(
          records.save(
            "internal_report",
            serializeInternalReport(reportRef.current)
          )
        )
      }
      if (
        transcriptRef.current.trim() &&
        transcriptRef.current !== lastSavedTranscriptRef.current
      ) {
        saves.push(records.save("transcript", transcriptRef.current))
      }
      if (saves.length > 0) {
        await Promise.allSettled(saves)
      }
    }
    await daily?.leave()
  }

  function handleSend() {
    const text = chatDraft.trim()
    if (!text) return
    sendAppMessage({ text })
    setMessages((curr) => [
      ...curr,
      { id: crypto.randomUUID(), fromLocal: true, text },
    ])
    setChatDraft("")
  }

  if (left) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 py-12 text-center">
        <h1 className="text-xl font-medium">{labels.leftTitle}</h1>
        <p className="text-sm text-muted-foreground">{labels.leftBody}</p>
        <p className="text-xs text-muted-foreground">{labels.notHipaa}</p>
        <LinkButton href={backHref}>{labels.back}</LinkButton>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-4" data-testid="eleva-call">
      <DailyAudio />
      <p className="text-xs text-muted-foreground">{labels.notHipaa}</p>

      {!joined ? (
        <Prejoin
          localId={localId}
          labels={labels}
          joining={joining}
          joinFailed={joinFailed}
          onJoin={() => void handleJoin()}
        />
      ) : (
        <InCall
          localId={localId}
          remoteIds={remoteIds}
          screens={screens}
          labels={labels}
        />
      )}

      {joined || localId ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            aria-label={mic.isOff ? labels.unmute : labels.mute}
            onPress={() => daily?.setLocalAudio(mic.isOff)}
          >
            {mic.isOff ? (
              <MicrophoneSlashIcon className="size-4" />
            ) : (
              <MicrophoneIcon className="size-4" />
            )}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            aria-label={cam.isOff ? labels.cameraOn : labels.cameraOff}
            onPress={() => daily?.setLocalVideo(cam.isOff)}
          >
            {cam.isOff ? (
              <VideoCameraSlashIcon className="size-4" />
            ) : (
              <VideoCameraIcon className="size-4" />
            )}
          </Button>
          {joined ? (
            <>
              <Button
                variant="secondary"
                aria-label={
                  isSharingScreen ? labels.stopShare : labels.shareScreen
                }
                onPress={() =>
                  isSharingScreen ? stopScreenShare() : startScreenShare()
                }
              >
                <MonitorIcon className="size-4" />
                {isSharingScreen ? labels.stopShare : labels.shareScreen}
              </Button>
              <Button
                variant="secondary"
                aria-label={labels.chat}
                onPress={() => setChatOpen((open) => !open)}
              >
                <ChatCircleIcon className="size-4" />
                {labels.chat}
              </Button>
              <Button variant="destructive" onPress={() => void handleLeave()}>
                <PhoneDisconnectIcon className="size-4" />
                {labels.leave}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {joined && chatOpen ? (
        <ChatPanel
          labels={labels}
          messages={messages}
          draft={chatDraft}
          onDraftChange={setChatDraft}
          onSend={handleSend}
        />
      ) : null}

      {showNotesSlot ? (
        <SessionNotesPanel
          labels={labels}
          intake={intake}
          note={note}
          transcript={transcript}
          internalReport={internalReport}
          saveFailed={saveFailed}
          onNoteChange={(value) => {
            setNote(value)
            setNotesDirty(true)
          }}
          onReportChange={(patch) => {
            setInternalReport((curr) => ({ ...curr, ...patch }))
            setReportDirty(true)
          }}
        />
      ) : null}
    </div>
  )
}

function Prejoin({
  localId,
  labels,
  joining,
  joinFailed,
  onJoin,
}: {
  localId: string
  labels: ElevaCallLabels
  joining: boolean
  joinFailed: boolean
  onJoin: () => void
}) {
  return (
    <div
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
      data-testid="eleva-call-prejoin"
    >
      <div className="overflow-hidden rounded-3xl bg-muted">
        {localId ? (
          <DailyVideo
            sessionId={localId}
            automirror
            fit="cover"
            className="aspect-video h-full w-full bg-black object-cover"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center text-sm text-muted-foreground">
            {labels.connecting}
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center gap-3">
        <h1 className="text-xl font-medium">{labels.prejoinTitle}</h1>
        <p className="text-sm text-muted-foreground">{labels.prejoinHint}</p>
        {joinFailed ? (
          <p className="text-sm text-destructive">{labels.errors.internal}</p>
        ) : null}
        <Button onPress={onJoin} isDisabled={joining || !localId}>
          {joining ? labels.joining : labels.join}
        </Button>
      </div>
    </div>
  )
}

function InCall({
  localId,
  remoteIds,
  screens,
  labels,
}: {
  localId: string
  remoteIds: string[]
  screens: { session_id: string }[]
  labels: ElevaCallLabels
}) {
  const waiting = remoteIds.length === 0
  return (
    <div className="grid gap-3">
      {waiting ? (
        <p className="rounded-3xl bg-muted px-4 py-3 text-sm">
          <span className="font-medium">{labels.waiting}</span>
          <span className="mt-1 block text-muted-foreground">
            {labels.waitingHint}
          </span>
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {remoteIds.map((id) => (
          <DailyVideo
            key={id}
            sessionId={id}
            fit="cover"
            className="aspect-video w-full rounded-3xl bg-black object-cover"
          />
        ))}
        {localId ? (
          <DailyVideo
            sessionId={localId}
            automirror
            fit="cover"
            className="aspect-video w-full rounded-3xl bg-black object-cover"
          />
        ) : null}
      </div>
      {screens.map((screen) => (
        <DailyVideo
          key={`screen-${screen.session_id}`}
          sessionId={screen.session_id}
          type="screenVideo"
          fit="contain"
          className="aspect-video w-full rounded-3xl bg-black object-contain"
        />
      ))}
    </div>
  )
}

function ChatPanel({
  labels,
  messages,
  draft,
  onDraftChange,
  onSend,
}: {
  labels: ElevaCallLabels
  messages: ChatMessage[]
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => void
}) {
  const inputId = useId()
  return (
    <div className="flex max-h-64 flex-col rounded-3xl border">
      <div className="overflow-y-auto p-3 text-sm">
        {messages.length === 0 ? (
          <p className="text-muted-foreground">{labels.chatPlaceholder}</p>
        ) : (
          messages.map((msg) => (
            <p key={msg.id} className="py-0.5">
              <span className="font-medium">
                {msg.fromLocal ? labels.you : labels.remote}:
              </span>{" "}
              {msg.text}
            </p>
          ))
        )}
      </div>
      <form
        className="flex gap-2 border-t p-2"
        onSubmit={(event) => {
          event.preventDefault()
          onSend()
        }}
      >
        <Input
          id={inputId}
          aria-label={labels.chat}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={labels.chatPlaceholder}
        />
        <Button type="submit">{labels.send}</Button>
      </form>
    </div>
  )
}

function SessionNotesPanel({
  labels,
  intake,
  note,
  transcript,
  internalReport,
  saveFailed,
  onNoteChange,
  onReportChange,
}: {
  labels: ElevaCallLabels
  intake: string
  note: string
  transcript: string
  internalReport: InternalReportDraft
  saveFailed: boolean
  onNoteChange: (value: string) => void
  onReportChange: (patch: Partial<InternalReportDraft>) => void
}) {
  return (
    <aside className="grid gap-4 rounded-3xl border p-4 text-sm">
      {intake ? (
        <div>
          <p className="font-medium text-foreground">{labels.intakeTitle}</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
            {intake}
          </p>
        </div>
      ) : null}
      <div>
        <p className="font-medium text-foreground">{labels.notesTitle}</p>
        <Textarea
          className="mt-2 min-h-32"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={labels.notesPlaceholder}
          aria-label={labels.notesTitle}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {saveFailed ? labels.notesSaveFailed : labels.notesSaved}
        </p>
      </div>
      <div className="grid gap-3">
        <div>
          <p className="font-medium text-foreground">{labels.reportTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {labels.reportHint}
          </p>
        </div>
        <Textarea
          className="min-h-24"
          value={internalReport.notes}
          onChange={(event) => onReportChange({ notes: event.target.value })}
          placeholder={labels.reportNotesPlaceholder}
          aria-label={labels.reportNotes}
        />
        <Textarea
          className="min-h-24"
          value={internalReport.suggestions}
          onChange={(event) =>
            onReportChange({ suggestions: event.target.value })
          }
          placeholder={labels.reportSuggestionsPlaceholder}
          aria-label={labels.reportSuggestions}
        />
        <Textarea
          className="min-h-24"
          value={internalReport.recommendations}
          onChange={(event) =>
            onReportChange({ recommendations: event.target.value })
          }
          placeholder={labels.reportRecommendationsPlaceholder}
          aria-label={labels.reportRecommendations}
        />
      </div>
      <div>
        <p className="font-medium text-foreground">{labels.transcriptTitle}</p>
        {transcript ? (
          <pre className="mt-2 max-h-48 overflow-y-auto rounded-2xl bg-muted p-3 text-xs whitespace-pre-wrap">
            {transcript}
          </pre>
        ) : (
          <p className="mt-1 text-muted-foreground">{labels.transcriptEmpty}</p>
        )}
      </div>
    </aside>
  )
}
