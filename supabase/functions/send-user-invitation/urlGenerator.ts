
export const generateRegistrationUrl = (req: Request, email: string): string => {
  const url = new URL(req.url);
  const origin = req.headers.get('origin') || 'https://gruas5norte.com';
  return `${origin}/auth?tab=register&email=${encodeURIComponent(email)}&invited=true`;
};
