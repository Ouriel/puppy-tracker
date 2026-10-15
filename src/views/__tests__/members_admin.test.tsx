// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Caretaker, UserAccount } from '../../types';
import { SUPER_ADMIN_EMAIL } from '../../utils/auth';
import { HouseholdView } from '../HouseholdView';
import { AdminView } from '../AdminView';

const apiMock = vi.hoisted(() => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  fetchUsers: vi.fn(),
  fetchAllHouseholds: vi.fn(),
}));
vi.mock('../../services/api', () => apiMock);

let root: Root | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // jsdom lacks these; the HeroUI / react-aria modal reads them.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  Object.values(apiMock).forEach((mock) => mock.mockReset());
  apiMock.createUser.mockResolvedValue({ ok: true, data: {} });
  apiMock.updateUser.mockResolvedValue({ ok: true, data: {} });
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

async function render(element: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(element));
  // AdminView loads its lists on a 0 ms timer.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

const buttons = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].filter((button) => button.textContent?.trim() === text);

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

async function setValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

const owner: UserAccount = { id: 'usr-owner', email: SUPER_ADMIN_EMAIL, name: 'Owner Fullname', role: 'SuperAdmin' };
const member: UserAccount = { id: 'usr-member', email: 'member@example.com', name: 'Member Person', role: 'Member' };
const badges: Caretaker[] = [
  { id: 'c-owner', name: 'Matthieu', role: 'Member', color: '#EC4899', email: SUPER_ADMIN_EMAIL },
  { id: 'c-daria', name: 'Daria', role: 'Member', color: '#10B981', email: 'daria@example.com' },
];
const FIRST_FREE_COLOR = '#F59E0B';

function renderMembers(user: UserAccount, caretakers: Caretaker[] = badges) {
  const handlers = { onAddCaretaker: vi.fn(), onUpdateCaretaker: vi.fn(), onDeleteCaretaker: vi.fn() };
  return render(<HouseholdView caretakers={caretakers} user={user} {...handlers} />).then(() => handlers);
}

async function inviteFromMembersTab(email: string) {
  await click(buttons('Pre-Approve Member Email')[0]);
  await setValue(document.querySelector<HTMLInputElement>('form input[type="email"]')!, email);
  await click(buttons('Send Authorization')[0]);
}

describe('Members tab invite (19, 20, 42)', () => {
  it('creates the badge linked to the invited email, named from it, in the first free colour, and sends no name', async () => {
    const { onAddCaretaker } = await renderMembers(owner);
    await inviteFromMembersTab('Jane.Doe@example.com');

    expect(apiMock.createUser).toHaveBeenCalledTimes(1);
    expect(apiMock.createUser.mock.calls[0][0]).toEqual({ email: 'jane.doe@example.com', role: 'Member', status: 'ACTIVE' });
    expect(onAddCaretaker).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Jane', email: 'jane.doe@example.com', color: FIRST_FREE_COLOR, role: 'Member' })
    );
  });

  it('asks before moving someone who already has an account, then resends with confirmMove and only then adds the badge', async () => {
    apiMock.createUser.mockResolvedValueOnce({ ok: false, status: 409, error: 'exists' });
    const { onAddCaretaker } = await renderMembers(owner);
    await inviteFromMembersTab('jane.doe@example.com');

    expect(document.body.textContent).toContain('This person already has an account. Add them to your family?');
    expect(onAddCaretaker).not.toHaveBeenCalled();

    await click(buttons('Add to family')[0]);
    expect(apiMock.createUser).toHaveBeenCalledTimes(2);
    expect(apiMock.createUser.mock.calls[1][0]).toMatchObject({ email: 'jane.doe@example.com', confirmMove: true });
    expect(onAddCaretaker).toHaveBeenCalledWith(expect.objectContaining({ email: 'jane.doe@example.com' }));
  });

  it('shows the pre-approve button only to the owner (the server refuses members)', async () => {
    await renderMembers(member);
    expect(buttons('Pre-Approve Member Email')).toHaveLength(0);
  });

  it('opens "Add Member" on the first colour no badge uses', async () => {
    await renderMembers(owner);
    await click(buttons('Add Member')[0]);
    expect(document.querySelector<HTMLInputElement>('form input[type="color"]')!.value.toUpperCase()).toBe(FIRST_FREE_COLOR);
  });
});

describe('Members tab identity (22)', () => {
  it('lights the active chip and hides the delete button on the badge linked by email, not on a same-name badge', async () => {
    const twins: Caretaker[] = [
      { id: 'c-1', name: 'Alex', role: 'Member', color: '#EC4899' },
      { id: 'c-2', name: 'Alex', role: 'Member', color: '#10B981', email: 'alex@example.com' },
    ];
    await renderMembers({ ...member, email: 'alex@example.com', name: 'Alex' }, twins);

    expect(document.body.textContent?.match(/Active/g)).toHaveLength(1);
    expect(document.querySelectorAll('[aria-label="Delete Member"]')).toHaveLength(1);
  });

  it('"This is me" links my unlinked badge to my login, and is not offered on a badge linked to someone else', async () => {
    const caretakers: Caretaker[] = [{ id: 'c-guest', name: 'Guest', role: 'Member', color: '#F59E0B' }, ...badges];
    const { onUpdateCaretaker } = await renderMembers(member, caretakers);
    const pencils = () => document.querySelectorAll<HTMLButtonElement>('[aria-label="Edit Member Name & Color"]');

    await click(pencils()[2]);
    expect(document.body.textContent).not.toContain('This is me');
    await click(buttons('')[buttons('').length - 1]);

    await click(pencils()[0]);
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.checked).toBe(false);
    await click(checkbox);
    await click(buttons('Save Changes')[0]);

    expect(onUpdateCaretaker).toHaveBeenCalledWith('c-guest', expect.objectContaining({ name: 'Guest', email: 'member@example.com' }));
  });
});

describe('Admin panel (27, 28)', () => {
  const pendingStranger = { id: 'usr-jane', email: 'jane.doe@example.com', name: 'Jane Doe', householdId: 'house-stranger', role: 'Member', status: 'PENDING_APPROVAL' };
  const ownerRow = { id: 'usr-owner', email: SUPER_ADMIN_EMAIL, name: 'Owner Fullname', householdId: 'FAMILY-COCKER-2026', role: 'SuperAdmin', status: 'ACTIVE' };

  async function renderAdmin() {
    apiMock.fetchUsers.mockResolvedValue({ ok: true, data: [ownerRow, pendingStranger] });
    apiMock.fetchAllHouseholds.mockResolvedValue({
      ok: true,
      data: [
        { id: 'FAMILY-COCKER-2026', name: 'Family Pack (Main)' },
        { id: 'hh-other', name: 'Other Family' },
      ],
    });
    const onAddCaretaker = vi.fn();
    await render(<AdminView currentUserEmail={SUPER_ADMIN_EMAIL} caretakers={badges} onAddCaretaker={onAddCaretaker} />);
    return { onAddCaretaker };
  }

  const assignSelect = () => document.querySelectorAll<HTMLSelectElement>('select')[0];

  it("'Assign to' defaults to the user's own household, and Approve keeps them there", async () => {
    await renderAdmin();
    expect(assignSelect().value).toBe('house-stranger');

    await click(buttons('Approve & Assign')[0]);
    expect(apiMock.updateUser).toHaveBeenCalledWith({ email: 'jane.doe@example.com', status: 'ACTIVE', householdId: 'house-stranger' });
  });

  it("joining the owner's family is an explicit choice, confirmed first", async () => {
    await renderAdmin();
    await setValue(assignSelect(), 'FAMILY-COCKER-2026');
    await click(buttons('Approve & Assign')[0]);

    expect(apiMock.updateUser).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Add jane.doe@example.com to Family Pack (Main)?');

    await click(buttons('Approve & Assign').at(-1)!);
    expect(apiMock.updateUser).toHaveBeenCalledWith({ email: 'jane.doe@example.com', status: 'ACTIVE', householdId: 'FAMILY-COCKER-2026' });
  });

  async function preApprove(email: string) {
    const form = [...document.querySelectorAll('form')].at(-1)!;
    await setValue(form.querySelector<HTMLInputElement>('input[type="email"]')!, email);
    await click(buttons('Pre-Approve')[0]);
  }

  it('pre-approving into the own household creates the same linked badge as the Members tab, and sends no name', async () => {
    const { onAddCaretaker } = await renderAdmin();
    await preApprove('new.person@example.com');

    expect(apiMock.createUser.mock.calls[0][0]).toEqual({
      email: 'new.person@example.com',
      role: 'Member',
      status: 'ACTIVE',
      householdId: 'FAMILY-COCKER-2026',
    });
    expect(onAddCaretaker).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New', email: 'new.person@example.com', color: FIRST_FREE_COLOR })
    );
  });

  it('pre-approving into another household creates no badge', async () => {
    const { onAddCaretaker } = await renderAdmin();
    await setValue(document.querySelectorAll<HTMLSelectElement>('select')[1], 'hh-other');
    await preApprove('new.person@example.com');

    expect(apiMock.createUser.mock.calls[0][0]).toMatchObject({ householdId: 'hh-other' });
    expect(onAddCaretaker).not.toHaveBeenCalled();
  });

  it('asks before moving an existing account, then resends with confirmMove', async () => {
    apiMock.createUser.mockResolvedValueOnce({ ok: false, status: 409, error: 'exists' });
    const { onAddCaretaker } = await renderAdmin();
    await preApprove('jane.doe@example.com');

    expect(document.body.textContent).toContain('This person already has an account. Add them to your family?');
    await click(buttons('Add to family')[0]);

    expect(apiMock.createUser.mock.calls[1][0]).toMatchObject({ email: 'jane.doe@example.com', householdId: 'FAMILY-COCKER-2026', confirmMove: true });
    expect(onAddCaretaker).toHaveBeenCalledWith(expect.objectContaining({ email: 'jane.doe@example.com' }));
  });
});
