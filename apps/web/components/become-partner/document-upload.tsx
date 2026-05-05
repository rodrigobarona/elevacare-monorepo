"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { FileText, Loader2, Upload, X } from "lucide-react"

import { Button } from "@eleva/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Alert, AlertDescription } from "@eleva/ui/components/alert"
import { uploadApplicationDocumentClient } from "@eleva/billing/uploads-client"

import {
  ALLOWED_DOC_KINDS,
  type ApplicationDocumentInput,
  type DocumentKind,
} from "@/lib/become-partner/schema"

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp"
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
])

interface DocumentUploadListProps {
  documents: ApplicationDocumentInput[]
  onChange: (documents: ApplicationDocumentInput[]) => void
}

export function DocumentUploadList({
  documents,
  onChange,
}: DocumentUploadListProps) {
  // Snapshot the latest documents in a ref so the per-slot callbacks
  // always read the most recent list when invoked. `onChange` is a
  // value setter (not React's setState updater) so we cannot rely on
  // a functional update form to merge upload results. Reading from a
  // ref keeps callbacks correct even if React batches multiple uploads
  // before re-render.
  const latestDocsRef = React.useRef(documents)
  React.useEffect(() => {
    latestDocsRef.current = documents
  }, [documents])

  return (
    <div className="grid gap-4">
      {ALLOWED_DOC_KINDS.map((kind) => (
        <DocumentSlot
          key={kind}
          kind={kind}
          existing={documents.find((d) => d.kind === kind)}
          onUploaded={(doc) => {
            const next = [
              ...latestDocsRef.current.filter((d) => d.kind !== kind),
              doc,
            ]
            latestDocsRef.current = next
            onChange(next)
          }}
          onRemove={() => {
            const next = latestDocsRef.current.filter((d) => d.kind !== kind)
            latestDocsRef.current = next
            onChange(next)
          }}
        />
      ))}
    </div>
  )
}

interface DocumentSlotProps {
  kind: DocumentKind
  existing?: ApplicationDocumentInput
  onUploaded: (doc: ApplicationDocumentInput) => void
  onRemove: () => void
}

function DocumentSlot({
  kind,
  existing,
  onUploaded,
  onRemove,
}: DocumentSlotProps) {
  const t = useTranslations("becomePartner.documents")
  const tCommon = useTranslations()
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [progress, setProgress] = React.useState<number>(0)
  // We split UI state into a "transient" interaction tracked in this
  // component (uploading / error) and the "persisted" state derived
  // from the parent-provided `existing` prop. This lets us avoid
  // setState-in-effect: when the parent commits the uploaded doc, the
  // derived state automatically flips to "uploaded".
  const [interaction, setInteraction] = React.useState<
    null | "uploading" | "error"
  >(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const state: "idle" | "uploading" | "uploaded" | "error" = (() => {
    if (interaction === "uploading") return "uploading"
    if (interaction === "error") return "error"
    return existing ? "uploaded" : "idle"
  })()

  async function onPick(file: File | null) {
    if (!file) return
    setErrorMessage(null)
    if (!ALLOWED_MIME.has(file.type)) {
      setInteraction("error")
      setErrorMessage(t("errors.wrongType"))
      resetInputValue()
      return
    }
    if (file.size > MAX_BYTES) {
      setInteraction("error")
      setErrorMessage(t("errors.tooLarge"))
      resetInputValue()
      return
    }

    setInteraction("uploading")
    setProgress(0)

    try {
      const uploaded = await uploadApplicationDocumentClient({
        kind,
        file,
        onUploadProgress: (e) => setProgress(e.percentage),
      })
      onUploaded({
        kind,
        name: uploaded.name,
        url: uploaded.url,
        pathname: uploaded.pathname,
        contentType: uploaded.contentType,
        size: uploaded.size,
        uploadedAt: uploaded.uploadedAt,
      })
      setInteraction(null)
    } catch (err) {
      console.error("upload failed", err)
      setInteraction("error")
      setErrorMessage(t("errors.uploadFailed"))
    } finally {
      resetInputValue()
    }
  }

  function resetInputValue() {
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {t(`kinds.${kind}`)}
          {kind !== "license" ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              · {tCommon("common.optional")}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {existing ? (
          <div className="flex items-center justify-between gap-3 rounded-md bg-muted/50 p-3">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <FileText className="size-4 shrink-0 text-primary" />
              <span className="truncate">{existing.name}</span>
              <span className="text-xs text-muted-foreground">
                {(existing.size / 1024).toFixed(0)} KB
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              aria-label={t("remove")}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : null}

        {state === "uploading" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("uploading")} ({Math.round(progress)}%)
          </div>
        ) : null}

        {state === "error" && errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {!existing ? (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={state === "uploading"}
            >
              <Upload />
              {t("uploadCta")}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
