import { describe, it, expect } from 'vitest';
import { en } from '../en';
import { fr } from '../fr';

function getDeepKeys(object: Record<string, any>, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key of Object.keys(object)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof object[key] === 'object' && object[key] !== null) {
      keys = keys.concat(getDeepKeys(object[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe('i18n Translation Dictionary Parity', () => {
  it('should have 100% deep key parity between English and French dictionaries', () => {
    const enDeepKeys = getDeepKeys(en);
    const frDeepKeys = getDeepKeys(fr);
    expect(enDeepKeys).toEqual(frDeepKeys);
  });

  it('should have matching top-level sections', () => {
    const enKeys = Object.keys(en).sort();
    const frKeys = Object.keys(fr).sort();
    expect(enKeys).toEqual(frKeys);
  });

  it('should non-empty strings for all English translation values', () => {
    const enDeepKeys = getDeepKeys(en);
    enDeepKeys.forEach((keyPath) => {
      const parts = keyPath.split('.');
      let current: any = en;
      for (const part of parts) current = current[part];
      expect(typeof current).toBe('string');
      expect(current.length).toBeGreaterThan(0);
    });
  });

  it('should non-empty strings for all French translation values', () => {
    const frDeepKeys = getDeepKeys(fr);
    frDeepKeys.forEach((keyPath) => {
      const parts = keyPath.split('.');
      let current: any = fr;
      for (const part of parts) current = current[part];
      expect(typeof current).toBe('string');
      expect(current.length).toBeGreaterThan(0);
    });
  });
});
