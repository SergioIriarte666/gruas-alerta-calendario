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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[PushNotification] Processing request...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, notification }: PushNotificationRequest = await req.json();

    console.log('[PushNotification] Request data:', { userId, notificationType: notification.type });

    // Validate input
    if (!userId || !notification || !notification.title || !notification.body) {
      console.error('[PushNotification] Invalid request data');
      return new Response(JSON.stringify({
        success: false,
        message: 'Datos de solicitud inválidos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get active subscription for user
    const { data: subscription, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (subscriptionError || !subscription) {
      console.log('[PushNotification] No active subscription for user:', userId, subscriptionError?.message);
      return new Response(JSON.stringify({
        success: false,
        message: 'No hay suscripción activa para este usuario'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('[PushNotification] Found active subscription');

    // Build notification payload
    const payload = {
      title: notification.title,
      body: notification.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      data: notification.data || {},
      type: notification.type
    };

    console.log('[PushNotification] Payload prepared:', payload);

    // Simulate push sending (in production, use web-push library)
    try {
      console.log('[PushNotification] Simulating push send to endpoint:', 
        subscription.endpoint.substring(0, 50) + '...');
      
      // In a real implementation, you would use the web-push library here
      // For now, we'll just log the attempt
      console.log('[PushNotification] Push notification simulated successfully');
    } catch (pushError) {
      console.error('[PushNotification] Error in push simulation:', pushError);
      // Don't fail the whole operation for simulation errors
    }
    
    // Log the notification
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
      console.error('[PushNotification] Error logging notification:', logError);
      // Don't fail for logging errors
    }

    console.log('[PushNotification] Notification processed successfully for user:', userId);

    return new Response(JSON.stringify({
      success: true,
      message: 'Notificación push procesada exitosamente',
      userId: userId,
      notificationType: notification.type
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('[PushNotification] Service error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Error desconocido',
      details: 'Error en el servicio de notificación push'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);