"use client"

import { Button as ButtonPrimitive } from "react-aria-components"
import { googleSans } from "@eleva/ui/fonts"
import { cn } from "@eleva/ui/lib/utils"
import { GoogleLogo } from "@eleva/ui/components/provider-logo"

/**
 * "Continue with Google" button per the Sign in with Google branding
 * guidelines: light theme #FFFFFF / #747775 stroke / #1F1F1F text, dark theme
 * #131314 / #8E918F / #E3E3E3, Google Sans Medium 14/20, pill shape.
 */
function GoogleSignInButton({
  label,
  onPress,
  isPending = false,
  className,
  ...props
}: {
  label: string
  onPress: () => void
  isPending?: boolean
  className?: string
  "data-testid"?: string
}) {
  return (
    <ButtonPrimitive
      data-slot="google-sign-in-button"
      onPress={onPress}
      isPending={isPending}
      className={cn(
        googleSans.className,
        "relative inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-full border border-[#747775] bg-white px-3 text-sm leading-5 font-medium text-[#1F1F1F] transition-[background-color,box-shadow] duration-150 outline-none",
        "data-hovered:bg-[#F8F9FA] data-hovered:shadow-[0_1px_2px_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)] data-pressed:bg-[#F1F3F4]",
        "data-focus-visible:ring-3 data-focus-visible:ring-ring/50 data-pending:cursor-wait data-pending:opacity-80",
        "dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3] dark:data-hovered:bg-[#1F1F20] dark:data-pressed:bg-[#28292A]",
        className
      )}
      {...props}
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-white">
        <GoogleLogo />
      </span>
      <span>{label}</span>
    </ButtonPrimitive>
  )
}

export { GoogleSignInButton }
