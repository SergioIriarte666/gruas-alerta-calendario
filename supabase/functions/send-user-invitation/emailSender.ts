
import { Resend } from "npm:resend@2.0.0";

export interface EmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

export const sendInvitationEmail = async (resend: Resend, payload: EmailPayload) => {
  console.log('Attempting to send email...');

  const emailResponse = await resend.emails.send(payload);

  console.log('Email response:', emailResponse);

  if (emailResponse.error) {
    console.error('Resend API error:', emailResponse.error);
    throw new Error(`Error enviando email: ${emailResponse.error.message}`);
  }

  console.log('Email sent successfully:', emailResponse.data);
  return emailResponse;
};
