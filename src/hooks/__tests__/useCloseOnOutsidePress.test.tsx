// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useCloseOnOutsidePress } from '../useCloseOnOutsidePress';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function Menu() {
  const [isOpen, setIsOpen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  useCloseOnOutsidePress(ref, isOpen, setIsOpen);
  return <div ref={ref}><button type="button" onClick={() => setIsOpen(true)}>Export</button>{isOpen && <span>menu</span>}</div>;
}

describe('useCloseOnOutsidePress: the export menus close as before', () => {
  it('a press inside keeps the menu open; a press outside, a touch outside or Escape closes it', async () => {
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    await act(async () => root.render(<Menu />));
    const button = container.querySelector('button')!;
    const isOpen = () => container.textContent!.includes('menu');

    await act(async () => { button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
    expect(isOpen()).toBe(true);

    for (const close of [new MouseEvent('mousedown', { bubbles: true }), new TouchEvent('touchstart', { bubbles: true }), new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })]) {
      await act(async () => button.click());
      expect(isOpen()).toBe(true);
      await act(async () => { (close instanceof KeyboardEvent ? button : document.body).dispatchEvent(close); });
      expect(isOpen(), close.type).toBe(false);
    }
    await act(async () => root.unmount());
  });
});
