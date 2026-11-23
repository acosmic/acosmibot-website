/** Focus helpers shared by the drawer and popovers. */

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const focusableIn = (container: HTMLElement | null): HTMLElement[] =>
  container
    ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => !element.closest('[hidden]'))
    : [];

/** Keeps Tab and Shift+Tab inside `container`. Call from a keydown handler. */
export function trapTab(event: KeyboardEvent, container: HTMLElement | null): void {
  if (event.key !== 'Tab' || !container) return;
  const items = focusableIn(container);
  if (!items.length) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

/** Where portals should mount so the dashboard tokens apply. */
export const portalRoot = (): HTMLElement => document.querySelector<HTMLElement>('.dashboard-shell') ?? document.body;
