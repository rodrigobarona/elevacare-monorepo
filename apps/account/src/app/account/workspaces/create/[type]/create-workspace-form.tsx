"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useActionState } from "react"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { createWorkspace, type CreateWorkspaceState } from "./actions"

interface CreateWorkspaceFormProps {
  type: "expert" | "team" | "academy"
}

export function CreateWorkspaceForm({ type }: CreateWorkspaceFormProps) {
  const t = useTranslations("createWorkspace")
  const [name, setName] = React.useState("")
  const [state, formAction, pending] = useActionState<
    CreateWorkspaceState | null,
    FormData
  >(createWorkspace, null)

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="type" value={type} />
      <div className="space-y-2">
        <Label htmlFor="workspace-name">{t("nameLabel")}</Label>
        <Input
          id="workspace-name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("namePlaceholder")}
          minLength={2}
          maxLength={100}
          required
          autoFocus
        />
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-destructive">{t("errorGeneric")}</p>
      ) : null}
      <Button type="submit" disabled={pending || name.trim().length < 2}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  )
}
