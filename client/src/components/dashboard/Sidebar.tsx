import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { 
  LayoutDashboard, 
  Bot, 
  BarChart, 
  Settings, 
  Wallet, 
  Users,
  Menu,
  X
} from 'lucide-react';
import { BasicAccountSwitcher } from './BasicAccountSwitcher';

interface SidebarProps {
  className?: string;
  isMobile?: boolean;
}

export function Sidebar({ className = '', isMobile = false }: SidebarProps) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => {
    setIsOpen(prev => !prev);
  };

  const closeSidebar = () => {
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const navItems = [
    { 
      path: '/dashboard', 
      label: 'Dashboard', 
      icon: <LayoutDashboard className="h-5 w-5" /> 
    },
    { 
      path: '/bot', 
      label: 'Robô de Operações', 
      icon: <Bot className="h-5 w-5" /> 
    },
    { 
      path: '/statistics', 
      label: 'Estatísticas', 
      icon: <BarChart className="h-5 w-5" /> 
    },
    { 
      path: '/settings', 
      label: 'Configurações', 
      icon: <Settings className="h-5 w-5" /> 
    },
    { 
      path: '/cashier', 
      label: 'Operações de Caixa', 
      icon: <Wallet className="h-5 w-5" /> 
    },
    { 
      path: '/accounts', 
      label: 'Contas', 
      icon: <Users className="h-5 w-5" /> 
    }
  ];

  // Mobile sidebar overlay
  const sidebarClass = `${isMobile ? 'fixed inset-y-0 left-0 z-30' : 'hidden md:flex md:w-64'} 
    flex-col bg-[#162746] border-r border-[#1c3654] ${className} 
    ${isMobile && isOpen ? 'block' : isMobile && !isOpen ? 'hidden' : ''}`;

  return (
    <>
      {/* Mobile menu button */}
      {isMobile && (
        <button
          type="button"
          onClick={toggleSidebar}
          className="md:hidden fixed top-4 left-4 z-40 p-2 text-white rounded-md bg-[#162746] border border-[#1c3654]"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      )}

      {/* Overlay for mobile */}
      {isMobile && isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-20" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={sidebarClass}>
        <div className="p-4 border-b border-[#1c3654] flex items-center justify-center">
          <svg className="w-8 h-8 text-[#00e5b3] mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <h1 className="text-xl font-bold text-white">Genius Tech</h1>
        </div>
        
        <div className="flex flex-col flex-grow py-4 overflow-y-auto">
          <nav className="flex-1 px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Link 
                  key={item.path} 
                  href={item.path}
                  onClick={closeSidebar}
                >
                  <div className={`side-nav-item px-3 py-2 rounded-md ${isActive ? 'active text-white' : 'text-[#8492b4] hover:text-white'} flex items-center space-x-3 cursor-pointer`}>
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="p-4 border-t border-[#1c3654]">
          <BasicAccountSwitcher />
        </div>
      </aside>
    </>
  );
}
