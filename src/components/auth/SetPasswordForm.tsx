import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Eye, EyeOff, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { validatePassword } from '@/utils/passwordValidation';

interface SetPasswordFormProps {
  onSuccess: () => void;
}

export const SetPasswordForm = ({ onSuccess }: SetPasswordFormProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('Error setting password:', error);
        toast.error('Error al configurar la contraseña');
        return;
      }

      toast.success('¡Contraseña configurada exitosamente!');
      onSuccess();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al configurar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
      <div className="text-center mb-6">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/20">
          <Lock className="size-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Configura tu contraseña</h2>
        <p className="text-sm text-white/70">
          Crea una contraseña segura para acceder al sistema
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/85">Nueva contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="h-11 rounded-xl border-white/15 bg-white/8 pr-10 text-white placeholder:text-white/45"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-white/85">Confirmar contraseña</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite tu contraseña"
            className="h-11 rounded-xl border-white/15 bg-white/8 text-white placeholder:text-white/45"
            required
          />
        </div>

        <div className="space-y-1 text-xs text-white/55">
          <p className="font-medium">La contraseña debe tener:</p>
          <ul className="list-none space-y-1">
            <li className={`flex items-center gap-2 ${password.length >= 8 ? 'text-primary' : ''}`}>
              <Check className={`size-3 ${password.length >= 8 ? 'opacity-100' : 'opacity-30'}`} />
              Al menos 8 caracteres
            </li>
            <li className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-primary' : ''}`}>
              <Check className={`size-3 ${/[A-Z]/.test(password) ? 'opacity-100' : 'opacity-30'}`} />
              Una letra mayúscula
            </li>
            <li className={`flex items-center gap-2 ${/[a-z]/.test(password) ? 'text-primary' : ''}`}>
              <Check className={`size-3 ${/[a-z]/.test(password) ? 'opacity-100' : 'opacity-30'}`} />
              Una letra minúscula
            </li>
            <li className={`flex items-center gap-2 ${/[0-9]/.test(password) ? 'text-primary' : ''}`}>
              <Check className={`size-3 ${/[0-9]/.test(password) ? 'opacity-100' : 'opacity-30'}`} />
              Un número
            </li>
          </ul>
        </div>

        <Button 
          type="submit" 
          className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={loading || !password || !confirmPassword}
        >
          {loading ? 'Configurando...' : 'Configurar contraseña'}
        </Button>
      </form>
    </div>
  );
};
