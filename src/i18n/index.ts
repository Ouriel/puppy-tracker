import { useState } from 'react';
import { en } from './en';
import { fr } from './fr';

export type Language = 'en' | 'fr';

const STORAGE_KEY = 'puppace_lang_v1';

export function getStoredLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'fr' || stored === 'en') return stored;
  return 'en'; // default English
}

export function setStoredLanguage(lang: Language) {
  localStorage.setItem(STORAGE_KEY, lang);
}

export function useI18n() {
  const [lang, setLangState] = useState<Language>(getStoredLanguage);

  const changeLanguage = (newLang: Language) => {
    setLangState(newLang);
    setStoredLanguage(newLang);
  };

  const t = lang === 'fr' ? fr : en;

  return { lang, changeLanguage, t };
}
