// Patrones sincronizados con is_test_user_email() en
// supabase/migrations/20260625020000_operator_user_link_safety.sql.
// Si modificas estos, modifica también la función SQL en el mismo commit.
export const TEST_EMAIL_PATTERNS: RegExp[] = [
  /^pagos@/i,
  /\+test@/i,
  /@example\./i,
  /@test\./i,
  /^test.*@/i,
  /^prueba.*@/i,
  /^demo.*@/i,
  /^dummy.*@/i,
];

export function isTestUserEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return TEST_EMAIL_PATTERNS.some((rx) => rx.test(normalized));
}
