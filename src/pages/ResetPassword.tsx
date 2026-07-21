import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Eye, EyeOff, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { validatePassword } from '@/utils/passwordValidation';
import { createLogger } from "@/lib/logger";


const logger = createLogger("ResetPassword");
const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase handles the token exchange automatically via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    // Also check if we already have a session (user clicked the link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        logger.error('Error updating password:', error);
        toast.error('Error al actualizar la contraseña');
        return;
      }

      toast.success('¡Contraseña actualizada exitosamente!');
      navigate('/auth', { replace: true });
    } catch (error) {
      logger.error('Error:', error);
      toast.error('Error al actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <AuthBackground>
        <div className="text-center text-auth-foreground">
          <div className="size-8 border-2 border-auth-border border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>Verificando enlace...</p>
        </div>
      </AuthBackground>
    );
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-md">
        <Card className="bg-transparent border-auth-border/20 shadow-none" style={{ background: 'transparent' }}>
          <CardHeader className="bg-transparent text-center" style={{ background: 'transparent' }}>
            <div className="mx-auto mb-2 flex size-16 items-center justify-center rounded-full bg-primary/20">
              <Lock className="size-8 text-primary" />
            </div>
            <CardTitle className="text-auth-foreground">Nueva Contraseña</CardTitle>
            <CardDescription className="text-auth-foreground/80">
              Ingresa tu nueva contraseña segura
            </CardDescription>
          </CardHeader>
          <CardContent className="bg-transparent" style={{ background: 'transparent' }}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-auth-foreground">Nueva contraseña</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 12 caracteres"
                    className="bg-transparent border-auth-border/50 text-auth-foreground placeholder:text-auth-foreground/60 focus:border-auth-border pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-auth-foreground/60 hover:text-auth-foreground"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-new-password" className="text-auth-foreground">Confirmar contraseña</Label>
                <Input
                  id="confirm-new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  className="bg-transparent border-auth-border/50 text-auth-foreground placeholder:text-auth-foreground/60 focus:border-auth-border"
                  required
                />
              </div>

              <div className="text-xs text-auth-foreground/60 space-y-1">
                <p className="font-medium text-auth-foreground/80">La contraseña debe tener:</p>
                <ul className="list-none space-y-1">
                  <li className={`flex items-center gap-2 ${password.length >= 12 ? 'text-auth-success' : ''}`}>
                    <Check className={`size-3 ${password.length >= 12 ? 'opacity-100' : 'opacity-30'}`} />
                    Al menos 12 caracteres
                  </li>
                  <li className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-auth-success' : ''}`}>
                    <Check className={`size-3 ${/[A-Z]/.test(password) ? 'opacity-100' : 'opacity-30'}`} />
                    Una letra mayúscula
                  </li>
                  <li className={`flex items-center gap-2 ${/[a-z]/.test(password) ? 'text-auth-success' : ''}`}>
                    <Check className={`size-3 ${/[a-z]/.test(password) ? 'opacity-100' : 'opacity-30'}`} />
                    Una letra minúscula
                  </li>
                  <li className={`flex items-center gap-2 ${/[0-9]/.test(password) ? 'text-auth-success' : ''}`}>
                    <Check className={`size-3 ${/[0-9]/.test(password) ? 'opacity-100' : 'opacity-30'}`} />
                    Un número
                  </li>
                  <li className={`flex items-center gap-2 ${/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'text-auth-success' : ''}`}>
                    <Check className={`size-3 ${/[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'opacity-100' : 'opacity-30'}`} />
                    Un símbolo especial
                  </li>
                </ul>
              </div>

              <Button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className="w-full text-auth-foreground font-semibold bg-transparent border-auth-border/50 hover:bg-auth-surface/10"
                style={{ background: 'transparent' }}
              >
                {loading ? 'Actualizando...' : 'Actualizar contraseña'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AuthBackground>
  );
};

export default ResetPassword;
