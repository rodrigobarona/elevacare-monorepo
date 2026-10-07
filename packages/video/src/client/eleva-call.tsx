"use client"

import { useCallback, useEffect, useId, useState } from "react"
import {
  DailyAudio,
  DailyProvider,
  DailyVideo,
  useAppMessage,
  useDaily,
  useDailyEvent,
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
import type { ElevaCallLabels } from "./labels"

export type { ElevaCallLabels, ElevaCallErrorCode } from "./labels"

export type ElevaCallProps = {
  roomUrl: string
  token: string
  labels: ElevaCallLabels
  onLeft?: () => void
  showNotesSlot?: boolean
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
  backHref,
}: ElevaCallProps) {
  return (
    <DailyProvider url={roomUrl} token={token}>
      <CallShell
        labels={labels}
        onLeft={onLeft}
        showNotesSlot={showNotesSlot}
        backHref={backHref}
      />
    </DailyProvider>
  )
}

function CallShell({
  labels,
  onLeft,
  showNotesSlot,
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
    if (!daily) return
    void daily.startCamera().catch(() => {
      /* device errors surface in the prejoin UI */
    })
    return () => {
      void daily.leave()
    }
  }, [daily])

  const handleLeft = useCallback(() => {
    onLeft?.()
  }, [onLeft])
  useDailyEvent("left-meeting", handleLeft)

  const joined = meetingState === "joined-meeting"
  const joining = meetingState === "joining-meeting"
  const left = meetingState === "left-meeting"

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
    if (onLeft) return null
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
        <aside className="rounded-3xl border border-dashed p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{labels.notesTitle}</p>
          <p className="mt-1">{labels.notesPlaceholder}</p>
        </aside>
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
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
                {msg.fromLocal ? labels.you : labels.chat}:
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
