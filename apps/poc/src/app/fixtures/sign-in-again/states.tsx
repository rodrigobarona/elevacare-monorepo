"use client"

import type { ReactNode } from "react"
import {
  SignedInAgainNotice,
  SignInAgainNotice,
} from "@eleva/dashboard/sign-in-again"
import { Button } from "@eleva/ui/components/button"
import { Label } from "@eleva/ui/components/label"
import { Textarea } from "@eleva/ui/components/textarea"

export interface SignInAgainCopy {
  bannerTitle: string
  bannerBody: string
  kept: string
  notKept: string
  refusedTitle: string
  refusedBody: string
  refusedKept: string
  action: string
  actionPending: string
  unavailable: string
  writeFailed: string
  restored: string
  restoredSome: string
  changed: string
  lapsed: string
  renewed: string
  snapshotTitle: string
  decisionTitle: string
  checklistHelp: string
  approve: string
  reasonLabel: string
  reasonHelp: string
  needsChanges: string
  reject: string
}

const noop = () => {}

/** A review's page column, so each notice is seen among what surrounds it. */
function Review({
  name,
  banner,
  above,
  afterApprove,
  afterButtons,
  copy,
}: {
  name: string
  banner?: ReactNode
  above?: ReactNode
  afterApprove?: ReactNode
  afterButtons?: ReactNode
  copy: SignInAgainCopy
}) {
  return (
    <section
      data-testid={`state-${name}`}
      className="mx-auto max-w-3xl space-y-8"
    >
      <p className="font-mono text-xs text-muted-foreground">{name}</p>
      {banner}
      <div className="space-y-2 rounded-xl border p-6">
        <h2 className="text-base font-semibold tracking-tight">
          {copy.snapshotTitle}
        </h2>
        <p className="text-sm text-muted-foreground">Clínica Lumen, Lda</p>
      </div>
      <div className="space-y-6 rounded-xl border p-6">
        <h2 className="text-base font-semibold tracking-tight">
          {copy.decisionTitle}
        </h2>
        {above}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{copy.checklistHelp}</p>
          <Button onPress={noop}>{copy.approve}</Button>
          {afterApprove}
        </div>
        <div className="space-y-3 border-t pt-6">
          <div className="space-y-1.5">
            <Label htmlFor={`reason-${name}`}>{copy.reasonLabel}</Label>
            <Textarea id={`reason-${name}`} rows={2} readOnly value="" />
            <p className="text-sm text-muted-foreground">{copy.reasonHelp}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onPress={noop}>
              {copy.needsChanges}
            </Button>
            <Button variant="destructive" onPress={noop}>
              {copy.reject}
            </Button>
          </div>
          {afterButtons}
        </div>
      </div>
    </section>
  )
}

export function SignInAgainStates({ copy }: { copy: SignInAgainCopy }) {
  const action = (isPending = false) => ({
    label: copy.action,
    pendingLabel: copy.actionPending,
    isPending,
    onPress: noop,
  })
  const refusal = (extra: { failure?: string; pending?: boolean } = {}) => (
    <SignInAgainNotice
      title={copy.refusedTitle}
      action={action(extra.pending)}
      failure={extra.failure ?? null}
      answersAPress
      data-testid="notice"
    >
      {copy.refusedBody} {copy.refusedKept}
    </SignInAgainNotice>
  )
  return (
    <main className="space-y-16 p-4 sm:p-6">
      <h1 className="font-display text-3xl">Sign in again</h1>
      <Review
        name="banner"
        copy={copy}
        banner={
          <SignInAgainNotice
            title={copy.bannerTitle}
            action={action()}
            size="roomy"
            data-testid="notice"
          >
            {copy.bannerBody} {copy.kept}
          </SignInAgainNotice>
        }
      />
      <Review
        name="banner-not-kept"
        copy={copy}
        banner={
          <SignInAgainNotice
            title={copy.bannerTitle}
            action={action()}
            failure={copy.writeFailed}
            size="roomy"
            data-testid="notice"
          >
            {copy.bannerBody} {copy.notKept}
          </SignInAgainNotice>
        }
      />
      <Review name="refused-reason" copy={copy} afterButtons={refusal()} />
      <Review name="refused-approve" copy={copy} afterApprove={refusal()} />
      <Review
        name="refused-leaving"
        copy={copy}
        afterButtons={refusal({ pending: true })}
      />
      <Review
        name="refused-sign-out-failed"
        copy={copy}
        afterButtons={refusal({ failure: copy.unavailable })}
      />
      <Review
        name="restored"
        copy={copy}
        above={
          <SignedInAgainNotice takeFocus={false} data-testid="notice">
            {copy.restored}
          </SignedInAgainNotice>
        }
      />
      <Review
        name="restored-focused"
        copy={copy}
        above={
          <SignedInAgainNotice data-testid="notice">
            {copy.restoredSome}
          </SignedInAgainNotice>
        }
      />
      <Review
        name="new-details"
        copy={copy}
        above={
          <SignedInAgainNotice
            tone="plain"
            takeFocus={false}
            data-testid="notice"
          >
            {copy.changed}
          </SignedInAgainNotice>
        }
      />
      <Review
        name="lapsed"
        copy={copy}
        above={
          <SignedInAgainNotice
            tone="plain"
            takeFocus={false}
            data-testid="notice"
          >
            {copy.lapsed}
          </SignedInAgainNotice>
        }
      />
      <Review
        name="renewed"
        copy={copy}
        above={
          <SignedInAgainNotice
            tone="plain"
            takeFocus={false}
            data-testid="notice"
          >
            {copy.renewed}
          </SignedInAgainNotice>
        }
      />
    </main>
  )
}
