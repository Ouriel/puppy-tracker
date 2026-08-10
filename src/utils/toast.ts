export type ToastType = 'success' | 'error' | 'info';

type Listener = (msg: string, type: ToastType) => void;

let listener: Listener | null = null;

export function onToast(fn: Listener) {
  listener = fn;
}

export function showToast(msg: string, type: ToastType = 'info') {
  listener?.(msg, type);
}
