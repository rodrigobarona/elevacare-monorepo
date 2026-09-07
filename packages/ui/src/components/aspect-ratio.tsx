import { cn } from "@eleva/ui/lib/utils"

function AspectRatio({
  ratio,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & { ratio: number }) {
  return (
    <div
      data-slot="aspect-ratio"
      // eleva: merge caller styles so a `style` prop cannot wipe `--ratio`.
      style={{ ...style, "--ratio": ratio } as React.CSSProperties}
      className={cn("relative aspect-(--ratio)", className)}
      {...props}
    />
  )
}

export { AspectRatio }
