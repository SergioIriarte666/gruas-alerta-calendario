interface NavigationCoordinates {
  lat: number | null | undefined;
  lng: number | null | undefined;
}

export const buildNavigationUrl = (
  label: string,
  coordinates?: NavigationCoordinates,
): string | null => {
  const trimmedLabel = label?.trim();
  const hasCoordinates = coordinates?.lat != null && coordinates?.lng != null;
  if (!trimmedLabel && !hasCoordinates) return null;

  const destination = hasCoordinates
    ? `${coordinates.lat},${coordinates.lng}`
    : trimmedLabel;

  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: 'driving',
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export const openNavigation = (
  label: string,
  coordinates?: NavigationCoordinates,
): void => {
  const url = buildNavigationUrl(label, coordinates);
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
};
