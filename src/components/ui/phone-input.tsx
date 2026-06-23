import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PhoneInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Input de teléfono con prefijo fijo "+56" visible. El usuario escribe solo el número local.
 * - El valor emitido incluye el prefijo: "+56 9 1234 5678".
 * - Si el usuario borra todo, emite '' (NUNCA "+56" solo) → los campos opcionales vacíos
 *   quedan realmente vacíos y no contaminan la prioridad de WhatsApp.
 * - Al editar un valor existente que ya trae "+56", se muestra solo la parte local.
 */
export const PhoneInput = ({
  value,
  onChange,
  placeholder = '9 1234 5678',
  disabled,
  id,
  className,
}: PhoneInputProps) => {
  const local = (value ?? '').replace(/^\s*\+?56\s*/, '');

  const handleChange = (raw: string) => {
    const trimmed = raw.replace(/^\s*\+?56\s*/, '');
    const hasDigits = /\d/.test(trimmed);
    onChange(hasDigits ? `+56 ${trimmed.trim()}` : '');
  };

  return (
    <div className={cn('flex', className)}>
      <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground select-none">
        +56
      </span>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        className="rounded-l-none"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
};
