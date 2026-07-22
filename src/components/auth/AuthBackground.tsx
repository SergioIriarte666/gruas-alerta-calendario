import React from 'react';
import authBackground from '@/assets/auth-background.jpg';

interface AuthBackgroundProps {
  children: React.ReactNode;
  variant?: 'default' | 'operator';
}

export const AuthBackground: React.FC<AuthBackgroundProps> = ({ children, variant = 'default' }) => {
  return (
    <div className={`relative min-h-screen overflow-hidden bg-auth-background ${variant === 'operator' ? 'operator-auth-concept' : ''}`}>
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat saturate-[0.78] brightness-[0.62] contrast-[0.82]"
        style={{
          backgroundImage: `url(${authBackground})`,
        }}
      />
      <div className="absolute inset-0 bg-auth-background/80" />
      <div className="absolute inset-0 bg-auth-glow" />
      <div className="absolute inset-0 bg-auth-vignette" />
      <div className="absolute left-1/2 top-1/2 size-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-auth-background/35 blur-3xl" />

      <div className="operator-auth-content relative z-10 flex min-h-screen items-center justify-center p-4 sm:p-8 md:p-12">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
};
