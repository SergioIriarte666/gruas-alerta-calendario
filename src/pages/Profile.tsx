import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, User, Lock, Save, Camera, Loader2, ShieldCheck, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';


const logger = createLogger("Profile");
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

  useEffect(() => {
    form.reset({
      name: user?.name || '',
      email: user?.email || '',
      phone: '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  }, [form, user?.email, user?.name]);

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
      logger.error('Error uploading avatar:', error);
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
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Mi Perfil"
        description="Gestiona tu información personal, identidad visual y credenciales de acceso."
        badges={
          <Badge variant="outline" className="capitalize">
            {user?.role || 'usuario'}
          </Badge>
        }
        actions={
          <Button variant="outline" onClick={() => navigate(-1)} className="border-border/70 bg-card/70">
            <ArrowLeft className="mr-2 size-4" />
            Volver
          </Button>
        }
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardContent className="space-y-5 p-6">
                <div className="relative mx-auto flex w-fit justify-center">
                  <div className="group relative">
                    <Avatar className="size-28 border-2 border-border shadow-sm">
                      <AvatarImage src={user?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-overlay/60 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="size-5 animate-spin text-effect-highlight" />
                      ) : (
                        <Camera className="size-5 text-effect-highlight" />
                      )}
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>

                <div className="space-y-2 text-center">
                  <p className="text-lg font-semibold text-foreground">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <Badge variant="outline" className="capitalize">
                    {user?.role || 'usuario'}
                  </Badge>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/50 p-4 text-sm">
                  <div className="flex items-center gap-2 text-foreground">
                    <ShieldCheck className="size-4 text-primary" />
                    <span className="font-medium">Estado de cuenta</span>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Mantén tu correo y contraseña actualizados para una recuperación segura del acceso.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-border/70 bg-background/60"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? 'Subiendo foto...' : 'Cambiar foto de perfil'}
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="border-border/70 bg-card/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center text-foreground">
                    <User className="mr-2 size-5 text-primary" />
                    Información Personal
                  </CardTitle>
                  <CardDescription>Actualiza tu nombre visible y correo principal de acceso.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre completo</FormLabel>
                        <FormControl><Input {...field} placeholder="Tu nombre completo" className="border-border/70 bg-background/60" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input {...field} type="email" placeholder="tu@email.com" className="border-border/70 bg-background/60" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <PhoneInput
                            value={field.value ?? ''}
                            onChange={(v) => field.onChange(v)}
                            placeholder="9 XXXX XXXX"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="rounded-xl border border-border/70 bg-background/50 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Mail className="size-4 text-primary" />
                        Identidad de acceso
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        El rol actual define los permisos visibles dentro del sistema.
                      </p>
                      <Badge variant="outline" className="mt-3 capitalize">
                        {user?.role || 'usuario'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-card/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center text-foreground">
                    <Lock className="mr-2 size-5 text-primary" />
                    Seguridad
                  </CardTitle>
                  <CardDescription>Cambia tu contraseña para mantener tu cuenta protegida.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <FormField control={form.control} name="currentPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña actual</FormLabel>
                        <FormControl><Input {...field} type="password" placeholder="Contraseña actual" className="border-border/70 bg-background/60" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="newPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nueva contraseña</FormLabel>
                        <FormControl><Input {...field} type="password" placeholder="Nueva contraseña" className="border-border/70 bg-background/60" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="confirmPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar contraseña</FormLabel>
                        <FormControl><Input {...field} type="password" placeholder="Confirmar contraseña" className="border-border/70 bg-background/60" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
              </Card>

              <DeleteAccountSection />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button type="button" variant="outline" className="border-border/70 bg-card/70" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button type="submit">
              <Save className="size-4 mr-2" />
              Guardar Cambios
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default Profile;
