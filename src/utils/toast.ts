import { toast } from '@heroui/react';

export type ToastType = 'success' | 'error' | 'danger' | 'warning' | 'info';

export function showToast(msg: string, type: ToastType = 'info') {
  if (type === 'success') toast.success(msg);
  else if (type === 'error' || type === 'danger') toast.danger(msg);
  else toast(msg);
}
