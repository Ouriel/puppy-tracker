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

      if (createdBlob) {
        const text = await (createdBlob as Blob).text();
        expect(text).toContain('"Date","Time","Activity Type","Potty Location","Stool Consistency","Quantity (g)","Quantity (cups)","Duration (min)","Weight (kg)","Medication","Logged By","Notes"');
        expect(text).toContain('"Pee"');
        expect(text).toContain('"Poop"');
        expect(text).toContain('"Outside"');
        expect(text).toContain('"Indoor Accident"');
      }
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
      expect(htmlContent).toContain('window.print()');
      expect(htmlContent).toContain('5');
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
        weightAtTime: 6.2,
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

      if (createdBlob) {
        const text = await (createdBlob as Blob).text();
        expect(text).toContain('"Category","Date","Protocol / Product / Measurement","Next Due / Booster Date","Weight (kg)","Veterinary Clinic","Batch / Lot Number","Logged By","Notes"');
      }
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
});
