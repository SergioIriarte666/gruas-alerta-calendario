// Dedicated DOM node for all Radix UI portals.
//
// backdrop-filter on DialogOverlay and transform on DialogContent each create
// a new CSS stacking context. Even though Radix portals mount to <body>, the
// browser compositor can still trap z-index comparisons when a backdrop-filter
// sibling is present. A dedicated container that is:
//   - a direct child of <body>
//   - has no filter, transform, opacity, will-change, or isolation CSS
//   - is appended AFTER the React root
// guarantees that every overlay (Popover, Select, DropdownMenu, Tooltip)
// lives in an independent, top-level stacking context with correct z-ordering.

let _container: HTMLElement | null = null;

export function getPortalContainer(): HTMLElement {
  if (!_container) {
    const existing = document.getElementById('radix-portal-root');
    if (existing instanceof HTMLElement) {
      _container = existing;
    } else {
      _container = document.createElement('div');
      _container.id = 'radix-portal-root';
      document.body.appendChild(_container);
    }
  }
  _container.removeAttribute('style');
  return _container;
}
