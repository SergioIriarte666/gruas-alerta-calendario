import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = process.cwd();
const pwaRoot = resolve(workspaceRoot, "src/components/pwa");

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : collectSourceFiles(absolutePath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });

const protectedFiles = collectSourceFiles(pwaRoot);
const rawPaletteClass =
  /(?:text|bg|border(?:-[trblxy])?|ring|fill|stroke|from|via|to|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-[0-9]+)?(?:\/[0-9]+)?/g;
const legacyTmsClass =
  /(?:text|bg|border(?:-[trblxy])?|ring|fill|stroke|from|via|to|shadow)-tms-[a-z0-9-]+(?:\/[0-9]+)?/g;
const fixedPixelUtility = /[a-z-]+-\[[0-9.]+px\]/g;
const rawTokenUtility = /\[[^\]]*hsl\(var\(/g;
const rawHexColor = /(?<!&)#[0-9a-f]{3,8}\b/gi;
const rawRgbColor = /rgba?\(/g;
const rawHslColor = /hsla?\(\s*\d/g;
const malformedSemanticClass =
  /(?:(?:soft|muted|foreground|card|border|primary|info|success|warning|danger)\d|\/\d+\/\d+)/g;

describe("contrato visual de PWA", () => {
  it.each(protectedFiles)("mantiene estilos semánticos en %s", (file) => {
    const source = readFileSync(file, "utf8");
    const label = relative(workspaceRoot, file);

    expect(source.match(rawHexColor), `${label} contiene colores hexadecimales`).toBeNull();
    expect(source.match(rawRgbColor), `${label} contiene colores RGB directos`).toBeNull();
    expect(source.match(rawHslColor), `${label} contiene colores HSL directos`).toBeNull();
    expect(source.match(rawPaletteClass), `${label} contiene colores Tailwind directos`).toBeNull();
    expect(source.match(legacyTmsClass), `${label} contiene aliases visuales legacy`).toBeNull();
    expect(source.match(fixedPixelUtility), `${label} contiene utilidades fijas en píxeles`).toBeNull();
    expect(source.match(rawTokenUtility), `${label} contiene tokens HSL en utilidades arbitrarias`).toBeNull();
    expect(source.match(malformedSemanticClass), `${label} contiene una clase semántica mal formada`).toBeNull();
  });
});
