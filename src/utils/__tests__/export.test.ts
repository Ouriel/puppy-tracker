// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Activity, PuppyProfile, Caretaker, HealthRecord } from '../../types';
import { exportActivitiesToCSV, printActivitiesReport, exportHealthPassportToCSV, printHealthPassportReport } from '../export';
import { addDays } from '../health';
import { en } from '../../i18n/en';
import { fr } from '../../i18n/fr';

describe('export utilities — CSV and PDF export test suite', () => {
  const mockProfile: PuppyProfile = {
    id: 'pup-1',
    name: 'Pistache',
    breed: 'Australian Shepherd',
    birthDate: '2026-03-01',
    weightKg: 6.5,
    dailyFoodGramGoal: 240,
    targetMealsPerDay: 3,
  };

  const mockCaretakers: Caretaker[] = [
    { id: 'c-1', name: 'Sam', role: 'Member', color: '#6366F1' },
    { id: 'c-2', name: 'Alice', role: 'Member', color: '#EC4899' },
  ];

  const mockActivities: Activity[] = [
    {
      id: 'act-1',
      puppyId: 'pup-1',
      type: 'pee',
      timestamp: '2026-08-19T08:30:00.000Z',
      pottyLocation: 'outside',
      loggedBy: 'Sam Taylor',
      notes: 'Good pee on grass',
    },
    {
      id: 'act-2',
      puppyId: 'pup-1',
      type: 'poop',
      timestamp: '2026-08-19T09:00:00.000Z',
      pottyLocation: 'indoor_accident',
      stoolConsistency: 'soft',
      loggedBy: 'alice@example.com',
      notes: 'Accident in "hallway", cleaned immediately',
    },
    {
      id: 'act-3',
      puppyId: 'pup-1',
      type: 'food',
      timestamp: '2026-08-19T12:00:00.000Z',
      foodType: 'kibble',
      quantityGrams: 80,
      quantityCups: 0.73,
      loggedBy: 'Sam',
    },
    {
      id: 'act-4',
      puppyId: 'pup-1',
      type: 'weight',
      timestamp: '2026-08-19T13:00:00.000Z',
      weightKg: 6.8,
      loggedBy: 'Alice',
    },
    {
      id: 'act-5',
      puppyId: 'pup-1',
      type: 'medication',
      timestamp: '2026-08-19T14:00:00.000Z',
      medicationName: 'Bravecto',
      loggedBy: 'Sam',
    },
  ];

  // The window the activity feed shows: its first and last day
  const period = { from: '2026-08-14', to: '2026-08-20' };

  let createdBlob: Blob | null = null;
  let clickedDownload = false;
  // The print window: a real EventTarget, so a test can fire its load event
  let mockWindow: (EventTarget & { document: { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }; print: ReturnType<typeof vi.fn> }) | null = null;

  beforeEach(() => {
    createdBlob = null;
    clickedDownload = false;

    globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
      createdBlob = blob;
      return 'blob:mock-url';
    });
    globalThis.URL.revokeObjectURL = vi.fn();

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        element.click = () => {
          clickedDownload = true;
        };
      }
      return element;
    });

    mockWindow = Object.assign(new EventTarget(), {
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
      print: vi.fn(),
    });
    vi.spyOn(window, 'open').mockReturnValue(mockWindow as unknown as Window);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exportActivitiesToCSV', () => {
    it('returns false when activities array is empty', () => {
      const result = exportActivitiesToCSV([], mockProfile);
      expect(result).toBe(false);
      expect(clickedDownload).toBe(false);
    });

    it('generates valid French CSV with UTF-8 BOM, escaped fields, and resolved caretaker names', async () => {
      const result = exportActivitiesToCSV(mockActivities, mockProfile, 'fr', mockCaretakers);
      expect(result).toBe(true);
      expect(clickedDownload).toBe(true);
      expect(createdBlob).not.toBeNull();

      if (createdBlob) {
        const buffer = await (createdBlob as Blob).arrayBuffer();
        const bytes = new Uint8Array(buffer);
        // Check UTF-8 BOM bytes (EF BB BF)
        expect(bytes[0]).toBe(0xef);
        expect(bytes[1]).toBe(0xbb);
        expect(bytes[2]).toBe(0xbf);

        const text = await (createdBlob as Blob).text();
        // Check quoted French headers
        // Sentence case, all French
        expect(text).toContain('"Date","Heure","Type d\'activité","Lieu besoins","Consistance selles","Quantité (g)","Quantité (verres)","Durée (min)","Poids (kg)","Médicament","Enregistré par","Notes"');
        expect(text).toContain('"Sam"');
        expect(text).toContain('"Alice"');
        // SSO full names and emails are resolved to the caretaker name, never exported raw
        expect(text).not.toContain('Sam Taylor');
        expect(text).not.toContain('alice@example.com');
        expect(text).toContain('Accident in ""hallway"", cleaned immediately');
        expect(text).toContain('"Pipi"');
        expect(text).toContain('"Caca"');
        expect(text).toContain('"Repas"');
        expect(text).toContain('"Pesée"');
        expect(text).toContain('"Médicament"');
        expect(text).toContain('"Dehors"');
        expect(text).toContain('"Accident intérieur"');
        expect(text).toContain('"80"');
        expect(text).toContain('"6.8"');
        expect(text).toContain('"Bravecto"');
      }
    });

    it('generates valid English CSV headers when lang is en', async () => {
      const result = exportActivitiesToCSV(mockActivities, mockProfile, 'en', mockCaretakers);
      expect(result).toBe(true);
      expect(createdBlob).not.toBeNull();

      const text = await (createdBlob as Blob).text();
      expect(text).toContain('"Date","Time","Activity Type","Potty Location","Stool Consistency","Quantity (g)","Quantity (cups)","Duration (min)","Weight (kg)","Medication","Logged By","Notes"');
      expect(text).toContain('"Pee"');
      expect(text).toContain('"Poop"');
      expect(text).toContain('"Outside"');
      expect(text).toContain('"Indoor Accident"');
    });

    // App review 2026-10-16, section 3: "diarrhea" and "runny" were exported raw
    it('every stool value is translated, as in the log form', async () => {
      const stools: Activity[] = (['diarrhea', 'runny', 'soft', 'hard', 'normal'] as const).map((stoolConsistency, index) => ({
        id: `poop-${index}`, puppyId: 'pup-1', type: 'poop', timestamp: `2026-08-19T1${index}:00:00.000Z`, stoolConsistency, loggedBy: 'Sam',
      }));
      exportActivitiesToCSV(stools, mockProfile, 'fr', mockCaretakers);
      const text = await (createdBlob as Blob).text();

      expect(text.match(/"Diarrhée"/g)).toHaveLength(2);
      expect(text).toContain(`"${fr.potty.soft}"`);
      expect(text).toContain(`"${fr.potty.hard}"`);
      expect(text).toContain(`"${fr.potty.normal}"`);
      expect(text).not.toMatch(/diarrhea|runny/);
    });
  });

  describe('printActivitiesReport', () => {
    it('returns false when window.open fails', () => {
      vi.spyOn(window, 'open').mockReturnValue(null);
      const result = printActivitiesReport(mockActivities, mockProfile, 'fr', fr, mockCaretakers, period);
      expect(result).toBe(false);
    });

    it('renders printable French activity report with summary cards and timeline table', () => {
      const result = printActivitiesReport(mockActivities, mockProfile, 'fr', fr, mockCaretakers, period);
      expect(result).toBe(true);
      expect(window.open).toHaveBeenCalledWith('', '', 'width=900,height=1000');
      expect(mockWindow?.document.write).toHaveBeenCalled();
      expect(mockWindow?.document.close).toHaveBeenCalled();

      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;
      expect(htmlContent).toContain('Pistache');
      expect(htmlContent).toContain("Rapport d'activités & propreté");
      expect(htmlContent).toContain('Berger australien');
      // The period printed; no goal: today's goal is not the goal of past days (history display decision (a))
      expect(htmlContent).toContain('Du 14 août 2026 au 20 août 2026');
      expect(htmlContent).not.toContain('240g /');
      expect(htmlContent).toContain('<div class="card-value">5</div>'); // total logs card
      expect(htmlContent).toContain('Dehors');
      expect(htmlContent).toContain('Accident intérieur');
      expect(htmlContent).toContain('80\u00a0g');
      expect(htmlContent).toContain('Bravecto');
    });

    it('renders printable English activity report when lang is en', () => {
      const result = printActivitiesReport(mockActivities, mockProfile, 'en', en, mockCaretakers, period);
      expect(result).toBe(true);

      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;
      expect(htmlContent).toContain('Activity & Potty Report');
      expect(htmlContent).toContain('From August 14, 2026 to August 20, 2026');
      expect(htmlContent).toContain('Total Logs');
      expect(htmlContent).toContain('Outside');
      expect(htmlContent).toContain('Indoors');
    });

    // Owner decision 2026-10-15: a dog with no gram goal may log meals without grams (stored as null)
    it('the Meals card prints the grams only when some were logged, never "0g"', () => {
      const mealsCard = (activities: Activity[]) => {
        vi.mocked(mockWindow!.document.write).mockClear();
        printActivitiesReport(activities, { ...mockProfile, dailyFoodGramGoal: 0 }, 'en', en, mockCaretakers, period);
        const htmlContent = (vi.mocked(mockWindow!.document.write).mock.calls[0][0] as string).replace(/\s+/g, ' ');
        return htmlContent.match(/card-label">Meals<\/div>.*?<div class="card-sub">.*?<\/div>/)![0];
      };
      const gramlessMeals: Activity[] = ['2026-08-19T06:00:00.000Z', '2026-08-19T16:00:00.000Z']
        .map((timestamp, index) => ({ id: `meal-${index}`, puppyId: 'pup-1', type: 'food', timestamp, loggedBy: 'Alice' }));

      expect(mealsCard(gramlessMeals)).toContain('>2</div>');
      expect(mealsCard(gramlessMeals)).not.toMatch(/\dg/);
      expect(mealsCard(mockActivities)).toContain('80 g logged');
    });

    // App review 2026-10-16, section 3: "Selles : diarrhea", "(0.73 cups)" and an English brand line in a French report
    it('a French report says the stool, the cups and its brand line in French, with French numbers', () => {
      const diarrhea: Activity = { id: 'act-d', puppyId: 'pup-1', type: 'poop', timestamp: '2026-08-19T10:00:00.000Z', stoolConsistency: 'diarrhea', loggedBy: 'Sam' };
      printActivitiesReport([...mockActivities, diarrhea], mockProfile, 'fr', fr, mockCaretakers, period);
      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;

      expect(htmlContent).toContain('Selles\u00a0: Diarrhée');
      expect(htmlContent).toContain('Selles\u00a0: Molles');
      expect(htmlContent).toContain('80\u00a0g</strong> (0,73 verres)');
      expect(htmlContent).toContain('6,8 kg');
      expect(htmlContent).not.toMatch(/Smart Activity Log|diarrhea|cups/);
    });

    // Carnet review phase 4 / app review decision 12: French titles in sentence case (English keeps Title Case)
    it('a French report has its titles in sentence case', () => {
      printActivitiesReport(mockActivities, mockProfile, 'fr', fr, mockCaretakers, period);
      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;
      expect(htmlContent).toContain('Historique détaillé des événements');
      expect(htmlContent).toContain('Taux de réussite');
      expect(htmlContent).toContain('Date et heure');
      expect(htmlContent).toContain('Document généré avec PupPace — suivi des besoins et carnet de santé du chiot.');
      expect(htmlContent).not.toMatch(/Activités &|Détaillé|Taux Réussite|Date & Heure|Intelligent|Familial/);
    });

    it('the "Logged by" cell never wraps', () => {
      printActivitiesReport(mockActivities, mockProfile, 'en', en, mockCaretakers, period);
      const htmlContent = (mockWindow!.document.write.mock.calls[0][0] as string).replace(/\s+/g, ' ');

      expect(htmlContent).toMatch(/\.caretaker-badge \{[^}]*white-space: nowrap;/);
    });
  });

  describe('exportHealthPassportToCSV', () => {
    const mockVaccinations: HealthRecord[] = [
      {
        id: 'v-1',
        householdId: 'hh-1',
        puppyId: 'pup-1',
        type: 'vaccination' as const,
        name: 'CHPPiL4 (Nobivac)',
        date: '2026-05-01',
        boosterDate: '2027-05-01',
        vetClinic: 'Clinique Vétérinaire des Lilas',
        batchNumber: 'LOT-992A',
        notes: 'Bien toléré',
      },
    ];

    const mockDewormings: HealthRecord[] = [
      {
        id: 'd-1',
        householdId: 'hh-1',
        puppyId: 'pup-1',
        type: 'deworming' as const,
        name: 'Milbemax',
        productName: 'Milbemax',
        date: '2026-06-01',
        boosterDate: '2026-07-01',
        notes: 'Comprimé appétant',
      },
    ];

    it('generates structured CSV with vaccine, deworming, and weight records', async () => {
      const result = exportHealthPassportToCSV(mockProfile, mockVaccinations, mockDewormings, mockActivities, 'fr', mockCaretakers);
      expect(result).toBe(true);
      expect(clickedDownload).toBe(true);
      expect(createdBlob).not.toBeNull();

      if (createdBlob) {
        const text = await (createdBlob as Blob).text();
        // Sentence case, a dedicated column for the product typed from the vet's sticker
        expect(text).toContain('"Catégorie","Date","Heure","Protocole / produit / mesure","Prochain rappel / échéance","Poids (kg)","Clinique vétérinaire","Produit (vignette)","N° lot / flacon","Enregistré par","Notes"');
        expect(text).toContain('"CHPPiL4 (Nobivac)"');
        expect(text).toContain('"LOT-992A"');
        expect(text).toContain('"Milbemax"');
        expect(text).toContain('"Clinique Vétérinaire des Lilas"');
        expect(text).toContain('"6.8"');
      }
    });

    it('generates structured CSV with English headers when lang is en', async () => {
      const result = exportHealthPassportToCSV(mockProfile, mockVaccinations, mockDewormings, mockActivities, 'en', mockCaretakers);
      expect(result).toBe(true);
      expect(createdBlob).not.toBeNull();

      const text = await (createdBlob as Blob).text();
      expect(text).toContain('"Category","Date","Time","Protocol / Product / Measurement","Next Due / Booster Date","Weight (kg)","Veterinary Clinic","Product (Sticker)","Batch / Lot Number","Logged By","Notes"');
    });

    // Carnet review phase 4: treatments were missing from the exports; whoever logged one is named by their badge
    it('lists every treatment, with who logged it and its notes, and the product typed from the sticker', async () => {
      const stickerVaccine = { ...mockVaccinations[0], productName: 'Nobivac DHPPi+L4' };
      const treatment: Activity = { id: 'act-m', puppyId: 'pup-1', type: 'medication', timestamp: '2026-08-19T14:00:00.000Z', medicationName: 'Métacam', notes: '2 jours', loggedBy: 'alice@example.com' };
      exportHealthPassportToCSV(mockProfile, [stickerVaccine], mockDewormings, [...mockActivities, treatment], 'fr', [...mockCaretakers.slice(0, 1), { ...mockCaretakers[1], email: 'alice@example.com' }]);
      const text = await (createdBlob as Blob).text();

      expect(text).toContain('"Vaccination","2026-05-01","","CHPPiL4 (Nobivac)","2027-05-01","","Clinique Vétérinaire des Lilas","Nobivac DHPPi+L4","LOT-992A","","Bien toléré"');
      expect(text).toContain('"Traitement","2026-08-19","16:00","Bravecto","","","","","","Sam",""');
      expect(text).toContain('"Traitement","2026-08-19","16:00","Métacam","","","","","","Alice","2 jours"');
      expect(text).not.toContain('alice@example.com');

      exportHealthPassportToCSV(mockProfile, [], [], [treatment], 'en', mockCaretakers);
      expect(await (createdBlob as Blob).text()).toContain('"Treatment","2026-08-19","16:00","Métacam"');
    });

    it('a treatment or a weigh-in is on its calendar day, with its time: a 01:30 dose is not on the day before', async () => {
      const lateDose: Activity = { id: 'm-late', puppyId: 'pup-1', type: 'medication', timestamp: '2026-10-01T23:30:00.000Z', medicationName: 'Métacam', loggedBy: 'Sam' };
      const dayDose: Activity = { ...lateDose, id: 'm-day', timestamp: '2026-10-02T11:30:00.000Z' };
      exportHealthPassportToCSV(mockProfile, [], [], [lateDose, dayDose], 'fr', mockCaretakers);
      const text = await (createdBlob as Blob).text();
      expect(text).toContain('"Traitement","2026-10-02","01:30","Métacam"');
      expect(text).toContain('"Traitement","2026-10-02","13:30","Métacam"');
      expect(text).not.toContain('2026-10-01');
    });

    it('its French values are in sentence case', async () => {
      exportHealthPassportToCSV(mockProfile, mockVaccinations, mockDewormings, mockActivities, 'fr', mockCaretakers);
      const text = await (createdBlob as Blob).text();
      expect(text).toContain('"Vermifuge / antiparasitaire","2026-06-01","","Milbemax"');
      expect(text).toContain('"Pesée & croissance","2026-08-19","15:00","Contrôle du poids","","6.8"');
    });
  });

  describe('printHealthPassportReport: one A4 page for the vet (carnet review phase 4, decisions C10-C14)', () => {
    // Today: 15 Oct 2026, Paris
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-15T10:00:00+02:00'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const dog: PuppyProfile = { ...mockProfile, gender: 'female', notes: 'Puce 250269800000000, allergique au poulet' };
    const record = (overrides: Partial<HealthRecord> & Pick<HealthRecord, 'id' | 'type' | 'name' | 'date'>): HealthRecord =>
      ({ householdId: 'hh-1', puppyId: 'pup-1', ...overrides });
    const chppiL4 = 'CHPPi / DAPPi + L4 (Eurican / Nobivac / Versican / Canigen)';
    const rage = 'Rage (Eurican LR / Nobivac Rabies / Versiguard / Rabisin)';
    const vaccines = [
      record({ id: 'v-1', type: 'vaccination', name: chppiL4, date: '2026-05-01', boosterDate: '2026-06-01', productName: 'Nobivac DHPPi+L4', batchNumber: 'B456', vetClinic: 'Clinique des Lilas' }),
      record({ id: 'v-2', type: 'vaccination', name: chppiL4, date: '2026-06-01', boosterDate: '2027-03-01', batchNumber: 'C789', notes: 'Petite boule au point d\'injection' }),
      record({ id: 'v-3', type: 'vaccination', name: rage, date: '2025-10-01', boosterDate: '2026-10-01' }),
    ];
    const dose = (id: string, date: string, boosterDate: string, name = 'Credelio Plus') =>
      record({ id, type: 'deworming', name, productName: name, date, boosterDate });
    const doses = [
      dose('d-1', '2026-09-20', '2026-10-20'),
      dose('d-2', '2026-08-20', '2026-09-20'),
      dose('d-old-1', '2025-09-01', '2025-10-01', 'Milbemax Chiot / Milprazon / Milprazikan'),
      dose('d-old-2', '2025-08-01', '2025-09-01', 'Milbemax Chiot / Milprazon / Milprazikan'),
    ];
    const weighIn = (id: string, date: string, weightKg: number): Activity => ({ id, puppyId: 'pup-1', type: 'weight', timestamp: `${date}T08:00:00.000Z`, weightKg, loggedBy: 'Alice' });
    const medication = (id: string, date: string, medicationName: string, notes?: string): Activity => ({ id, puppyId: 'pup-1', type: 'medication', timestamp: `${date}T08:00:00.000Z`, medicationName, notes, loggedBy: 'Alice' });
    const activities: Activity[] = [
      weighIn('w-1', '2026-05-01', 6.2), weighIn('w-2', '2026-06-01', 9.1), weighIn('w-3', '2026-08-01', 13.4), weighIn('w-4', '2026-10-01', 16.8),
      medication('m-1', '2026-10-01', 'Métacam', '2 jours'),
      medication('m-old', '2026-06-01', 'Smecta'),
    ];

    const printed = (overrides: { profile?: PuppyProfile; vaccines?: HealthRecord[]; doses?: HealthRecord[]; activities?: Activity[]; lang?: 'en' | 'fr' } = {}) => {
      expect(printHealthPassportReport(overrides.profile ?? dog, overrides.vaccines ?? vaccines, overrides.doses ?? doses, overrides.activities ?? activities, overrides.lang ?? 'fr')).toBe(true);
      return mockWindow!.document.write.mock.calls.at(-1)![0] as string;
    };
    /** One section of the page, by its id. */
    const sectionOf = (html: string, id: string) => {
      const start = html.indexOf(`<section id="${id}"`);
      expect(start).toBeGreaterThan(-1);
      return html.slice(start, html.indexOf('</section>', start));
    };
    const rowCount = (html: string) => (html.match(/<tr data-row>/g) ?? []).length;

    it('opens a print window with one A4 page: its margins set by @page', () => {
      const html = printed();
      expect(window.open).toHaveBeenCalledWith('', '', 'width=900,height=1000');
      expect(html).toMatch(/@page \{ size: A4; margin: 12mm; \}/);
    });

    it('its title says it is a summary and not an official document; no "Enregistré par", WSAVA or "Passeport vaccinal"', () => {
      const french = printed();
      expect(french).toContain('<title>Pistache — Carnet de santé — résumé (document non officiel)</title>');
      expect(french).toContain('<h1>Carnet de santé — résumé (document non officiel)</h1>');
      expect(french).not.toMatch(/Enregistré par|WSAVA|Passeport|ESCCAP/i);

      const english = printed({ lang: 'en' });
      expect(english).toContain('<h1>Health record — summary (unofficial document)</h1>');
      expect(english).not.toMatch(/Logged by|WSAVA|Passport|ESCCAP/i);
    });

    it('the header: name, sex, breed, birth date and age, the latest weight, and the dog\'s own notes (decision C11)', () => {
      const header = sectionOf(printed(), 'identity');
      expect(header).toContain('Pistache');
      expect(header).toContain('Femelle');
      expect(header).toContain('Berger australien');
      expect(header).toContain('01/03/2026 (7\u00a0mois)');
      expect(header).toContain('16,8 kg (01/10/2026)');
      expect(header).toContain('Puce 250269800000000, allergique au poulet');

      const withoutNotes = sectionOf(printed({ profile: { ...dog, notes: undefined, gender: null } }), 'identity');
      expect(withoutNotes).not.toContain('dog-notes');
      expect(withoutNotes).not.toMatch(/Femelle|Mâle/);
    });

    it('every date is DD/MM/YYYY', () => {
      const html = printed();
      expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(html).toContain('01/05/2026');
      expect(html).toContain('15/10/2026'); // printed on
    });

    it('"À faire" lists every open next date, overdue first, as on screen', () => {
      const toDo = sectionOf(printed(), 'to-do');
      const order = ['Rage', 'Credelio Plus', 'CHPPi + L4'].map((name) => toDo.indexOf(name));
      expect(order.every((index) => index > -1)).toBe(true);
      expect(order).toEqual([...order].sort((first, second) => first - second));
      expect(toDo).toContain('01/10/2026');
      expect(toDo).toContain('en retard');
      expect(toDo).toContain('20/10/2026');
      expect(toDo).toContain('01/03/2027');
      expect(toDo).not.toContain('01/06/2026'); // the renewed May shot

      expect(sectionOf(printed({ vaccines: [], doses: [] }), 'to-do')).toContain('Rien à faire pour l\'instant.');
    });

    it('vaccines: the short name, the product and lot from the sticker, the clinic and the notes', () => {
      const section = sectionOf(printed(), 'vaccines');
      expect(rowCount(section)).toBe(3);
      expect(section).toContain('CHPPi + L4');
      expect(section).toContain('Nobivac DHPPi+L4 · lot B456');
      expect(section).toContain('lot C789');
      expect(section).toContain('Clinique des Lilas');
      expect(section).toContain('Petite boule au point d&#39;injection');
      expect(section).not.toContain('Eurican / Nobivac');
    });

    it('"À faire" past 6 lines: "+ 1 autre", "+ 2 autres", "+ 1 more"', () => {
      const openShots = (count: number) => Array.from({ length: count }, (_, index) =>
        record({ id: `o-${index}`, type: 'vaccination', name: `Vaccin ${index}`, date: '2026-06-01', boosterDate: '2027-06-01' }));
      expect(sectionOf(printed({ vaccines: openShots(7), doses: [] }), 'to-do')).toContain('<p class="earlier">+ 1 autre</p>');
      expect(sectionOf(printed({ vaccines: openShots(8), doses: [] }), 'to-do')).toContain('<p class="earlier">+ 2 autres</p>');
      expect(sectionOf(printed({ vaccines: openShots(7), doses: [], lang: 'en' }), 'to-do')).toContain('<p class="earlier">+ 1 more</p>');
    });

    it('vaccines: every open shot first (a rabies shot good for 3 years, with its lot), then the latest renewed ones; the rest as "n antérieurs"', () => {
      // A 1-2-year-old's carnet in France: puppy series, rabies, kennel cough, piroplasmosis twice a year
      const piro = 'Piroplasmose (Eurican Piro / Nobivac Piro)';
      const history = [
        record({ id: 'rage', type: 'vaccination', name: rage, date: '2025-06-15', boosterDate: '2028-06-15', batchNumber: 'RAGE-LOT-1' }),
        record({ id: 'chppi-1', type: 'vaccination', name: chppiL4, date: '2025-07-01', boosterDate: '2026-07-01' }),
        record({ id: 'chppi-2', type: 'vaccination', name: chppiL4, date: '2026-07-01', boosterDate: '2027-07-01' }),
        record({ id: 'piro-1', type: 'vaccination', name: piro, date: '2025-09-01', boosterDate: '2026-03-01' }),
        record({ id: 'piro-2', type: 'vaccination', name: piro, date: '2026-03-01', boosterDate: '2026-09-01' }),
        record({ id: 'piro-3', type: 'vaccination', name: piro, date: '2026-09-01', boosterDate: '2027-03-01' }),
        record({ id: 'kc', type: 'vaccination', name: 'Toux de Chenil (Nobivac KC / Bronchi-Shield)', date: '2026-05-01', boosterDate: '2027-05-01' }),
      ];
      const section = sectionOf(printed({ vaccines: history }), 'vaccines');
      expect(rowCount(section)).toBe(6);
      expect(section).toContain('<td>15/06/2025</td><td>Rage</td><td>lot RAGE-LOT-1</td>');
      expect(section).not.toContain('<td>01/07/2025</td>'); // the oldest renewed shot
      expect(section).toContain('<p class="earlier">1 antérieur</p>');
      expect(sectionOf(printed({ vaccines: history, lang: 'en' }), 'vaccines')).toContain('<p class="earlier">1 earlier</p>');
      // Newest first
      const dates = [...section.matchAll(/<tr data-row><td>(\d\d)\/(\d\d)\/(\d{4})/g)].map(([, day, month, year]) => `${year}-${month}-${day}`);
      expect(dates).toEqual([...dates].sort().reverse());
    });

    it('dewormings: the last 12 months, older ones as "n antérieurs", with their notes', () => {
      const section = sectionOf(printed({ doses: [{ ...doses[0], notes: 'Donné avec du fromage' }, ...doses.slice(1)] }), 'dewormings');
      expect(rowCount(section)).toBe(2);
      expect(section).toContain('<tr class="note"><td colspan="3">Donné avec du fromage</td></tr>');
      expect(section).not.toContain('Milbemax');
      expect(section).toContain('<p class="earlier">2 antérieurs</p>');
      expect(sectionOf(printed({ lang: 'en' }), 'dewormings')).toContain('<p class="earlier">2 earlier</p>');
    });

    it('treatments: the last 90 days, with their notes', () => {
      const section = sectionOf(printed(), 'treatments');
      expect(rowCount(section)).toBe(1);
      expect(section).toContain('Métacam');
      expect(section).toContain('2 jours');
      expect(section).not.toContain('Smecta');
      expect(section).toContain('1 antérieur');
    });

    it('weight: the curve as an inline SVG drawn by the chart\'s geometry, and the last 6 weigh-ins', () => {
      // 4 kg to 13 kg, every 3 weeks
      const weighIns = Array.from({ length: 10 }, (_, index) => weighIn(`w-${index}`, addDays('2026-03-15', index * 21), 4 + index));
      const section = sectionOf(printed({ activities: weighIns }), 'weight');
      expect(section).toMatch(/<svg [^>]*width="\d+" height="200"/);
      expect(section).toMatch(/<path data-line d="M[-\d.,L]+"/);
      expect((section.match(/<circle data-weigh-in/g) ?? []).length).toBe(10);
      expect(rowCount(section)).toBe(6);
      expect(section).toContain('13 kg'); // the latest
      expect(section).toContain('<td>8 kg</td>'); // the 6th latest
      expect(section).not.toContain('<td>7 kg</td>'); // the 7th latest is out of the list
    });

    it('weight: a legend says what the line and dots, the grey band and the dashed line are, as on screen', () => {
      const legend = (html: string) => sectionOf(html, 'weight').match(/<p class="legend">.*?<\/p>/s)?.[0] ?? '';
      const puppyLegend = legend(printed());
      expect(puppyLegend).toContain('Pesées');
      expect(puppyLegend).toContain('Zone attendue (race, indicatif)');
      expect(puppyLegend).toContain('Projection');
      expect(legend(printed({ lang: 'en' }))).toContain('Expected range (breed, rough guide)');

      // An adult of no known breed: no band, no projection, and none in the legend
      const adultLegend = legend(printed({ profile: { ...dog, breed: 'Croisé', birthDate: '2022-01-01' } }));
      expect(adultLegend).toContain('Pesées');
      expect(adultLegend).not.toMatch(/Zone attendue|Projection/);
    });

    it('a weigh-in that looks like a typo is left out of the latest weight and marked in the list, as on screen', () => {
      const weighIns = ([['2026-09-01', 9], ['2026-09-15', 9.6], ['2026-10-01', 10.4], ['2026-10-08', 104]] as const).map(([date, weightKg], index) => weighIn(`t-${index}`, date, weightKg));
      const html = printed({ activities: weighIns });
      expect(sectionOf(html, 'identity')).toContain('10,4 kg (01/10/2026)');
      expect(sectionOf(html, 'weight')).toContain('104 kg (À vérifier)');
    });

    it('a dog without a weigh-in shows no weight, never the profile weight (a new dog\'s is made up)', () => {
      const html = printed({ activities: [] });
      expect(html).not.toContain(`${mockProfile.weightKg}`.replace('.', ','));
      expect(sectionOf(html, 'weight')).toContain('Aucune pesée enregistrée.');
      expect(sectionOf(html, 'weight')).not.toContain('<svg');
    });

    it('a missing clinic, product or lot prints a dash, never a made-up value', () => {
      const section = sectionOf(printed({ vaccines: [record({ id: 'v-x', type: 'vaccination', name: rage, date: '2026-07-01', boosterDate: '2027-07-01' })] }), 'vaccines');
      expect(section).toMatch(/<td>Rage<\/td>\s*<td>-<\/td>\s*<td>-<\/td>/);
    });

    it('every section is capped, so a long history still fits one page', () => {
      const manyVaccines = Array.from({ length: 20 }, (_, index) => record({ id: `v-${index}`, type: 'vaccination', name: `Vaccin ${index}`, date: `${2000 + index}-01-01`, boosterDate: '2027-06-01', notes: 'x'.repeat(2000) }));
      const manyDoses = Array.from({ length: 30 }, (_, index) => dose(`d-${index}`, addDays('2026-10-14', -index * 11), '2026-11-14'));
      const manyActivities = [
        ...Array.from({ length: 20 }, (_, index) => weighIn(`w-${index}`, addDays('2026-10-14', -index * 7), 20 - index / 2)),
        ...Array.from({ length: 20 }, (_, index) => medication(`m-${index}`, addDays('2026-10-14', -index * 4), `Traitement ${index}`, 'y'.repeat(2000))),
      ];
      const html = printed({ profile: { ...dog, notes: 'z'.repeat(2000) }, vaccines: manyVaccines, doses: manyDoses, activities: manyActivities });

      expect(rowCount(sectionOf(html, 'to-do'))).toBe(6);
      // Checked at A4 in Chrome: this history, every note 2000 characters long, prints on one page
      expect(rowCount(sectionOf(html, 'vaccines'))).toBe(6);
      expect(sectionOf(html, 'vaccines')).toContain('14 antérieurs');
      expect(rowCount(sectionOf(html, 'dewormings'))).toBe(8);
      expect(sectionOf(html, 'dewormings')).toContain('22 antérieurs');
      expect(rowCount(sectionOf(html, 'treatments'))).toBe(8);
      expect(rowCount(sectionOf(html, 'weight'))).toBe(6);
      // Notes are cut, with an ellipsis, and print on one line (the dog's on two)
      expect(html).not.toMatch(/x{200}|y{200}|z{400}/);
      expect(html).toMatch(/tr\.note td \{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/);
      expect(html).toMatch(/x+…/);
      expect(html).toMatch(/z+…/);
    });
  });

  // The print window is about:blank, so it inherits the app's Content-Security-Policy: no inline script may run in it
  describe('print windows run no script of their own', () => {
    it.each([
      ['activity report', () => printActivitiesReport(mockActivities, mockProfile, 'fr', fr, mockCaretakers, period)],
      ['health passport', () => printHealthPassportReport(mockProfile, [], [], mockActivities, 'fr')],
    ])('the %s window gets no inline script; the app prints it once it has loaded', (_reportName, printReport) => {
      const addListener = vi.spyOn(mockWindow!, 'addEventListener');
      expect(printReport()).toBe(true);

      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;
      expect(htmlContent).not.toMatch(/<script/i);
      expect(mockWindow?.print).not.toHaveBeenCalled();
      // In a browser, write() opens a new document and drops the window's listeners: listen after it,
      // and before close(), which can fire load synchronously
      expect(addListener.mock.invocationCallOrder[0]).toBeGreaterThan(mockWindow!.document.write.mock.invocationCallOrder[0]);
      expect(addListener.mock.invocationCallOrder[0]).toBeLessThan(mockWindow!.document.close.mock.invocationCallOrder[0]);

      mockWindow?.dispatchEvent(new Event('load'));
      expect(mockWindow?.print).toHaveBeenCalledTimes(1);
    });
  });

  describe('print reports escape user-controlled values', () => {
    const imagePayload = '<img src=x onerror=alert(1)>';
    // No whitespace: resolveCaretakerName keeps only the first word of loggedBy.
    const svgPayload = '<svg/onload=alert(1)>';
    const hostileProfile: PuppyProfile = { ...mockProfile, name: svgPayload, breed: svgPayload, birthDate: svgPayload, notes: imagePayload };
    const hostileActivities: Activity[] = [
      {
        id: 'act-x1',
        puppyId: 'pup-1',
        type: 'poop',
        timestamp: '2026-08-19T08:30:00.000Z',
        pottyLocation: 'outside',
        stoolConsistency: svgPayload as Activity['stoolConsistency'],
        loggedBy: svgPayload,
        notes: imagePayload,
      },
      {
        id: 'act-x2',
        puppyId: 'pup-1',
        type: 'medication',
        timestamp: '2026-08-19T09:00:00.000Z',
        medicationName: svgPayload,
        loggedBy: svgPayload,
      },
      {
        id: 'act-x3',
        puppyId: 'pup-1',
        type: 'weight',
        timestamp: '2026-08-19T10:00:00.000Z',
        weightKg: 7,
        loggedBy: svgPayload,
        notes: imagePayload,
      },
    ];
    const hostileCaretakers: Caretaker[] = [{ id: 'c-x', name: svgPayload, role: 'Member', color: '#000' }];
    const hostileRecord: HealthRecord = {
      id: 'v-x',
      householdId: 'hh-1',
      puppyId: 'pup-1',
      type: 'vaccination',
      name: svgPayload,
      date: svgPayload,
      boosterDate: svgPayload,
      vetClinic: svgPayload,
      batchNumber: svgPayload,
      productName: svgPayload,
      notes: imagePayload,
    };

    const expectEscaped = (htmlContent: string) => {
      expect(htmlContent).not.toContain('<img');
      expect(htmlContent).not.toContain('<svg/');
      expect(htmlContent).toContain('&lt;svg/onload=alert(1)&gt;');
    };

    it('escapes names, notes, caretakers and medication in the activity report', () => {
      printActivitiesReport(hostileActivities, hostileProfile, 'en', en, hostileCaretakers, period);
      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;
      expectEscaped(htmlContent);
      expect(htmlContent).toContain('&quot;&lt;img src=x onerror=alert(1)&gt;&quot;');
    });

    it('escapes profile, vaccine, deworming and weight values in the health passport', () => {
      const hostileDeworming: HealthRecord = { ...hostileRecord, id: 'd-x', type: 'deworming' };
      printHealthPassportReport(hostileProfile, [hostileRecord], [hostileDeworming], hostileActivities, 'fr');
      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;
      expectEscaped(htmlContent);
      expect(htmlContent).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });
  });

  describe('health passport weights (Phase 5c)', () => {
    // A record entered before Phase 5c still holds its weight, now also a weight event: the passport shows it once, as the event
    const legacyDeworming = {
      id: 'd-legacy', householdId: 'hh-1', puppyId: 'pup-1', type: 'deworming', name: 'Credelio Plus', productName: 'Credelio Plus', date: '2026-07-21', boosterDate: '2026-08-21', weightAtTime: 7.55,
    } as HealthRecord;
    const dewormingWeighIn: Activity = { id: 'act-w', puppyId: 'pup-1', type: 'weight', timestamp: '2026-07-21T10:00:00.000Z', weightKg: 7.55, notes: 'Credelio Plus', loggedBy: 'Alice' };

    it('the CSV lists a deworming weight once, as its weight event', async () => {
      exportHealthPassportToCSV(mockProfile, [], [legacyDeworming], [dewormingWeighIn], 'fr', mockCaretakers);
      const text = await (createdBlob as Blob).text();
      expect(text.match(/"7\.55"/g)).toHaveLength(1);
    });

    it('the printed passport lists a deworming weight once, as its weight event', () => {
      printHealthPassportReport(mockProfile, [], [legacyDeworming], [dewormingWeighIn], 'fr');
      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;
      expect(htmlContent.match(/<td>7,6 kg<\/td>/g)).toHaveLength(1); // French format (formatKg)
      expect(htmlContent).not.toContain('Poids au Traitement');
    });
  });
  describe('health passport CSV: missing clinic (pre-fill review item 36)', () => {
    const vaccineWithoutClinic = { id: 'v-x', householdId: 'hh-1', puppyId: 'pup-1', type: 'vaccination', name: 'Rage', date: '2026-07-01', boosterDate: '2027-07-01' } as HealthRecord;

    it('the CSV leaves the clinic empty when none was entered, instead of a made-up "Clinique Vétérinaire"', async () => {
      exportHealthPassportToCSV(mockProfile, [vaccineWithoutClinic], [], [], 'fr', mockCaretakers);
      const text = await (createdBlob as Blob).text();
      expect(text.match(/"Clinique vétérinaire"/gi)).toHaveLength(1); // the header only
      expect(text).toContain('"Vaccination","2026-07-01","","Rage","2027-07-01","","","","",');
    });
  });

  describe('CSV exports never hand a spreadsheet a formula (OWASP CSV injection)', () => {
    const formulaLog = (id: string, extra: Partial<Activity>): Activity => ({
      id, puppyId: 'pup-1', type: 'pee', timestamp: '2026-08-19T08:30:00.000Z', loggedBy: 'Alice', ...extra,
    });

    it('a text cell starting with = + - @, even after leading whitespace, gets a leading quote in the activity CSV; numbers stay numbers', async () => {
      exportActivitiesToCSV([
        formulaLog('f-1', { notes: '=HYPERLINK("http://example.com","x")' }),
        formulaLog('f-2', { type: 'medication', medicationName: '+SUM(1,1)', loggedBy: '@cmd' }),
        formulaLog('f-3', { notes: '-2+3' }),
        formulaLog('f-4', { notes: '\t=1+1' }),
        formulaLog('f-5', { notes: '\r@SUM(A1)' }),
        formulaLog('f-8', { notes: ' =1+1' }),
        formulaLog('f-9', { notes: '\n=1+1' }),
        formulaLog('f-6', { type: 'weight', weightKg: 6.8 }),
        formulaLog('f-7', { type: 'food', quantityGrams: 80, durationMinutes: -5 }),
      ], mockProfile, 'en', mockCaretakers);
      const text = await (createdBlob as Blob).text();

      expect(text).toContain('"\'=HYPERLINK(""http://example.com"",""x"")"');
      expect(text).toContain('"\'+SUM(1,1)"');
      expect(text).toContain('"\'@cmd"');
      expect(text).toContain('"\'-2+3"');
      expect(text.match(/"'=1\+1"/g)).toHaveLength(3); // after a tab, a space, a line feed
      expect(text).toContain('"\'@SUM(A1)"');
      expect(text).toContain('"6.8"');
      expect(text).toContain('"80"');
      expect(text).toContain('"-5"');
      expect(text).not.toMatch(/"=|"\+|"@/);
    });

    it('a text cell starting with = + - @, even after leading whitespace, gets a leading quote in the health passport CSV', async () => {
      const formulaVaccine = { id: 'v-f', householdId: 'hh-1', puppyId: 'pup-1', type: 'vaccination', name: '=cmd|"/C calc"!A0', date: '2026-07-01', vetClinic: '@evil', batchNumber: '+1', notes: '-1' } as HealthRecord;
      const whitespaceVaccine = { ...formulaVaccine, id: 'v-w', name: ' =1+1', vetClinic: '', batchNumber: '', notes: '\n=1+1' } as HealthRecord;
      exportHealthPassportToCSV(mockProfile, [formulaVaccine, whitespaceVaccine], [], [], 'en', mockCaretakers);
      const text = await (createdBlob as Blob).text();

      expect(text).toContain('"\'=cmd|""/C calc""!A0"');
      expect(text).toContain('"\'@evil"');
      expect(text).toContain('"\'+1"');
      expect(text).toContain('"\'-1"');
      expect(text.match(/"'=1\+1"/g)).toHaveLength(2); // after a space, a line feed
      expect(text).not.toMatch(/"=|"\+|"@/);
    });
  });
});
