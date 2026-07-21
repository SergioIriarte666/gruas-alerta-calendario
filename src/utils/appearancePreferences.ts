import {
  defaultAppearancePreferences,
  type AppearancePreferences,
  type InterfaceDensity,
  type InterfaceTextScale,
} from '@/types/settings';

const themes: AppearancePreferences['theme'][] = ['light', 'dark', 'system'];
const densities: InterfaceDensity[] = ['comfortable', 'compact'];
const textScales: InterfaceTextScale[] = [100, 110, 120];

export const normalizeAppearancePreferences = (
  value: Partial<AppearancePreferences> | null | undefined,
): AppearancePreferences => ({
  theme: themes.includes(value?.theme as AppearancePreferences['theme'])
    ? (value?.theme as AppearancePreferences['theme'])
    : defaultAppearancePreferences.theme,
  density: densities.includes(value?.density as InterfaceDensity)
    ? (value?.density as InterfaceDensity)
    : defaultAppearancePreferences.density,
  textScale: textScales.includes(Number(value?.textScale) as InterfaceTextScale)
    ? (Number(value?.textScale) as InterfaceTextScale)
    : defaultAppearancePreferences.textScale,
  reduceMotion: typeof value?.reduceMotion === 'boolean'
    ? value.reduceMotion
    : defaultAppearancePreferences.reduceMotion,
  sidebarCollapsed: typeof value?.sidebarCollapsed === 'boolean'
    ? value.sidebarCollapsed
    : defaultAppearancePreferences.sidebarCollapsed,
});

export const appearancePreferencesFromDatabase = (value: {
  theme?: string | null;
  interface_density?: string | null;
  text_scale?: number | null;
  reduce_motion?: boolean | null;
  sidebar_collapsed?: boolean | null;
} | null): AppearancePreferences => normalizeAppearancePreferences({
  theme: value?.theme as AppearancePreferences['theme'],
  density: value?.interface_density as InterfaceDensity,
  textScale: value?.text_scale as InterfaceTextScale,
  reduceMotion: value?.reduce_motion ?? undefined,
  sidebarCollapsed: value?.sidebar_collapsed ?? undefined,
});

export const appearancePreferencesToDatabase = (preferences: AppearancePreferences) => ({
  theme: preferences.theme,
  interface_density: preferences.density,
  text_scale: preferences.textScale,
  reduce_motion: preferences.reduceMotion,
  sidebar_collapsed: preferences.sidebarCollapsed,
});
