import React from 'react';
import authBackground from '@/assets/auth-background.jpg';

interface AuthBackgroundProps {
  children: React.ReactNode;
}

export const AuthBackground: React.FC<AuthBackgroundProps> = ({ children }) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${authBackground})`,
        }}
      />
      <div className="absolute inset-0 bg-slate-950/70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.24),_transparent_42%)]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-8 md:p-12">
        <div className="w-full max-w-[440px]">
          {children}
        </div>
      </div>
    </div>
  );
};
