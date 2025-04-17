import React, { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const isActive = (path: string) => {
    return location === path ? 'bg-primary/10 text-primary' : 'hover:bg-gray-100 hover:dark:bg-gray-800';
  };

  const getUsername = () => {
    const accountInfo = localStorage.getItem('deriv_account_info');
    
    if (accountInfo) {
      try {
        const parsed = JSON.parse(accountInfo);
        return parsed.fullname || parsed.email || 'Usuário Deriv';
      } catch (e) {
        return 'Usuário';
      }
    }
    
    return 'Usuário';
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <a className="font-bold text-xl text-primary">Trading Bot</a>
            </Link>
          </div>
          <div className="flex items-center space-x-3">
            <span className="hidden md:inline text-sm text-gray-600 dark:text-gray-400">
              {getUsername()}
            </span>
          </div>
        </div>
      </header>
      
      <div className="flex flex-1">
        <aside className="w-16 md:w-64 border-r border-border flex-shrink-0">
          <nav className="p-2 md:p-4 space-y-1">
            <Link href="/dashboard">
              <a className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${isActive('/dashboard')}`}>
                <span className="text-center w-full md:w-auto md:text-left">Dashboard</span>
              </a>
            </Link>
            <Link href="/bot">
              <a className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${isActive('/bot')}`}>
                <span className="text-center w-full md:w-auto md:text-left">Robô de Trading</span>
              </a>
            </Link>
            <Link href="/token-test">
              <a className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${isActive('/token-test')}`}>
                <span className="text-center w-full md:w-auto md:text-left">Testar Token</span>
              </a>
            </Link>
          </nav>
        </aside>
        
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}