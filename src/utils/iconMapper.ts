import { 
  DollarSign, 
  TrendingUp, 
  Banknote, 
  CreditCard, 
  Wallet,
  PiggyBank,
  Receipt,
  ShoppingCart,
  Package,
  HelpCircle,
  type LucideIcon
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  'dollar-sign': DollarSign,
  'trending-up': TrendingUp,
  'banknote': Banknote,
  'credit-card': CreditCard,
  'wallet': Wallet,
  'piggy-bank': PiggyBank,
  'receipt': Receipt,
  'shopping-cart': ShoppingCart,
  'package': Package,
  'help-circle': HelpCircle,
};

export const getIconComponent = (iconName: string): LucideIcon => {
  return iconMap[iconName] || DollarSign;
};
