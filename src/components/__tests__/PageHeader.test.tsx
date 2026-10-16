// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Settings } from 'lucide-react';
import { PageHeader } from '../common/PageHeader';

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

async function render(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
  return container;
}

describe('PageHeader', () => {
  it('lays the icon, the title with its subtitle, and the action out in one row', async () => {
    const container = await render(
      <PageHeader icon={Settings} title="Dog Profiles" subtitle="Manage the dogs" action={<button type="button">Add a dog</button>} />,
    );

    const title = container.querySelector('h2')!;
    expect(title.textContent).toBe('Dog Profiles');
    const textBlock = title.parentElement!;
    expect(textBlock.textContent).toBe('Dog ProfilesManage the dogs');
    // HeroUI's card content is a column: the header has to ask for a row, and the text block takes what is left
    const row = textBlock.parentElement!;
    expect(row.classList.contains('flex-row')).toBe(true);
    expect(textBlock.classList.contains('flex-1')).toBe(true);
    expect(textBlock.classList.contains('min-w-0')).toBe(true);
    const action = container.querySelector('button')!;
    expect(row.contains(action)).toBe(true);
    expect(row.querySelector('svg')).not.toBeNull();
  });

  it('renders no subtitle or action when none is given', async () => {
    const container = await render(<PageHeader icon={Settings} title="Settings" />);

    expect(container.querySelector('h2')!.textContent).toBe('Settings');
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });
});
