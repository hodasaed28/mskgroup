import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { languages, LanguageCode } from '@/i18n';

export function useLanguage() {
  const { i18n } = useTranslation();

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const changeLanguage = (code: LanguageCode) => {
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
  };

  useEffect(() => {
    const lang = languages.find(l => l.code === i18n.language);
    if (lang) {
      document.documentElement.dir = lang.dir;
      document.documentElement.lang = lang.code;
    }
  }, [i18n.language]);

  return {
    currentLanguage,
    languages,
    changeLanguage,
    isRTL: currentLanguage.dir === 'rtl',
  };
}
