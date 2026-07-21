import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workspaceRoot = process.cwd();
const sourceRoot = resolve(workspaceRoot, 'src');
const docsRoot = resolve(workspaceRoot, 'docs');

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === 'integrations'
        ? []
        : collectSourceFiles(absolutePath);
    }

    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [absolutePath] : [];
  });

const protectedFiles = collectSourceFiles(sourceRoot);

const collectMarkdownFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return collectMarkdownFiles(absolutePath);
    return entry.name.endsWith('.md') ? [absolutePath] : [];
  });

const documentedFiles = collectMarkdownFiles(docsRoot);

const rules: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'clase de color Tailwind basada en una paleta física',
    pattern: /(?:text|bg|border|ring|from|via|to|shadow|fill|stroke)-(?:white|black|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|tms)(?:-[0-9]+)?(?:\/[0-9]+)?\b/g,
  },
  {
    label: 'valor de color arbitrario en una utilidad Tailwind',
    pattern: /(?:text|bg|border|ring|from|via|to|shadow|fill|stroke)-\[[^\]]+\]/g,
  },
  {
    label: 'medida Tailwind fija en píxeles',
    pattern: /(?:w|h|min-w|max-w|min-h|max-h|text|rounded)-\[[0-9.]+px\]/g,
  },
  {
    label: 'tamaño tipográfico fraccionario fuera de la escala',
    pattern: /text-\[[0-9.]+rem\]/g,
  },
  {
    label: 'color hexadecimal directo',
    pattern: /(?<![&\w])#(?=[0-9a-f]{3,8}\b)(?=[0-9a-f]*[a-f])[0-9a-f]{3,8}\b|#(?:000|000000|fff|ffffff)\b/gi,
  },
  {
    label: 'color RGB directo',
    pattern: /rgba?\(/g,
  },
  {
    label: 'color HSL numérico directo',
    pattern: /hsla?\(\s*[0-9]/g,
  },
  {
    label: 'opacidad semántica mal formada',
    pattern: /(?:text|bg|border|ring|from|via|to)-[a-z-]*(?:soft\d+|\/\d+\/\d+)/g,
  },
];

// El blanco es parte del contenido de salida: al convertir PNG transparente a
// JPEG se necesita un fondo opaco y no participa del tema de la interfaz.
const outputColorExceptions = new Set(['src/utils/imageCompression.ts']);

describe('contrato visual global', () => {
  it('mantiene toda la interfaz vinculada a roles semánticos', () => {
    const violations: string[] = [];

    for (const file of protectedFiles) {
      const label = relative(workspaceRoot, file);
      const source = readFileSync(file, 'utf8');

      for (const rule of rules) {
        if (rule.label === 'color hexadecimal directo' && outputColorExceptions.has(label)) continue;
        const matches = source.match(rule.pattern);
        if (matches) violations.push(`${label}: ${rule.label}: ${[...new Set(matches)].join(', ')}`);
      }
    }

    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('mantiene una sola guía vigente y documentación sin estilos físicos', () => {
    const violations: string[] = [];
    const physicalClass = rules[0].pattern;
    const directHex = rules[4].pattern;

    for (const file of documentedFiles) {
      const label = relative(workspaceRoot, file);
      const source = readFileSync(file, 'utf8');
      const matches = [...(source.match(physicalClass) ?? []), ...(source.match(directHex) ?? [])];
      if (matches.length) violations.push(`${label}: ${[...new Set(matches)].join(', ')}`);
    }

    const guide = readFileSync(resolve(docsRoot, 'design-system.md'), 'utf8');
    const index = readFileSync(resolve(docsRoot, 'README.md'), 'utf8');
    expect(guide).not.toMatch(/migraci[oó]n pendiente/i);
    expect(index).toContain('[Guía visual](design-system.md)');
    expect(violations, violations.join('\n')).toEqual([]);
  });
});
