
import React from 'react';

interface AuthTabsProps {
  activeTab: 'login' | 'register';
  setActiveTab: (tab: 'login' | 'register') => void;
}

export const AuthTabs: React.FC<AuthTabsProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="flex w-full bg-white/10 backdrop-blur-md rounded-lg p-1 mb-4 border border-white/20">
      <button
        onClick={() => setActiveTab('login')}
        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
          activeTab === 'login'
            ? 'bg-white/30 text-white shadow-sm backdrop-blur-sm'
            : 'text-white/80 hover:text-white hover:bg-white/15'
        }`}
      >
        Iniciar Sesión
      </button>
      <button
        onClick={() => setActiveTab('register')}
        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
          activeTab === 'register'
            ? 'bg-white/30 text-white shadow-sm backdrop-blur-sm'
            : 'text-white/80 hover:text-white hover:bg-white/15'
        }`}
      >
        Registrarse
      </button>
    </div>
  );
};
