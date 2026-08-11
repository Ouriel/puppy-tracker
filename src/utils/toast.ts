import { toast as heroToast } from '@heroui/react';

export type ToastType = 'success' | 'error' | 'info';

export function showToast(msg: string, type: ToastType = 'info') {
  switch (type) {
    case 'success':
      heroToast.success(msg);
      break;
    case 'error':
      heroToast.danger(msg);
      break;
    case 'info':
    default:
      heroToast(msg);
      break;
  }
}

// Keep onToast export for backward compatibility but make it a no-op
// since HeroUI's ToastProvider handles rendering now
export function onToast(_callback: (msg: string, type: ToastType) => void) {
  // No-op: HeroUI ToastProvider handles toast rendering
}
