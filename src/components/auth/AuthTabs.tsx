import React from 'react';

interface AuthTabsProps {
  activeTab: 'login' | 'register';
  setActiveTab: (tab: 'login' | 'register') => void;
}

export const AuthTabs: React.FC<AuthTabsProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="mb-4 flex w-full rounded-2xl border border-white/15 bg-white/8 p-1 backdrop-blur-xl">
      <button
        onClick={() => setActiveTab('login')}
        className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'login'
            ? 'bg-white/18 text-white shadow-sm backdrop-blur-sm'
            : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`}
      >
        Iniciar Sesión
      </button>
      <button
        onClick={() => setActiveTab('register')}
        className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'register'
            ? 'bg-white/18 text-white shadow-sm backdrop-blur-sm'
            : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`}
      >
        Registrarse
      </button>
    </div>
  );
};
