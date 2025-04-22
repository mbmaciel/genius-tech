import React, { useState, useEffect } from 'react';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Globe } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

// Componente que força a atualização quando o idioma muda
function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [, forceUpdate] = useState({});
  
  useEffect(() => {
    const handleLanguageChange = () => {
      forceUpdate({});
    };
    
    i18n.on('languageChanged', handleLanguageChange);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);
  
  return <>{children}</>;
}

// Componente de botão de idioma
function LanguageButton() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const currentLanguage = i18n.language?.substring(0, 2) || 'pt';
  
  const toggleLanguage = () => {
    try {
      // Alterna entre pt e en
      const newLanguage = currentLanguage === 'pt' ? 'en' : 'pt';
      console.log(`[LanguageSwitcher] Alterando idioma de ${currentLanguage} para ${newLanguage}`);
      
      // Salvar a preferência de idioma do usuário antes de mudar o idioma
      localStorage.setItem('i18nextLng', newLanguage);
      
      // Forçar a mudança de idioma
      i18n.changeLanguage(newLanguage)
        .then(() => {
          console.log(`[LanguageSwitcher] Idioma alterado com sucesso para: ${newLanguage}`);
          console.log(`[LanguageSwitcher] i18n.language agora é: ${i18n.language}`);
          
          // Mostrar toast de confirmação
          toast({
            title: newLanguage === 'pt' ? 'Idioma alterado' : 'Language changed',
            description: newLanguage === 'pt' ? 'Português selecionado' : 'English selected',
          });
        })
        .catch(error => {
          console.error(`[LanguageSwitcher] Erro ao alterar idioma:`, error);
          toast({
            title: 'Erro',
            description: 'Não foi possível alterar o idioma',
            variant: 'destructive',
          });
        });
    } catch (error) {
      console.error(`[LanguageSwitcher] Erro ao tentar alterar idioma:`, error);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="h-8 px-2 min-w-[110px]"
      onClick={toggleLanguage}
    >
      {currentLanguage === 'pt' ? 'Português' : 'English'}
    </Button>
  );
}

// Componente principal que combina tudo
export function LanguageSwitcher() {
  return (
    <LanguageProvider>
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <LanguageButton />
      </div>
    </LanguageProvider>
  );
}