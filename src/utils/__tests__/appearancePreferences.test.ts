import { describe, expect, it } from 'vitest';
import { defaultAppearancePreferences } from '@/types/settings';
import {
  appearancePreferencesFromDatabase,
  appearancePreferencesToDatabase,
  normalizeAppearancePreferences,
} from '@/utils/appearancePreferences';

describe('appearance preferences', () => {
  it('uses safe defaults for unsupported persisted values', () => {
    expect(normalizeAppearancePreferences({
      theme: 'dark',
      density: 'wide' as never,
      textScale: 95 as never,
      reduceMotion: true,
    })).toEqual({
      ...defaultAppearancePreferences,
      theme: 'dark',
      reduceMotion: true,
    });
  });

  it('maps database columns to application preferences', () => {
    expect(appearancePreferencesFromDatabase({
      theme: 'light',
      interface_density: 'compact',
      text_scale: 110,
      reduce_motion: true,
      sidebar_collapsed: true,
    })).toEqual({
      theme: 'light',
      density: 'compact',
      textScale: 110,
      reduceMotion: true,
      sidebarCollapsed: true,
    });
  });

  it('maps application preferences to database columns', () => {
    expect(appearancePreferencesToDatabase({
      theme: 'system',
      density: 'comfortable',
      textScale: 120,
      reduceMotion: false,
      sidebarCollapsed: true,
    })).toEqual({
      theme: 'system',
      interface_density: 'comfortable',
      text_scale: 120,
      reduce_motion: false,
      sidebar_collapsed: true,
    });
  });
});
