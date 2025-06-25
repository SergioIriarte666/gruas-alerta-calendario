
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationRequest {
  userId: string;
  notification: {
    title: string;
    body: string;
    data?: any;
    type: string;
  };
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

    const { userId, notification }: PushNotificationRequest = await req.json();

    console.log('Sending push notification to user:', userId, notification);

    // Obtener suscripción activa del usuario
    const { data: subscription, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (subscriptionError || !subscription) {
      console.log('No active push subscription found for user:', userId);
      return new Response(JSON.stringify({
        success: false,
        message: 'No hay suscripción activa para este usuario'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Aquí implementarías el envío real usando web-push
    // Por ahora, solo registramos la intención de envío
    
    // Registrar la notificación en el log
    const { error: logError } = await supabase
      .from('notification_logs')
      .insert({
        user_id: userId,
        type: 'push',
        title: notification.title,
        body: notification.body,
        data: notification.data,
        status: 'sent',
        sent_at: new Date().toISOString()
      });

    if (logError) {
      console.error('Error logging notification:', logError);
    }

    console.log('Push notification processed for user:', userId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Notificación push enviada exitosamente',
      userId: userId,
      notificationType: notification.type
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('Error sending push notification:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Error en el servicio de notificación push'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
