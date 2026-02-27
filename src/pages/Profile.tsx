import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, User, Lock, Save, Camera, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const profileSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) return false;
  if (data.newPassword && data.newPassword !== data.confirmPassword) return false;
  return true;
}, {
  message: "Las contraseñas no coinciden o falta la contraseña actual",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;

const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser, forceRefreshProfile } = useUser();
  const { user: authUser } = useAuth();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no debe superar 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      // Add cache buster
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      await updateUser({ avatar_url: avatarUrl });
      await forceRefreshProfile();
      toast.success('Foto de perfil actualizada');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Error al subir la foto');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    await updateUser({ name: data.name, email: data.email });

    if (data.newPassword) {
      const { error } = await supabase.auth.updateUser({ password: data.newPassword });
      if (error) {
        toast.error('Error al cambiar contraseña', { description: error.message });
        return;
      }
    }

    toast.success("Perfil actualizado", {
      description: "Los cambios se han guardado correctamente",
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mi Perfil</h1>
          <p className="text-muted-foreground text-sm">Gestiona tu información personal y configuración de seguridad</p>
        </div>
      </div>

      {/* Avatar Section */}
      <Card className="bg-card border">
        <CardContent className="flex items-center gap-6 p-6">
          <div className="relative group">
            <Avatar className="h-20 w-20 border-2 border-border">
              <AvatarImage src={user?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? 'Subiendo...' : 'Cambiar foto'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Information */}
          <Card className="bg-card border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center">
                <User className="w-5 h-5 mr-2" />
                Información Personal
              </CardTitle>
              <CardDescription>Actualiza tu información personal y de contacto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Nombre completo</FormLabel>
                    <FormControl><Input {...field} placeholder="Tu nombre completo" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Email</FormLabel>
                    <FormControl><Input {...field} type="email" placeholder="tu@email.com" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Teléfono</FormLabel>
                    <FormControl><Input {...field} placeholder="+56 9 1234 5678" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex items-center space-x-2">
                  <span className="text-muted-foreground text-sm">Rol:</span>
                  <span className="text-primary font-medium capitalize">{user?.role}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="bg-card border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center">
                <Lock className="w-5 h-5 mr-2" />
                Seguridad
              </CardTitle>
              <CardDescription>Cambia tu contraseña para mantener tu cuenta segura</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="currentPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Contraseña actual</FormLabel>
                    <FormControl><Input {...field} type="password" placeholder="Contraseña actual" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="newPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Nueva contraseña</FormLabel>
                    <FormControl><Input {...field} type="password" placeholder="Nueva contraseña" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Confirmar contraseña</FormLabel>
                    <FormControl><Input {...field} type="password" placeholder="Confirmar contraseña" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button type="submit">
              <Save className="w-4 h-4 mr-2" />
              Guardar Cambios
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default Profile;
