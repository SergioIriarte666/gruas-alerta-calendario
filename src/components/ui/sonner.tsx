import { Toaster as Sonner } from "sonner"
import type { ComponentProps } from "react"
import { useTheme } from "@/contexts/ThemeContext"

type ToasterProps = ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      position="top-center"
      duration={2500}
      richColors
      containerAriaLabel="Notificaciones"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:w-[23.75rem] group-[.toaster]:rounded-2xl " +
            "group-[.toaster]:border group-[.toaster]:border-border/70 group-[.toaster]:!bg-card " +
            "group-[.toaster]:text-foreground group-[.toaster]:shadow-xl",
          title:
            "group-[.toast]:font-semibold group-[.toast]:tracking-tight group-[.toast]:text-foreground " +
            "group-[.toast.sonner-toast--success]:!text-success-text " +
            "group-[.toast.sonner-toast--error]:!text-danger-text " +
            "group-[.toast.sonner-toast--warning]:!text-warning-text " +
            "group-[.toast.sonner-toast--info]:!text-info-text",
          description:
            "group-[.toast]:text-sm group-[.toast]:leading-6 group-[.toast]:text-muted-foreground " +
            "group-[.toast.sonner-toast--error]:!text-danger-text/90",
          icon:
            "group-[.toast.sonner-toast--error]:!text-danger",
          actionButton:
            "group-[.toast]:rounded-lg group-[.toast]:bg-primary group-[.toast]:px-3 group-[.toast]:text-primary-foreground group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:rounded-lg group-[.toast]:bg-muted/80 group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:border-border/70 group-[.toast]:bg-background/70 group-[.toast]:text-muted-foreground " +
            "group-[.toast]:transition-colors group-[.toast]:hover:bg-background group-[.toast]:hover:text-foreground " +
            "group-[.toast.sonner-toast--error]:!border-danger/30 group-[.toast.sonner-toast--error]:!bg-danger/10 " +
            "group-[.toast.sonner-toast--error]:!text-danger group-[.toast.sonner-toast--error]:hover:!bg-danger/20",
          success:
            "group-[.toaster]:!border-success/30 group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-success " +
            "group-[.toaster]:!bg-success-soft",
          error:
            "group-[.toaster]:!border-danger/30 group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-danger " +
            "group-[.toaster]:!bg-danger-soft",
          warning:
            "group-[.toaster]:!border-warning/30 group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-warning " +
            "group-[.toaster]:!bg-warning-soft",
          info:
            "group-[.toaster]:!border-info/30 group-[.toaster]:!border-l-4 group-[.toaster]:!border-l-info " +
            "group-[.toaster]:!bg-info-soft",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
