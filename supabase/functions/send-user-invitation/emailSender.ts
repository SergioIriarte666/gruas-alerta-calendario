
import { Resend } from "npm:resend@2.0.0";

export interface EmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

export const sendInvitationEmail = async (resend: Resend, payload: EmailPayload) => {
  console.log('📧 Attempting to send email with payload:', {
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    htmlLength: payload.html.length
  });

  try {
    const emailResponse = await resend.emails.send(payload);

    console.log('📬 Resend API response:', {
      success: !emailResponse.error,
      data: emailResponse.data,
      error: emailResponse.error
    });

    if (emailResponse.error) {
      console.error('❌ Resend API error details:', {
        name: emailResponse.error.name,
        message: emailResponse.error.message,
        code: (emailResponse.error as any).code
      });
      throw new Error(`Error enviando email: ${emailResponse.error.message}`);
    }

    if (!emailResponse.data?.id) {
      console.error('❌ Email sent but no ID returned:', emailResponse);
      throw new Error('Email enviado pero sin ID de confirmación');
    }

    console.log('✅ Email sent successfully with ID:', emailResponse.data.id);
    return emailResponse;

  } catch (error: any) {
    console.error('💥 Error in sendInvitationEmail:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};
