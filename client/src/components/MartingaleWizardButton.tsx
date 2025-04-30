import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Settings2Icon } from 'lucide-react';
import { MartingaleConfigWizard } from './MartingaleConfigWizard';

interface MartingaleWizardButtonProps {
  strategyId: string;
  disabled?: boolean;
  onConfigSaved?: (config: any) => void;
  initialValues?: {
    valorInicial?: number;
    martingale?: number;
    lossVirtual?: number;
    metaGanho?: number;
    limitePerda?: number;
    parcelasMartingale?: number;
    resetAposVitoria?: boolean;
  };
}

export function MartingaleWizardButton({
  strategyId,
  disabled = false,
  onConfigSaved,
  initialValues = {}
}: MartingaleWizardButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSave = (config: any) => {
    // Fechar diálogo
    setIsDialogOpen(false);
    
    // Notificar o componente pai, se houver callback
    if (onConfigSaved) {
      onConfigSaved(config);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 font-medium"
          disabled={disabled}
        >
          <Settings2Icon className="h-4 w-4" />
          <span>Configurar Martingale</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-3xl">
        <MartingaleConfigWizard
          strategyId={strategyId}
          onSave={handleSave}
          onCancel={() => setIsDialogOpen(false)}
          initialValues={initialValues}
        />
      </DialogContent>
    </Dialog>
  );
}