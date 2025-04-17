import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, Key, Trash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { derivAPI } from '@/lib/websocketManager';

// Interface para token
interface Token {
  display_name: string;
  token: string;
  scopes: string[];
  last_used: string;
  valid_for_ip?: string;
}

// Componente para gerenciar tokens da API Deriv
export default function TokenManager() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [scopes, setScopes] = useState({
    read: true,
    trade: false,
    trading_information: false,
    payments: false,
    admin: false,
  });
  const [onlyCurrentIP, setOnlyCurrentIP] = useState(false);
  const { toast } = useToast();

  // Carregar tokens ao montar o componente
  useEffect(() => {
    fetchTokens();
  }, []);

  // Buscar tokens existentes
  const fetchTokens = async () => {
    try {
      setIsLoading(true);
      const response = await derivAPI.sendRequest({
        api_token: 1
      });

      if (response.api_token?.tokens) {
        setTokens(response.api_token.tokens);
      }
    } catch (error) {
      console.error("Erro ao carregar tokens:", error);
      toast({
        title: "Erro ao carregar tokens",
        description: "Não foi possível recuperar os tokens da API.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Criar novo token
  const createToken = async () => {
    if (!newTokenName.trim()) {
      toast({
        title: "Nome inválido",
        description: "Por favor, informe um nome para o token.",
        variant: "destructive",
      });
      return;
    }

    const selectedScopes = Object.entries(scopes)
      .filter(([_, isSelected]) => isSelected)
      .map(([scope]) => scope);

    if (selectedScopes.length === 0) {
      toast({
        title: "Permissões necessárias",
        description: "Selecione pelo menos uma permissão para o token.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await derivAPI.sendRequest({
        api_token: 1,
        new_token: newTokenName,
        new_token_scopes: selectedScopes,
        valid_for_current_ip_only: onlyCurrentIP ? 1 : 0
      });

      if (response.api_token?.new_token === 1) {
        toast({
          title: "Token criado com sucesso",
          description: "O novo token foi criado e está pronto para uso.",
        });
        
        // Limpar formulário
        setNewTokenName("");
        setScopes({
          read: true,
          trade: false,
          trading_information: false,
          payments: false,
          admin: false,
        });
        setOnlyCurrentIP(false);
        
        // Recarregar lista de tokens
        fetchTokens();
      }
    } catch (error) {
      console.error("Erro ao criar token:", error);
      toast({
        title: "Erro ao criar token",
        description: "Não foi possível criar o token de API.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Excluir token
  const deleteToken = async (tokenName: string) => {
    try {
      setIsLoading(true);
      const response = await derivAPI.sendRequest({
        api_token: 1,
        delete_token: tokenName
      });

      if (response.api_token?.delete_token === 1) {
        toast({
          title: "Token excluído",
          description: "O token foi excluído com sucesso.",
        });
        
        // Atualizar lista de tokens
        setTokens(tokens.filter(t => t.display_name !== tokenName));
      }
    } catch (error) {
      console.error("Erro ao excluir token:", error);
      toast({
        title: "Erro ao excluir token",
        description: "Não foi possível excluir o token.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizar uma cor baseada no escopo
  const getScopeColor = (scope: string) => {
    switch (scope) {
      case "read":
        return "bg-blue-500";
      case "trade":
        return "bg-green-500";
      case "trading_information":
        return "bg-yellow-500";
      case "payments":
        return "bg-red-500";
      case "admin":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gerenciador de Tokens API</h2>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Key className="mr-2 h-4 w-4" />
              Novo Token
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Token API</DialogTitle>
              <DialogDescription>
                Os tokens permitem acesso programático à sua conta Deriv. Nunca compartilhe seus tokens.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Token</Label>
                <Input
                  id="name"
                  placeholder="Meu Bot de Trading"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Permissões</Label>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="read" 
                      checked={scopes.read}
                      onCheckedChange={(checked) => setScopes({...scopes, read: !!checked})}
                    />
                    <label htmlFor="read" className="text-sm font-medium">
                      Leitura (Dados da conta, histórico)
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="trade" 
                      checked={scopes.trade}
                      onCheckedChange={(checked) => setScopes({...scopes, trade: !!checked})}
                    />
                    <label htmlFor="trade" className="text-sm font-medium">
                      Trading (Compra e venda de contratos)
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="trading_information" 
                      checked={scopes.trading_information}
                      onCheckedChange={(checked) => setScopes({...scopes, trading_information: !!checked})}
                    />
                    <label htmlFor="trading_information" className="text-sm font-medium">
                      Informações de Trading (Preços, contratos abertos)
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="payments" 
                      checked={scopes.payments}
                      onCheckedChange={(checked) => setScopes({...scopes, payments: !!checked})}
                    />
                    <label htmlFor="payments" className="text-sm font-medium">
                      Pagamentos (Depósitos e saques)
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="admin" 
                      checked={scopes.admin}
                      onCheckedChange={(checked) => setScopes({...scopes, admin: !!checked})}
                    />
                    <label htmlFor="admin" className="text-sm font-medium">
                      Administração (Gerenciar configurações e tokens)
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="ip_restriction" 
                  checked={onlyCurrentIP}
                  onCheckedChange={(checked) => setOnlyCurrentIP(!!checked)}
                />
                <label htmlFor="ip_restriction" className="text-sm font-medium">
                  Limitar token ao IP atual (mais seguro)
                </label>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="submit" onClick={createToken} disabled={isLoading}>
                {isLoading ? "Criando..." : "Criar Token"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {tokens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhum token encontrado</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Crie um novo token para integrar aplicações ou robôs de trading.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Token</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead>Último Uso</TableHead>
              <TableHead>Restrição de IP</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.token}>
                <TableCell className="font-medium">{token.display_name}</TableCell>
                <TableCell>
                  <div className="flex items-center">
                    <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-1 rounded">
                      {token.token.substring(0, 8)}...
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(token.token);
                        toast({
                          title: "Token copiado",
                          description: "O token foi copiado para a área de transferência.",
                        });
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {token.scopes.map((scope) => (
                      <Badge key={scope} className={getScopeColor(scope)}>
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{token.last_used}</TableCell>
                <TableCell>
                  {token.valid_for_ip ? (
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                      {token.valid_for_ip}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Sem restrição</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteToken(token.display_name)}
                    disabled={isLoading}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}