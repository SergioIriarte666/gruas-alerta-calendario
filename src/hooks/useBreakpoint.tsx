import React from "react"

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = React.useState<Breakpoint>('lg')
  const [screenWidth, setScreenWidth] = React.useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )

  React.useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth
      setScreenWidth(width)
      
      if (width >= BREAKPOINTS['2xl']) {
        setBreakpoint('2xl')
      } else if (width >= BREAKPOINTS.xl) {
        setBreakpoint('xl')
      } else if (width >= BREAKPOINTS.lg) {
        setBreakpoint('lg')
      } else if (width >= BREAKPOINTS.md) {
        setBreakpoint('md')
      } else if (width >= BREAKPOINTS.sm) {
        setBreakpoint('sm')
      } else {
        setBreakpoint('xs')
      }
    }

    updateBreakpoint()
    window.addEventListener('resize', updateBreakpoint)
    return () => window.removeEventListener('resize', updateBreakpoint)
  }, [])

  const isAbove = React.useCallback((bp: Breakpoint) => {
    return screenWidth >= BREAKPOINTS[bp]
  }, [screenWidth])

  const isBelow = React.useCallback((bp: Breakpoint) => {
    return screenWidth < BREAKPOINTS[bp]
  }, [screenWidth])

  const isBetween = React.useCallback((min: Breakpoint, max: Breakpoint) => {
    return screenWidth >= BREAKPOINTS[min] && screenWidth < BREAKPOINTS[max]
  }, [screenWidth])

  return {
    breakpoint,
    screenWidth,
    isAbove,
    isBelow,
    isBetween,
    // Convenience methods
    isMobile: screenWidth < BREAKPOINTS.md,
    isTablet: screenWidth >= BREAKPOINTS.md && screenWidth < BREAKPOINTS.lg,
    isDesktop: screenWidth >= BREAKPOINTS.lg,
  }
}