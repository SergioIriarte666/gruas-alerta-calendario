import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = process.cwd();
const portalRoots = [
  resolve(workspaceRoot, "src/pages/portal"),
  resolve(workspaceRoot, "src/components/portal"),
];

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : collectSourceFiles(absolutePath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });

const portalFiles = portalRoots.flatMap(collectSourceFiles);

const rawPaletteClass =
  /(?:text|bg|border|ring|from|via|to)-(?:slate|gray|zinc|neutral|red|green|blue|yellow|amber|orange|purple|violet|cyan|teal|emerald|indigo|white|black)(?:-[0-9]+)?(?:\/[0-9]+)?/g;
const fixedPixelUtility = /[a-z-]+-\[[0-9.]+px\]/g;
const rawHexColor = /#[0-9a-f]{3,8}\b/gi;

describe("contrato visual del Portal", () => {
  it.each(portalFiles)("usa tokens semánticos en %s", (file) => {
    const source = readFileSync(file, "utf8");
    const label = relative(workspaceRoot, file);

    expect(source.match(rawHexColor), `${label} contiene colores hexadecimales`).toBeNull();
    expect(source.match(rawPaletteClass), `${label} contiene colores Tailwind directos`).toBeNull();
    expect(source.match(fixedPixelUtility), `${label} contiene utilidades fijas en píxeles`).toBeNull();
    expect(source, `${label} contiene una clase de color mal formada`).not.toContain("soft0");
  });

  it("mantiene el shell A+C y el selector de tema", () => {
    const layout = readFileSync(
      resolve(
        workspaceRoot,
        "src/components/portal/layout/PortalLayout.tsx",
      ),
      "utf8",
    );
    const header = readFileSync(
      resolve(
        workspaceRoot,
        "src/components/portal/layout/PortalHeader.tsx",
      ),
      "utf8",
    );

    expect(layout).toContain("portal-client-shell");
    expect(layout).toContain("portal-client-sidebar-frame");
    expect(header).toContain("<ThemeSelector");
    expect(header).toContain("portal-client-search");
  });

  it("conserva el recorrido guiado en el dashboard", () => {
    const dashboard = readFileSync(
      resolve(workspaceRoot, "src/pages/portal/PortalDashboard.tsx"),
      "utf8",
    );

    expect(dashboard).toContain("portal-service-journey");
    expect(dashboard).toContain("useClientBranding");
    expect(dashboard).toContain("portal-dashboard-heading__email");
    expect(dashboard).toContain("Servicio confirmado");
    expect(dashboard).toContain("En camino al destino");
    expect(dashboard).toContain("Entrega en destino");
  });

  it("usa el encabezado común en las páginas operativas", () => {
    const pageNames = [
      "PortalServices.tsx",
      "PortalPurchaseOrders.tsx",
      "PortalRequestService.tsx",
      "PortalInvoices.tsx",
      "PortalAccount.tsx",
    ];

    pageNames.forEach((pageName) => {
      const page = readFileSync(
        resolve(workspaceRoot, "src/pages/portal", pageName),
        "utf8",
      );
      expect(page, `${pageName} no usa PortalPageHeader`).toContain(
        "<PortalPageHeader",
      );
    });
  });

  it("permite buscar tipos de servicio en la solicitud", () => {
    const requestPage = readFileSync(
      resolve(workspaceRoot, "src/pages/portal/PortalRequestService.tsx"),
      "utf8",
    );
    const serviceCombobox = readFileSync(
      resolve(
        workspaceRoot,
        "src/components/portal/PortalServiceTypeCombobox.tsx",
      ),
      "utf8",
    );

    expect(requestPage).toContain("<PortalServiceTypeCombobox");
    expect(serviceCombobox).toContain("<CommandInput");
    expect(serviceCombobox).toContain("Buscar servicio por nombre...");
  });

  it("usa alto contraste en acciones y avatares del portal", () => {
    const portalStyles = readFileSync(
      resolve(workspaceRoot, "src/styles/portal-client.css"),
      "utf8",
    );

    expect(portalStyles).toContain(
      "--portal-action-foreground: 0 0% 100%",
    );
    expect(portalStyles).toContain(
      "color: hsl(var(--portal-action-foreground))",
    );
    expect(portalStyles).toContain("--portal-action: 191 76% 25%");
    expect(portalStyles).toContain("--primary: 191 76% 25%");
    expect(portalStyles).not.toMatch(/--portal-action:\s*270/);
  });

  it("ofrece en el portal solo servicios propios e independientes", () => {
    const portalServiceTypes = readFileSync(
      resolve(
        workspaceRoot,
        "src/hooks/portal/useServiceTypesForPortal.ts",
      ),
      "utf8",
    );

    expect(portalServiceTypes).toContain(
      "CLIENT_PORTAL_SERVICE_CATEGORIES = ['in_situ', 'traslado']",
    );
    expect(portalServiceTypes).toContain(
      ".eq('available_in_client_portal', true)",
    );
    expect(portalServiceTypes).toContain(".eq('is_outsourced', false)");
    expect(portalServiceTypes).toContain(
      ".in('service_category', CLIENT_PORTAL_SERVICE_CATEGORIES)",
    );
  });

  it("excluye del portal las facturas con folio histórico", () => {
    const clientInvoices = readFileSync(
      resolve(workspaceRoot, "src/hooks/portal/useClientInvoices.ts"),
      "utf8",
    );

    expect(clientInvoices).toContain(
      ".not('folio', 'ilike', 'HIST-%')",
    );
  });

  it("incorpora gestión de cuenta con preferencias y seguridad", () => {
    const accountPage = readFileSync(
      resolve(workspaceRoot, "src/pages/portal/PortalAccount.tsx"),
      "utf8",
    );
    const appRoutes = readFileSync(
      resolve(workspaceRoot, "src/App.tsx"),
      "utf8",
    );
    const header = readFileSync(
      resolve(
        workspaceRoot,
        "src/components/portal/layout/PortalHeader.tsx",
      ),
      "utf8",
    );
    const migration = readFileSync(
      resolve(
        workspaceRoot,
        "supabase/migrations/20260723233000_client_portal_account_preferences.sql",
      ),
      "utf8",
    );

    expect(accountPage).toContain('value="profile"');
    expect(accountPage).toContain('value="company"');
    expect(accountPage).toContain('value="preferences"');
    expect(accountPage).toContain('value="security"');
    expect(accountPage).toContain("verifyPassword(currentPassword)");
    expect(appRoutes).toContain('path="account" element={<PortalAccount />}');
    expect(header).toContain('navigate("/portal/account")');
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.client_portal_preferences",
    );
    expect(migration).toContain("auth.uid() = user_id");
  });

  it("permite gestionar únicamente el avatar propio", () => {
    const avatarMigration = readFileSync(
      resolve(
        workspaceRoot,
        "supabase/migrations/20260723235000_fix_avatar_storage_rls.sql",
      ),
      "utf8",
    );
    const accountPage = readFileSync(
      resolve(workspaceRoot, "src/pages/portal/PortalAccount.tsx"),
      "utf8",
    );
    const profilePolicyMigration = readFileSync(
      resolve(
        workspaceRoot,
        "supabase/migrations/20260724030500_fix_profile_self_update_recursion.sql",
      ),
      "utf8",
    );

    expect(avatarMigration).toContain("CREATE POLICY avatars_select_own");
    expect(avatarMigration).toContain("CREATE POLICY avatars_insert_own");
    expect(avatarMigration).toContain("CREATE POLICY avatars_update_own");
    expect(avatarMigration).toContain(
      "(storage.foldername(name))[1] = auth.uid()::text",
    );
    expect(accountPage).toContain('const path = `${user.id}/avatar.${extension}`');
    expect(accountPage).toContain('status === "error"');
    expect(profilePolicyMigration).toContain(
      "CREATE POLICY \"profiles_update_own\"",
    );
    expect(profilePolicyMigration).toContain(
      "CREATE TRIGGER protect_profile_sensitive_fields_before_update",
    );
  });

  it("ofrece canales operativos desde el acceso de soporte", () => {
    const supportDialog = readFileSync(
      resolve(
        workspaceRoot,
        "src/components/portal/PortalSupportDialog.tsx",
      ),
      "utf8",
    );
    const sidebar = readFileSync(
      resolve(
        workspaceRoot,
        "src/components/portal/layout/PortalSidebar.tsx",
      ),
      "utf8",
    );

    expect(sidebar).toContain("<PortalSupportDialog");
    expect(sidebar).toContain("operationalContactPhone");
    expect(supportDialog).toContain('aria-label="Abrir soporte operacional"');
    expect(supportDialog).toContain("tel:+");
    expect(supportDialog).toContain("https://wa.me/");
    expect(supportDialog).toContain("mailto:");
  });

  it("mantiene completo el diálogo de eliminación de cuenta", () => {
    const deleteAccount = readFileSync(
      resolve(
        workspaceRoot,
        "src/components/account/DeleteAccountSection.tsx",
      ),
      "utf8",
    );
    const portalStyles = readFileSync(
      resolve(workspaceRoot, "src/styles/portal-client.css"),
      "utf8",
    );

    expect(deleteAccount).toContain("portal-delete-account-dialog");
    expect(deleteAccount).toContain(
      "portal-delete-account-dialog__actions !grid grid-cols-1",
    );
    expect(portalStyles).toContain(
      ".portal-delete-account-dialog__description",
    );
    expect(portalStyles).toContain("overflow-wrap: anywhere");
    expect(portalStyles).toContain("overflow-x: hidden");
  });
});
