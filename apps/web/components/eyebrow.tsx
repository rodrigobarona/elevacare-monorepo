import { cn } from "@eleva/ui/lib/utils"

interface EyebrowProps {
  children: React.ReactNode
  className?: string
}

export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <p
      className={cn(
        "font-mono text-xs font-medium tracking-widest text-primary uppercase",
        className
      )}
    >
      {children}
    </p>
  )
}
