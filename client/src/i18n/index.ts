import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Importar arquivos de tradução
import translationPT from './locales/pt.json';
import translationEN from './locales/en.json';

// Recursos de traduções
const resources = {
  pt: {
    translation: translationPT
  },
  en: {
    translation: translationEN
  }
};

i18n
  // Detectar idioma do navegador
  .use(LanguageDetector)
  // Passar instância do i18n para o react-i18next
  .use(initReactI18next)
  // Inicializar i18next
  .init({
    resources,
    fallbackLng: 'pt', // Idioma padrão (português)
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false // React já escapa valores
    }
  });

export default i18n;