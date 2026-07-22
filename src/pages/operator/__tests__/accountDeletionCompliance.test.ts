import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readWorkspaceFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('eliminación de cuenta del Portal Operador', () => {
  it('mantiene Mi perfil visible y enrutado desde la cabecera', () => {
    const appSource = readWorkspaceFile('src/App.tsx');
    const layoutSource = readWorkspaceFile('src/components/layout/OperatorLayout.tsx');
    const profileSource = readWorkspaceFile('src/pages/operator/OperatorProfile.tsx');

    expect(appSource).toContain('<Route path="profile" element={<OperatorProfile />} />');
    expect(layoutSource).toContain('to="/operator/profile"');
    expect(layoutSource).toContain('aria-label="Abrir Mi perfil"');
    expect(profileSource).toContain('<DeleteAccountSection />');
  });

  it('deriva la identidad de la sesión y exige confirmación explícita', () => {
    const componentSource = readWorkspaceFile('src/components/account/DeleteAccountSection.tsx');
    const functionSource = readWorkspaceFile('supabase/functions/delete-my-account/index.ts');

    expect(componentSource).toContain("const CONFIRMATION_TEXT = 'ELIMINAR'");
    expect(componentSource).toContain('/functions/v1/delete-my-account');
    expect(functionSource).toContain('body?.confirmation !== "ELIMINAR"');
    expect(functionSource).toContain('target_user_id: user.id');
    expect(functionSource).not.toMatch(/const\s*\{[^}]*userId[^}]*\}\s*=\s*await req\.json/);
  });

  it('protege el borrado definitivo para que solo lo ejecute el backend', () => {
    const migrationSource = readWorkspaceFile(
      'supabase/migrations/20260722170000_self_service_account_deletion.sql',
    );
    const configSource = readWorkspaceFile('supabase/config.toml');

    expect(migrationSource).toContain('DELETE FROM auth.users WHERE id = target_user_id');
    expect(migrationSource).toContain(
      'GRANT EXECUTE ON FUNCTION public.delete_account_permanently(uuid) TO service_role',
    );
    expect(migrationSource).toContain(
      'REVOKE ALL ON FUNCTION public.delete_account_permanently(uuid) FROM authenticated',
    );
    expect(configSource).toContain('[functions.delete-my-account]\nverify_jwt = true');
  });
});
