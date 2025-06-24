
import React from 'react';

interface AuthBackgroundProps {
  children: React.ReactNode;
}

export const AuthBackground: React.FC<AuthBackgroundProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/images/crane-background.jpg)',
        }}
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        {children}
      </div>
    </div>
  );
};
