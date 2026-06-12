/**
 * Imperative toast for code that runs outside React (the legacy feature
 * bridge). Visuals match SaveBar's success/error/info toasts.
 */

type ToastType = 'success' | 'error' | 'info' | string;

const COLORS: Record<string, string> = {
  success: 'var(--success-color, #3ecf8e)',
  error: 'var(--error-color, #ef4444)',
  info: 'var(--primary-color, #00d9ff)',
};

// Static lucide SVG markup (Check / TriangleAlert / Info) — mirrors the icons
// SaveBar renders via lucide-react. stroke="currentColor" inherits the toast's
// per-type color.
const SVG_ATTRS =
  'xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" ' +
  'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

const ICONS: Record<string, string> = {
  success: `<svg ${SVG_ATTRS}><path d="M20 6 9 17l-5-5"/></svg>`,
  error: `<svg ${SVG_ATTRS}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  info: `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
};

let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (container && document.body.contains(container)) return container;
  container = document.createElement('div');
  container.style.cssText =
    'position:fixed;bottom:20px;left:20px;right:20px;z-index:1100;' +
    'display:flex;flex-direction:column;gap:8px;pointer-events:none;';
  document.body.appendChild(container);
  return container;
}

export function showToast(message: string, type: ToastType = 'info'): void {
  const color = COLORS[type] ?? COLORS.info;
  const icon = ICONS[type] ?? ICONS.info;

  const toast = document.createElement('div');
  toast.setAttribute('role', 'status');
  toast.style.cssText =
    `padding:16px 32px;border-radius:16px;font-weight:600;display:flex;` +
    `align-items:center;gap:12px;background:var(--bg-card,#1a1a1a);` +
    `border:1px solid ${color};color:${color};` +
    `box-shadow:0 -10px 40px rgba(0,0,0,0.35);pointer-events:auto;` +
    `opacity:0;transform:translateY(8px);transition:opacity .2s ease,transform .2s ease;`;

  const iconEl = document.createElement('span');
  iconEl.style.display = 'flex';
  iconEl.innerHTML = icon;
  const msgEl = document.createElement('span');
  msgEl.textContent = message;
  toast.append(iconEl, msgEl);

  getContainer().appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 250);
  }, type === 'error' ? 5000 : 3000);
}
