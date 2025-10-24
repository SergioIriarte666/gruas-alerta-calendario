export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
  strength?: 'weak' | 'medium' | 'strong';
}

export const validatePassword = (password: string): PasswordValidationResult => {
  if (password.length < 12) {
    return { 
      valid: false, 
      error: 'La contraseña debe tener al menos 12 caracteres',
      strength: 'weak'
    };
  }
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const strengthScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar]
    .filter(Boolean).length;
  
  if (strengthScore < 3) {
    return { 
      valid: false, 
      error: 'La contraseña debe incluir al menos 3 de: mayúsculas, minúsculas, números, símbolos',
      strength: 'weak'
    };
  }
  
  const strength = getPasswordStrength(password);
  return { valid: true, strength };
};

export const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
  const score = [
    password.length >= 12,
    password.length >= 16,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*(),.?":{}|<>]/.test(password)
  ].filter(Boolean).length;
  
  if (score <= 3) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
};

export const getStrengthColor = (strength: 'weak' | 'medium' | 'strong'): string => {
  switch (strength) {
    case 'weak':
      return 'bg-red-500';
    case 'medium':
      return 'bg-yellow-500';
    case 'strong':
      return 'bg-green-500';
  }
};

export const getStrengthText = (strength: 'weak' | 'medium' | 'strong'): string => {
  switch (strength) {
    case 'weak':
      return 'Débil';
    case 'medium':
      return 'Media';
    case 'strong':
      return 'Fuerte';
  }
};
