// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Activity, PuppyProfile, Caretaker, HealthRecord } from '../../types';
import { exportActivitiesToCSV, printActivitiesReport, exportHealthPassportToCSV, printHealthPassportReport } from '../export';
import { en } from '../../i18n/en';
import { fr } from '../../i18n/fr';

describe('export utilities — CSV and PDF export test suite', () => {
  const mockProfile: PuppyProfile = {
    id: 'pup-1',
    name: 'Balma',
    breed: 'Australian Shepherd',
    birthDate: '2026-03-01',
    weightKg: 6.5,
    dailyFoodGramGoal: 240,
    targetMealsPerDay: 3,
  };

  const mockCaretakers: Caretaker[] = [
    { id: 'c-1', name: 'Matthieu', role: 'Member', color: '#6366F1' },
    { id: 'c-2', name: 'Daria', role: 'Member', color: '#EC4899' },
  ];

  const mockActivities: Activity[] = [
    {
      id: 'act-1',
      puppyId: 'pup-1',
      type: 'pee',
      timestamp: '2026-08-19T08:30:00.000Z',
      pottyLocation: 'outside',
      loggedBy: 'Matthieu Jacquet',
      notes: 'Good pee on grass',
    },
    {
      id: 'act-2',
      puppyId: 'pup-1',
      type: 'poop',
      timestamp: '2026-08-19T09:00:00.000Z',
      pottyLocation: 'indoor_accident',
      stoolConsistency: 'soft',
      loggedBy: 'daria.risko@gmail.com',
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
      loggedBy: 'Matthieu',
    },
    {
      id: 'act-4',
      puppyId: 'pup-1',
      type: 'weight',
      timestamp: '2026-08-19T13:00:00.000Z',
      weightKg: 6.8,
      loggedBy: 'Daria',
    },
    {
      id: 'act-5',
      puppyId: 'pup-1',
      type: 'medication',
      timestamp: '2026-08-19T14:00:00.000Z',
      medicationName: 'Bravecto',
      loggedBy: 'Matthieu',
    },
  ];

  let createdBlob: Blob | null = null;
  let clickedDownload = false;
  let mockWindow: { document: { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> } } | null = null;

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

    mockWindow = {
      document: {
        write: vi.fn(),
        close: vi.fn(),
      },
    };
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
        expect(text).toContain('"Date","Heure","Type d\'Activité","Lieu Besoins","Consistance Selles","Quantité (g)","Quantité (cups)","Durée (min)","Poids (kg)","Médicament","Enregistré Par","Notes"');
        expect(text).toContain('"Matthieu"');
        expect(text).toContain('"Daria"');
        // SSO full names and emails are resolved to the caretaker name, never exported raw
        expect(text).not.toContain('Matthieu Jacquet');
        expect(text).not.toContain('daria.risko@gmail.com');
        expect(text).toContain('Accident in ""hallway"", cleaned immediately');
        expect(text).toContain('"Pipi"');
        expect(text).toContain('"Caca"');
        expect(text).toContain('"Repas"');
        expect(text).toContain('"Pesée"');
        expect(text).toContain('"Médicament"');
        expect(text).toContain('"Dehors"');
        expect(text).toContain('"Accident Intérieur"');
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
  });

  describe('printActivitiesReport', () => {
    it('returns false when window.open fails', () => {
      vi.spyOn(window, 'open').mockReturnValue(null);
      const result = printActivitiesReport(mockActivities, mockProfile, 'fr', fr, mockCaretakers);
      expect(result).toBe(false);
    });

    it('renders printable French activity report with summary cards and timeline table', () => {
      const result = printActivitiesReport(mockActivities, mockProfile, 'fr', fr, mockCaretakers);
      expect(result).toBe(true);
      expect(window.open).toHaveBeenCalledWith('', '', 'width=900,height=1000');
      expect(mockWindow?.document.write).toHaveBeenCalled();
      expect(mockWindow?.document.close).toHaveBeenCalled();

      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;
      expect(htmlContent).toContain('Balma');
      expect(htmlContent).toContain("Rapport d'Activités & Propreté");
      expect(htmlContent).toContain('Berger Australien');
      expect(htmlContent).toContain('240g / jour (3 repas)');

      vi.mocked(mockWindow!.document.write).mockClear();
      printActivitiesReport(mockActivities, { ...mockProfile, dailyFoodGramGoal: 0 }, 'fr', fr, mockCaretakers);
      const noGoalContent = vi.mocked(mockWindow!.document.write).mock.calls[0][0] as string;
      expect(noGoalContent).toContain('<strong>Objectif Repas :</strong> 3 repas / jour</div>');
      expect(htmlContent).toContain('window.print()');
      expect(htmlContent).toContain('<div class="card-value">5</div>'); // total logs card
      expect(htmlContent).toContain('Dehors');
      expect(htmlContent).toContain('Accident Intérieur');
      expect(htmlContent).toContain('80g');
      expect(htmlContent).toContain('Bravecto');
    });

    it('renders printable English activity report when lang is en', () => {
      const result = printActivitiesReport(mockActivities, mockProfile, 'en', en, mockCaretakers);
      expect(result).toBe(true);

      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;
      expect(htmlContent).toContain('Activity & Potty Report');
      expect(htmlContent).toContain('Total Logs');
      expect(htmlContent).toContain('Outside');
      expect(htmlContent).toContain('Indoors');
    });

    // Owner decision 2026-10-15: a dog with no gram goal may log meals without grams (stored as null)
    it('the Meals card prints the grams only when some were logged, never "0g"', () => {
      const mealsCard = (activities: Activity[]) => {
        vi.mocked(mockWindow!.document.write).mockClear();
        printActivitiesReport(activities, { ...mockProfile, dailyFoodGramGoal: 0 }, 'en', en, mockCaretakers);
        const htmlContent = (vi.mocked(mockWindow!.document.write).mock.calls[0][0] as string).replace(/\s+/g, ' ');
        return htmlContent.match(/card-label">Meals<\/div>.*?<div class="card-sub">.*?<\/div>/)![0];
      };
      const gramlessMeals: Activity[] = ['2026-08-19T06:00:00.000Z', '2026-08-19T16:00:00.000Z']
        .map((timestamp, index) => ({ id: `meal-${index}`, puppyId: 'pup-1', type: 'food', timestamp, loggedBy: 'Daria' }));

      expect(mealsCard(gramlessMeals)).toContain('>2</div>');
      expect(mealsCard(gramlessMeals)).not.toMatch(/\dg/);
      expect(mealsCard(mockActivities)).toContain('80g logged');
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
        expect(text).toContain('"Catégorie","Date","Protocole / Produit / Mesure","Prochain Rappel / Échéance","Poids (kg)","Clinique Vétérinaire","N° Lot / Flacon","Enregistré Par","Notes"');
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
      expect(text).toContain('"Category","Date","Protocol / Product / Measurement","Next Due / Booster Date","Weight (kg)","Veterinary Clinic","Batch / Lot Number","Logged By","Notes"');
    });
  });

  describe('printHealthPassportReport', () => {
    const mockVaccinations: HealthRecord[] = [
      {
        id: 'v-1',
        householdId: 'hh-1',
        puppyId: 'pup-1',
        type: 'vaccination' as const,
        name: 'CHPPiL4',
        date: '2026-05-01',
        boosterDate: '2027-05-01',
        vetClinic: 'Clinique Vet',
        batchNumber: 'LOT-1',
      },
    ];

    const mockDewormings: HealthRecord[] = [
      {
        id: 'd-1',
        householdId: 'hh-1',
        puppyId: 'pup-1',
        type: 'deworming' as const,
        name: 'Credelio Plus',
        date: '2026-06-01',
        boosterDate: '2026-07-01',
      },
    ];

    it('renders printable French veterinary health passport', () => {
      const result = printHealthPassportReport(mockProfile, mockVaccinations, mockDewormings, mockActivities, 'fr', fr);
      expect(result).toBe(true);
      expect(window.open).toHaveBeenCalledWith('', '', 'width=900,height=1000');

      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;
      expect(htmlContent).toContain('Carnet de Santé & Passeport Vaccinal');
      expect(htmlContent).toContain('CHPPiL4');
      expect(htmlContent).toContain('Credelio Plus');
      expect(htmlContent).toContain('window.print()');
    });

    it('renders printable English veterinary health passport when lang is en', () => {
      const result = printHealthPassportReport(mockProfile, mockVaccinations, mockDewormings, mockActivities, 'en', en);
      expect(result).toBe(true);

      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;
      expect(htmlContent).toContain('Health Passport & Vaccine Record');
      expect(htmlContent).toContain('Vaccination History');
      expect(htmlContent).toContain('Deworming & Parasitology');
    });
  });

  describe('print reports escape user-controlled values', () => {
    const imagePayload = '<img src=x onerror=alert(1)>';
    // No whitespace: resolveCaretakerName keeps only the first word of loggedBy.
    const svgPayload = '<svg/onload=alert(1)>';
    const hostileProfile: PuppyProfile = { ...mockProfile, name: svgPayload, breed: svgPayload, birthDate: svgPayload };
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
      expect(htmlContent).not.toContain('<svg');
      expect(htmlContent).toContain('&lt;svg/onload=alert(1)&gt;');
    };

    it('escapes names, notes, caretakers and medication in the activity report', () => {
      printActivitiesReport(hostileActivities, hostileProfile, 'en', en, hostileCaretakers);
      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;
      expectEscaped(htmlContent);
      expect(htmlContent).toContain('&quot;&lt;img src=x onerror=alert(1)&gt;&quot;');
    });

    it('escapes profile, vaccine, deworming and weight values in the health passport', () => {
      const hostileDeworming: HealthRecord = { ...hostileRecord, id: 'd-x', type: 'deworming' };
      printHealthPassportReport(hostileProfile, [hostileRecord], [hostileDeworming], hostileActivities, 'fr', fr);
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
    const dewormingWeighIn: Activity = { id: 'act-w', puppyId: 'pup-1', type: 'weight', timestamp: '2026-07-21T10:00:00.000Z', weightKg: 7.55, notes: 'Credelio Plus', loggedBy: 'Daria' };

    it('the CSV lists a deworming weight once, as its weight event', async () => {
      exportHealthPassportToCSV(mockProfile, [], [legacyDeworming], [dewormingWeighIn], 'fr', mockCaretakers);
      const text = await (createdBlob as Blob).text();
      expect(text.match(/"7\.55"/g)).toHaveLength(1);
    });

    it('the printed passport lists a deworming weight once, in the weight history', () => {
      printHealthPassportReport(mockProfile, [], [legacyDeworming], [dewormingWeighIn], 'fr', fr);
      const htmlContent = mockWindow?.document.write.mock.calls[0][0] as string;
      expect(htmlContent.match(/7\.55 kg/g)).toHaveLength(2); // the latest-weight card and its weight history row
      expect(htmlContent).not.toContain('Poids au Traitement');
    });
  });
});
