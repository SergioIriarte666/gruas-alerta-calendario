import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = process.cwd();
const settingsRoot = resolve(workspaceRoot, "src/components/settings");

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : collectSourceFiles(absolutePath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });

const protectedFiles = [
  ...collectSourceFiles(settingsRoot),
  resolve(workspaceRoot, "src/pages/Settings.tsx"),
];
const rawPaletteClass =
  /(?:text|bg|border(?:-[trblxy])?|ring|fill|stroke|from|via|to|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-[0-9]+)?(?:\/[0-9]+)?/g;
const legacyTmsClass =
  /(?:text|bg|border(?:-[trblxy])?|ring|fill|stroke|from|via|to|shadow)-tms-[a-z0-9-]+(?:\/[0-9]+)?/g;
const fixedPixelUtility = /[a-z-]+-\[[0-9.]+px\]/g;
const rawHexColor = /(?<!&)#[0-9a-f]{3,8}\b/gi;
const rawRgbColor = /rgba?\(/g;
const rawHslColor = /hsla?\(\s*\d/g;
const malformedSemanticClass =
  /(?:(?:soft|muted|foreground|card|border|primary|info|success|warning|danger)\d|\/\d+\/\d+)/g;

describe("contrato visual de Configuración", () => {
  it.each(protectedFiles)("mantiene estilos semánticos en %s", (file) => {
    const source = readFileSync(file, "utf8");
    const label = relative(workspaceRoot, file);

    expect(
      source.match(rawHexColor),
      `${label} contiene colores hexadecimales`,
    ).toBeNull();
    expect(
      source.match(rawRgbColor),
      `${label} contiene colores RGB directos`,
    ).toBeNull();
    expect(
      source.match(rawHslColor),
      `${label} contiene colores HSL directos`,
    ).toBeNull();
    expect(
      source.match(rawPaletteClass),
      `${label} contiene colores Tailwind directos`,
    ).toBeNull();
    expect(
      source.match(legacyTmsClass),
      `${label} contiene aliases visuales legacy`,
    ).toBeNull();
    expect(
      source.match(fixedPixelUtility),
      `${label} contiene utilidades fijas en píxeles`,
    ).toBeNull();
    expect(
      source.match(malformedSemanticClass),
      `${label} contiene una clase semántica mal formada`,
    ).toBeNull();
  });

  it("reserva el ancho completo para el contenido de configuración", () => {
    const source = readFileSync(
      resolve(workspaceRoot, "src/pages/Settings.tsx"),
      "utf8",
    );

    expect(source).not.toContain("lg:grid-cols-[18rem_minmax(0,1fr)]");
    expect(source).not.toContain("<aside");
    expect(source).toContain('aria-label="Secciones de configuración"');
    expect(source).toContain('className="hidden xl:block"');
  });

  it("divide las configuraciones extensas en vistas internas", () => {
    const settingsSource = readFileSync(
      resolve(workspaceRoot, "src/pages/Settings.tsx"),
      "utf8",
    );
    const systemSource = readFileSync(
      resolve(workspaceRoot, "src/components/settings/SystemSettingsTab.tsx"),
      "utf8",
    );

    for (const panel of ["general", "invoices", "email", "whatsapp"]) {
      expect(settingsSource).toContain(`TabsContent value="${panel}"`);
    }

    for (const panel of ["general", "daily-report", "backups", "pdf-reports"]) {
      expect(systemSource).toContain(`TabsContent value="${panel}"`);
    }
  });

  it("mantiene el Centro de recuperación dentro del lenguaje visual de Configuración", () => {
    const source = readFileSync(
      resolve(workspaceRoot, "src/components/settings/RecoveryCenterTab.tsx"),
      "utf8",
    );

    expect(source).not.toContain("bg-foreground");
    expect(source).not.toContain("text-background");
    expect(source).not.toContain("blur-3xl");
    expect(source).toContain("border-border/70 bg-card/80 shadow-sm");
  });

  it("centraliza los catálogos administrativos y conserva Respaldos como atajo", () => {
    const settingsSource = readFileSync(
      resolve(workspaceRoot, "src/pages/Settings.tsx"),
      "utf8",
    );
    const sidebarSource = readFileSync(
      resolve(workspaceRoot, "src/components/layout/Sidebar.tsx"),
      "utf8",
    );
    const appSource = readFileSync(resolve(workspaceRoot, "src/App.tsx"), "utf8");

    for (const section of ["service-types", "service-rates", "cost-centers"]) {
      expect(settingsSource).toContain(`value: "${section}"`);
      expect(sidebarSource).not.toContain(`href: '/${section}'`);
      expect(appSource).toContain(`to="/settings#${section}"`);
    }

    expect(sidebarSource).toContain("href: '/settings#respaldos'");
  });
});
