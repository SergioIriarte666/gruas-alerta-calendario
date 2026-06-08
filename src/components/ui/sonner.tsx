import { Toaster as Sonner } from "sonner"
import type { ComponentProps } from "react"

type ToasterProps = ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      duration={2500}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description:
            "group-[.toast]:text-muted-foreground group-[.toast]:text-sm " +
            "group-[.toast.sonner-toast--success]:!text-white/90 " +
            "group-[.toast.sonner-toast--error]:!text-white/90 " +
            "group-[.toast.sonner-toast--warning]:!text-black/80 " +
            "group-[.toast.sonner-toast--info]:!text-white/90",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:!bg-[hsl(var(--success))] group-[.toaster]:!text-[hsl(var(--success-foreground))] group-[.toaster]:!border-[hsl(var(--success))]",
          error:
            "group-[.toaster]:!bg-[hsl(var(--danger))] group-[.toaster]:!text-[hsl(var(--danger-foreground))] group-[.toaster]:!border-[hsl(var(--danger))]",
          warning:
            "group-[.toaster]:!bg-[hsl(var(--warning))] group-[.toaster]:!text-[hsl(var(--warning-foreground))] group-[.toaster]:!border-[hsl(var(--warning))]",
          info:
            "group-[.toaster]:!bg-[hsl(var(--primary))] group-[.toaster]:!text-[hsl(var(--primary-foreground))] group-[.toaster]:!border-[hsl(var(--primary))]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
