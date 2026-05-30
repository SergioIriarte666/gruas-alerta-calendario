export const openNavigation = (destination: string): void => {
  if (!destination?.trim()) return;
  const encoded = encodeURIComponent(destination.trim());
  window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank');
};
