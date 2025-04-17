import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertCircle, Key, Plus, Clock, Trash2 } from "lucide-react";
import derivAPI from '@/lib/derivApi';

interface TokenData {
  display_name: string;
  token: string;
  scopes: string[];
  last_used: string;
  valid_for_ip?: string;
}

export function ApiTokensManager() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estados para criação de token
  const [newTokenDialog, setNewTokenDialog] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [tokenScopes, setTokenScopes] = useState<string[]>(['read', 'trade']);
  const [ipRestriction, setIpRestriction] = useState(false);
  const [creatingToken, setCreatingToken] = useState(false);
  const [showNewToken, setShowNewToken] = useState<{token: string, name: string} | null>(null);
  
  // Estados para exclusão de token
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState<{token: string, name: string} | null>(null);
  const [deletingToken, setDeletingToken] = useState(false);
  
  // Carregar tokens
  const loadTokens = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await derivAPI.listApiTokens();
      
      if (response.error) {
        throw new Error(response.error.message || "Erro ao carregar tokens");
      }
      
      if (response.api_token && response.api_token.tokens) {
        setTokens(response.api_token.tokens);
        console.log("Tokens carregados:", response.api_token.tokens.length);
      } else {
        console.warn("Resposta válida, mas sem tokens:", response);
        setTokens([]);
      }
    } catch (err: any) {
      console.error("Erro ao carregar tokens:", err);
      setError(err.message || "Falha ao carregar tokens da API");
    } finally {
      setLoading(false);
    }
  };
  
  // Carregar tokens ao montar o componente
  useEffect(() => {
    if (derivAPI.isAuthorized()) {
      loadTokens();
    } else {
      setLoading(false);
      setError("Autenticação necessária para gerenciar tokens");
    }
  }, []);
  
  // Criar novo token
  const createToken = async () => {
    if (!tokenName.trim()) {
      setError("Nome do token é obrigatório");
      return;
    }
    
    if (!tokenScopes.length) {
      setError("Selecione pelo menos um escopo de permissão");
      return;
    }
    
    setError(null);
    setCreatingToken(true);
    
    try {
      const response = await derivAPI.createApiToken(
        tokenName,
        tokenScopes as any,
        ipRestriction
      );
      
      if (response.error) {
        throw new Error(response.error.message || "Erro ao criar token");
      }
      
      // Encontrar o token criado na resposta
      if (response.api_token && response.api_token.tokens) {
        // Encontrar o token recém-criado que corresponde ao nome que especificamos
        const newToken = response.api_token.tokens.find(
          (t: TokenData) => t.display_name === tokenName
        );
        
        if (newToken && newToken.token) {
          setShowNewToken({
            name: newToken.display_name,
            token: newToken.token
          });
          
          // Atualizar a lista de tokens
          setTokens(response.api_token.tokens);
          
          // Limpar o formulário
          setTokenName('');
          setTokenScopes(['read', 'trade']);
          setIpRestriction(false);
          
          setSuccess("Token criado com sucesso!");
        } else {
          throw new Error("Token criado, mas não encontrado na resposta");
        }
      }
    } catch (err: any) {
      console.error("Erro ao criar token:", err);
      setError(err.message || "Falha ao criar token");
    } finally {
      setCreatingToken(false);
    }
  };
  
  // Excluir token
  const deleteToken = async () => {
    if (!tokenToDelete) {
      return;
    }
    
    setDeletingToken(true);
    setError(null);
    
    try {
      const response = await derivAPI.deleteApiToken(tokenToDelete.token);
      
      if (response.error) {
        throw new Error(response.error.message || "Erro ao excluir token");
      }
      
      // Atualizar a lista de tokens
      await loadTokens();
      
      setSuccess(`Token "${tokenToDelete.name}" excluído com sucesso`);
      setDeleteConfirmDialog(false);
      setTokenToDelete(null);
    } catch (err: any) {
      console.error("Erro ao excluir token:", err);
      setError(err.message || "Falha ao excluir token");
    } finally {
      setDeletingToken(false);
    }
  };
  
  // Formatar data da última utilização
  const formatLastUsed = (dateStr: string): string => {
    if (!dateStr) return "Nunca utilizado";
    
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return "Hoje";
      } else if (diffDays === 1) {
        return "Ontem";
      } else if (diffDays < 7) {
        return `${diffDays} dias atrás`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} atrás`;
      } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} ${months === 1 ? 'mês' : 'meses'} atrás`;
      } else {
        const years = Math.floor(diffDays / 365);
        return `${years} ${years === 1 ? 'ano' : 'anos'} atrás`;
      }
    } catch (e) {
      return dateStr;
    }
  };
  
  // Mapear escopos para ícones e descrições
  const getScopeInfo = (scope: string) => {
    const scopeMap: Record<string, { color: string; description: string }> = {
      read: { color: "bg-blue-100 text-blue-800", description: "Leitura de dados da conta" },
      trade: { color: "bg-green-100 text-green-800", description: "Realizar operações" },
      trading_information: { color: "bg-purple-100 text-purple-800", description: "Informações de negociação" },
      payments: { color: "bg-orange-100 text-orange-800", description: "Pagamentos e saques" },
      admin: { color: "bg-red-100 text-red-800", description: "Acesso administrativo" }
    };
    
    return scopeMap[scope] || { color: "bg-gray-100 text-gray-800", description: scope };
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Gerenciador de Tokens da API</span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setNewTokenDialog(true)}
          >
            <Plus className="mr-2 h-4 w-4" /> Novo Token
          </Button>
        </CardTitle>
        <CardDescription>
          Crie e gerencie tokens de API para conectar aplicações de terceiros à sua conta Deriv.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3">Carregando tokens...</span>
          </div>
        ) : error && !tokens.length ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : tokens.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>Você não tem tokens API. Crie um token para integrar aplicações de terceiros com sua conta Deriv.</p>
          </div>
        ) : (
          <Table>
            <TableCaption>Lista de tokens API disponíveis para sua conta Deriv.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Permissões</TableHead>
                <TableHead>Restrição IP</TableHead>
                <TableHead>Último uso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{token.display_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {token.scopes.map((scope) => {
                        const { color } = getScopeInfo(scope);
                        return (
                          <Badge 
                            key={scope} 
                            variant="outline" 
                            className={`${color} capitalize`}
                          >
                            {scope.replace('_', ' ')}
                          </Badge>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {token.valid_for_ip ? (
                      <Badge variant="secondary" className="capitalize">
                        {token.valid_for_ip}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Sem restrição</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{formatLastUsed(token.last_used)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setTokenToDelete({
                          token: token.token,
                          name: token.display_name
                        });
                        setDeleteConfirmDialog(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        
        {success && (
          <Alert className="mt-4 bg-green-500/10 text-green-500 border-green-500/20">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Sucesso</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-col items-start">
        <p className="text-sm text-muted-foreground">
          Os tokens API são equivalentes a senhas. Nunca compartilhe seus tokens API com ninguém.
          <br />Cada token deve ter apenas as permissões necessárias para a aplicação específica.
        </p>
      </CardFooter>
      
      {/* Diálogo para criar novo token */}
      <Dialog open={newTokenDialog} onOpenChange={setNewTokenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Token API</DialogTitle>
            <DialogDescription>
              Crie um token API para integrar aplicações externas à sua conta Deriv.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="token-name">Nome do Token</Label>
              <Input
                id="token-name"
                placeholder="Nome descritivo para o token"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use um nome que ajude a identificar onde o token será utilizado.
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label>Permissões</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {['read', 'trade', 'trading_information', 'payments', 'admin'].map((scope) => {
                  const { color, description } = getScopeInfo(scope);
                  const isSelected = tokenScopes.includes(scope);
                  
                  return (
                    <div 
                      key={scope} 
                      className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer
                        border transition-colors
                        ${isSelected 
                          ? `${color} border-current` 
                          : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
                        }
                      `}
                      onClick={() => {
                        if (isSelected) {
                          // Não permitir desselecionar tudo
                          if (tokenScopes.length > 1) {
                            setTokenScopes(tokenScopes.filter(s => s !== scope));
                          }
                        } else {
                          setTokenScopes([...tokenScopes, scope]);
                        }
                      }}
                    >
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => {}}
                        className="pointer-events-none"
                      />
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {scope.replace('_', ' ')}
                        </p>
                        <p className="text-xs opacity-70">{description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="ip-restriction" 
                checked={ipRestriction}
                onCheckedChange={(checked) => setIpRestriction(!!checked)}
              />
              <Label htmlFor="ip-restriction" className="cursor-pointer">
                Restringir uso ao IP atual
              </Label>
            </div>
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTokenDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={createToken} disabled={creatingToken}>
              {creatingToken ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo para mostrar o novo token criado */}
      <Dialog open={!!showNewToken} onOpenChange={(open) => !open && setShowNewToken(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Token Criado com Sucesso</DialogTitle>
            <DialogDescription>
              Copie o token abaixo. Por segurança, ele não será mostrado novamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Token "{showNewToken?.name}"</Label>
              <div className="relative">
                <Input
                  readOnly
                  value={showNewToken?.token || ''}
                  className="pr-20 font-mono"
                />
                <Button 
                  className="absolute right-1 top-1 h-7"
                  size="sm"
                  onClick={() => {
                    if (showNewToken?.token) {
                      navigator.clipboard.writeText(showNewToken.token);
                      setSuccess("Token copiado para a área de transferência!");
                      setTimeout(() => setSuccess(null), 3000);
                    }
                  }}
                >
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Este token não será mostrado novamente. Guarde-o em um local seguro.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowNewToken(null)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de confirmação para excluir token */}
      <Dialog open={deleteConfirmDialog} onOpenChange={setDeleteConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o token "{tokenToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmDialog(false)}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={deleteToken}
              disabled={deletingToken}
            >
              {deletingToken ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}