export const resolveThemeColor = (element: HTMLElement, token: `--${string}`): string => {
  const tokenValue = window.getComputedStyle(element).getPropertyValue(token).trim();

  if (!tokenValue) {
    return window.getComputedStyle(element).color;
  }

  const probe = document.createElement('span');
  probe.style.color = `hsl(${tokenValue})`;
  probe.style.display = 'none';
  element.appendChild(probe);
  const resolved = window.getComputedStyle(probe).color;
  probe.remove();

  return resolved || window.getComputedStyle(element).color;
};
