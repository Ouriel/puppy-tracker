// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from '@heroui/react';
import type { Caretaker, UserAccount } from '../../types';
import { SUPER_ADMIN_EMAIL } from '../../utils/auth';
import { CaretakerInputSchema } from '../../utils/schemas';
import { HouseholdView } from '../HouseholdView';
import { AdminView } from '../AdminView';

const apiMock = vi.hoisted(() => ({
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  fetchUsers: vi.fn(),
  fetchAllHouseholds: vi.fn(),
  fetchPrivacyRequests: vi.fn(),
  markPrivacyRequestHandled: vi.fn(),
  renameHousehold: vi.fn(),
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
  apiMock.fetchPrivacyRequests.mockResolvedValue({ ok: true, data: [] });
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

const owner: UserAccount = { email: SUPER_ADMIN_EMAIL, name: 'Owner Fullname', role: 'SuperAdmin' };
const member: UserAccount = { email: 'member@example.com', name: 'Member Person', role: 'Member' };
const familyAdmin: UserAccount = { email: 'admin@example.com', name: 'Family Admin', role: 'Admin' };
const badges: Caretaker[] = [
  { id: 'c-owner', name: 'Sam', role: 'Member', color: '#EC4899', email: SUPER_ADMIN_EMAIL },
  { id: 'c-alice', name: 'Alice', role: 'Member', color: '#10B981', email: 'alice@example.com' },
];
const FIRST_FREE_COLOR = '#F59E0B';

function renderMembers(user: UserAccount, caretakers: Caretaker[] = badges) {
  const handlers = { onAddCaretaker: vi.fn(), onUpdateCaretaker: vi.fn(), onDeleteCaretaker: vi.fn() };
  return render(<HouseholdView caretakers={caretakers} user={user} {...handlers} />).then(() => handlers);
}

async function inviteFromMembersTab(email: string) {
  await click(buttons('Invite a member')[0]);
  await setValue(document.querySelector<HTMLInputElement>('form input[type="email"]')!, email);
  await click(buttons('Invite')[0]);
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

    expect(document.body.textContent).toContain('This person already has an account. Add them to your household?');
    expect(onAddCaretaker).not.toHaveBeenCalled();

    await click(buttons('Add to household')[0]);
    expect(apiMock.createUser).toHaveBeenCalledTimes(2);
    expect(apiMock.createUser.mock.calls[1][0]).toMatchObject({ email: 'jane.doe@example.com', confirmMove: true });
    expect(onAddCaretaker).toHaveBeenCalledWith(expect.objectContaining({ email: 'jane.doe@example.com' }));
  });

  it('Cancel on that question moves nobody, adds no badge and closes it', async () => {
    apiMock.createUser.mockResolvedValueOnce({ ok: false, status: 409, error: 'exists' });
    const { onAddCaretaker } = await renderMembers(owner);
    await inviteFromMembersTab('jane.doe@example.com');

    await click(buttons('Cancel').at(-1)!);
    // The modal leaves with an exit animation.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));

    expect(apiMock.createUser).toHaveBeenCalledTimes(1);
    expect(onAddCaretaker).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain('This person already has an account');
  });

  it('Escape on that question moves nobody and adds no badge', async () => {
    apiMock.createUser.mockResolvedValueOnce({ ok: false, status: 409, error: 'exists' });
    const { onAddCaretaker } = await renderMembers(owner);
    await inviteFromMembersTab('jane.doe@example.com');

    await act(async () => {
      document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));

    expect(apiMock.createUser).toHaveBeenCalledTimes(1);
    expect(onAddCaretaker).not.toHaveBeenCalled();
  });

  it('shows the pre-approve button to an Admin, not to a member (the server refuses members)', async () => {
    await renderMembers(member);
    expect(buttons('Invite a member')).toHaveLength(0);
    await act(async () => root?.unmount());

    await renderMembers(familyAdmin);
    expect(buttons('Invite a member')).toHaveLength(1);
  });

  // Backlog 12: the first member of a new family is its Admin and invites the rest of it.
  it("an Admin's invite creates the same linked badge as the owner's", async () => {
    const { onAddCaretaker } = await renderMembers(familyAdmin);
    await inviteFromMembersTab('jane.doe@example.com');

    expect(apiMock.createUser.mock.calls[0][0]).toEqual({ email: 'jane.doe@example.com', role: 'Member', status: 'ACTIVE' });
    expect(onAddCaretaker).toHaveBeenCalledWith(expect.objectContaining({ name: 'Jane', email: 'jane.doe@example.com' }));
  });

  it('tells an Admin to ask the owner for someone who already has an account elsewhere: no move question, no badge', async () => {
    const danger = vi.spyOn(toast, 'danger').mockImplementation(() => '');
    apiMock.createUser.mockResolvedValueOnce({ ok: false, status: 409, error: 'exists' });
    const { onAddCaretaker } = await renderMembers(familyAdmin);
    await inviteFromMembersTab('jane.doe@example.com');

    expect(danger).toHaveBeenCalledWith('This person already has an account. Ask the owner to add them.');
    expect(document.body.textContent).not.toContain('Add them to your household?');
    expect(apiMock.createUser).toHaveBeenCalledTimes(1);
    expect(onAddCaretaker).not.toHaveBeenCalled();
    danger.mockRestore();
  });

  it('a second tap on Invite while the invite is in flight sends nothing more', async () => {
    let answer!: (result: unknown) => void;
    apiMock.createUser.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
    const { onAddCaretaker } = await renderMembers(owner);
    await inviteFromMembersTab('jane.doe@example.com');
    await click(buttons('Invite')[0]);

    expect(apiMock.createUser).toHaveBeenCalledTimes(1);
    expect(buttons('Invite')[0].disabled).toBe(true);
    await act(async () => answer({ ok: true, data: {} }));
    expect(onAddCaretaker).toHaveBeenCalledTimes(1);
  });

  it('opens "Add a member" on the first colour no badge uses', async () => {
    await renderMembers(owner);
    await click(buttons('Add a member')[0]);
    expect(document.querySelector<HTMLInputElement>('form input[type="color"]')!.value.toUpperCase()).toBe(FIRST_FREE_COLOR);
  });

  describe('sharing the invite', () => {
    afterEach(() => {
      Reflect.deleteProperty(navigator, 'share');
      Reflect.deleteProperty(navigator, 'clipboard');
    });

    it('Share sends the link Copy link copies to the share sheet; closing the sheet copies nothing', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      const writeText = vi.fn();
      Object.defineProperty(navigator, 'share', { value: share, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      await renderMembers(owner);
      await inviteFromMembersTab('jane.doe@example.com');

      await click(buttons('Share')[0]);
      expect(share).toHaveBeenCalledWith({ title: 'PupPace', text: 'Join our household on PupPace to follow our puppy.', url: window.location.origin });

      share.mockRejectedValueOnce(new DOMException('Share canceled', 'AbortError'));
      await click(buttons('Share')[0]);
      expect(writeText).not.toHaveBeenCalled();

      await click(buttons('Copy link')[0]);
      expect(writeText).toHaveBeenCalledWith(window.location.origin);
    });

    it('a browser with no share sheet shows Copy link only', async () => {
      await renderMembers(owner);
      await inviteFromMembersTab('jane.doe@example.com');

      expect(buttons('Copy link')).toHaveLength(1);
      expect(buttons('Share')).toHaveLength(0);
    });
  });
});

describe('Members tab identity (22)', () => {
  it('lights the active chip and hides the delete button on the badge linked by email, not on a same-name badge', async () => {
    const twins: Caretaker[] = [
      { id: 'c-1', name: 'Alex', role: 'Member', color: '#EC4899' },
      { id: 'c-2', name: 'Alex', role: 'Member', color: '#10B981', email: 'alex@example.com' },
    ];
    await renderMembers({ ...familyAdmin, email: 'alex@example.com', name: 'Alex' }, twins);

    expect(document.body.textContent?.match(/Active/g)).toHaveLength(1);
    expect(document.querySelectorAll('[aria-label="Delete Alex"]')).toHaveLength(1);
  });

  // Audit M3: the owner and the family's Admin delete badges; a member's delete would always get 403
  it("shows the family's Admin a delete button on each badge", async () => {
    await renderMembers(familyAdmin);
    expect(document.querySelectorAll('[aria-label^="Delete "]')).toHaveLength(2);
  });

  it('shows a member no delete button, only the pencils', async () => {
    await renderMembers(member);
    expect(document.querySelectorAll('[aria-label^="Delete "]')).toHaveLength(0);
    expect(document.querySelectorAll('[aria-label^="Edit "]')).toHaveLength(2);
  });

  it('"This is me" links my unlinked badge to my login, and is not offered on a badge linked to someone else', async () => {
    const caretakers: Caretaker[] = [{ id: 'c-guest', name: 'Guest', role: 'Member', color: '#F59E0B' }, ...badges];
    const { onUpdateCaretaker } = await renderMembers(member, caretakers);
    const pencils = () => document.querySelectorAll<HTMLButtonElement>('[aria-label^="Edit "]');

    await click(pencils()[2]);
    expect(document.body.textContent).not.toContain('This is me');
    await click(buttons('')[buttons('').length - 1]);

    await click(pencils()[0]);
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.checked).toBe(false);
    await click(checkbox);
    await click(buttons('Save')[0]);

    expect(onUpdateCaretaker).toHaveBeenCalledWith('c-guest', expect.objectContaining({ name: 'Guest', email: 'member@example.com' }));
  });

  const pencils = () => document.querySelectorAll<HTMLButtonElement>('[aria-label^="Edit "]');

  it('"This is me" starts ticked on my own badge, and renaming it keeps the link (sends no email)', async () => {
    const { onUpdateCaretaker } = await renderMembers(owner);
    await click(pencils()[0]);

    expect(document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
    await setValue(document.querySelector<HTMLInputElement>('input[type="text"]')!, 'Matt');
    await click(buttons('Save')[0]);

    expect(onUpdateCaretaker).toHaveBeenCalledTimes(1);
    expect(onUpdateCaretaker.mock.calls[0][1]).toMatchObject({ name: 'Matt' });
    expect(onUpdateCaretaker.mock.calls[0][1]).not.toHaveProperty('email');
  });

  it('unticking "This is me" on my own badge unlinks it', async () => {
    const { onUpdateCaretaker } = await renderMembers(owner);
    await click(pencils()[0]);
    await click(document.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
    await click(buttons('Save')[0]);

    expect(onUpdateCaretaker).toHaveBeenCalledWith('c-owner', expect.objectContaining({ email: '' }));
  });

  it('offers no "This is me" to a member on their own linked badge: only the owner unlinks', async () => {
    await renderMembers(member, [{ id: 'c-member', name: 'Member', role: 'Member', color: '#10B981', email: 'member@example.com' }]);
    await click(pencils()[0]);

    expect(document.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('offers no "This is me" on an unlinked badge while another badge carries my email', async () => {
    const caretakers: Caretaker[] = [{ id: 'c-guest', name: 'Guest', role: 'Member', color: '#F59E0B' }, ...badges];
    await renderMembers(owner, caretakers);
    await click(pencils()[0]);

    expect(document.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('reads "C\'est moi" and the move question in French', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    try {
      apiMock.createUser.mockResolvedValueOnce({ ok: false, status: 409, error: 'exists' });
      await renderMembers(owner, [{ id: 'c-guest', name: 'Guest', role: 'Member', color: '#F59E0B' }]);
      await click(document.querySelector<HTMLButtonElement>('[aria-label="Modifier Guest"]')!);
      expect(document.body.textContent).toContain("C'est moi");

      await click([...document.querySelectorAll('button')].find((button) => /Inviter un membre/.test(button.textContent ?? ''))!);
      await setValue(document.querySelector<HTMLInputElement>('form input[type="email"]')!, 'x@example.com');
      await act(async () => document.querySelector<HTMLFormElement>('form:has(input[type="email"])')!.requestSubmit());

      expect(document.body.textContent).toContain("Cette personne a déjà un compte. L'ajouter à ton foyer\u00a0?");
      expect(buttons('Ajouter')).toHaveLength(1);
    } finally {
      localStorage.removeItem('puppace_lang_v1');
    }
  });
});

// App review 2026-10-16, Settings: Members, and owner decision 13 (each badge's linked email is shown to the whole household)
describe('Members list layout', () => {
  const rowOf = (name: string) =>
    [...document.querySelectorAll('li')].find((row) => row.querySelector('.font-bold')?.textContent === name)!;
  // The name and its chip; the email is the element right after it
  const nameLine = (row: HTMLElement) => row.querySelector('.font-bold')!.parentElement!;
  const actions = (row: HTMLElement) => row.lastElementChild!;

  it('shows the linked email under each linked name, to a member too; an unlinked badge shows none', async () => {
    await renderMembers(member, [...badges, { id: 'c-guest', name: 'Guest', role: 'Member', color: '#F59E0B' }]);

    expect(nameLine(rowOf('Alice')).nextElementSibling!.textContent).toBe('alice@example.com');
    expect(nameLine(rowOf('Sam')).nextElementSibling!.textContent).toBe(SUPER_ADMIN_EMAIL);
    expect(rowOf('Guest').textContent).not.toContain('@');
  });

  // The pencil at the row's edge: before it, on your own row, an empty slot looked like a missing button
  it('every row ends with the same action column: the trash or an empty 44 px slot on your own row, then the pencil', async () => {
    await renderMembers(owner);

    for (const name of ['Sam', 'Alice']) {
      const column = actions(rowOf(name));
      expect(column.children, name).toHaveLength(2);
      expect(column.children[1].getAttribute('aria-label')).toBe(`Edit ${name}`);
    }
    expect(actions(rowOf('Alice')).children[0].getAttribute('aria-label')).toBe('Delete Alice');
    const ownSlot = actions(rowOf('Sam')).children[0];
    expect(ownSlot.getAttribute('aria-hidden')).toBe('true');
    expect(ownSlot.classList).toContain('w-11');
    // "Active" sits next to the name, not in the action column
    expect(actions(rowOf('Sam')).textContent).not.toContain('Active');
    expect(nameLine(rowOf('Sam')).textContent).toContain('Active');
  });

  it('a long name wraps to 2 lines and a long email wraps, rather than being cut or pushing the row wider', async () => {
    const longName = 'Marie-Charlotte de La Rochefoucauld';
    const longEmail = 'marie-charlotte.delarochefoucauld@example.com';
    await renderMembers(owner, [{ id: 'c-long', name: longName, role: 'Member', color: '#10B981', email: longEmail }]);

    const name = rowOf(longName).querySelector('.font-bold')!;
    expect(name.classList).toContain('line-clamp-2');
    expect(name.classList).toContain('break-words');
    expect(name.classList).not.toContain('truncate');
    const email = [...rowOf(longName).querySelectorAll('div')].find((element) => element.textContent === longEmail)!;
    expect(email.classList).toContain('break-all');
  });

  it('editing: "This is me" has its own line under the name, with Save and close below it', async () => {
    await renderMembers(owner);
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Edit Sam"]')!);

    const label = document.querySelector('input[type="checkbox"]')!.closest('label')!;
    expect(label.previousElementSibling!.querySelector('input[type="text"]')).not.toBeNull();
    expect(label.nextElementSibling!.textContent).toContain('Save');
  });

  it('"Add a member" turns into a close button with an X while the form is open', async () => {
    await renderMembers(owner);
    await click(buttons('Add a member')[0]);

    const toggle = buttons('Cancel')[0];
    expect(toggle.querySelector('.lucide-x')).not.toBeNull();
    expect(toggle.querySelector('.lucide-user-plus')).toBeNull();
  });

  it('the invite email box takes the full width on a phone, the send button under it', async () => {
    await renderMembers(owner);
    await click(buttons('Invite a member')[0]);

    const emailRow = document.querySelector('form input[type="email"]')!.parentElement!.parentElement!;
    expect(emailRow.classList).toContain('flex-col');
    expect(emailRow.innerHTML).not.toContain('min-w-[200px]');
  });
});

// Improvement backlog 18: the boxes stop where the server's limit stops, so a typed name is never refused on save
describe('Members tab name limits', () => {
  it('the new badge and badge rename boxes stop at the length the server accepts', async () => {
    await renderMembers(owner);
    await click(buttons('Add a member')[0]);
    await click(document.querySelector<HTMLButtonElement>('[aria-label^="Edit "]')!);

    const nameBoxes = [...document.querySelectorAll<HTMLInputElement>('input[type="text"]')];
    expect(nameBoxes).toHaveLength(2);
    for (const box of nameBoxes) {
      expect(box.maxLength).toBeGreaterThan(0);
      expect(CaretakerInputSchema.safeParse({ name: 'a'.repeat(box.maxLength) }).success).toBe(true);
      expect(CaretakerInputSchema.safeParse({ name: 'a'.repeat(box.maxLength + 1) }).success).toBe(false);
    }
  });

  it('"Save" with the name emptied says the name is needed and saves nothing', async () => {
    const { onUpdateCaretaker } = await renderMembers(owner);
    await click(document.querySelector<HTMLButtonElement>('[aria-label="Edit Alice"]')!);
    const nameBox = document.querySelector<HTMLInputElement>('input[aria-label="Member name"]')!;
    await setValue(nameBox, '  ');
    await click(buttons('Save')[0]);

    expect(onUpdateCaretaker).not.toHaveBeenCalled();
    expect(nameBox.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(nameBox.getAttribute('aria-describedby')!)!.textContent).toBe('Enter the name');
  });
});

describe('Admin panel (27, 28)', () => {
  const pendingStranger = { id: 'usr-jane', email: 'jane.doe@example.com', name: 'Jane Doe', householdId: 'house-stranger', role: 'Member', status: 'PENDING_APPROVAL' };
  const ownerRow = { id: 'usr-owner', email: SUPER_ADMIN_EMAIL, name: 'Owner Fullname', householdId: 'FAMILY-COCKER-2026', role: 'SuperAdmin', status: 'ACTIVE' };
  const activeElsewhere = { id: 'usr-bob', email: 'bob.smith@example.com', name: 'Bob Smith', householdId: 'hh-other', role: 'Member', status: 'ACTIVE' };

  async function renderAdmin(users = [ownerRow, pendingStranger, activeElsewhere]) {
    apiMock.fetchUsers.mockResolvedValue({ ok: true, data: users });
    apiMock.fetchAllHouseholds.mockResolvedValue({
      ok: true,
      // As the API lists them: a household the owner has not named comes with no name
      data: [
        { id: 'FAMILY-COCKER-2026', name: null },
        { id: 'house-stranger', name: null },
        { id: 'hh-other', name: 'Other Family' },
        { id: 'hh-third', name: 'Third Family' },
      ],
    });
    const onAddCaretaker = vi.fn();
    await render(<AdminView currentUserEmail={SUPER_ADMIN_EMAIL} caretakers={badges} onAddCaretaker={onAddCaretaker} />);
    return { onAddCaretaker };
  }

  const assignSelect = () => document.querySelectorAll<HTMLSelectElement>('select')[0];

  it('lists the privacy requests from /privacy, says whether an account has the email, and marks one answered', async () => {
    const request = { id: 'prq-1', email: 'bob.smith@example.com', kind: 'erase', message: 'Please delete everything', lang: 'fr', createdAt: '2026-11-20T10:00:00.000Z', handledAt: null };
    const stranger = { ...request, id: 'prq-2', email: 'nobody@example.com', kind: 'access', message: null, lang: 'en' };
    apiMock.fetchPrivacyRequests.mockResolvedValue({ ok: true, data: [request, stranger] });
    apiMock.markPrivacyRequestHandled.mockResolvedValue({ ok: true, data: { ...request, handledAt: '2026-11-22T09:00:00.000Z' } });
    await renderAdmin();

    expect(document.body.textContent).toContain('Privacy requests (2 to answer)');
    expect(document.body.textContent).toContain('Delete my account and data');
    expect(document.body.textContent).toContain('Please delete everything');
    expect(document.body.textContent).toContain('Account found');
    expect(document.body.textContent).toContain('No account with this email');

    await click(buttons('Mark as answered')[0]);
    expect(apiMock.markPrivacyRequestHandled).toHaveBeenCalledWith('prq-1');
    expect(document.body.textContent).toContain('Privacy requests (1 to answer)');
    expect(document.body.textContent).toMatch(/Answered on/);
  });

  it("'Assign to' defaults to the user's own household, and Approve keeps them there, with no badge in the family", async () => {
    const { onAddCaretaker } = await renderAdmin();
    expect(assignSelect().value).toBe('house-stranger');

    await click(buttons('Approve and assign')[0]);
    expect(apiMock.updateUser).toHaveBeenCalledWith({ email: 'jane.doe@example.com', status: 'ACTIVE', householdId: 'house-stranger' });
    expect(onAddCaretaker).not.toHaveBeenCalled();
  });

  it('shows the role the approval gave: a sign-up approved alone in its household is its Admin', async () => {
    apiMock.updateUser.mockResolvedValueOnce({ ok: true, data: { ...pendingStranger, status: 'ACTIVE', role: 'Admin' } });
    await renderAdmin();
    await click(buttons('Approve and assign')[0]);

    const janeRow = [...document.querySelectorAll('div')].find((element) => element.childElementCount === 0 && element.textContent === pendingStranger.email)!.parentElement!;
    expect(janeRow.textContent).toContain('Admin');
  });

  // Offline, Revoke did nothing and Delete closed its dialog with the account still listed, both without a word
  it('a Revoke the server never takes says why in a toast, and the account stays active', async () => {
    const danger = vi.spyOn(toast, 'danger').mockImplementation(() => '');
    apiMock.updateUser.mockResolvedValueOnce({ ok: false, status: 0, errorKey: 'offline' });
    await renderAdmin();
    await click(buttons('Revoke')[0]);

    expect(danger).toHaveBeenCalledWith('No connection, nothing was saved.');
    expect(buttons('Revoke')).toHaveLength(1);
    danger.mockRestore();
  });

  it('a Delete the server never takes says why in a toast, and the account stays listed', async () => {
    const danger = vi.spyOn(toast, 'danger').mockImplementation(() => '');
    apiMock.deleteUser.mockResolvedValueOnce({ ok: false, status: 0, errorKey: 'offline' });
    await renderAdmin();
    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Delete bob.smith@example.com"]')!);
    await click(buttons('Delete account').at(-1)!);

    expect(danger).toHaveBeenCalledWith('No connection, nothing was saved.');
    expect(document.body.textContent).toContain('bob.smith@example.com');
    danger.mockRestore();
  });

  // A stale row: a family Admin took the sign-up in since the panel loaded, and the server refuses (409).
  it('reloads the accounts when an approval is refused, so a stale row shows where the account is now', async () => {
    apiMock.updateUser.mockResolvedValueOnce({ ok: false, status: 409, error: 'no longer pending' });
    await renderAdmin();
    expect(apiMock.fetchUsers).toHaveBeenCalledTimes(1);

    await click(buttons('Approve and assign')[0]);
    expect(apiMock.fetchUsers).toHaveBeenCalledTimes(2);
  });

  it('an approval the server never takes says why in a toast', async () => {
    const danger = vi.spyOn(toast, 'danger').mockImplementation(() => '');
    apiMock.updateUser.mockResolvedValueOnce({ ok: false, status: 0, errorKey: 'offline' });
    await renderAdmin();
    await click(buttons('Approve and assign')[0]);

    expect(danger).toHaveBeenCalledWith('No connection, nothing was saved.');
    danger.mockRestore();
  });

  it("joining the owner's family is an explicit choice, confirmed first, and creates the same linked badge as an invite", async () => {
    const { onAddCaretaker } = await renderAdmin();
    await setValue(assignSelect(), 'FAMILY-COCKER-2026');
    await click(buttons('Approve and assign')[0]);

    expect(apiMock.updateUser).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Add jane.doe@example.com to Owner Fullname's household?");

    await click(buttons('Approve and assign').at(-1)!);
    expect(apiMock.updateUser).toHaveBeenCalledWith({ email: 'jane.doe@example.com', status: 'ACTIVE', householdId: 'FAMILY-COCKER-2026' });
    expect(onAddCaretaker).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Jane', email: 'jane.doe@example.com', color: FIRST_FREE_COLOR })
    );
  });

  it('Cancel on the join question approves nobody', async () => {
    await renderAdmin();
    await setValue(assignSelect(), 'FAMILY-COCKER-2026');
    await click(buttons('Approve and assign')[0]);
    await click(buttons('Cancel').at(-1)!);

    expect(apiMock.updateUser).not.toHaveBeenCalled();
  });

  async function preApprove(email: string) {
    const form = [...document.querySelectorAll('form')].at(-1)!;
    await setValue(form.querySelector<HTMLInputElement>('input[type="email"]')!, email);
    await click(buttons('Invite')[0]);
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

    expect(document.body.textContent).toContain('This person already has an account. Add them to your household?');
    await click(buttons('Add to household')[0]);

    expect(apiMock.createUser.mock.calls[1][0]).toMatchObject({ email: 'jane.doe@example.com', householdId: 'FAMILY-COCKER-2026', confirmMove: true });
    expect(onAddCaretaker).toHaveBeenCalledWith(expect.objectContaining({ email: 'jane.doe@example.com' }));
  });

  it('Cancel on that question moves nobody and adds no badge', async () => {
    apiMock.createUser.mockResolvedValueOnce({ ok: false, status: 409, error: 'exists' });
    const { onAddCaretaker } = await renderAdmin();
    await preApprove('jane.doe@example.com');
    await click(buttons('Cancel').at(-1)!);

    expect(apiMock.createUser).toHaveBeenCalledTimes(1);
    expect(onAddCaretaker).not.toHaveBeenCalled();
  });

  it('names the other household in that question when the invite targets it', async () => {
    apiMock.createUser.mockResolvedValueOnce({ ok: false, status: 409, error: 'exists' });
    await renderAdmin();
    await setValue(document.querySelectorAll<HTMLSelectElement>('select')[1], 'hh-other');
    await preApprove('jane.doe@example.com');

    expect(document.body.textContent).toContain('Add jane.doe@example.com to Other Family?');
  });

  async function chooseNewHousehold(name: string) {
    await setValue(document.querySelectorAll<HTMLSelectElement>('select')[1], '+new');
    await setValue(document.querySelector<HTMLInputElement>('input[aria-label="Household name"]')!, name);
  }

  it('"New household…" asks for its name and invites the person as its Admin, with no badge in the owner\'s household', async () => {
    const { onAddCaretaker } = await renderAdmin();
    expect(document.querySelector('input[aria-label="Household name"]')).toBeNull();
    await chooseNewHousehold('  Famille Durand ');
    await preApprove('new.person@example.com');

    expect(apiMock.createUser.mock.calls[0][0]).toEqual({ email: 'new.person@example.com', status: 'ACTIVE', role: 'Admin', newHouseholdName: 'Famille Durand' });
    expect(onAddCaretaker).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Invited new.person@example.com as the admin of "Famille Durand".');
  });

  it('for an account living elsewhere, names the new household in the question, then resends with confirmMove', async () => {
    apiMock.createUser.mockResolvedValueOnce({ ok: false, status: 409, error: 'exists' });
    await renderAdmin();
    await chooseNewHousehold('Famille Durand');
    await preApprove('jane.doe@example.com');

    expect(document.body.textContent).toContain('Add jane.doe@example.com to Famille Durand?');
    await click(buttons('Add to household')[0]);
    expect(apiMock.createUser.mock.calls[1][0]).toEqual({
      email: 'jane.doe@example.com', status: 'ACTIVE', role: 'Admin', newHouseholdName: 'Famille Durand', confirmMove: true,
    });
  });

  it('lists every household by name, one not named yet after its admin, with its accounts, and renames it', async () => {
    apiMock.renameHousehold.mockResolvedValue({ ok: true, data: { id: 'FAMILY-COCKER-2026', name: 'Famille Cocker' } });
    await renderAdmin();

    expect(document.body.textContent).toContain('Households (4)');
    expect(document.body.textContent).toContain("Owner Fullname's household1 account");
    expect(document.body.textContent).toContain('Third Family0 accounts');
    await click(document.querySelector<HTMLButtonElement>('button[aria-label="Rename Owner Fullname\'s household"]')!);
    const nameBox = document.querySelector<HTMLInputElement>('input[aria-label="Household name"]')!;
    expect(nameBox.value).toBe("Owner Fullname's household");
    await setValue(nameBox, ' Famille Cocker ');
    await click(buttons('Save')[0]);

    expect(apiMock.renameHousehold).toHaveBeenCalledWith('FAMILY-COCKER-2026', 'Famille Cocker');
    expect(document.querySelector('button[aria-label="Rename Famille Cocker"]')).not.toBeNull();
    expect([...document.querySelectorAll('select')[1].options].map((option) => option.textContent)).toContain('Famille Cocker');
  });

  // App review 2026-10-16, Settings: Admin: at 320 px the selects were 434 px wide (each option carried the household id)
  it('the household selects name each household only (its id in a title) and fit their row; role chips are 12 px', async () => {
    await renderAdmin();

    const selects = [...document.querySelectorAll('select')];
    expect(selects).toHaveLength(3);
    for (const select of selects) {
      expect(select.classList).toContain('w-full');
      expect(select.classList).toContain('min-w-0');
      // Every option but the invite's "New household…", which is not a household yet
      for (const option of [...select.options].filter((option) => option.value !== '+new')) {
        expect(option.textContent).not.toContain(option.value);
        expect(option.title).toBe(option.value);
      }
    }
    const roleChip = [...document.querySelectorAll('.chip')].find((chip) => chip.textContent === 'Member')!;
    expect(roleChip.className).not.toContain('text-[10px]');
    expect(document.querySelector('[class*="text-[10px]"]')).toBeNull();
  });

  describe("'Active accounts' household select", () => {
    const moveSelect = () => document.querySelector<HTMLSelectElement>('select[aria-label="Household for Bob Smith"]')!;

    it("asks before moving; confirming a move into the owner's household moves it and creates the same linked badge as an approval", async () => {
      const { onAddCaretaker } = await renderAdmin();
      await setValue(moveSelect(), 'FAMILY-COCKER-2026');

      expect(apiMock.updateUser).not.toHaveBeenCalled();
      expect(document.body.textContent).toContain("Move bob.smith@example.com to Owner Fullname's household?");

      await click(buttons('Move').at(-1)!);
      expect(apiMock.updateUser).toHaveBeenCalledWith({ email: 'bob.smith@example.com', householdId: 'FAMILY-COCKER-2026' });
      expect(onAddCaretaker).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Bob', email: 'bob.smith@example.com', color: FIRST_FREE_COLOR, role: 'Member' })
      );
      expect(moveSelect().value).toBe('FAMILY-COCKER-2026');
    });

    it('Cancel moves nobody, adds no badge and leaves the select on the current household', async () => {
      const { onAddCaretaker } = await renderAdmin();
      await setValue(moveSelect(), 'FAMILY-COCKER-2026');
      await click(buttons('Cancel').at(-1)!);

      expect(apiMock.updateUser).not.toHaveBeenCalled();
      expect(onAddCaretaker).not.toHaveBeenCalled();
      expect(moveSelect().value).toBe('hh-other');
    });

    it('shows the role the move gave: an Admin moved into another household is a Member there', async () => {
      apiMock.updateUser.mockResolvedValueOnce({ ok: true, data: { ...activeElsewhere, householdId: 'hh-third', role: 'Member' } });
      await renderAdmin([ownerRow, pendingStranger, { ...activeElsewhere, role: 'Admin' }]);
      await setValue(moveSelect(), 'hh-third');
      await click(buttons('Move').at(-1)!);

      const bobRow = [...document.querySelectorAll('div')].find((element) => element.childElementCount === 0 && element.textContent === activeElsewhere.email)!.parentElement!;
      expect(bobRow.textContent).toContain('Member');
      expect(bobRow.textContent).not.toContain('Admin');
    });

    it('a confirmed move into another household creates no badge', async () => {
      const { onAddCaretaker } = await renderAdmin();
      await setValue(moveSelect(), 'hh-third');
      expect(document.body.textContent).toContain('Move bob.smith@example.com to Third Family?');

      await click(buttons('Move').at(-1)!);
      expect(apiMock.updateUser).toHaveBeenCalledWith({ email: 'bob.smith@example.com', householdId: 'hh-third' });
      expect(onAddCaretaker).not.toHaveBeenCalled();
    });

    it('reads the move question in French', async () => {
      localStorage.setItem('puppace_lang_v1', 'fr');
      try {
        await renderAdmin();
        await setValue(document.querySelector<HTMLSelectElement>('select[aria-label="Foyer de Bob Smith"]')!, 'FAMILY-COCKER-2026');

        expect(document.body.textContent).toContain('Déplacer bob.smith@example.com vers Foyer de Owner Fullname\u00a0?');
        expect(buttons('Déplacer')).toHaveLength(1);
      } finally {
        localStorage.removeItem('puppace_lang_v1');
      }
    });
  });
});

// App review 2026-10-16, 5.3: no English left on the French screens of Members and Admin
describe('Members and Admin in French: no English left', () => {
  it('Members: the invite success reads in French', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    try {
      await renderMembers(owner);
      await click([...document.querySelectorAll('button')].find((button) => /Inviter un membre/.test(button.textContent ?? ''))!);
      await setValue(document.querySelector<HTMLInputElement>('form input[type="email"]')!, 'jane.doe@example.com');
      await act(async () => document.querySelector<HTMLFormElement>('form:has(input[type="email"])')!.requestSubmit());

      expect(document.body.textContent).toContain('jane.doe@example.com peut maintenant se connecter.');
      expect(document.body.textContent).not.toContain('authorized');
    } finally {
      localStorage.removeItem('puppace_lang_v1');
    }
  });

  it('Admin: roles, the e-mail placeholder and the status messages read in French', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    try {
      apiMock.fetchUsers.mockResolvedValue({ ok: true, data: [
        { id: 'usr-owner', email: SUPER_ADMIN_EMAIL, name: 'Owner Fullname', householdId: 'FAMILY-COCKER-2026', role: 'SuperAdmin', status: 'ACTIVE' },
        { id: 'usr-bob', email: 'bob.smith@example.com', name: 'Bob Smith', householdId: 'hh-other', role: 'Member', status: 'ACTIVE' },
      ] });
      apiMock.fetchAllHouseholds.mockResolvedValue({ ok: true, data: [{ id: 'FAMILY-COCKER-2026', name: 'Family Pack (Main)' }, { id: 'hh-other', name: 'Other Family' }] });
      await render(<AdminView currentUserEmail={SUPER_ADMIN_EMAIL} caretakers={badges} onAddCaretaker={vi.fn()} />);

      const chips = [...document.querySelectorAll('.chip')].map((chip) => chip.textContent);
      expect(chips).toEqual(expect.arrayContaining(['Propriétaire', 'Membre']));
      expect(chips).not.toContain('Member');
      const form = [...document.querySelectorAll('form')].at(-1)!;
      const email = form.querySelector<HTMLInputElement>('input[type="email"]')!;
      expect(email.placeholder).toBe('ex.\u00a0: conjoint@famille.com');

      await setValue(email, 'new.person@example.com');
      await click(buttons('Inviter')[0]);
      expect(document.body.textContent).toContain('new.person@example.com invité dans «\u00a0Family Pack (Main)\u00a0»');
      expect(document.body.textContent).not.toMatch(/Pre-approved|Activated|Moved/);
      // Each trash says whose account, 44 px; each select is named
      const trash = document.querySelector<HTMLButtonElement>('button[aria-label="Supprimer bob.smith@example.com"]')!;
      expect(['min-h-11', 'min-w-11'].every((name) => trash.classList.contains(name))).toBe(true);
      expect(form.querySelector('select')!.getAttribute('aria-label')).toBe('Foyer');
      expect(email.getAttribute('aria-label')).toBe('Inviter une adresse e-mail');
    } finally {
      localStorage.removeItem('puppace_lang_v1');
    }
  });

  // A sign-up's own household has no households row: the message names it as the select does, never by its id
  it('Admin: approving a sign-up in its own household reads "activé dans « Foyer de Jane Doe »", not the household id', async () => {
    localStorage.setItem('puppace_lang_v1', 'fr');
    try {
      apiMock.fetchUsers.mockResolvedValue({ ok: true, data: [
        { id: 'usr-owner', email: SUPER_ADMIN_EMAIL, name: 'Owner Fullname', householdId: 'FAMILY-COCKER-2026', role: 'SuperAdmin', status: 'ACTIVE' },
        { id: 'usr-jane', email: 'jane.doe@example.com', name: 'Jane Doe', householdId: 'house-stranger', role: 'Member', status: 'PENDING_APPROVAL' },
      ] });
      apiMock.fetchAllHouseholds.mockResolvedValue({ ok: true, data: [{ id: 'FAMILY-COCKER-2026', name: 'Family Pack (Main)' }] });
      await render(<AdminView currentUserEmail={SUPER_ADMIN_EMAIL} caretakers={badges} onAddCaretaker={vi.fn()} />);

      await click(buttons('Approuver et assigner')[0]);
      expect(document.body.textContent).toContain('jane.doe@example.com activé dans «\u00a0Foyer de Jane Doe\u00a0».');
      // (The pending row still shows the id on its "ID" line, on purpose)
      expect(document.body.textContent).not.toContain('activé dans «\u00a0house-stranger');
    } finally {
      localStorage.removeItem('puppace_lang_v1');
    }
  });
});
