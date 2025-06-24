
import React from 'react';

interface AuthTabsProps {
  activeTab: 'login' | 'register';
  setActiveTab: (tab: 'login' | 'register') => void;
}

export const AuthTabs: React.FC<AuthTabsProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="flex w-full bg-white/20 backdrop-blur-sm rounded-lg p-1 mb-4 border border-white/30">
      <button
        onClick={() => setActiveTab('login')}
        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
          activeTab === 'login'
            ? 'bg-white text-black shadow-sm'
            : 'text-white hover:text-gray-200 hover:bg-white/10'
        }`}
      >
        Iniciar Sesión
      </button>
      <button
        onClick={() => setActiveTab('register')}
        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
          activeTab === 'register'
            ? 'bg-white text-black shadow-sm'
            : 'text-white hover:text-gray-200 hover:bg-white/10'
        }`}
      >
        Registrarse
      </button>
    </div>
  );
};
