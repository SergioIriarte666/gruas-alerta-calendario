import { useBreakpoint } from './useBreakpoint'

export type DeviceType = 'mobile' | 'tablet' | 'desktop'

export function useDeviceType() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint()

  const deviceType: DeviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop'

  return {
    deviceType,
    isMobile,
    isTablet,
    isDesktop,
    isTouchDevice: isMobile || isTablet,
    showMobileView: isMobile,
    showTabletView: isTablet,
    showDesktopView: isDesktop,
  }
}