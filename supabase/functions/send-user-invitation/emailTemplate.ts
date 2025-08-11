
import { EmailTemplateData } from './types.ts';

export const generateEmailHtml = (data: EmailTemplateData): string => {
  const { businessName, fullName, email, roleLabel, clientName, registerUrl, role, supportEmail, companyPhone } = data;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Invitación al Sistema ${businessName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .btn { 
            display: inline-block; 
            background: #10b981; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 20px 0;
            font-weight: bold;
          }
          .info-box { background: #e0f2fe; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; }
          .warning-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Bienvenido a ${businessName}!</h1>
          </div>
          
          <div class="content">
            <h2>Hola ${fullName},</h2>
            
            <p>Has sido invitado a formar parte del sistema de gestión de ${businessName}. Un administrador ha creado tu cuenta con los siguientes detalles:</p>
            
            <div class="info-box">
              <strong>📧 Email:</strong> ${email}<br>
              <strong>👤 Rol asignado:</strong> ${roleLabel}<br>
              ${clientName ? `<strong>🏢 Cliente asociado:</strong> ${clientName}<br>` : ''}
              <strong>📅 Fecha de invitación:</strong> ${new Date().toLocaleDateString('es-CL')}
            </div>
            
            <h3>¿Qué sigue?</h3>
            <p>Para completar tu registro y acceder al sistema, haz clic en el siguiente botón:</p>
            
            <div style="text-align: center;">
              <a href="${registerUrl}" class="btn">Completar Registro</a>
            </div>
            
            <div class="warning-box">
              <strong>⚠️ Importante:</strong> Si el botón no funciona, copia y pega esta URL en tu navegador:<br>
              <code>${registerUrl}</code>
            </div>
            
            <p><strong>Instrucciones:</strong></p>
            <ol>
              <li>Haz clic en el botón "Completar Registro" o usa la URL proporcionada</li>
              <li>Crea tu contraseña segura</li>
              <li>Confirma tu registro</li>
              <li>¡Ya podrás acceder al sistema con tu rol de ${roleLabel}!</li>
            </ol>
            
            <div class="info-box">
              <strong>📋 Acerca de tu rol (${roleLabel}):</strong><br>
              ${getRoleDescription(role)}
            </div>
            
            <p>Si tienes alguna duda o necesitas ayuda, no dudes en contactarnos:</p>
            <p>📧 <a href="mailto:${supportEmail}">${supportEmail}</a></p>
            ${companyPhone ? `<p>📱 ${companyPhone}</p>` : ''}
            
            <p>¡Esperamos verte pronto en el sistema!</p>
            
            <p>Saludos cordiales,<br>
            <strong>Equipo ${businessName}</strong></p>
          </div>
          
          <div class="footer">
            <p>Este es un email automático del sistema ${businessName}.</p>
            <p>Si no esperabas esta invitación, puedes ignorar este mensaje.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

const getRoleDescription = (role: string): string => {
  switch (role) {
    case 'admin':
      return 'Tendrás acceso completo al sistema, incluyendo gestión de usuarios, configuración y todos los módulos.';
    case 'operator':
      return 'Podrás gestionar servicios, realizar inspecciones y acceder a las funciones operativas del sistema.';
    case 'viewer':
      return 'Tendrás acceso de solo lectura para consultar información del sistema.';
    case 'client':
      return 'Podrás acceder al portal de cliente para ver tus servicios, facturas y solicitar nuevos servicios.';
    default:
      return 'Tu rol te permitirá acceder a funciones específicas del sistema según los permisos asignados.';
  }
};
