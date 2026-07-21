import React from 'react';
import { getPasswordStrength, getStrengthColor, getStrengthText } from '@/utils/passwordValidation';

interface PasswordStrengthIndicatorProps {
  password: string;
}

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({ password }) => {
  if (!password) return null;
  
  const strength = getPasswordStrength(password);
  const strengthColor = getStrengthColor(strength);
  const strengthText = getStrengthText(strength);
  
  const widthPercentage = {
    weak: '33%',
    medium: '66%',
    strong: '100%'
  }[strength];
  
  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-auth-foreground/70">Fortaleza de contraseña</span>
        <span className={`text-xs font-medium ${
          strength === 'weak' ? 'text-auth-danger' :
          strength === 'medium' ? 'text-auth-warning' :
          'text-auth-success'
        }`}>
          {strengthText}
        </span>
      </div>
      <div className="w-full h-2 bg-auth-surface/10 rounded-full overflow-hidden">
        <div 
          className={`h-full ${strengthColor} transition-all duration-300`}
          style={{ width: widthPercentage }}
        />
      </div>
      <div className="mt-2 text-xs text-auth-foreground/60">
        <p>La contraseña debe contener al menos:</p>
        <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
          <li className={password.length >= 12 ? 'text-auth-success' : ''}>
            12 caracteres
          </li>
          <li className={/[A-Z]/.test(password) && /[a-z]/.test(password) ? 'text-auth-success' : ''}>
            Mayúsculas y minúsculas
          </li>
          <li className={/\d/.test(password) ? 'text-auth-success' : ''}>
            Números
          </li>
          <li className={/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'text-auth-success' : ''}>
            Símbolos especiales
          </li>
        </ul>
      </div>
    </div>
  );
};
