
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscriptionData {
  userId: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  userAgent: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, subscription, userAgent }: PushSubscriptionData = await req.json();

    console.log('Saving push subscription for user:', userId);

    // Verificar que el usuario existe y está activo
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, role, is_active')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (profileError || !profile) {
      throw new Error('Usuario no encontrado o inactivo');
    }

    // Guardar o actualizar la suscripción
    const { error: upsertError } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        user_agent: userAgent,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      throw new Error(`Error guardando suscripción: ${upsertError.message}`);
    }

    // Enviar notificación de prueba
    const testNotification = {
      title: '🔔 Notificaciones Habilitadas',
      body: 'Has habilitado exitosamente las notificaciones push para TMS Grúas',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: 'welcome-notification',
      data: {
        type: 'welcome',
        timestamp: new Date().toISOString()
      }
    };

    // Aquí podrías enviar la notificación de prueba usando web-push
    // Por ahora solo guardamos la suscripción

    console.log('Push subscription saved successfully for user:', userId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Suscripción guardada exitosamente',
      userId: userId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('Error saving push subscription:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Error en el servicio de suscripción push'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
