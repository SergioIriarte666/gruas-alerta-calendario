import React from 'react';
import authBackground from '@/assets/auth-background.jpg';

interface AuthBackgroundProps {
  children: React.ReactNode;
}

export const AuthBackground: React.FC<AuthBackgroundProps> = ({ children }) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat saturate-[0.78] brightness-[0.62] contrast-[0.82]"
        style={{
          backgroundImage: `url(${authBackground})`,
        }}
      />
      <div className="absolute inset-0 bg-slate-950/78" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.20),_transparent_38%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0.22),_rgba(15,23,42,0.62)_44%,_rgba(15,23,42,0.82)_100%)]" />
      <div className="absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950/34 blur-3xl" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-8 md:p-12">
        <div className="w-full max-w-[440px]">
          {children}
        </div>
      </div>
    </div>
  );
};
