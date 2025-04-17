import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CheckIcon, EditIcon, ExternalLinkIcon, Loader2, TrashIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import derivAPI from "@/lib/derivApi";

type OAuthApp = {
  app_id: number;
  name: string;
  app_markup_percentage: number;
  redirect_uri: string;
  scopes: string[];
  active: number;
  homepage?: string;
  github?: string;
  appstore?: string;
  googleplay?: string;
  verification_uri?: string;
};

const OAuthScopeDescription: Record<string, string> = {
  "read": "Ler informações da conta",
  "trade": "Criar e gerenciar operações",
  "trading_information": "Ler informações de operações",
  "payments": "Gerenciar pagamentos",
  "admin": "Funções administrativas"
};

export default function OAuthAppsManager() {
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Partial<OAuthApp>>({});
  const { toast } = useToast();

  // Consulta para listar as aplicações
  const { 
    data: appListResponse, 
    isLoading: isLoadingApps,
    refetch: refetchApps 
  } = useQuery({
    queryKey: ['oauth-apps-list'],
    queryFn: async () => {
      try {
        const response = await derivAPI.listApplications();
        return response;
      } catch (error) {
        console.error("Erro ao listar aplicações OAuth:", error);
        throw error;
      }
    },
    enabled: derivAPI.getConnectionStatus(), // Só executar se estiver conectado
  });

  // Mutação para atualizar uma aplicação
  const updateAppMutation = useMutation({
    mutationFn: async ({ appId, data }: { appId: number, data: any }) => {
      return await derivAPI.updateApplication(appId, data);
    },
    onSuccess: () => {
      toast({
        title: "Aplicação atualizada",
        description: "As alterações foram salvas com sucesso.",
        variant: "default",
      });
      setEditMode(false);
      refetchApps();
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar",
        description: `Ocorreu um erro: ${error}`,
        variant: "destructive",
      });
    }
  });

  // Lista de aplicações
  const appList = appListResponse?.app_list || [];

  // Selecionar uma aplicação para visualizar/editar
  const handleSelectApp = (appId: number) => {
    const app = appList.find((app: OAuthApp) => app.app_id === appId);
    if (app) {
      setSelectedAppId(appId);
      setFormData(app);
      setEditMode(false);
    }
  };

  // Iniciar modo de edição
  const handleEdit = () => {
    setEditMode(true);
  };

  // Cancelar edição
  const handleCancelEdit = () => {
    // Restaurar dados originais
    if (selectedAppId) {
      const app = appList.find((app: OAuthApp) => app.app_id === selectedAppId);
      setFormData(app || {});
    }
    setEditMode(false);
  };

  // Salvar alterações
  const handleSave = () => {
    if (!selectedAppId || !formData.name || !formData.scopes) {
      toast({
        title: "Dados incompletos",
        description: "Nome e escopos são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    updateAppMutation.mutate({
      appId: selectedAppId,
      data: {
        name: formData.name,
        scopes: formData.scopes as Array<"read" | "trade" | "trading_information" | "payments" | "admin">,
        redirect_uri: formData.redirect_uri,
        app_markup_percentage: formData.app_markup_percentage,
        homepage: formData.homepage,
        github: formData.github,
        appstore: formData.appstore,
        googleplay: formData.googleplay,
        verification_uri: formData.verification_uri
      }
    });
  };

  // Manipular alterações no formulário
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Manipular alterações nos escopos (checkboxes)
  const handleScopeChange = (scope: string, checked: boolean) => {
    const currentScopes = formData.scopes || [];
    let newScopes;
    
    if (checked) {
      newScopes = [...currentScopes, scope];
    } else {
      newScopes = currentScopes.filter(s => s !== scope);
    }
    
    setFormData(prev => ({ ...prev, scopes: newScopes }));
  };

  // Efeito para limpar a seleção quando a lista de apps mudar
  useEffect(() => {
    if (appList.length > 0 && !selectedAppId) {
      handleSelectApp(appList[0].app_id);
    }
  }, [appList]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Gerenciamento de Aplicações OAuth</CardTitle>
        <CardDescription>
          Configure suas aplicações OAuth para integração com a API da Deriv
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingApps ? (
          <div className="flex justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-[#00e5b3]" />
          </div>
        ) : appList.length === 0 ? (
          <div className="text-center p-6">
            <p>Nenhuma aplicação OAuth encontrada.</p>
            <Button className="mt-4 bg-[#00e5b3] hover:bg-[#00c29e]">
              Criar Nova Aplicação
            </Button>
          </div>
        ) : (
          <Tabs defaultValue={selectedAppId?.toString()} className="w-full">
            <TabsList className="mb-4">
              {appList.map((app: OAuthApp) => (
                <TabsTrigger 
                  key={app.app_id}
                  value={app.app_id.toString()}
                  onClick={() => handleSelectApp(app.app_id)}
                >
                  {app.name}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {appList.map((app: OAuthApp) => (
              <TabsContent key={`app-tab-content-${app.app_id}-${Math.random().toString(36).substring(2)}`} value={app.app_id.toString()}>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome da Aplicação</Label>
                      <Input 
                        id="name" 
                        name="name"
                        value={formData.name || ''}
                        onChange={handleFormChange}
                        disabled={!editMode}
                      />
                    </div>
                    <div>
                      <Label htmlFor="redirect_uri">URL de Redirecionamento</Label>
                      <Input 
                        id="redirect_uri" 
                        name="redirect_uri"
                        value={formData.redirect_uri || ''}
                        onChange={handleFormChange}
                        disabled={!editMode}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="app_markup_percentage">Percentual de Markup (máx. 3%)</Label>
                    <Input 
                      id="app_markup_percentage" 
                      name="app_markup_percentage"
                      type="number"
                      min="0"
                      max="3"
                      step="0.01"
                      value={formData.app_markup_percentage || 0}
                      onChange={handleFormChange}
                      disabled={!editMode}
                    />
                  </div>
                  
                  <div>
                    <Label className="mb-2 block">Escopos Permitidos</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {["read", "trade", "trading_information", "payments", "admin"].map(scope => (
                        <div key={scope} className="flex items-center space-x-2">
                          <input 
                            type="checkbox" 
                            id={`scope-${scope}`}
                            checked={formData.scopes?.includes(scope) || false}
                            onChange={(e) => handleScopeChange(scope, e.target.checked)}
                            disabled={!editMode}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <label htmlFor={`scope-${scope}`} className="text-sm">
                            {OAuthScopeDescription[scope]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-3">
                    <Label className="mb-2 block">URLs Opcionais</Label>
                    
                    <div>
                      <Label htmlFor="homepage">Site da Aplicação</Label>
                      <Input 
                        id="homepage" 
                        name="homepage"
                        value={formData.homepage || ''}
                        onChange={handleFormChange}
                        disabled={!editMode}
                        placeholder="https://sua-aplicacao.com"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="github">GitHub</Label>
                      <Input 
                        id="github" 
                        name="github"
                        value={formData.github || ''}
                        onChange={handleFormChange}
                        disabled={!editMode}
                        placeholder="https://github.com/usuario/projeto"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="appstore">App Store</Label>
                        <Input 
                          id="appstore" 
                          name="appstore"
                          value={formData.appstore || ''}
                          onChange={handleFormChange}
                          disabled={!editMode}
                          placeholder="https://itunes.apple.com/..."
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="googleplay">Google Play</Label>
                        <Input 
                          id="googleplay" 
                          name="googleplay"
                          value={formData.googleplay || ''}
                          onChange={handleFormChange}
                          disabled={!editMode}
                          placeholder="https://play.google.com/store/apps/..."
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="verification_uri">URL de Verificação</Label>
                      <Input 
                        id="verification_uri" 
                        name="verification_uri"
                        value={formData.verification_uri || ''}
                        onChange={handleFormChange}
                        disabled={!editMode}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        {selectedAppId && (
          editMode ? (
            <>
              <Button 
                variant="outline" 
                onClick={handleCancelEdit}
              >
                Cancelar
              </Button>
              <Button
                className="bg-[#00e5b3] hover:bg-[#00c29e]"
                onClick={handleSave}
                disabled={updateAppMutation.isPending}
              >
                {updateAppMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
                ) : (
                  <><CheckIcon className="mr-2 h-4 w-4" /> Salvar Alterações</>
                )}
              </Button>
            </>
          ) : (
            <>
              <div>
                <Button variant="outline" className="mr-2">
                  <TrashIcon className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
                <Button variant="outline">
                  <ExternalLinkIcon className="mr-2 h-4 w-4" />
                  Abrir
                </Button>
              </div>
              <Button
                className="bg-[#00e5b3] hover:bg-[#00c29e]"
                onClick={handleEdit}
              >
                <EditIcon className="mr-2 h-4 w-4" />
                Editar
              </Button>
            </>
          )
        )}
      </CardFooter>
    </Card>
  );
}