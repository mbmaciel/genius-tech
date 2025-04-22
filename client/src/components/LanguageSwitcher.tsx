import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'pt');

  useEffect(() => {
    // Atualizar o estado quando o idioma mudar externamente
    setCurrentLanguage(i18n.language || 'pt');
  }, [i18n.language]);

  const toggleLanguage = () => {
    // Alterna entre pt e en
    const newLanguage = currentLanguage === 'pt' ? 'en' : 'pt';
    i18n.changeLanguage(newLanguage);
    setCurrentLanguage(newLanguage);
    // Salvar a preferência de idioma do usuário
    localStorage.setItem('i18nextLng', newLanguage);
    
    // Log de confirmação
    console.log(`[LanguageSwitcher] Idioma alterado para: ${newLanguage}`);
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Button 
        variant="outline" 
        size="sm" 
        className="h-8 px-2"
        onClick={toggleLanguage}
      >
        {currentLanguage === 'pt' ? t('language.pt') : t('language.en')}
      </Button>
    </div>
  );
}