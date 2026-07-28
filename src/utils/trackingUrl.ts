const PUBLIC_TRACKING_ORIGIN = 'https://app.gruas5norte.cl';

/**
 * Los WebViews nativos viven en `capacitor://localhost`, pero ese origen sólo
 * existe dentro del teléfono y nunca es accesible para el cliente.
 */
export const buildPublicTrackingUrl = (token: string): string =>
  `${PUBLIC_TRACKING_ORIGIN}/track/${encodeURIComponent(token)}`;
