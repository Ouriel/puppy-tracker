// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from '../App';
import { en } from '../i18n/en';
import { setAuthToken, clearAuthToken, setStoredAuthUser } from '../utils/auth';
import { setStoredPuppies, setActivePuppyId, setStoredRecentActivities } from '../utils/storage';
import { clearApiCache } from '../services/api';
import { formatLocalDate } from '../utils/date';
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
const prodShapedDashboard = () => ({ puppies: [puppy], caretakers: [], activities: [], healthRecords: legacyDewormings, weightActivities: [...homeWeighIns, ...migratedWeighIns] });
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
      if (method === 'GET') return respond([...legacyDewormings, vaccination]);
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

  it('a weight with a date after today blocks the save: the server refuses a weigh-in in the future', async () => {
    const box = await openAddForm();
    await setValue(box.form!.querySelector<HTMLInputElement>('input[type="date"]')!, formatLocalDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)));
    await setValue(box, '10,4');

    await submit(box);

    expect(savedRequests()).toEqual([]);
    expect(weightBox()!.value).toBe('10,4');
    expect(document.getElementById(`${weightBoxId}-error`)!.textContent).toBe(en.potty.dateTimeInFuture);
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
