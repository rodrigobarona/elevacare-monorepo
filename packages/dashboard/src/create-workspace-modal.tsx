"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@eleva/ui/components/dialog"
import { WorkspaceTypePicker } from "./workspace-type-picker"

interface CreateWorkspaceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateWorkspaceModal({
  open,
  onOpenChange,
}: CreateWorkspaceModalProps) {
  const t = useTranslations("createWorkspace")

  return (
    <Dialog
      isOpen={open}
      onOpenChange={onOpenChange}
      className="gap-8 p-8 sm:max-w-4xl"
    >
      <DialogHeader className="items-center text-center sm:pr-0">
        <DialogTitle className="text-2xl">{t("pickerTitle")}</DialogTitle>
        <DialogDescription className="text-base">
          {t("pickerDescription")}
        </DialogDescription>
      </DialogHeader>
      <WorkspaceTypePicker mode="modal" />
    </Dialog>
  )
}

/** Account app intercept route — same UI, dismiss via router.back(). */
export function CreateWorkspaceInterceptModal() {
  const router = useRouter()
  const t = useTranslations("createWorkspace")

  return (
    <Dialog
      isOpen
      onOpenChange={(nextOpen) => {
        if (!nextOpen) router.back()
      }}
      className="gap-8 p-8 sm:max-w-4xl"
    >
      <DialogHeader className="items-center text-center sm:pr-0">
        <DialogTitle className="text-2xl">{t("pickerTitle")}</DialogTitle>
        <DialogDescription className="text-base">
          {t("pickerDescription")}
        </DialogDescription>
      </DialogHeader>
      <WorkspaceTypePicker mode="modal" />
    </Dialog>
  )
}
