import { Toaster as Sonner } from "sonner"
import type { ComponentProps } from "react"

type ToasterProps = ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      duration={2500}
      richColors
      containerAriaLabel="Notificaciones"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:w-[380px] group-[.toaster]:rounded-2xl " +
            "group-[.toaster]:border group-[.toaster]:border-border/70 group-[.toaster]:!bg-card " +
            "group-[.toaster]:text-foreground group-[.toaster]:shadow-[0_12px_32px_rgba(15,23,42,0.14)]",
          title:
            "group-[.toast]:font-semibold group-[.toast]:tracking-tight group-[.toast]:text-[hsl(var(--text-strong))] " +
            "group-[.toast.sonner-toast--success]:!text-[hsl(var(--success))] " +
            "group-[.toast.sonner-toast--error]:!text-[hsl(var(--danger))] " +
            "group-[.toast.sonner-toast--warning]:!text-[hsl(var(--warning))] " +
            "group-[.toast.sonner-toast--info]:!text-[hsl(var(--primary))]",
          description:
            "group-[.toast]:text-sm group-[.toast]:leading-6 group-[.toast]:text-[hsl(var(--text))]",
          actionButton:
            "group-[.toast]:rounded-lg group-[.toast]:bg-primary group-[.toast]:px-3 group-[.toast]:text-primary-foreground group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:rounded-lg group-[.toast]:bg-muted/80 group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:border-border/70 group-[.toast]:bg-background/70 group-[.toast]:text-muted-foreground " +
            "group-[.toast]:transition-colors group-[.toast]:hover:bg-background group-[.toast]:hover:text-foreground",
          success:
            "group-[.toaster]:!border-[hsl(var(--success)/0.25)] group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--success))] " +
            "group-[.toaster]:!bg-[hsl(var(--success-soft))] group-[.toaster]:shadow-[0_14px_34px_hsl(var(--success)/0.12)]",
          error:
            "group-[.toaster]:!border-[hsl(var(--danger)/0.25)] group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--danger))] " +
            "group-[.toaster]:!bg-[hsl(var(--danger-soft))] group-[.toaster]:shadow-[0_14px_34px_hsl(var(--danger)/0.12)]",
          warning:
            "group-[.toaster]:!border-[hsl(var(--warning)/0.28)] group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--warning))] " +
            "group-[.toaster]:!bg-[hsl(var(--warning-soft))] group-[.toaster]:shadow-[0_14px_34px_hsl(var(--warning)/0.12)]",
          info:
            "group-[.toaster]:!border-[hsl(var(--primary)/0.20)] group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-[hsl(var(--primary))] " +
            "group-[.toaster]:!bg-[hsl(var(--primary-soft))] group-[.toaster]:shadow-[0_14px_34px_hsl(var(--primary)/0.12)]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
