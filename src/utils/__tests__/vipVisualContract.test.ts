import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = process.cwd();
const vipRoot = resolve(workspaceRoot, "src/components/vip");

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : collectSourceFiles(absolutePath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });

const vipFiles = collectSourceFiles(vipRoot);
const rawPaletteClass =
  /(?:text|bg|border(?:-[trblxy])?|ring|fill|stroke|from|via|to|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-[0-9]+)?(?:\/[0-9]+)?/g;
const fixedPixelUtility = /[a-z-]+-\[[0-9.]+px\]/g;
const rawHexColor = /(?<!&)#[0-9a-f]{3,8}\b/gi;
const rawRgbColor = /rgba?\(/g;
const rawHslColor = /hsla?\(\s*\d/g;
const malformedSemanticClass = /(?:(?:soft|muted|foreground|card|border)\d|\/\d+\/\d+)/g;

describe("contrato visual del módulo VIP", () => {
  it.each(vipFiles)("mantiene estilos semánticos en %s", (file) => {
    const source = readFileSync(file, "utf8");
    const label = relative(workspaceRoot, file);

    expect(source.match(rawHexColor), `${label} contiene colores hexadecimales`).toBeNull();
    expect(source.match(rawRgbColor), `${label} contiene colores RGB directos`).toBeNull();
    expect(source.match(rawHslColor), `${label} contiene colores HSL directos`).toBeNull();
    expect(source.match(rawPaletteClass), `${label} contiene colores Tailwind directos`).toBeNull();
    expect(source.match(fixedPixelUtility), `${label} contiene utilidades fijas en píxeles`).toBeNull();
    expect(source.match(malformedSemanticClass), `${label} contiene una clase semántica mal formada`).toBeNull();
  });
});
