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
  X,
  Calculator as CalculatorIcon,
  Globe,
  CreditCard,
  ArrowDownCircle
} from 'lucide-react';
import { DirectHTMLSwitcher } from './DirectHTMLSwitcher';
import { LanguageSwitcher } from '../LanguageSwitcher';

interface SidebarProps {
  className?: string;
  isMobile?: boolean;
}

export function Sidebar({ className = '', isMobile = false }: SidebarProps) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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
      path: '/gestao-operacional', 
      label: 'Gestão Operacional', 
      icon: <CalculatorIcon className="h-5 w-5" /> 
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
    }
  ];

  // Classes para mobile e desktop
  const sidebarClassMobile = `
    fixed inset-y-0 left-0 z-30 
    flex-col bg-[#162746] border-r border-[#1c3654] ${className} 
    ${isOpen ? 'block' : 'hidden'}
  `;

  // Versão desktop com largura variável baseada no hover
  const sidebarClassDesktop = `
    hidden md:flex fixed h-full z-30
    flex-col bg-[#162746] border-r border-[#1c3654] ${className}
    transition-all duration-300 ease-in-out
    ${isHovered ? 'md:w-64' : 'md:w-16'}
  `;

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

      {/* Overlay para mobile */}
      {isMobile && isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-20" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar para Mobile */}
      {isMobile && (
        <aside className={sidebarClassMobile}>
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
          
          {/* Botões de Depósito e Saque para Mobile */}
          <div className="px-2 py-3">
            <a 
              href="https://app.deriv.com/cashier/deposit?lang=PT" 
              target="_blank" 
              rel="noopener noreferrer"
              className="side-nav-item px-3 py-2 rounded-md text-[#00e5b3] hover:bg-[#1d2a45] flex items-center space-x-3 cursor-pointer mb-2"
              onClick={closeSidebar}
            >
              <CreditCard className="h-5 w-5" />
              <span>Deposite</span>
            </a>
            
            <a 
              href="https://app.deriv.com/cashier/withdrawal?lang=PT" 
              target="_blank" 
              rel="noopener noreferrer"
              className="side-nav-item px-3 py-2 rounded-md text-[#ffcc00] hover:bg-[#1d2a45] flex items-center space-x-3 cursor-pointer"
              onClick={closeSidebar}
            >
              <ArrowDownCircle className="h-5 w-5" />
              <span>Saque</span>
            </a>
          </div>
          
          {/* Área do rodapé da sidebar com seletor de idioma */}
          <div className="p-4 border-t border-[#1c3654]">
            <LanguageSwitcher />
          </div>
        </aside>
      )}

      {/* Sidebar para Desktop - expansível no hover */}
      {!isMobile && (
        <aside 
          className={sidebarClassDesktop}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className={`border-b border-[#1c3654] flex items-center justify-center transition-all ${isHovered ? 'p-4' : 'p-3'}`}>
            <svg className="w-8 h-8 text-[#00e5b3]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            {isHovered && <h1 className="ml-2 text-xl font-bold text-white">Genius Tech</h1>}
          </div>
          
          <div className="flex flex-col flex-grow py-4 overflow-hidden hover:overflow-y-auto">
            <nav className="flex-1 px-2 space-y-1">
              {navItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <Link 
                    key={item.path} 
                    href={item.path}
                  >
                    <div className={`side-nav-item px-3 py-2 rounded-md ${isActive ? 'active text-white' : 'text-[#8492b4] hover:text-white'} flex items-center cursor-pointer ${isHovered ? 'justify-start' : 'justify-center'}`}>
                      {item.icon}
                      {isHovered && <span className="ml-3">{item.label}</span>}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
          
          {/* Botões de Depósito e Saque */}
          <div className="px-2 py-2">
            <a 
              href="https://app.deriv.com/cashier/deposit?lang=PT" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`side-nav-item px-3 py-2 rounded-md text-[#00e5b3] hover:bg-[#1d2a45] flex items-center cursor-pointer ${isHovered ? 'justify-start' : 'justify-center'} mb-2`}
            >
              <CreditCard className="h-5 w-5" />
              {isHovered && <span className="ml-3">Deposite</span>}
            </a>
            
            <a 
              href="https://app.deriv.com/cashier/withdrawal?lang=PT" 
              target="_blank" 
              rel="noopener noreferrer"
              className={`side-nav-item px-3 py-2 rounded-md text-[#ffcc00] hover:bg-[#1d2a45] flex items-center cursor-pointer ${isHovered ? 'justify-start' : 'justify-center'}`}
            >
              <ArrowDownCircle className="h-5 w-5" />
              {isHovered && <span className="ml-3">Saque</span>}
            </a>
          </div>
          
          {/* Área do rodapé da sidebar com seletor de idioma */}
          <div className={`border-t border-[#1c3654] ${isHovered ? 'p-4' : 'p-3 flex justify-center'}`}>
            {isHovered 
              ? <LanguageSwitcher /> 
              : <Globe className="h-4 w-4 text-muted-foreground" />
            }
          </div>
        </aside>
      )}
    </>
  );
}
