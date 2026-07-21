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
});
