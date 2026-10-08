"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { ElevaCall } from "./eleva-call"
import {
  joinErrorCode,
  type ElevaCallErrorCode,
  type ElevaCallLabels,
} from "./labels"

export type JoinSessionProps = {
  join: () => Promise<{ roomUrl: string; token: string }>
  labels: ElevaCallLabels
  backHref: string
  showNotesSlot?: boolean
}

export function JoinSession({
  join,
  labels,
  backHref,
  showNotesSlot = false,
}: JoinSessionProps) {
  const [creds, setCreds] = useState<{
    roomUrl: string
    token: string
  } | null>(null)
  const [error, setError] = useState<ElevaCallErrorCode | null>(null)
  const [loading, setLoading] = useState(true)
  const [left, setLeft] = useState(false)
  const reqId = useRef(0)

  const load = useCallback(() => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    setCreds(null)
    void join()
      .then((result) => {
        if (id !== reqId.current) return
        setCreds({ roomUrl: result.roomUrl, token: result.token })
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (id !== reqId.current) return
        setError(joinErrorCode(err))
        setLoading(false)
      })
  }, [join])

  useEffect(() => {
    return () => {
      reqId.current += 1
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

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

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {labels.connecting}
      </p>
    )
  }

  if (error || !creds) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 py-12">
        <h1 className="text-xl font-medium">{labels.errorTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {labels.errors[error ?? "internal"]}
        </p>
        <p className="text-xs text-muted-foreground">{labels.notHipaa}</p>
        <div className="flex flex-wrap gap-2">
          <Button onPress={load}>{labels.retry}</Button>
          <LinkButton variant="outline" href={backHref}>
            {labels.back}
          </LinkButton>
        </div>
      </div>
    )
  }

  return (
    <ElevaCall
      roomUrl={creds.roomUrl}
      token={creds.token}
      labels={labels}
      showNotesSlot={showNotesSlot}
      backHref={backHref}
      onLeft={() => setLeft(true)}
    />
  )
}
