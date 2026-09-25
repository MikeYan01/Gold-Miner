export type Language = 'zh-CN' | 'en';
export const DEFAULT_LANGUAGE: Language = 'zh-CN';
export type LocalizedText = Readonly<Record<Language, string>>;
export type DisplayText = string | LocalizedText;

export function bilingual(chinese: string, english: string): LocalizedText {
  return { 'zh-CN': chinese, en: english };
}

export function localize(text: DisplayText, language: Language): string {
  return typeof text === 'string' ? text : text[language];
}

export function getTranslator(language: Language) {
  return (chinese: string, english: string): string => language === 'en' ? english : chinese;
}
