// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Activity, PuppyProfile, Caretaker } from '../../types';
import { exportActivitiesToCSV, printActivitiesReport } from '../export';
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
        // Check French headers
        expect(text).toContain('Date & Heure,Type,Lieu Besoins,Consistance Selles,Quantité (g),Quantité (cups),Durée (min),Poids (kg),Médicament,Enregistré par,Notes');
        expect(text).toContain('"Matthieu"');
        expect(text).toContain('"Daria"');
        expect(text).toContain('Accident in ""hallway"", cleaned immediately');
        expect(text).toContain('"PEE"');
        expect(text).toContain('"POOP"');
        expect(text).toContain('"FOOD"');
        expect(text).toContain('"WEIGHT"');
        expect(text).toContain('"MEDICATION"');
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
        expect(text).toContain('Date & Time,Type,Potty Location,Stool Consistency,Quantity (g),Quantity (cups),Duration (min),Weight (kg),Medication,Logged By,Notes');
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
});
