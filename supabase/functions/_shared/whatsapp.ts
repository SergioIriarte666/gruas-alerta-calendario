export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  parameters: string[],
): Promise<{ success: boolean; messageId?: string; error?: unknown }> {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const token = Deno.env.get('WHATSAPP_TOKEN');

  if (!phoneNumberId || !token) {
    return {
      success: false,
      error: {
        code: 'MISSING_WHATSAPP_SECRETS',
        message: 'Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN',
      },
    };
  }

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'es_CL' },
      components: [
        {
          type: 'body',
          parameters: parameters.map((text) => ({ type: 'text', text })),
        },
      ],
    },
  };

  const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) return { success: false, error: data };

  console.log('WhatsApp enviado:', { to, templateName, messageId: data.messages?.[0]?.id });
  return { success: true, messageId: data.messages?.[0]?.id };
}

export function normalizeChileanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('56')) return digits;
  if (digits.startsWith('9') && digits.length === 9) return `56${digits}`;
  if (digits.startsWith('0')) return `56${digits.slice(1)}`;
  return `56${digits}`;
}

export async function notifyAdmins(templateName: string, parameters: string[]): Promise<void> {
  const numbers = [Deno.env.get('ADMIN_WHATSAPP_1'), Deno.env.get('ADMIN_WHATSAPP_2')].filter(
    Boolean,
  ) as string[];

  await Promise.all(numbers.map((n) => sendWhatsAppTemplate(n, templateName, parameters)));
}
