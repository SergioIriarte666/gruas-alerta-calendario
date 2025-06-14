
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Truck, AlertTriangle, Info } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (!error) {
      navigate('/');
    }
    
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSignupError(null);
    
    const { error } = await signUp(email, password, fullName);
    
    if (error) {
      if (error.message.includes('Signups not allowed')) {
        setSignupError('signup_disabled');
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-tms-dark flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-tms-green/20 p-3 rounded-full">
              <Truck className="w-8 h-8 text-tms-green" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">TMS Grúas</CardTitle>
          <CardDescription className="text-gray-400">
            Sistema de Gestión de Transportes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="signin">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="signup">Registrarse</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <Alert className="mb-4 bg-blue-900/20 border-blue-700">
                <Info className="h-4 w-4 text-blue-400" />
                <AlertDescription className="text-blue-300">
                  Para probar la aplicación, usa estas credenciales de demo:
                  <br />
                  <strong>Email:</strong> admin@tmsgruas.cl
                  <br />
                  <strong>Contraseña:</strong> demo123
                </AlertDescription>
              </Alert>
              
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-gray-300">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white/5 border-gray-700 text-white placeholder-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="text-gray-300">Contraseña</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-white/5 border-gray-700 text-white placeholder-gray-400"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-tms-green hover:bg-tms-green/90 text-white"
                  disabled={loading}
                >
                  {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              {signupError === 'signup_disabled' && (
                <Alert className="mb-4 bg-yellow-900/20 border-yellow-700">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <AlertDescription className="text-yellow-300">
                    <strong>Registros deshabilitados:</strong>
                    <br />
                    Para obtener acceso al sistema, contacta al administrador. Los registros públicos están temporalmente deshabilitados por seguridad.
                    <br /><br />
                    <strong>Pasos para el administrador:</strong>
                    <br />
                    1. Ir a Supabase Dashboard → Authentication → Settings
                    <br />
                    2. Habilitar "Enable email signup"
                    <br />
                    3. Configurar URLs de redirección apropiadas
                  </AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-gray-300">Nombre Completo</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Tu nombre completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-white/5 border-gray-700 text-white placeholder-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-gray-300">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white/5 border-gray-700 text-white placeholder-gray-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-gray-300">Contraseña</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="bg-white/5 border-gray-700 text-white placeholder-gray-400"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-tms-green hover:bg-tms-green/90 text-white"
                  disabled={loading}
                >
                  {loading ? 'Registrando...' : 'Registrarse'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
