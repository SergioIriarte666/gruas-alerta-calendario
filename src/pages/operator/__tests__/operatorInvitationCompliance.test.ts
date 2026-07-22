import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readWorkspaceFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

describe('invitaciones seguras de operadores', () => {
  const migrationPath =
    'supabase/migrations/20260722180000_secure_operator_invitation_autoapproval.sql';

  it('autoaprueba únicamente operadores invitados por un administrador', () => {
    const migration = readWorkspaceFile(migrationPath);

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.finalize_user_invitation');
    expect(migration).toContain(
      "NOT public.has_role(invitation_creator_id, 'admin'::public.app_role)",
    );
    expect(migration).toContain("IF requested_role = 'operator'::public.app_role THEN");
    expect(migration).toContain("status = 'approved'");
    expect(migration).toContain("role = 'viewer'::public.app_role");
    expect(migration).toContain("status = 'pending'");
  });

  it('bloquea reutilización y carreras al vincular la ficha del operador', () => {
    const migration = readWorkspaceFile(migrationPath);

    expect(migration).toContain('FOR UPDATE;');
    expect(migration).toContain('ON CONFLICT (user_id) DO UPDATE');
    expect(migration).toContain('La ficha de operador ya esta vinculada a otra cuenta');
    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_user_invitations_operator_id');
  });

  it('expone las funciones críticas solo al service_role', () => {
    const migration = readWorkspaceFile(migrationPath);

    expect(migration).toContain(
      'FROM PUBLIC, anon, authenticated;',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.repair_operator_invitation(uuid)\n  TO service_role;',
    );
    expect(migration).toContain(
      'REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_invitations FROM authenticated;',
    );
  });

  it('compensa la creación Auth si falla la transacción de invitación', () => {
    const invitationFunction = readWorkspaceFile(
      'supabase/functions/send-user-invitation/index.ts',
    );

    expect(invitationFunction).toContain('"finalize_user_invitation"');
    expect(invitationFunction).toContain('if (!operatorId)');
    expect(invitationFunction).toContain('await supabaseAdmin.auth.admin.deleteUser(createdUserId)');
    expect(invitationFunction).not.toContain("status: 'approved'");
  });

  it('repara la invitación usando exclusivamente la identidad del JWT', () => {
    const repairFunction = readWorkspaceFile(
      'supabase/functions/repair-invited-user-profile/index.ts',
    );

    expect(repairFunction).toContain('await supabaseAdmin.auth.getUser(token)');
    expect(repairFunction).toContain('"repair_operator_invitation"');
    expect(repairFunction).toContain('{ target_user_id: user.id }');
    expect(repairFunction).not.toMatch(/target_user_id:\s*body/);
  });
});
