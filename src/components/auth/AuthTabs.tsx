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
            ? 'bg-white/18 shadow-sm backdrop-blur-sm'
            : 'hover:bg-white/10'
        }`}
        style={{ color: activeTab === 'login' ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.76)' }}
      >
        Iniciar Sesión
      </button>
      <button
        onClick={() => setActiveTab('register')}
        className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'register'
            ? 'bg-white/18 shadow-sm backdrop-blur-sm'
            : 'hover:bg-white/10'
        }`}
        style={{ color: activeTab === 'register' ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.76)' }}
      >
        Registrarse
      </button>
    </div>
  );
};
