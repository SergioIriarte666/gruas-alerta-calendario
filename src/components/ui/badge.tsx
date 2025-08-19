
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent font-medium",
        secondary: "border-transparent font-medium",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, style, ...props }: BadgeProps) {
  // Apply TMS styling for default variant
  const tmsStyle = variant === 'default' ? {
    backgroundColor: '#9cfa24',
    color: '#000000',
    ...style
  } : style;

  return (
    <div 
      className={cn(badgeVariants({ variant }), className)} 
      style={tmsStyle}
      {...props} 
    />
  )
}

export { Badge, badgeVariants }
