import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = process.cwd();
const protectedRoots = [
  resolve(workspaceRoot, "src/components/operator"),
  resolve(workspaceRoot, "src/components/auth"),
];
const authFiles = [
  "src/pages/Auth.tsx",
  "src/pages/Register.tsx",
  "src/pages/ResetPassword.tsx",
  "src/pages/PendingApproval.tsx",
  "src/pages/PendingUsers.tsx",
].map((file) => resolve(workspaceRoot, file));

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : collectSourceFiles(absolutePath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });

const protectedFiles = [...protectedRoots.flatMap(collectSourceFiles), ...authFiles];
const rawPaletteClass =
  /(?:text|bg|border(?:-[trblxy])?|ring|fill|stroke|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-[0-9]+)?(?:\/[0-9]+)?/g;
const fixedPixelUtility = /[a-z-]+-\[[0-9.]+px\]/g;
const rawHexColor = /(?<!&)#[0-9a-f]{3,8}\b/gi;
const rawRgbColor = /rgba?\(/g;
const malformedOpacity = /(?:soft\d|\/\d+\/\d+)/g;

describe("contrato visual de operación y autenticación", () => {
  it.each(protectedFiles)("mantiene estilos semánticos en %s", (file) => {
    const source = readFileSync(file, "utf8");
    const label = relative(workspaceRoot, file);

    expect(source.match(rawHexColor), `${label} contiene colores hexadecimales`).toBeNull();
    expect(source.match(rawRgbColor), `${label} contiene colores RGB directos`).toBeNull();
    expect(source.match(rawPaletteClass), `${label} contiene colores Tailwind directos`).toBeNull();
    expect(source.match(fixedPixelUtility), `${label} contiene utilidades fijas en píxeles`).toBeNull();
    expect(source.match(malformedOpacity), `${label} contiene una opacidad mal formada`).toBeNull();
  });
});
