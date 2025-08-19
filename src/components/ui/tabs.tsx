
import React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md p-1 text-muted-foreground bg-white border border-gray-200",
      className
    )}
    style={{
      backgroundColor: '#ffffff',
      border: '1px solid #e5e7eb'
    }}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-tms-green data-[state=active]:text-black data-[state=active]:font-semibold text-black hover:bg-gray-50",
      className
    )}
    style={{
      color: '#000000',
      backgroundColor: 'transparent'
    }}
    onMouseEnter={(e) => {
      if (!e.currentTarget.hasAttribute('data-state') || e.currentTarget.getAttribute('data-state') !== 'active') {
        e.currentTarget.style.backgroundColor = '#f9fafb';
        e.currentTarget.style.color = '#000000';
      }
    }}
    onMouseLeave={(e) => {
      if (!e.currentTarget.hasAttribute('data-state') || e.currentTarget.getAttribute('data-state') !== 'active') {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = '#000000';
      }
    }}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
