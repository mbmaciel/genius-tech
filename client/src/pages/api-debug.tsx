import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, ArrowUp, CheckCircle, Copy, RefreshCw, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { useLocation } from 'wouter';

interface TokenDebugInfo {
  key: string;
  value: string;
  type: 'main' | 'verified' | 'simple' | 'map' | 'oauth';
  account?: string;
}

export default function ApiDebugPage() {
  const [tokens, setTokens] = React.useState<TokenDebugInfo[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = React.useState<boolean>(false);
  const [activeAccount, setActiveAccount] = React.useState<string | null>(null);
  const [, navigate] = useLocation();

  // Carregar status de conexão
  React.useEffect(() => {
    const checkConnection = () => {
      // Simplified check for connection status as we don't have the actual derivAPI import here
      const isConnected = localStorage.getItem('deriv_api_token') ? true : false;
      setConnectionStatus(isConnected);

      // Try to get active account info
      try {
        const accountInfoStr = localStorage.getItem('deriv_account_info');
        if (accountInfoStr) {
          const accountInfo = JSON.parse(accountInfoStr);
          if (accountInfo && accountInfo.loginId) {
            setActiveAccount(accountInfo.loginId);
          } else {
            setActiveAccount(null);
          }
        } else {
          setActiveAccount(null);
        }
      } catch (e) {
        setActiveAccount(null);
      }
    };

    checkConnection();
    
    // Check every 5 seconds
    const interval = setInterval(checkConnection, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Load stored tokens
  const loadAllTokens = () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const tokenList: TokenDebugInfo[] = [];
      
      // 1. Main token
      const mainToken = localStorage.getItem('deriv_api_token');
      if (mainToken) {
        tokenList.push({
          key: 'deriv_api_token',
          value: mainToken,
          type: 'main'
        });
      }
      
      // 2. Check for verified token format
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        if (key.startsWith('deriv_verified_token_')) {
          const accountId = key.replace('deriv_verified_token_', '');
          const token = localStorage.getItem(key);
          if (token) {
            tokenList.push({
              key,
              value: token,
              type: 'verified',
              account: accountId
            });
          }
        } else if (key.startsWith('deriv_token_')) {
          const accountId = key.replace('deriv_token_', '');
          const token = localStorage.getItem(key);
          if (token) {
            tokenList.push({
              key,
              value: token,
              type: 'simple',
              account: accountId
            });
          }
        }
      }
      
      // 3. Check token map format
      try {
        const tokenMapStr = localStorage.getItem('deriv_account_token_map');
        if (tokenMapStr) {
          const tokenMap = JSON.parse(tokenMapStr);
          if (tokenMap && typeof tokenMap === 'object') {
            for (const [account, token] of Object.entries(tokenMap)) {
              if (typeof token === 'string') {
                tokenList.push({
                  key: `deriv_account_token_map[${account}]`,
                  value: token,
                  type: 'map',
                  account
                });
              }
            }
          }
        }
      } catch (e) {
        console.error('Error processing token map:', e);
      }
      
      // 4. Check OAuth accounts list
      try {
        const userAccountsStr = localStorage.getItem('deriv_user_accounts');
        if (userAccountsStr) {
          const accounts = JSON.parse(userAccountsStr);
          if (Array.isArray(accounts)) {
            accounts.forEach((acc: any, index: number) => {
              if (acc && acc.token && (acc.account || acc.accountName)) {
                const account = acc.account || acc.accountName;
                tokenList.push({
                  key: `deriv_user_accounts[${index}]`,
                  value: acc.token,
                  type: 'oauth',
                  account
                });
              }
            });
          }
        }
      } catch (e) {
        console.error('Error processing accounts list:', e);
      }
      
      setTokens(tokenList);
      
      // Also log to console for debugging
      console.error('================= TOKENS DEBUG =================');
      tokenList.forEach(token => {
        console.error(`[TOKEN] ${token.key} (${token.type}): ${token.value.substring(0, 10)}...`);
      });
      console.error('===============================================');
      
    } catch (err: any) {
      console.error('Error loading tokens:', err);
      setError(err.message || 'Error loading tokens');
    } finally {
      setIsLoading(false);
    }
  };

  // Load tokens on mount
  React.useEffect(() => {
    loadAllTokens();
  }, []);

  // Copy token to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('Token copied to clipboard!');
      })
      .catch(err => {
        console.error('Error copying:', err);
      });
  };

  // Clear all tokens
  const clearAllTokens = () => {
    if (window.confirm('Are you sure you want to remove ALL tokens?')) {
      try {
        // First, list all token-related keys
        const keysToRemove: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key === 'deriv_api_token' ||
            key === 'deriv_account_token_map' ||
            key === 'deriv_user_accounts' ||
            key === 'tokenList' ||
            key.startsWith('deriv_token_') ||
            key.startsWith('deriv_verified_token_')
          )) {
            keysToRemove.push(key);
          }
        }
        
        // Remove each key
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });
        
        // Reload list
        loadAllTokens();
        alert(`${keysToRemove.length} tokens removed successfully!`);
      } catch (err: any) {
        console.error('Error clearing tokens:', err);
        setError(err.message || 'Error clearing tokens');
      }
    }
  };

  // Show advanced connection debug
  const showConnectionDebug = () => {
    try {
      console.error('============= CONNECTION DEBUG =============');
      console.error(`WebSocket connection status: ${connectionStatus ? 'Connected' : 'Disconnected'}`);
      
      if (connectionStatus) {
        console.error(`Active account: ${activeAccount || 'None'}`);
        
        // Try to get account info
        const accountInfoStr = localStorage.getItem('deriv_account_info');
        if (accountInfoStr) {
          const accountInfo = JSON.parse(accountInfoStr);
          console.error('Account information:', accountInfo);
        }
      }
      
      console.error('===========================================');
    } catch (e) {
      console.error('Error showing connection debug:', e);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden md:flex" />
      
      {/* Mobile Sidebar */}
      <Sidebar className="" isMobile={true} />
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#0e1a33]">
        {/* Top Navigation */}
        <header className="bg-[#162746] border-b border-[#1c3654] sticky top-0 z-10">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/dashboard')}
                className="text-white border-[#1c3654] hover:bg-[#1c3654] mr-4"
              >
                Voltar ao Dashboard
              </Button>
            </div>
          </div>
        </header>
        
        {/* Content */}
        <div className="container mx-auto py-6 max-w-4xl px-4">
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-white">Deriv API Debugger</h1>
            <p className="text-[#8492b4]">Tool for viewing and managing API tokens</p>
          </div>
          
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 mb-6">
            <Card className="bg-[#162746] border-[#1c3654] text-white">
              <CardHeader>
                <CardTitle>Connection Status</CardTitle>
                <CardDescription>Current Deriv API connection status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2 mb-4">
                  <div className={`w-3 h-3 rounded-full ${connectionStatus ? 'bg-[#00e5b3]' : 'bg-red-500'}`}></div>
                  <span>{connectionStatus ? 'Connected' : 'Disconnected'}</span>
                </div>
                
                {activeAccount && (
                  <div className="mt-2">
                    <Badge variant="outline" className="text-[#00e5b3] border-[#00e5b3]">
                      Active account: {activeAccount}
                    </Badge>
                  </div>
                )}
              </CardContent>
              <div className="px-6 pb-6">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={showConnectionDebug}
                  className="text-white border-[#1c3654] hover:bg-[#1c3654]"
                >
                  Detailed Debug
                </Button>
              </div>
            </Card>
            
            <Card className="bg-[#162746] border-[#1c3654] text-white">
              <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>Options for managing tokens</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    onClick={loadAllTokens} 
                    disabled={isLoading}
                    className="justify-start text-white border-[#1c3654] hover:bg-[#1c3654]"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Token List
                  </Button>
                  
                  <Button 
                    variant="destructive" 
                    onClick={clearAllTokens} 
                    disabled={isLoading}
                    className="justify-start"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All Tokens
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {error && (
            <Alert variant="destructive" className="mb-6 bg-red-900/30 border-red-800">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Card className="bg-[#162746] border-[#1c3654] text-white">
            <CardHeader>
              <CardTitle className="flex items-center">
                Stored Tokens
                {tokens.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-white border-[#1c3654]">
                    {tokens.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                List of all Deriv API tokens stored in the browser
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tokens.length === 0 ? (
                <div className="text-center py-6 text-[#8492b4]">
                  {isLoading ? 'Loading tokens...' : 'No tokens found'}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Main token */}
                  {tokens.filter(t => t.type === 'main').length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2 text-white">Main Token</h3>
                      <div className="space-y-2">
                        {tokens.filter(t => t.type === 'main').map((token, index) => (
                          <div key={`main-${index}`} className="flex items-center justify-between p-2 bg-[#1f3158] border border-[#1c3654] rounded-md">
                            <div>
                              <div className="font-mono text-sm text-white">{token.value.substring(0, 15)}...</div>
                              <div className="text-xs text-[#8492b4]">{token.key}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(token.value)}
                              className="text-white hover:bg-[#1c3654]"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <Separator className="bg-[#1c3654]" />
                  
                  {/* Verified tokens */}
                  {tokens.filter(t => t.type === 'verified').length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2 text-white">Verified Tokens</h3>
                      <div className="space-y-2">
                        {tokens.filter(t => t.type === 'verified').map((token, index) => (
                          <div key={`verified-${index}`} className="flex items-center justify-between p-2 bg-[#1f3158] border border-[#1c3654] rounded-md">
                            <div>
                              <div className="font-mono text-sm text-white">{token.value.substring(0, 15)}...</div>
                              <div className="text-xs text-[#8492b4]">{token.key}</div>
                              {token.account && (
                                <div className="text-xs text-[#00e5b3]">Account: {token.account}</div>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <Badge variant="outline" className="bg-[#00e5b3]/10 text-[#00e5b3] border-[#00e5b3]/30">
                                Verified
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(token.value)}
                                className="text-white hover:bg-[#1c3654]"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Simple tokens */}
                  {tokens.filter(t => t.type === 'simple').length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2 text-white">Account Tokens</h3>
                      <div className="space-y-2">
                        {tokens.filter(t => t.type === 'simple').map((token, index) => (
                          <div key={`simple-${index}`} className="flex items-center justify-between p-2 bg-[#1f3158] border border-[#1c3654] rounded-md">
                            <div>
                              <div className="font-mono text-sm text-white">{token.value.substring(0, 15)}...</div>
                              <div className="text-xs text-[#8492b4]">{token.key}</div>
                              {token.account && (
                                <div className="text-xs text-[#8492b4]">Account: {token.account}</div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(token.value)}
                              className="text-white hover:bg-[#1c3654]"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Map tokens */}
                  {tokens.filter(t => t.type === 'map').length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2 text-white">Token Map</h3>
                      <div className="space-y-2">
                        {tokens.filter(t => t.type === 'map').map((token, index) => (
                          <div key={`map-${index}`} className="flex items-center justify-between p-2 bg-[#1f3158] border border-[#1c3654] rounded-md">
                            <div>
                              <div className="font-mono text-sm text-white">{token.value.substring(0, 15)}...</div>
                              <div className="text-xs text-[#8492b4]">{token.key}</div>
                              {token.account && (
                                <div className="text-xs text-[#8492b4]">Account: {token.account}</div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(token.value)}
                              className="text-white hover:bg-[#1c3654]"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* OAuth tokens */}
                  {tokens.filter(t => t.type === 'oauth').length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2 text-white">OAuth Accounts</h3>
                      <div className="space-y-2">
                        {tokens.filter(t => t.type === 'oauth').map((token, index) => (
                          <div key={`oauth-${index}`} className="flex items-center justify-between p-2 bg-[#1f3158] border border-[#1c3654] rounded-md">
                            <div>
                              <div className="font-mono text-sm text-white">{token.value.substring(0, 15)}...</div>
                              <div className="text-xs text-[#8492b4]">{token.key}</div>
                              {token.account && (
                                <div className="text-xs text-[#8492b4]">Account: {token.account}</div>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <Badge variant="outline" className="bg-blue-900/20 text-blue-400 border-blue-800/30">
                                OAuth
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(token.value)}
                                className="text-white hover:bg-[#1c3654]"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
