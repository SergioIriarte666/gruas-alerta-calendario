import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';

interface DocumentAlert {
  crane_id: string;
  crane_license_plate: string;
  document_type: string;
  expiry_date: string;
  days_until_expiry: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Restrict to cron jobs (CRON_SECRET) or authenticated admin users
    const cronSecret = Deno.env.get('CRON_SECRET');
    const requestSecret = req.headers.get('x-cron-secret');
    const authHeader = req.headers.get('Authorization');
    let authorized = false;

    if (cronSecret && requestSecret && requestSecret === cronSecret) {
      authorized = true;
    } else if (authHeader?.startsWith('Bearer ')) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user) {
        const { data: roleRow } = await supabaseAuth
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        if (roleRow) authorized = true;
      }
    }

    if (!authorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obtener alertas de documentos próximos a vencer
    const { data: alerts, error: alertsError } = await supabase
      .rpc('get_document_expiry_alerts');

    if (alertsError) {
      console.error('Error fetching document alerts:', alertsError);
      throw alertsError;
    }

    const documentAlerts = alerts as DocumentAlert[];
    console.log(`Found ${documentAlerts.length} document alerts to process`);

    // Obtener usuarios administradores para notificar
    const { data: adminUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'admin')
      .eq('is_active', true);

    if (usersError) {
      console.error('Error fetching admin users:', usersError);
      throw usersError;
    }

    const notifications = [];

    // Crear notificaciones para cada alerta
    for (const alert of documentAlerts) {
      const documentName = getDocumentName(alert.document_type);
      const urgencyLevel = getUrgencyLevel(alert.days_until_expiry);
      
      for (const user of adminUsers) {
        const notification = {
          user_id: user.id,
          type: 'document_expiry',
          title: `${urgencyLevel.title}: ${documentName} - Grúa ${alert.crane_license_plate}`,
          body: urgencyLevel.expired 
            ? `El documento ${documentName} de la grúa ${alert.crane_license_plate} venció hace ${Math.abs(alert.days_until_expiry)} días.`
            : `El documento ${documentName} de la grúa ${alert.crane_license_plate} vence en ${alert.days_until_expiry} días.`,
          data: {
            crane_id: alert.crane_id,
            document_type: alert.document_type,
            expiry_date: alert.expiry_date,
            days_until_expiry: alert.days_until_expiry
          },
          status: 'pending'
        };

        notifications.push(notification);
      }
    }

    // Insertar notificaciones en la base de datos
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notification_logs')
        .insert(notifications);

      if (insertError) {
        console.error('Error inserting notifications:', insertError);
        throw insertError;
      }

      console.log(`Created ${notifications.length} notifications for document alerts`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        alerts_processed: documentAlerts.length,
        notifications_created: notifications.length,
        message: `Processed ${documentAlerts.length} document alerts and created ${notifications.length} notifications`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in send-document-alerts function:', error);
    return new Response(
      JSON.stringify({ 
        error: "Error en el servicio de alertas de documentos",
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function getDocumentName(documentType: string): string {
  switch (documentType) {
    case 'technical_review':
      return 'Revisión Técnica';
    case 'insurance':
      return 'Seguro';
    case 'circulation_permit':
      return 'Permiso de Circulación';
    default:
      return 'Documento';
  }
}

function getUrgencyLevel(daysUntilExpiry: number) {
  if (daysUntilExpiry <= 0) {
    return {
      title: 'VENCIDO',
      expired: true
    };
  } else if (daysUntilExpiry <= 7) {
    return {
      title: 'URGENTE',
      expired: false
    };
  } else if (daysUntilExpiry <= 15) {
    return {
      title: 'IMPORTANTE',
      expired: false
    };
  } else {
    return {
      title: 'AVISO',
      expired: false
    };
  }
}