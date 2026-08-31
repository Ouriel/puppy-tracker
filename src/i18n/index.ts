import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { en } from './en';
import { fr } from './fr';

export type Language = 'en' | 'fr';
type TranslationDictionary = typeof en;

const STORAGE_KEY = 'puppace_lang_v1';

function getStoredLanguage(): Language {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'fr' || stored === 'en') return stored;
    }
  } catch {
    // Ignore localStorage access errors in private/iframe modes
  }
  return 'en'; // default English
}

function setStoredLanguage(lang: Language) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  } catch {
    // Ignore localStorage access errors
  }
}

interface I18nContextType {
  lang: Language;
  changeLanguage: (newLang: Language) => void;
  t: TranslationDictionary;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(getStoredLanguage);

  const changeLanguage = useCallback((newLang: Language) => {
    setLangState(newLang);
    setStoredLanguage(newLang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLang;
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const value = useMemo(() => {
    const t = lang === 'fr' ? fr : en;
    return { lang, changeLanguage, t };
  }, [lang, changeLanguage]);

  return React.createElement(I18nContext.Provider, { value }, children);
};

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    // Graceful fallback when rendered outside provider (e.g. isolated unit tests)
    const stored = getStoredLanguage();
    return {
      lang: stored,
      changeLanguage: setStoredLanguage,
      t: stored === 'fr' ? fr : en,
    };
  }
  return context;
}

