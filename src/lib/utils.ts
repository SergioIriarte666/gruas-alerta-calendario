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
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount)
}
