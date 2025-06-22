
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "font-medium text-black bg-tms-green hover:bg-tms-green/80",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-white text-black hover:bg-gray-50 hover:text-black",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-black hover:bg-gray-100 hover:text-black",
        link: "text-primary underline-offset-4 hover:underline",
        tms: "font-medium text-black bg-tms-green hover:bg-tms-green/80",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // Apply TMS styling for default and tms variants with explicit text color
    const tmsStyle = (variant === 'default' || variant === 'tms') ? {
      backgroundColor: '#9cfa24',
      color: '#000000',
      ...style
    } : (variant === 'outline') ? {
      backgroundColor: '#ffffff',
      color: '#000000',
      ...style
    } : (variant === 'ghost') ? {
      backgroundColor: 'transparent',
      color: '#000000',
      ...style
    } : style;

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (variant === 'default' || variant === 'tms') {
        e.currentTarget.style.backgroundColor = 'rgba(156, 250, 36, 0.8)';
        e.currentTarget.style.color = '#000000';
      } else if (variant === 'outline') {
        e.currentTarget.style.backgroundColor = '#f9fafb';
        e.currentTarget.style.color = '#000000';
      } else if (variant === 'ghost') {
        e.currentTarget.style.backgroundColor = '#f3f4f6';
        e.currentTarget.style.color = '#000000';
      }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (variant === 'default' || variant === 'tms') {
        e.currentTarget.style.backgroundColor = '#9cfa24';
        e.currentTarget.style.color = '#000000';
      } else if (variant === 'outline') {
        e.currentTarget.style.backgroundColor = '#ffffff';
        e.currentTarget.style.color = '#000000';
      } else if (variant === 'ghost') {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = '#000000';
      }
    };

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        style={tmsStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        data-variant={variant}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
