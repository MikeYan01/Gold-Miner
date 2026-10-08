import { createContext, useContext } from 'react';
import { getTranslator } from '../game/i18n';
import type { Language } from '../game/i18n';

export const LanguageContext = createContext<{
  language: Language;
  onChange: (language: Language) => void;
} | null>(null);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('Language controls require a LanguageContext provider.');
  return { ...context, t: getTranslator(context.language) };
}

export function LanguageSwitch() {
  const { language, onChange } = useLanguage();
  const next = language === 'zh-CN' ? 'en' : 'zh-CN';
  return (
    <button
      type="button"
      className="game-button small-button language-switch"
      lang={next}
      aria-label={next === 'en' ? 'Switch to English' : '切换到中文'}
      onClick={() => onChange(next)}
    >{next === 'en' ? 'EN' : '中文'}</button>
  );
}
