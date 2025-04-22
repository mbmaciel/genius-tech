import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Globe } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const { toast } = useToast();
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'pt');

  // Debug - mostrar o idioma atual no console quando o componente montar
  useEffect(() => {
    console.log(`[LanguageSwitcher] Componente montado. Idioma atual: ${i18n.language}`);
    console.log(`[LanguageSwitcher] Idiomas disponíveis:`, i18n.options.resources);
    // Atualizar o estado quando o idioma mudar externamente
    setCurrentLanguage(i18n.language || 'pt');
  }, [i18n.language]);

  const toggleLanguage = () => {
    try {
      // Alterna entre pt e en
      const newLanguage = currentLanguage === 'pt' ? 'en' : 'pt';
      console.log(`[LanguageSwitcher] Alterando idioma de ${currentLanguage} para ${newLanguage}`);
      
      // Forçar a mudança de idioma
      i18n.changeLanguage(newLanguage)
        .then(() => {
          console.log(`[LanguageSwitcher] Idioma alterado com sucesso para: ${newLanguage}`);
          console.log(`[LanguageSwitcher] i18n.language agora é: ${i18n.language}`);

          // Atualizar estado local após confirmação da mudança
          setCurrentLanguage(newLanguage);
          
          // Mostrar toast de confirmação
          toast({
            title: newLanguage === 'pt' ? 'Idioma alterado' : 'Language changed',
            description: newLanguage === 'pt' ? 'Português selecionado' : 'English selected',
          });
          
          // Salvar a preferência de idioma do usuário
          localStorage.setItem('i18nextLng', newLanguage);
          
          // Atualizar a página para garantir que todos os componentes sejam atualizados
          // window.location.reload();
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
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Button 
        variant="outline" 
        size="sm" 
        className="h-8 px-2 min-w-[110px]"
        onClick={toggleLanguage}
      >
        {currentLanguage === 'pt' ? t('language.pt') : t('language.en')}
      </Button>
    </div>
  );
}