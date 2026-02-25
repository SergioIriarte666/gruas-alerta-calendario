import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'CLP'): string {
  const localeMap: Record<string, string> = {
    'CLP': 'es-CL',
    'USD': 'en-US', 
    'EUR': 'de-DE'
  };
  
  const locale = localeMap[currency] || 'es-CL';
  
  // CLP has no decimals; for others round to 2 decimals to avoid floating-point noise
  const rounded = currency === 'CLP' ? Math.round(amount) : Math.round(amount * 100) / 100;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(rounded)
}
