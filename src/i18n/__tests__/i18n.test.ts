import { describe, it, expect } from 'vitest';
import { en } from '../en';
import { fr } from '../fr';

describe('i18n Translation Dictionary Parity', () => {
  it('should have matching top-level keys between English and French', () => {
    const enKeys = Object.keys(en).sort();
    const frKeys = Object.keys(fr).sort();
    expect(enKeys).toEqual(frKeys);
  });

  it('should have matching navigation keys between English and French', () => {
    const enNav = Object.keys(en.nav).sort();
    const frNav = Object.keys(fr.nav).sort();
    expect(enNav).toEqual(frNav);
  });

  it('should have matching potty activity keys between English and French', () => {
    const enPotty = Object.keys(en.potty).sort();
    const frPotty = Object.keys(fr.potty).sort();
    expect(enPotty).toEqual(frPotty);
  });

  it('should have matching Carnet de Santé keys between English and French', () => {
    const enHealth = Object.keys(en.health).sort();
    const frHealth = Object.keys(fr.health).sort();
    expect(enHealth).toEqual(frHealth);
  });

  it('should have matching Admin keys between English and French', () => {
    const enAdmin = Object.keys(en.admin).sort();
    const frAdmin = Object.keys(fr.admin).sort();
    expect(enAdmin).toEqual(frAdmin);
  });
});
