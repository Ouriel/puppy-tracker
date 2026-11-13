// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from '@heroui/react';
import { AppToastProvider } from '../common/AppToastProvider';
import { I18nProvider } from '../../i18n';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  // A phone
  window.matchMedia ??= ((query: string) => ({
    matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

afterEach(async () => {
  await act(async () => toast.clear());
  document.body.innerHTML = '';
});

describe('app toast', () => {
  // HeroUI 3.2.7 spaces the action from the text with its grid; inside the text block it touched it (a one-tap log's Undo)
  it('on a phone, the action is a cell of the toast, not part of its text', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(<I18nProvider><AppToastProvider /></I18nProvider>));
    await act(async () => {
      toast.success('Logged: Peed Outside', { actionProps: { children: 'Undo', onPress: vi.fn() } });
    });

    const undo = [...document.querySelectorAll('button')].find((button) => button.textContent === 'Undo')!;
    expect(undo.closest('.toast__content')).toBeNull();
    expect(undo.parentElement!.classList.contains('toast')).toBe(true);
    await act(async () => root.unmount());
  });
});
