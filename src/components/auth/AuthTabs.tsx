import React from 'react';

interface AuthTabsProps {
  activeTab: 'login' | 'register';
  setActiveTab: (tab: 'login' | 'register') => void;
}

export const AuthTabs: React.FC<AuthTabsProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="mb-4 flex w-full rounded-2xl border border-auth-border/15 bg-auth-surface/10 p-1 backdrop-blur-xl">
      <button
        onClick={() => setActiveTab('login')}
        className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'login'
            ? 'bg-auth-surface/20 text-auth-foreground shadow-sm backdrop-blur-sm'
            : 'text-auth-muted/85 hover:bg-auth-surface/10'
        }`}
      >
        Iniciar Sesión
      </button>
      <button
        onClick={() => setActiveTab('register')}
        className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
          activeTab === 'register'
            ? 'bg-auth-surface/20 text-auth-foreground shadow-sm backdrop-blur-sm'
            : 'text-auth-muted/85 hover:bg-auth-surface/10'
        }`}
      >
        Registrarse
      </button>
    </div>
  );
};
