// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from '../App';
import { en } from '../i18n/en';
import { setAuthToken, clearAuthToken, setStoredAuthUser } from '../utils/auth';
import { setStoredPuppies, setActivePuppyId, setStoredRecentActivities } from '../utils/storage';
import { clearApiCache } from '../services/api';
import { formatLocalDate, formatShortDate } from '../utils/date';
import type { Activity, HealthRecord, PuppyProfile, UserAccount } from '../types';

// Phase 5c: every weigh-in is its own weight event; a vaccine or deworming record never holds a weight.
// Shaped like production after the step 5 migration, with made-up values.

const puppy: PuppyProfile = { id: 'pup-1', name: 'Rex', breed: 'Beagle', birthDate: '2026-03-01', targetMealsPerDay: 3, dailyFoodGramGoal: 200, weightKg: 7.1 };
const owner: UserAccount = { id: 'usr-1', email: 'owner@example.com', name: 'Owner', role: 'Member' };

const weighIn = (id: string, timestamp: string, weightKg: number, notes: string | null = null): Activity =>
  ({ id, puppyId: puppy.id, type: 'weight', timestamp, weightKg, notes, loggedBy: 'Owner' });

// 6 home weigh-ins (one with a free-text note) and 5 deworming weigh-ins migrated to weight events (12:00 Paris, notes = product)
const homeWeighIns = [
  weighIn('act-home-1', '2026-05-20T09:30:00.000Z', 3.95),
  weighIn('act-home-2', '2026-06-21T17:10:00.000Z', 5.85),
  weighIn('act-home-3', '2026-07-19T08:45:00.000Z', 7.45, 'après balade'),
  weighIn('act-home-4', '2026-08-02T18:20:00.000Z', 8.15),
  weighIn('act-home-5', '2026-08-16T07:55:00.000Z', 8.75),
  weighIn('act-home-6', '2026-09-25T16:40:00.000Z', 10.05),
];
const dewormingDoses = [
  ['2026-05-18', 'Drontal Chiot (Sirop / Comprimés)', 3.85],
  ['2026-06-22', 'Credelio Plus', 6.05],
  ['2026-07-21', 'Credelio Plus', 7.55],
  ['2026-08-21', 'Credelio Plus', 9.05],
  ['2026-09-21', 'Credelio Plus', 9.95],
] as const;
const migratedWeighIns = dewormingDoses.map(([date, product, weightKg], index) => weighIn(`act-vet-${index + 1}`, `${date}T10:00:00.000Z`, weightKg, product));
// The 5 health records still hold their weight (kept as a backup until the owner clears it): never read
const legacyDewormings = dewormingDoses.map(([date, product, weightKg], index) => ({
  id: `hr-${index + 1}`, householdId: 'hh-1', puppyId: puppy.id, type: 'deworming', name: product, productName: product, date, boosterDate: date, weightAtTime: weightKg,
})) as Array<HealthRecord & { weightAtTime: number }>;
const vaccination: HealthRecord = { id: 'hr-vac', householdId: 'hh-1', puppyId: puppy.id, type: 'vaccination', name: 'Rage (Eurican LR / Nobivac Rabies / Versiguard / Rabisin)', date: '2026-07-01', boosterDate: '2027-07-01', vetClinic: 'Clinique Test', batchNumber: 'LOT-T1' };

let root: Root | null = null;
let requests: Array<{ url: string; method: string; body?: any }> = [];
/** The status POST /api/health-records answers (201: saved). */
let healthRecordPostStatus = 201;
/** The vaccinations /api/dashboard and GET /api/health-records answer. */
let vaccinationRecords: HealthRecord[] = [vaccination];
const prodShapedDashboard = () => ({ puppies: [puppy], caretakers: [], activities: [], healthRecords: [...legacyDewormings, ...vaccinationRecords], weightActivities: [...homeWeighIns, ...migratedWeighIns] });
/** What GET /api/dashboard answers. */
let answerDashboard = () => respond(prodShapedDashboard());

const respond = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

function stubApi() {
  vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ url, method, body });
    const path = url.split('?')[0];
    // The recent window holds no weigh-in: the last one is 3 weeks old
    if (path === '/api/dashboard') return answerDashboard();
    if (path === '/api/health-records') {
      if (method === 'GET') return respond([...legacyDewormings, ...vaccinationRecords]);
      if (method === 'POST' && healthRecordPostStatus !== 201) return respond({ error: 'Internal server error' }, healthRecordPostStatus);
      return method === 'PUT' ? respond(body) : respond({ householdId: 'hh-1', ...body, id: `hr-new-${requests.length}` }, 201);
    }
    if (path === '/api/activities') return method === 'DELETE' ? respond({ success: true }) : respond(body, method === 'POST' ? 201 : 200);
    return respond({ error: 'Not found' }, 404);
  }));
}

/** Lets pending responses, lazy chunks and React updates finish. */
async function settle() {
  for (let round = 0; round < 10; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function settleUntil(condition: () => boolean) {
  for (let round = 0; round < 50 && !condition(); round += 1) await settle();
}

async function renderAppAt(path: string) {
  window.history.pushState({}, '', path);
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<App />));
  await settle();
}

async function openPassport() {
  await renderAppAt('/health-passport');
  await settleUntil(() => weightRows().length > 0 && document.body.textContent!.includes('Credelio Plus'));
}

/** The weight timeline's rows: each has its edit button, its delete button and its weight. */
const weightRows = () => [...document.querySelectorAll<HTMLButtonElement>('button[aria-label="Edit weight entry"]')].map((button) => button.parentElement!);
const rowWeight = (row: Element) => Number(row.textContent!.match(/([\d.]+) kg/)![1]);
const posts = (path: string) => requests.filter((request) => request.method === 'POST' && request.url.startsWith(path));

async function setValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
  await settle();
}

const buttonWithText = (text: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent!.trim() === text)!;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  requests = [];
  healthRecordPostStatus = 201;
  vaccinationRecords = [vaccination];
  answerDashboard = () => respond(prodShapedDashboard());
  localStorage.clear();
  clearAuthToken();
  clearApiCache();
  setAuthToken('app-session');
  setStoredAuthUser(owner);
  setStoredPuppies([puppy]);
  setActivePuppyId(puppy.id);
  stubApi();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Weight timeline (Phase 5c, prod-shaped)', () => {
  it('6 home weigh-ins + 5 migrated weight events + 5 records still holding a weight: 11 entries, each once, each editable and deletable', async () => {
    await openPassport();

    const rows = weightRows();
    expect(rows.map(rowWeight)).toEqual([...homeWeighIns, ...migratedWeighIns].map((weight) => weight.weightKg!).sort((weightA, weightB) => weightB - weightA));
    rows.forEach((row) => expect(row.querySelector('button[aria-label="Delete weight entry"]')).not.toBeNull());
    // The vet marker: a weigh-in whose note is a vaccine or antiparasitic of healthProtocols.json, not a free-text note
    expect(rows.filter((row) => row.textContent!.includes(en.weightChart.vetRecord)).map(rowWeight)).toEqual([9.95, 9.05, 7.55, 6.05, 3.85]);
    // The deworming list shows no weight: records never hold one
    expect(document.body.textContent).not.toContain(`Weight: 9.95`);
  });

  it('a migrated deworming weigh-in is edited and deleted from the timeline like any weigh-in', async () => {
    await openPassport();
    const firstDoseRow = weightRows().find((row) => rowWeight(row) === 3.85)!;

    await click(firstDoseRow.querySelector<HTMLButtonElement>('button[aria-label="Edit weight entry"]')!);
    await settleUntil(() => document.getElementById('quicklog-weight-kg') !== null);
    const weightBox = document.getElementById('quicklog-weight-kg') as HTMLInputElement;
    expect(weightBox.value).toBe('3.85');
    await setValue(weightBox, '3,9');
    await click(document.querySelector<HTMLButtonElement>('button[form="quicklog-form"]')!);

    const put = requests.find((request) => request.method === 'PUT')!;
    expect(put.body).toMatchObject({ id: 'act-vet-1', type: 'weight', weightKg: 3.9, notes: 'Drontal Chiot (Sirop / Comprimés)' });
    expect(weightRows().map(rowWeight)).toContain(3.9);

    // One tap on the trash, next to the pencil, only asks
    await click(weightRows().find((row) => rowWeight(row) === 3.9)!.querySelector<HTMLButtonElement>('button[aria-label="Delete weight entry"]')!);
    expect(requests.filter((request) => request.method === 'DELETE')).toEqual([]);
    expect(document.body.textContent).toContain(en.potty.deleteActivityMessage);
    await click(buttonWithText('Delete'));
    expect(requests.find((request) => request.method === 'DELETE')!.url).toBe('/api/activities?id=act-vet-1');
    expect(weightRows()).toHaveLength(10);
  });

  it('a weigh-in edit the server does not take keeps the edit form open with the typed weight', async () => {
    await openPassport();
    await click(weightRows().find((row) => rowWeight(row) === 3.85)!.querySelector<HTMLButtonElement>('button[aria-label="Edit weight entry"]')!);
    await settleUntil(() => document.getElementById('quicklog-weight-kg') !== null);
    const serverStub = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit = {}) => (init.method === 'PUT' ? Promise.reject(new TypeError('Load failed')) : serverStub(url, init))));

    await setValue(document.getElementById('quicklog-weight-kg') as HTMLInputElement, '3,9');
    await click(document.querySelector<HTMLButtonElement>('button[form="quicklog-form"]')!);

    expect((document.getElementById('quicklog-weight-kg') as HTMLInputElement | null)?.value).toBe('3,9');
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(en.potty.saveFailed);
  });

  it('a deworming saved with a weight: the record holds no weight, the weight is its own event at 12:00 Paris named after the product', async () => {
    await openPassport();
    await click(buttonWithText(en.health.addDeworming));
    const weightBox = document.getElementById('deworming-weight-kg') as HTMLInputElement;
    await setValue(weightBox.form!.querySelector<HTMLInputElement>('input[type="date"]')!, '2026-07-27');
    await setValue(weightBox, '10,4');

    await click(weightBox.form!.querySelector<HTMLButtonElement>('button[type="submit"]')!);

    expect(posts('/api/health-records')).toHaveLength(1);
    expect(posts('/api/health-records')[0].body).not.toHaveProperty('weightAtTime');
    expect(posts('/api/activities')).toHaveLength(1);
    expect(posts('/api/activities')[0].body).toMatchObject({ type: 'weight', weightKg: 10.4, timestamp: '2026-07-27T10:00:00.000Z', notes: 'Credelio Plus', puppyId: puppy.id });
    expect(weightRows()).toHaveLength(12);
  });

  it('a vaccine saved with a weight: the weight event is named after the vaccine', async () => {
    await openPassport();
    await click(buttonWithText(en.health.addVaccine));
    const weightBox = document.getElementById('vaccine-weight-kg') as HTMLInputElement;
    await setValue(weightBox.form!.querySelector<HTMLInputElement>('input[type="date"]')!, '2026-03-28');
    await setValue(weightBox, '11.2');

    await click(weightBox.form!.querySelector<HTMLButtonElement>('button[type="submit"]')!);

    const record = posts('/api/health-records')[0].body;
    expect(record).not.toHaveProperty('weightAtTime');
    // Winter time: 12:00 Paris is 11:00 UTC
    expect(posts('/api/activities')[0].body).toMatchObject({ type: 'weight', weightKg: 11.2, timestamp: '2026-03-28T11:00:00.000Z', notes: record.name });
  });

  // Owner decision 2026-10-15: no badge here carries the saved name (the account's first log made one), so the badges reload
  it('a vet weigh-in saved under a name no badge here carries reloads the badges', async () => {
    await openPassport();
    await click(buttonWithText(en.health.addVaccine));
    const weightBox = document.getElementById('vaccine-weight-kg') as HTMLInputElement;
    await setValue(weightBox, '11.2');
    const badgeReloads = () => requests.filter((request) => request.url === '/api/households');
    expect(badgeReloads()).toEqual([]);

    await click(weightBox.form!.querySelector<HTMLButtonElement>('button[type="submit"]')!);

    expect(posts('/api/activities')).toHaveLength(1);
    expect(badgeReloads()).toHaveLength(1);
  });

  it('the dashboard summary and the log form use the latest weigh-in, whatever its date', async () => {
    await renderAppAt('/');
    await settleUntil(() => document.body.textContent!.includes(en.health.summaryTitle));

    expect(document.body.textContent).toContain(`${en.health.lastLogged}10.05 kg`);

    await click(document.querySelector<HTMLElement>(`[aria-label="${en.nav.logEvent}"]`)!);
    await settleUntil(() => document.getElementById('quicklog-form') !== null);
    await click(buttonWithText(en.potty.weight));
    const weightBox = document.getElementById('quicklog-weight-kg') as HTMLInputElement;
    expect(weightBox.value).toBe('');
    expect(weightBox.parentElement!.textContent).toContain('Last weigh-in: 10.05 kg on 09/25');
  });

  it('no dog chosen yet on this device: the dashboard sends every dog\'s weigh-ins, the timeline shows the selected dog\'s only', async () => {
    const otherDog: PuppyProfile = { ...puppy, id: 'pup-2', name: 'Other' };
    setActivePuppyId('');
    setStoredPuppies([puppy, otherDog]);
    answerDashboard = () => respond({ ...prodShapedDashboard(), puppies: [puppy, otherDog], weightActivities: [...homeWeighIns, ...migratedWeighIns, { ...weighIn('act-other', '2026-09-30T08:00:00.000Z', 33.3), puppyId: otherDog.id }] });

    await openPassport();

    expect(weightRows()).toHaveLength(11);
    expect(weightRows().map(rowWeight)).not.toContain(33.3);
  });

  it('while the full weight list is not loaded (dashboard down), the recent logs cached on this device give the weigh-ins', async () => {
    setStoredRecentActivities(puppy.id, [weighIn('act-recent', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), 10.25)]);
    answerDashboard = () => respond({ error: 'Internal server error' }, 500);

    await renderAppAt('/health-passport');
    await settleUntil(() => weightRows().length > 0);

    expect(weightRows().map(rowWeight)).toEqual([10.25]);
  });

  it('editing a deworming shows no weight box, and an emptied next date is sent as null so it is cleared', async () => {
    await openPassport();
    await click(document.querySelector<HTMLButtonElement>(`[aria-label="${en.health.editDewormingEntry}"]`)!);
    const editCard = buttonWithText(en.potty.saveChanges).closest('.space-y-3')!;
    expect(editCard.textContent).not.toContain(en.potty.weight);
    expect(editCard.querySelectorAll('input:not([type="date"])')).toHaveLength(0);

    await setValue(editCard.querySelectorAll<HTMLInputElement>('input[type="date"]')[1], '');
    await click(buttonWithText(en.potty.saveChanges));

    const put = requests.find((request) => request.method === 'PUT' && request.url === '/api/health-records')!;
    expect(put.body.boosterDate).toBeNull();
    expect(put.body).not.toHaveProperty('weightAtTime');
  });

  it('editing a vaccination sends null for an emptied clinic and lot, so they are cleared', async () => {
    await openPassport();
    await click(document.querySelector<HTMLButtonElement>(`[aria-label="${en.health.editVaccineEntry}"]`)!);
    const editCard = buttonWithText(en.potty.saveChanges).closest('.space-y-3')!;
    const [clinic, lot] = editCard.querySelectorAll<HTMLInputElement>('input[type="text"]');

    await setValue(clinic, '');
    await setValue(lot, '');
    await click(buttonWithText(en.potty.saveChanges));

    const put = requests.find((request) => request.method === 'PUT' && request.url === '/api/health-records')!;
    expect(put.body).toMatchObject({ id: 'hr-vac', vetClinic: null, batchNumber: null, boosterDate: '2027-07-01' });
  });

  it('editing a vaccination sends null for an emptied next date, so it is cleared', async () => {
    await openPassport();
    await click(document.querySelector<HTMLButtonElement>(`[aria-label="${en.health.editVaccineEntry}"]`)!);
    const editCard = buttonWithText(en.potty.saveChanges).closest('.space-y-3')!;

    await setValue(editCard.querySelectorAll<HTMLInputElement>('input[type="date"]')[1], '');
    await click(buttonWithText(en.potty.saveChanges));

    const put = requests.find((request) => request.method === 'PUT' && request.url === '/api/health-records')!;
    expect(put.body.boosterDate).toBeNull();
  });

  // Owner decision 2026-10-15: a dog with no gram goal may log a meal without grams (stored as null, never 0)
  it('a dog with no gram goal: a weigh-in edited into a meal saves with the grams box left empty', async () => {
    const noGoalPuppy: PuppyProfile = { ...puppy, dailyFoodGramGoal: 0 };
    setStoredPuppies([noGoalPuppy]);
    answerDashboard = () => respond({ ...prodShapedDashboard(), puppies: [noGoalPuppy] });
    await openPassport();

    await click(weightRows()[0].querySelector<HTMLButtonElement>('button[aria-label="Edit weight entry"]')!);
    await settleUntil(() => document.getElementById('quicklog-form') !== null);
    await click([...document.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find((button) => button.textContent === en.potty.food)!);
    expect((document.getElementById('quicklog-quantity-grams') as HTMLInputElement).value).toBe('');
    await click(document.querySelector<HTMLButtonElement>('button[form="quicklog-form"]')!);

    const put = requests.find((request) => request.method === 'PUT' && request.url.startsWith('/api/activities'))!;
    expect(put.body).toMatchObject({ type: 'food' });
    expect(put.body).not.toHaveProperty('quantityGrams');
  });
});

describe.each([
  { form: 'deworming', addButton: en.health.addDeworming, weightBoxId: 'deworming-weight-kg' },
  { form: 'vaccine', addButton: en.health.addVaccine, weightBoxId: 'vaccine-weight-kg' },
])('the $form add form: optional weight box (Phase 5c step 2)', ({ addButton, weightBoxId }) => {
  const weightBox = () => document.getElementById(weightBoxId) as HTMLInputElement | null;

  async function openAddForm() {
    await openPassport();
    await click(buttonWithText(addButton));
    return weightBox()!;
  }

  const submit = (box: HTMLInputElement) => click(box.form!.querySelector<HTMLButtonElement>('button[type="submit"]')!);
  // Only the requests under test: the deferred session extension may POST too
  const savedRequests = () => [...posts('/api/health-records'), ...posts('/api/activities')];

  it('starts empty with the last weigh-in as a hint, never the profile weight or an estimate', async () => {
    const box = await openAddForm();

    expect(box.value).toBe('');
    expect(box.parentElement!.textContent).toContain('Last weigh-in: 10.05 kg on 09/25');
  });

  it('left empty, saves the record and no weight event', async () => {
    const box = await openAddForm();

    await submit(box);

    expect(posts('/api/health-records')).toHaveLength(1);
    expect(posts('/api/activities')).toEqual([]);
    expect(weightRows()).toHaveLength(11);
  });

  it('an invalid weight blocks the save with a message under the box, and the form stays open', async () => {
    const box = await openAddForm();
    await setValue(box, '104');

    await submit(box);

    expect(savedRequests()).toEqual([]);
    expect(weightBox()).toBe(box);
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(`${weightBoxId}-error`)!.textContent).toBe(en.potty.weightInvalid);
  });

  it('a date after today with a weight typed blocks the save, and the weight stays (pre-fill review item 38)', async () => {
    const box = await openAddForm();
    await setValue(box.form!.querySelector<HTMLInputElement>('input[type="date"]')!, formatLocalDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)));
    await setValue(box, '10,4');

    await submit(box);

    expect(savedRequests()).toEqual([]);
    expect(weightBox()!.value).toBe('10,4');
    expect(box.form!.textContent).toContain(en.health.dateInFuture);
  });

  it('after a save, the form opens again with an empty box', async () => {
    const box = await openAddForm();
    await setValue(box, '10,4');
    await submit(box);
    expect(weightBox()).toBeNull();

    await click(buttonWithText(addButton));

    expect(weightBox()!.value).toBe('');
  });

  it('a record the server refuses saves no weight event, and the typed weight stays', async () => {
    healthRecordPostStatus = 500;
    const box = await openAddForm();
    await setValue(box, '10,4');

    await submit(box);

    expect(posts('/api/health-records')).toHaveLength(1);
    expect(posts('/api/activities')).toEqual([]);
    expect(weightBox()!.value).toBe('10,4');
    expect(weightRows()).toHaveLength(11);
  });
});

describe('Carnet add and edit forms (pre-fill review items 11, 12, 23, 35-38)', () => {
  const chppiL4 = 'CHPPi / DAPPi + L4 (Eurican / Nobivac / Versican / Canigen)';
  const dateInputs = (container: ParentNode) => [...container.querySelectorAll<HTMLInputElement>('input[type="date"]')];
  /** The vaccine the closed Select shows (its placeholder when the value is not one of its options). */
  const shownVaccine = (form: HTMLFormElement) => form.querySelector('[data-slot="select-value"]')!.textContent;

  async function openVaccineAddForm() {
    await openPassport();
    await click(buttonWithText(en.health.addVaccine));
    return document.getElementById('vaccine-weight-kg')!.closest('form')!;
  }

  /** Picks an option through the Select's native twin, which picks it in the Select. */
  async function pickOption(container: ParentNode, optionValue: string) {
    const select = container.querySelector('select')!;
    await act(async () => {
      select.value = optionValue;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  it('item 11: a puppy shot entered months later gets +1 month, from her age on the injection day', async () => {
    vaccinationRecords = [{ ...vaccination, id: 'hr-chppi', name: chppiL4, date: '2026-04-26', boosterDate: '2026-05-26' }];
    const form = await openVaccineAddForm();
    const [administered, booster] = dateInputs(form);

    await setValue(administered, '2026-04-26'); // Rex is 8 weeks old that day
    expect(booster.value).toBe('2026-05-26');

    await setValue(administered, '2026-06-21'); // 16 weeks: the 1st birthday
    expect(booster.value).toBe('2027-03-01');
  });

  it('item 12: a Drontal dose at 8 weeks, entered later, gets +14 days from her age on the dose day', async () => {
    await openPassport();
    await click(buttonWithText(en.health.addDeworming));
    const form = document.getElementById('deworming-weight-kg')!.closest('form')!;
    // The Select's native twin: picking an option there picks it in the Select
    const product = form.querySelector('select')!;
    await act(async () => {
      product.value = 'Drontal Chiot (Sirop / Comprimés)';
      product.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const [given, next] = dateInputs(form);

    await setValue(given, '2026-04-26'); // Rex is 8 weeks old that day
    expect(form.querySelector('[data-slot="select-value"]')!.textContent).toContain('Drontal Chiot');
    expect(next.value).toBe('2026-05-10');
  });

  it('item 23: the vaccine box shows the last vaccine given, and that is what is saved', async () => {
    const form = await openVaccineAddForm();

    expect(shownVaccine(form)).toBe(vaccination.name);
    await click(form.querySelector<HTMLButtonElement>('button[type="submit"]')!);

    expect(posts('/api/health-records')[0].body.name).toBe(vaccination.name);
  });

  it('item 23: when the last vaccine is no longer in the list, CHPPi + L4 from the list is shown and saved', async () => {
    vaccinationRecords = [{ ...vaccination, id: 'hr-old', name: 'CHPPi + L4 (old spelling)', date: '2026-07-01' }];
    const form = await openVaccineAddForm();

    expect(shownVaccine(form)).toBe(chppiL4);
    await click(form.querySelector<HTMLButtonElement>('button[type="submit"]')!);

    expect(posts('/api/health-records')[0].body.name).toBe(chppiL4);
  });

  it('item 35: the clinic box starts with the clinic of the last vaccination, and stays editable', async () => {
    vaccinationRecords = [
      { ...vaccination, id: 'hr-2', date: '2026-08-01', vetClinic: null },
      { ...vaccination, id: 'hr-1', date: '2026-07-01', vetClinic: 'Clinique du Parc' },
      { ...vaccination, id: 'hr-0', date: '2026-06-01', vetClinic: 'Old Clinic' },
    ];
    const form = await openVaccineAddForm();
    const clinic = form.querySelector<HTMLInputElement>(`input[placeholder="${en.health.vetClinicPlaceholder}"]`)!;

    expect(clinic.value).toBe('Clinique du Parc');
    await setValue(clinic, 'Clinique des Lilas');
    await click(form.querySelector<HTMLButtonElement>('button[type="submit"]')!);

    expect(posts('/api/health-records')[0].body.vetClinic).toBe('Clinique des Lilas');
  });

  it('item 37: opening an edit offers nothing: the stored next date (often the vet\'s) stays, with no hint', async () => {
    // Both differ from the rule: Rage 1 Jul 2026 -> 1 Jul 2027, Credelio 21 Sep -> 21 Oct
    vaccinationRecords = [{ ...vaccination, boosterDate: '2027-06-25' }];
    await openPassport();
    await click(document.querySelector<HTMLButtonElement>(`[aria-label="${en.health.editVaccineEntry}"]`)!);
    await click(document.querySelector<HTMLButtonElement>(`[aria-label="${en.health.editDewormingEntry}"]`)!);

    expect(dateInputs(document).map((input) => input.value)).toEqual(['2026-07-01', '2027-06-25', '2026-09-21', '2026-09-21']);
    expect(document.body.textContent).not.toContain('Suggested');
  });

  it('item 37: editing the date keeps the stored next date and offers the suggestion, applied in one tap', async () => {
    await openPassport();
    await click(document.querySelector<HTMLButtonElement>(`[aria-label="${en.health.editVaccineEntry}"]`)!);
    const editCard = buttonWithText(en.potty.saveChanges).closest('.space-y-3')!;
    const [injected, booster] = dateInputs(editCard);

    await setValue(injected, '2026-07-10');
    expect(booster.value).toBe('2027-07-01');
    await click(buttonWithText(`Suggested: ${formatShortDate('2027-07-10', 'en')}`));
    expect(booster.value).toBe('2027-07-10');
    expect(editCard.textContent).not.toContain('Suggested');
    await click(buttonWithText(en.potty.saveChanges));

    const put = requests.find((request) => request.method === 'PUT' && request.url === '/api/health-records')!;
    expect(put.body).toMatchObject({ date: '2026-07-10', boosterDate: '2027-07-10' });
  });

  it('item 37: changing only the vaccine keeps the stored next date and offers the new vaccine\'s, applied in one tap', async () => {
    await openPassport();
    await click(document.querySelector<HTMLButtonElement>(`[aria-label="${en.health.editVaccineEntry}"]`)!);
    const editCard = buttonWithText(en.potty.saveChanges).closest('.space-y-3')!;
    const booster = dateInputs(editCard)[1];

    await pickOption(editCard, chppiL4); // Rage -> CHPPi + L4, same day: Rex is 17 weeks old, so the 1st birthday
    expect(booster.value).toBe('2027-07-01');
    expect(editCard.textContent).toContain(`Suggested: ${formatShortDate('2027-03-01', 'en')}`);
    await click(buttonWithText(`Suggested: ${formatShortDate('2027-03-01', 'en')}`));
    expect(booster.value).toBe('2027-03-01');
    await click(buttonWithText(en.potty.saveChanges));

    const put = requests.find((request) => request.method === 'PUT' && request.url === '/api/health-records')!;
    expect(put.body).toMatchObject({ name: chppiL4, date: '2026-07-01', boosterDate: '2027-03-01' });
  });

  it('item 37: changing only the product keeps the stored next date and offers the new product\'s, applied in one tap', async () => {
    await openPassport();
    // Newest first: Credelio Plus on 2026-09-21
    await click(document.querySelector<HTMLButtonElement>(`[aria-label="${en.health.editDewormingEntry}"]`)!);
    const editCard = buttonWithText(en.potty.saveChanges).closest('.space-y-3')!;
    const next = dateInputs(editCard)[1];

    await pickOption(editCard, 'Drontal Chiot (Sirop / Comprimés)'); // Rex is over 6 months old that day: every 3 months
    expect(next.value).toBe('2026-09-21');
    expect(editCard.textContent).toContain(`Suggested: ${formatShortDate('2026-12-21', 'en')}`);
    await click(buttonWithText(`Suggested: ${formatShortDate('2026-12-21', 'en')}`));
    expect(next.value).toBe('2026-12-21');
    await click(buttonWithText(en.potty.saveChanges));

    const put = requests.find((request) => request.method === 'PUT' && request.url === '/api/health-records')!;
    expect(put.body).toMatchObject({ productName: 'Drontal Chiot (Sirop / Comprimés)', date: '2026-09-21', boosterDate: '2026-12-21' });
  });

  it('the dashboard summary, for a last record with no next date, shows an em dash, never a date the rules make up (backlog item 1)', async () => {
    const backLogged = { householdId: 'hh-1', puppyId: puppy.id, boosterDate: null };
    answerDashboard = () => respond({
      ...prodShapedDashboard(),
      healthRecords: [
        { ...backLogged, id: 'hr-chppi', type: 'vaccination', name: chppiL4, date: '2026-04-26' }, // Rex is 8 weeks old: +1 month
        { ...backLogged, id: 'hr-drontal', type: 'deworming', name: 'Drontal Chiot (Sirop / Comprimés)', date: '2026-05-03' }, // 9 weeks: +14 days
      ],
    });

    await renderAppAt('/');
    await settleUntil(() => document.body.textContent!.includes(en.health.summaryTitle));

    // The rules would give 26 May (+1 month at 8 weeks) and 17 May (+14 days at 9 weeks)
    expect(document.body.textContent!.split(`${en.health.nextDue} —`)).toHaveLength(3);
    expect(document.body.textContent).not.toMatch(/2026-05-26|2026-05-17|May 26|May 17/);
  });

  it('item 11: a CHPPi edit moved to 16 weeks suggests the 1st birthday, from her age on the injection day', async () => {
    vaccinationRecords = [{ ...vaccination, id: 'hr-chppi', name: chppiL4, date: '2026-06-14', boosterDate: '2026-07-14' }];
    await openPassport();
    await click(document.querySelector<HTMLButtonElement>(`[aria-label="${en.health.editVaccineEntry}"]`)!);
    const editCard = buttonWithText(en.potty.saveChanges).closest('.space-y-3')!;

    await setValue(dateInputs(editCard)[0], '2026-06-21'); // Rex is 16 weeks old that day
    expect(editCard.textContent).toContain(`Suggested: ${formatShortDate('2027-03-01', 'en')}`);
  });

  it('item 12: a Drontal edit moved to 11 weeks suggests +14 days, from her age on the dose day, applied in one tap', async () => {
    await openPassport();
    // Newest first: the last one is the Drontal dose
    await click([...document.querySelectorAll<HTMLButtonElement>(`[aria-label="${en.health.editDewormingEntry}"]`)].at(-1)!);
    const editCard = buttonWithText(en.potty.saveChanges).closest('.space-y-3')!;
    const [given, next] = dateInputs(editCard);
    expect(given.value).toBe('2026-05-18');

    await setValue(given, '2026-05-17'); // Rex is 11 weeks old that day
    await click(buttonWithText(`Suggested: ${formatShortDate('2026-05-31', 'en')}`));

    expect(next.value).toBe('2026-05-31');
    expect(editCard.textContent).not.toContain('Suggested');
  });

  describe.each([
    { form: 'vaccine', addButton: en.health.addVaccine, weightBoxId: 'vaccine-weight-kg', editLabel: en.health.editVaccineEntry },
    { form: 'deworming', addButton: en.health.addDeworming, weightBoxId: 'deworming-weight-kg', editLabel: en.health.editDewormingEntry },
  ])('the $form forms: date rules (items 37, 38)', ({ addButton, weightBoxId, editLabel }) => {
    const puts = () => requests.filter((request) => request.method === 'PUT');

    async function openEditCard() {
      await openPassport();
      await click(document.querySelector<HTMLButtonElement>(`[aria-label="${editLabel}"]`)!);
      return buttonWithText(en.potty.saveChanges).closest('.space-y-3')!;
    }

    it('item 37: an emptied date says "Date required" and saves nothing', async () => {
      const editCard = await openEditCard();

      await setValue(dateInputs(editCard)[0], '');
      await click(buttonWithText(en.potty.saveChanges));

      expect(editCard.textContent).toContain(en.health.dateRequired);
      expect(puts()).toEqual([]);
    });

    it('item 38: an edit to a date after today is refused', async () => {
      const editCard = await openEditCard();

      await setValue(dateInputs(editCard)[0], formatLocalDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)));
      await click(buttonWithText(en.potty.saveChanges));

      expect(editCard.textContent).toContain(en.health.dateInFuture);
      expect(puts()).toEqual([]);
    });

    it('item 38: an edit with a next date before the date is refused', async () => {
      const editCard = await openEditCard();
      const [date, next] = dateInputs(editCard);

      await setValue(date, '2026-07-01');
      await setValue(next, '2026-06-30');
      await click(buttonWithText(en.potty.saveChanges));

      expect(editCard.textContent).toContain(en.health.boosterBeforeDate);
      expect(puts()).toEqual([]);
    });

    it('item 38: the add form refuses a next date before the date, with no weight typed', async () => {
      await openPassport();
      await click(buttonWithText(addButton));
      const form = document.getElementById(weightBoxId)!.closest('form')!;
      const [date, next] = dateInputs(form);

      await setValue(date, '2026-07-01');
      await setValue(next, '2026-06-30');
      // The browser's own check (min) blocks the submit; past it (not every browser enforces it), the form's guard does
      expect(next.validity.rangeUnderflow).toBe(true);
      form.noValidate = true;
      await click(form.querySelector<HTMLButtonElement>('button[type="submit"]')!);

      expect(form.textContent).toContain(en.health.boosterBeforeDate);
      expect(posts('/api/health-records')).toEqual([]);
    });

    it('item 38: the add form refuses a date after today, with no weight typed', async () => {
      await openPassport();
      await click(buttonWithText(addButton));
      const form = document.getElementById(weightBoxId)!.closest('form')!;
      const date = dateInputs(form)[0];

      await setValue(date, formatLocalDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)));
      // The browser's own check (max) blocks the submit; past it, the form's guard does
      expect(date.validity.rangeOverflow).toBe(true);
      form.noValidate = true;
      await click(form.querySelector<HTMLButtonElement>('button[type="submit"]')!);

      expect(form.textContent).toContain(en.health.dateInFuture);
      expect(posts('/api/health-records')).toEqual([]);
    });
  });

  it('item 36: a vaccination with no clinic shows "-", not a made-up clinic name', async () => {
    vaccinationRecords = [{ ...vaccination, vetClinic: null }];
    await openPassport();

    expect(document.body.textContent).toContain(`${en.health.clinic}: -`);
  });
});

describe('one copy of the health records (backlog item 2)', () => {
  const healthRecordGets = () => requests.filter((request) => request.method === 'GET' && request.url.startsWith('/api/health-records'));

  it('a dose added in the passport shows on the dashboard card after Back, and the passport sends no /api/health-records GET', async () => {
    await renderAppAt('/');
    await settleUntil(() => document.body.textContent!.includes(en.health.summaryTitle));
    await click(buttonWithText(en.health.viewFullHealthPassport));
    await settleUntil(() => document.body.textContent!.includes(en.health.addDeworming));
    await click(buttonWithText(en.health.addDeworming));
    const form = document.getElementById('deworming-weight-kg')!.closest('form')!;
    await setValue(form.querySelector<HTMLInputElement>('input[type="date"]')!, '2026-09-28'); // Credelio Plus: next dose 2026-10-28

    await click(form.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    await click(buttonWithText(en.nav.backToDashboard));
    await settleUntil(() => document.body.textContent!.includes(en.health.summaryTitle));

    expect(document.body.textContent).toContain(`${en.health.nextDue} ${formatShortDate('2026-10-28', 'en')}`);
    expect(healthRecordGets()).toEqual([]);
  });

  it('a dose added while a refresh is in flight stays when that refresh answers without it', async () => {
    await openPassport();
    let answerRefresh: (response: Response) => void = () => {};
    answerDashboard = () => new Promise<Response>((resolve) => { answerRefresh = resolve; });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await click(buttonWithText(en.health.addDeworming));
    const form = document.getElementById('deworming-weight-kg')!.closest('form')!;
    await setValue(form.querySelector<HTMLInputElement>('input[type="date"]')!, '2026-09-28');
    await click(form.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    expect(document.body.textContent).toContain(`${en.health.deworming} (6)`);

    // The refresh read the records before the dose was saved
    answerRefresh(new Response(JSON.stringify(prodShapedDashboard())));
    await settle();

    expect(document.body.textContent).toContain(`${en.health.deworming} (6)`);
  });

  it.each([
    { form: 'deworming', addButton: en.health.addDeworming, weightBoxId: 'deworming-weight-kg', listTitle: en.health.deworming, savedDose: { type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus' } },
    { form: 'vaccine', addButton: en.health.addVaccine, weightBoxId: 'vaccine-weight-kg', listTitle: en.health.vaccinations, savedDose: { type: 'vaccination', name: vaccination.name } },
  ])('a $form a refresh already brought is not listed twice when its save answers', async ({ addButton, weightBoxId, listTitle, savedDose: dose }) => {
    await openPassport();
    const savedDose = { id: 'hr-new', householdId: 'hh-1', puppyId: puppy.id, date: '2026-09-28', boosterDate: '2026-10-28', ...dose } as HealthRecord;
    const countBefore = Number(document.body.textContent!.match(new RegExp(`${listTitle} \\((\\d+)\\)`))![1]);
    let answerSave: () => void = () => {};
    const stubbedFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit = {}) => (url === '/api/health-records' && init.method === 'POST'
      ? new Promise<Response>((resolve) => { answerSave = () => resolve(new Response(JSON.stringify(savedDose), { status: 201 })); })
      : stubbedFetch(url, init))));
    await click(buttonWithText(addButton));
    const form = document.getElementById(weightBoxId)!.closest('form')!;
    await setValue(form.querySelector<HTMLInputElement>('input[type="date"]')!, '2026-09-28');
    await click(form.querySelector<HTMLButtonElement>('button[type="submit"]')!);

    // A refresh sent while the save is in flight already holds the dose
    answerDashboard = () => respond({ ...prodShapedDashboard(), healthRecords: [savedDose, ...legacyDewormings, ...vaccinationRecords] });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();
    expect(document.body.textContent).toContain(`${listTitle} (${countBefore + 1})`);
    answerSave();
    await settle();

    expect(document.body.textContent).toContain(`${listTitle} (${countBefore + 1})`);
  });

  it('a vaccine added in the passport shows on the dashboard card after Back', async () => {
    await openPassport();
    await click(buttonWithText(en.health.addVaccine));
    const form = document.getElementById('vaccine-weight-kg')!.closest('form')!;
    const [given, next] = form.querySelectorAll<HTMLInputElement>('input[type="date"]');
    await setValue(given, '2026-10-01');
    await setValue(next, '2026-11-05');

    await click(form.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    await click(buttonWithText(en.nav.backToDashboard));
    await settleUntil(() => document.body.textContent!.includes(en.health.summaryTitle));

    expect(document.body.textContent).toContain(`${en.health.nextDue} ${formatShortDate('2026-11-05', 'en')}`);
    expect(healthRecordGets()).toEqual([]);
  });

  describe.each([
    // The newest deworming (21 Sep) is the one the card shows; once deleted, the 21 Aug dose is
    { form: 'deworming', editLabel: en.health.editDewormingEntry, deleteLabel: en.health.deleteDewormingConfirm, newNextDate: '2026-11-21', afterDelete: `${en.health.given} ${formatShortDate('2026-08-21', 'en')}` },
    { form: 'vaccine', editLabel: en.health.editVaccineEntry, deleteLabel: en.health.deleteVaccineConfirm, newNextDate: '2027-08-01', afterDelete: en.health.noVaccineRecords },
  ])('the $form list writes its changes to the dashboard card', ({ editLabel, deleteLabel, newNextDate, afterDelete }) => {
    async function backToDashboard() {
      await click(buttonWithText(en.nav.backToDashboard));
      await settleUntil(() => document.body.textContent!.includes(en.health.summaryTitle));
    }

    it('an edited next date shows on the card after Back', async () => {
      await openPassport();
      await click(document.querySelector<HTMLButtonElement>(`[aria-label="${editLabel}"]`)!);
      const editCard = buttonWithText(en.potty.saveChanges).closest('.space-y-3')!;
      await setValue(editCard.querySelectorAll<HTMLInputElement>('input[type="date"]')[1], newNextDate);
      await click(buttonWithText(en.potty.saveChanges));

      await backToDashboard();

      expect(document.body.textContent).toContain(`${en.health.nextDue} ${formatShortDate(newNextDate, 'en')}`);
      expect(healthRecordGets()).toEqual([]);
    });

    it('a deleted dose leaves the card after Back', async () => {
      await openPassport();
      await click(document.querySelector<HTMLButtonElement>(`[aria-label="${deleteLabel}"]`)!);
      await click(buttonWithText('Delete'));

      await backToDashboard();

      expect(document.body.textContent).toContain(afterDelete);
      expect(healthRecordGets()).toEqual([]);
    });
  });

  it('booted on the passport, a dose saved before the first dashboard answer keeps every record that answer brings', async () => {
    let answerBoot: (response: Response) => void = () => {};
    answerDashboard = () => new Promise<Response>((resolve) => { answerBoot = resolve; });
    await renderAppAt('/health-passport');
    await settleUntil(() => document.body.textContent!.includes(en.health.addDeworming));
    await click(buttonWithText(en.health.addDeworming));
    const form = document.getElementById('deworming-weight-kg')!.closest('form')!;
    await setValue(form.querySelector<HTMLInputElement>('input[type="date"]')!, '2026-09-28');
    await click(form.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    expect(document.body.textContent).toContain(`${en.health.deworming} (1)`);

    // The answer was read before the dose was saved
    answerBoot(new Response(JSON.stringify(prodShapedDashboard())));
    await settle();

    expect(document.body.textContent).toContain(`${en.health.deworming} (6)`);
    expect(document.body.textContent).toContain(`${en.health.vaccinations} (1)`);
  });

  it('a dose deleted while a refresh is in flight does not come back when that refresh answers', async () => {
    await openPassport();
    let answerRefresh: (response: Response) => void = () => {};
    answerDashboard = () => new Promise<Response>((resolve) => { answerRefresh = resolve; });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await click(document.querySelector<HTMLButtonElement>(`[aria-label="${en.health.deleteDewormingConfirm}"]`)!);
    await click(buttonWithText('Delete'));
    expect(document.body.textContent).toContain(`${en.health.deworming} (4)`);

    // The refresh read the records before the delete
    answerRefresh(new Response(JSON.stringify(prodShapedDashboard())));
    await settle();

    expect(document.body.textContent).toContain(`${en.health.deworming} (4)`);
  });

  it('another dog\'s dose stays out of this dog\'s passport and card, and renews none of its doses', async () => {
    const otherDog: PuppyProfile = { ...puppy, id: 'pup-2', name: 'Other' };
    const otherDose: HealthRecord = { id: 'hr-other', householdId: 'hh-1', puppyId: otherDog.id, type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-10-01', boosterDate: '2026-11-01' };
    setStoredPuppies([puppy, otherDog]);
    answerDashboard = () => respond({ ...prodShapedDashboard(), puppies: [puppy, otherDog], healthRecords: [...prodShapedDashboard().healthRecords, otherDose] });

    await openPassport();

    expect(document.body.textContent).toContain(`${en.health.deworming} (5)`);
    // Rex's 21 Sep dose is still overdue: the other dog's later dose does not renew it
    expect([...document.querySelectorAll('.chip')].map((chip) => chip.textContent)).toContain(en.potty.overdue);

    await click(buttonWithText(en.nav.backToDashboard));
    await settleUntil(() => document.body.textContent!.includes(en.health.summaryTitle));

    expect(document.body.textContent).toContain(`${en.health.nextDue} ${formatShortDate('2026-09-21', 'en')}`);
    expect(document.body.textContent).not.toContain(formatShortDate('2026-11-01', 'en'));
  });

  it('with the dashboard down, the passport loads the records itself', async () => {
    answerDashboard = () => respond({ error: 'Internal server error' }, 500);

    await renderAppAt('/health-passport');
    await settleUntil(() => document.body.textContent!.includes(vaccination.name));

    expect(document.body.textContent).toContain('Credelio Plus');
    expect(healthRecordGets()).toHaveLength(1);
  });
});
