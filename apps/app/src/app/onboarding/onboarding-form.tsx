"use client"

import * as React from "react"
import { useActionState } from "react"
import { Button } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@eleva/ui/components/card"
import { createWorkspace } from "./actions"

interface Props {
  defaultName: string
}

export function OnboardingForm({ defaultName }: Props) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { ok: boolean; error?: string }, formData: FormData) => {
      const result = await createWorkspace(formData)
      return result
    },
    { ok: true }
  )

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>Create your workspace</CardTitle>
          <CardDescription>
            Your workspace is where you manage your health journey.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workspaceName">Workspace name</Label>
            <Input
              id="workspaceName"
              name="workspaceName"
              defaultValue={defaultName}
              placeholder="My Workspace"
              required
              minLength={2}
              maxLength={100}
              autoFocus
            />
          </div>
          {!state.ok && state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating..." : "Create workspace"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
