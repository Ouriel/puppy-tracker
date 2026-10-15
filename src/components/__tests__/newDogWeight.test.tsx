// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DogHealthSummary } from '../DogHealthSummary';
import { WeightGrowthChart } from '../WeightGrowthChart';
import { BALMA } from '../../utils/__tests__/fixtures';

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

async function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
  return container;
}

// A new dog gets a made-up 4.5 kg profile weight. A female Chihuahua's breed baseline is 2.5 kg.
const newChihuahua = { ...BALMA, breed: 'Chihuahua', birthDate: '2026-06-18', weightKg: 4.5 };

describe('a new dog before its first weigh-in: breed baseline, never the made-up profile weight', () => {
  it.each([
    ['health summary', () => <DogHealthSummary profile={newChihuahua} activities={[]} weightActivities={[]} onOpenHealthPassport={vi.fn()} />],
    ['weight chart', () => <WeightGrowthChart profile={newChihuahua} activities={[]} onOpenQuickLogModal={vi.fn()} />],
  ])('%s: adult range and current weight from the breed, no logged weight', async (_name, element) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-10T12:00:00+02:00')); // 12 weeks old

    const container = await render(element());

    expect(container.textContent).toContain('2.2–2.9 kg'); // 2.5 kg -12 % / +15 %
    expect(container.textContent).toContain('~1.25 kg'); // 50 % of 2.5 kg at 12 weeks
    expect(container.textContent).not.toContain('4.5 kg');
    expect(container.textContent).toContain('—'); // no logged weight yet
    expect(container.textContent).not.toContain('undefined');
  });
});
