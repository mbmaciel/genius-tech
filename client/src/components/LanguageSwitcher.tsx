import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const changeLanguage = (language: string) => {
    i18n.changeLanguage(language);
    // Salvar a preferência de idioma do usuário
    localStorage.setItem('i18nextLng', language);
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Select
        value={i18n.language || 'pt'}
        onValueChange={changeLanguage}
      >
        <SelectTrigger className="w-[110px] h-8">
          <SelectValue placeholder={t('settings.language')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pt">{t('language.pt')}</SelectItem>
          <SelectItem value="en">{t('language.en')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}