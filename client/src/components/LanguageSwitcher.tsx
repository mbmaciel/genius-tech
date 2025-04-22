import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'pt');

  useEffect(() => {
    // Atualizar o estado quando o idioma mudar externamente
    setCurrentLanguage(i18n.language || 'pt');
  }, [i18n.language]);

  const changeLanguage = (language: string) => {
    // Só muda se for diferente do atual
    if (language !== currentLanguage) {
      i18n.changeLanguage(language);
      setCurrentLanguage(language);
      // Salvar a preferência de idioma do usuário
      localStorage.setItem('i18nextLng', language);
      
      // Log de confirmação
      console.log(`[LanguageSwitcher] Idioma alterado para: ${language}`);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 px-2 gap-1">
            {currentLanguage === 'pt' ? t('language.pt') : t('language.en')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => changeLanguage('pt')}>
            {t('language.pt')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => changeLanguage('en')}>
            {t('language.en')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}