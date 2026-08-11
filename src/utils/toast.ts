import { toast as heroToast } from '@heroui/react';

export type ToastType = 'success' | 'error' | 'danger' | 'warning' | 'info';

export function showToast(msg: string, type: ToastType = 'info') {
  switch (type) {
    case 'success':
      heroToast.success(msg);
      break;
    case 'error':
    case 'danger':
      heroToast.danger(msg);
      break;
    case 'info':
    case 'warning':
    default:
      heroToast(msg);
      break;
  }
}

export function onToast(_callback: (msg: string, type: ToastType) => void) {
  // No-op: HeroUI ToastProvider handles toast rendering
}
